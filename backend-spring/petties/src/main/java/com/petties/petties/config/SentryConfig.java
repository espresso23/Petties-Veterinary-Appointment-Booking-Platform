package com.petties.petties.config;

import io.sentry.Sentry;
import io.sentry.SentryEvent;
import io.sentry.SentryOptions;
import io.sentry.protocol.Request;
import io.sentry.protocol.User;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.context.SecurityContextHolder;

import java.util.Map;
import java.util.regex.Pattern;

/**
 * Sentry Error Tracking Configuration
 * Auto-reports errors to Slack via Sentry integration
 */
@Configuration
public class SentryConfig {

    private static final Pattern SENSITIVE_PATTERN = Pattern.compile(
            "\"(password|token|apiKey|accessToken|refreshToken|secret)\"\\s*:\\s*\"[^\"]*\"",
            Pattern.CASE_INSENSITIVE);

    /**
     * Customize Sentry before send callback
     * - Adds current user info
     * - Removes sensitive data from request
     */
    @Bean
    public SentryOptions.BeforeSendCallback beforeSendCallback() {
        return (event, hint) -> {
            // Add current user info from Spring Security
            addUserContext(event);

            // Filter sensitive data from request
            filterSensitiveData(event);

            return event;
        };
    }

    /**
     * Add current authenticated user to Sentry event
     */
    private void addUserContext(SentryEvent event) {
        try {
            Authentication auth = SecurityContextHolder.getContext().getAuthentication();
            if (auth != null && auth.isAuthenticated() && !"anonymousUser".equals(auth.getName())) {
                User user = new User();
                user.setUsername(auth.getName());

                // Add role if available
                auth.getAuthorities().stream()
                        .findFirst()
                        .ifPresent(authority -> user.setData(Map.of("role", authority.getAuthority())));

                event.setUser(user);
            }
        } catch (Exception e) {
            // Ignore errors when getting user context
        }
    }

    /**
     * Filter sensitive data from request body and headers
     */
    private void filterSensitiveData(SentryEvent event) {
        Request request = event.getRequest();
        if (request == null) {
            return;
        }

        // Redact sensitive data in request body
        String data = request.getData() != null ? request.getData().toString() : null;
        if (data != null) {
            String redacted = SENSITIVE_PATTERN.matcher(data).replaceAll("\"$1\":\"[REDACTED]\"");
            request.setData(redacted);
        }

        // Redact sensitive headers
        Map<String, String> headers = request.getHeaders();
        if (headers != null) {
            String[] sensitiveHeaders = { "authorization", "cookie", "x-api-key" };
            for (String header : sensitiveHeaders) {
                if (headers.containsKey(header)) {
                    headers.put(header, "[REDACTED]");
                }
            }
        }
    }
}
