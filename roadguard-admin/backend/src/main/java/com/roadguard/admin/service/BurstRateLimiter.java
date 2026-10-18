package com.roadguard.admin.service;

import org.springframework.stereotype.Service;

import java.time.Instant;
import java.util.concurrent.ConcurrentHashMap;
import java.util.concurrent.atomic.AtomicLong;

@Service
public class BurstRateLimiter {
    private record Window(long startedAt, int count) { }
    private final ConcurrentHashMap<String, Window> windows = new ConcurrentHashMap<>();
    private final AtomicLong calls = new AtomicLong();

    public boolean allow(String key, int limit, long windowSeconds) {
        long now = Instant.now().getEpochSecond();
        boolean[] allowed = {false};
        windows.compute(key, (ignored, current) -> {
            if (current == null || now - current.startedAt() >= windowSeconds) {
                allowed[0] = true;
                return new Window(now, 1);
            }
            if (current.count() >= limit) return current;
            allowed[0] = true;
            return new Window(current.startedAt(), current.count() + 1);
        });
        if ((calls.incrementAndGet() & 255) == 0) {
            windows.entrySet().removeIf(entry -> now - entry.getValue().startedAt() >= windowSeconds);
        }
        return allowed[0];
    }
}
