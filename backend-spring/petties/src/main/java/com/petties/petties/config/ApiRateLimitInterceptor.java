package com.petties.petties.config;

import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.data.redis.core.StringRedisTemplate;
import org.springframework.security.authentication.AnonymousAuthenticationToken;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.stereotype.Component;
import org.springframework.web.servlet.HandlerInterceptor;

import java.io.IOException;
import java.time.Duration;
import java.time.Instant;

@Slf4j
@Component
@RequiredArgsConstructor
public class ApiRateLimitInterceptor implements HandlerInterceptor {

    private static final String KEY_PREFIX = "rate:api:";

    private final StringRedisTemplate stringRedisTemplate;

    @Value("${security.rate-limit.enabled:true}")
    private boolean enabled;

    @Value("${security.rate-limit.default-requests-per-minute:100}")
    private int defaultRequestsPerMinute;

    @Value("${security.rate-limit.auth-requests-per-minute:20}")
    private int authRequestsPerMinute;

    @Override
    public boolean preHandle(HttpServletRequest request, HttpServletResponse response, Object handler)
            throws IOException {
        if (!enabled) {
            return true;
        }

        String method = request.getMethod();
        if ("OPTIONS".equalsIgnoreCase(method) || "HEAD".equalsIgnoreCase(method)) {
            return true;
        }

        String path = request.getRequestURI();
        String bucket = resolveBucket(path);
        int limit = "auth".equals(bucket) ? authRequestsPerMinute : defaultRequestsPerMinute;

        Instant now = Instant.now();
        long bucketMinute = now.getEpochSecond() / 60;
        String identifier = resolveIdentifier(request);
        String key = KEY_PREFIX + bucket + ":" + identifier + ":" + bucketMinute;

        Long currentCount = stringRedisTemplate.opsForValue().increment(key);
        if (currentCount != null && currentCount == 1L) {
            stringRedisTemplate.expire(key, Duration.ofMinutes(2));
        }

        long count = currentCount != null ? currentCount : 0L;
        long remaining = Math.max(0L, limit - count);
        long retryAfterSeconds = 60 - (now.getEpochSecond() % 60);

        response.setHeader("X-RateLimit-Limit", String.valueOf(limit));
        response.setHeader("X-RateLimit-Remaining", String.valueOf(remaining));
        response.setHeader("X-RateLimit-Reset", String.valueOf(retryAfterSeconds));

        if (count > limit) {
            response.setStatus(429);
            response.setHeader("Retry-After", String.valueOf(retryAfterSeconds));
            response.setContentType("application/json;charset=UTF-8");
            response.getWriter().write(
                    String.format(
                            "{\"status\":429,\"error\":\"Too Many Requests\",\"message\":\"Bạn thao tác quá nhanh. Vui lòng thử lại sau %d giây.\"}",
                            retryAfterSeconds));

            log.warn("Rate limit exceeded: path={}, bucket={}, id={}, count={}, limit={}",
                    path, bucket, identifier, count, limit);
            return false;
        }

        return true;
    }

    private String resolveBucket(String path) {
        if (path == null) {
            return "default";
        }
        if (path.startsWith("/auth/") || path.startsWith("/api/auth/")) {
            return "auth";
        }
        return "default";
    }

    private String resolveIdentifier(HttpServletRequest request) {
        Authentication authentication = SecurityContextHolder.getContext().getAuthentication();
        if (authentication != null
                && authentication.isAuthenticated()
                && !(authentication instanceof AnonymousAuthenticationToken)) {
            Object principal = authentication.getPrincipal();
            if (principal instanceof UserDetailsServiceImpl.UserPrincipal userPrincipal) {
                return "user:" + userPrincipal.getUserId();
            }

            String username = authentication.getName();
            if (username != null && !username.isBlank()) {
                return "user:" + username;
            }
        }

        return "ip:" + resolveClientIp(request);
    }

    private String resolveClientIp(HttpServletRequest request) {
        String forwarded = request.getHeader("X-Forwarded-For");
        if (forwarded != null && !forwarded.isBlank()) {
            String[] parts = forwarded.split(",");
            if (parts.length > 0) {
                return parts[0].trim();
            }
        }
        return request.getRemoteAddr() != null ? request.getRemoteAddr() : "unknown";
    }
}
