package com.cesarx.analytics.security;

import jakarta.servlet.FilterChain;
import jakarta.servlet.ServletException;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import org.springframework.lang.NonNull;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.security.web.util.matcher.AntPathRequestMatcher;
import org.springframework.stereotype.Component;
import org.springframework.web.filter.OncePerRequestFilter;

import java.io.IOException;
import java.util.List;
import java.util.concurrent.ConcurrentHashMap;
import java.util.concurrent.atomic.AtomicInteger;

/**
 * Simple in-memory per-IP rate limiter for the endpoints most exposed to
 * abuse now that the app is public: open registration, and the AI proxy
 * endpoints (which burn metered NewsAPI/Anthropic quota downstream).
 * Deliberately not distributed — this runs as a single Render instance.
 */
@Component
public class RateLimitingFilter extends OncePerRequestFilter {

    private static final AntPathRequestMatcher REGISTER_MATCHER =
            new AntPathRequestMatcher("/api/auth/register", "POST");
    private static final List<AntPathRequestMatcher> AI_MATCHERS = List.of(
            new AntPathRequestMatcher("/api/ai/predict/**"),
            new AntPathRequestMatcher("/api/ai/news/**")
    );

    private static final int REGISTER_LIMIT = 5;
    private static final long REGISTER_WINDOW_MS = 60 * 60 * 1000L; // 1 hour

    private static final int AI_LIMIT = 20;
    private static final long AI_WINDOW_MS = 60 * 1000L; // 1 minute

    private final ConcurrentHashMap<String, WindowCounter> registerCounters = new ConcurrentHashMap<>();
    private final ConcurrentHashMap<String, WindowCounter> aiCounters = new ConcurrentHashMap<>();

    @Override
    protected void doFilterInternal(@NonNull HttpServletRequest request,
                                     @NonNull HttpServletResponse response,
                                     @NonNull FilterChain filterChain) throws ServletException, IOException {

        String clientKey = clientKey(request);

        if (REGISTER_MATCHER.matches(request) && exceedsLimit(registerCounters, clientKey, REGISTER_LIMIT, REGISTER_WINDOW_MS)) {
            reject(response);
            return;
        }

        if (AI_MATCHERS.stream().anyMatch(m -> m.matches(request))
                && exceedsLimit(aiCounters, clientKey, AI_LIMIT, AI_WINDOW_MS)) {
            reject(response);
            return;
        }

        filterChain.doFilter(request, response);
    }

    private String clientKey(HttpServletRequest request) {
        String forwardedFor = request.getHeader("X-Forwarded-For");
        if (forwardedFor != null && !forwardedFor.isBlank()) {
            return forwardedFor.split(",")[0].trim();
        }
        return request.getRemoteAddr();
    }

    private boolean exceedsLimit(ConcurrentHashMap<String, WindowCounter> counters, String key, int limit, long windowMs) {
        long now = System.currentTimeMillis();
        WindowCounter counter = counters.computeIfAbsent(key, k -> new WindowCounter(now));

        synchronized (counter) {
            if (now - counter.windowStart > windowMs) {
                counter.windowStart = now;
                counter.count.set(0);
            }
            return counter.count.incrementAndGet() > limit;
        }
    }

    private void reject(HttpServletResponse response) throws IOException {
        response.setStatus(429);
        response.setContentType("application/json");
        response.getWriter().write("{\"error\":\"Too Many Requests\",\"message\":\"Has alcanzado el límite de solicitudes. Intenta de nuevo más tarde.\"}");
    }

    /** Drops windows that have been idle well past their own window, so the maps don't grow unbounded. */
    @Scheduled(fixedRate = 30 * 60 * 1000L)
    public void cleanupExpiredWindows() {
        long now = System.currentTimeMillis();
        registerCounters.entrySet().removeIf(e -> now - e.getValue().windowStart > REGISTER_WINDOW_MS * 2);
        aiCounters.entrySet().removeIf(e -> now - e.getValue().windowStart > AI_WINDOW_MS * 2);
    }

    private static final class WindowCounter {
        volatile long windowStart;
        final AtomicInteger count = new AtomicInteger(0);

        WindowCounter(long windowStart) {
            this.windowStart = windowStart;
        }
    }
}
