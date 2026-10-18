package com.roadguard.admin.service;

import io.jsonwebtoken.Claims;
import io.jsonwebtoken.JwtException;
import io.jsonwebtoken.Jwts;
import io.jsonwebtoken.security.Keys;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;

import javax.crypto.SecretKey;
import java.security.SecureRandom;
import java.time.Instant;
import java.util.Base64;
import java.util.Date;
import java.util.UUID;
import java.util.concurrent.ConcurrentHashMap;
import java.util.concurrent.ConcurrentMap;
import java.util.concurrent.atomic.AtomicLong;

@Service
public class AccessTokenService {
    private static final Logger logger = LoggerFactory.getLogger(AccessTokenService.class);
    private static final long TOKEN_TTL_SECONDS = 15 * 60;
    private final SecretKey signingKey;
    private final ConcurrentMap<String, Long> revokedTokens = new ConcurrentHashMap<>();
    private final AtomicLong validations = new AtomicLong();

    public AccessTokenService(@Value("${APP_JWT_SECRET:}") String configuredSecret) {
        if (configuredSecret != null && !configuredSecret.isBlank()) {
            try {
                byte[] keyBytes = Base64.getDecoder().decode(configuredSecret.trim());
                this.signingKey = Keys.hmacShaKeyFor(keyBytes);
            } catch (IllegalArgumentException ex) {
                throw new IllegalStateException("APP_JWT_SECRET must be a base64 encoded key of at least 256 bits", ex);
            }
        } else {
            byte[] keyBytes = new byte[32];
            new SecureRandom().nextBytes(keyBytes);
            this.signingKey = Keys.hmacShaKeyFor(keyBytes);
            logger.warn("APP_JWT_SECRET is not configured; access tokens will be invalidated when this service restarts");
        }
    }

    public String create(String username) {
        Instant now = Instant.now();
        return Jwts.builder()
                .subject(username)
                .id(UUID.randomUUID().toString())
                .issuedAt(Date.from(now))
                .expiration(Date.from(now.plusSeconds(TOKEN_TTL_SECONDS)))
                .signWith(signingKey)
                .compact();
    }

    public String subject(String token) throws JwtException {
        Claims claims = parse(token);
        Long revokedUntil = revokedTokens.get(claims.getId());
        if (revokedUntil != null && revokedUntil > Instant.now().getEpochSecond())
            throw new JwtException("Access token has been revoked");
        if ((validations.incrementAndGet() & 255) == 0) {
            long now = Instant.now().getEpochSecond();
            revokedTokens.entrySet().removeIf(entry -> entry.getValue() <= now);
        }
        return claims.getSubject();
    }

    public void revoke(String token) {
        try {
            Claims claims = parse(token);
            if (claims.getId() != null && claims.getExpiration() != null) {
                long expiresAt = claims.getExpiration().toInstant().getEpochSecond();
                if (expiresAt > Instant.now().getEpochSecond()) revokedTokens.put(claims.getId(), expiresAt);
            }
        } catch (JwtException | IllegalArgumentException ignored) {
            // Expired or invalid tokens are already unusable.
        }
    }

    private Claims parse(String token) throws JwtException {
        return Jwts.parser().verifyWith(signingKey).build().parseSignedClaims(token).getPayload();
    }

    public long ttlSeconds() { return TOKEN_TTL_SECONDS; }
}
