package com.roadguard.admin.service;

import org.springframework.stereotype.Service;
import java.security.MessageDigest;
import java.security.SecureRandom;
import java.time.Instant;
import java.util.concurrent.ConcurrentHashMap;
import java.util.concurrent.ConcurrentMap;

@Service
public class PasswordOtpService {
    private static final long TTL_SECONDS = 5 * 60;
    private static final SecureRandom RANDOM = new SecureRandom();
    private final ConcurrentMap<String, Challenge> challenges = new ConcurrentHashMap<>();
    private record Challenge(String code, Instant expiresAt) { }

    public String issue(String email, String purpose) {
        String code = String.format("%06d", RANDOM.nextInt(1_000_000));
        challenges.put(key(email, purpose), new Challenge(code, Instant.now().plusSeconds(TTL_SECONDS)));
        return code;
    }

    public boolean consume(String email, String purpose, String suppliedCode) {
        if (suppliedCode == null) return false;
        String key = key(email, purpose);
        Challenge challenge = challenges.get(key);
        if (challenge == null) return false;
        if (Instant.now().isAfter(challenge.expiresAt())) {
            challenges.remove(key, challenge);
            return false;
        }
        if (!MessageDigest.isEqual(challenge.code().getBytes(java.nio.charset.StandardCharsets.UTF_8),
                suppliedCode.getBytes(java.nio.charset.StandardCharsets.UTF_8))) return false;
        return challenges.remove(key, challenge);
    }

    public void clear(String email, String purpose) { challenges.remove(key(email, purpose)); }
    private String key(String email, String purpose) { return purpose + ":" + email.trim().toLowerCase(java.util.Locale.ROOT); }
}
