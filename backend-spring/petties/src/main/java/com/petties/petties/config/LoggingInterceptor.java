package com.petties.petties.config;

import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.slf4j.MDC;
import org.springframework.stereotype.Component;
import org.springframework.web.servlet.HandlerInterceptor;
import org.springframework.web.servlet.ModelAndView;

import java.util.Arrays;
import java.util.List;
import java.util.UUID;
import java.util.regex.Pattern;

@Component
public class LoggingInterceptor implements HandlerInterceptor {

    private static final Logger log = LoggerFactory.getLogger(LoggingInterceptor.class);
    private static final String REQUEST_ID_HEADER = "X-Request-ID";
    private static final String REQUEST_ID_MDC_KEY = "requestId";
    private static final String USER_ID_HEADER = "X-User-ID";

    private static final List<Pattern> SENSITIVE_PARAMS = Arrays.asList(
            Pattern.compile("password", Pattern.CASE_INSENSITIVE),
            Pattern.compile("token", Pattern.CASE_INSENSITIVE),
            Pattern.compile("secret", Pattern.CASE_INSENSITIVE),
            Pattern.compile("api[_-]?key", Pattern.CASE_INSENSITIVE),
            Pattern.compile("authorization", Pattern.CASE_INSENSITIVE),
            Pattern.compile("bearer", Pattern.CASE_INSENSITIVE),
            Pattern.compile("credential", Pattern.CASE_INSENSITIVE)
    );

    private static final List<String> EXCLUDE_PATHS = Arrays.asList(
            "/actuator/health",
            "/actuator/info",
            "/api/actuator",
            "/health",
            "/favicon.ico"
    );

    @Override
    public boolean preHandle(HttpServletRequest request, HttpServletResponse response, Object handler) {
        String requestId = request.getHeader(REQUEST_ID_HEADER);
        if (requestId == null || requestId.isBlank()) {
            requestId = UUID.randomUUID().toString().substring(0, 8);
        }

        MDC.put(REQUEST_ID_MDC_KEY, requestId);
        MDC.put("method", request.getMethod());
        MDC.put("path", request.getRequestURI());

        String queryString = request.getQueryString();
        if (queryString != null && !queryString.isBlank()) {
            String maskedQuery = maskSensitiveParams(queryString);
            MDC.put("query", maskedQuery);
        }

        String userId = request.getHeader(USER_ID_HEADER);
        if (userId != null) {
            MDC.put("userId", userId);
        }

        MDC.put("clientIp", getClientIp(request));

        long startTime = System.currentTimeMillis();
        request.setAttribute("startTime", startTime);

        log.info("[{}] --> {} {} (IP: {}, User: {})",
                requestId,
                request.getMethod(),
                request.getRequestURI(),
                getClientIp(request),
                userId != null ? userId : "anonymous");

        return true;
    }

    @Override
    public void postHandle(HttpServletRequest request, HttpServletResponse response,
                           Object handler, ModelAndView modelAndView) {
    }

    @Override
    public void afterCompletion(HttpServletRequest request, HttpServletResponse response,
                                Object handler, Exception ex) {
        String requestId = MDC.get(REQUEST_ID_MDC_KEY);

        Long startTime = (Long) request.getAttribute("startTime");
        long duration = startTime != null ? System.currentTimeMillis() - startTime : 0;

        int status = response.getStatus();

        if (ex != null) {
            log.error("[{}] <-- {} {} | Status: {} | Duration: {}ms | Exception: {}",
                    requestId,
                    request.getMethod(),
                    request.getRequestURI(),
                    status,
                    duration,
                    ex.getMessage());
        } else if (status >= 500) {
            log.error("[{}] <-- {} {} | Status: {} | Duration: {}ms",
                    requestId,
                    request.getMethod(),
                    request.getRequestURI(),
                    status,
                    duration);
        } else if (status >= 400) {
            log.warn("[{}] <-- {} {} | Status: {} | Duration: {}ms",
                    requestId,
                    request.getMethod(),
                    request.getRequestURI(),
                    status,
                    duration);
        } else {
            log.info("[{}] <-- {} {} | Status: {} | Duration: {}ms",
                    requestId,
                    request.getMethod(),
                    request.getRequestURI(),
                    status,
                    duration);
        }

        MDC.clear();
    }

    private String getClientIp(HttpServletRequest request) {
        String xForwardedFor = request.getHeader("X-Forwarded-For");
        if (xForwardedFor != null && !xForwardedFor.isBlank()) {
            return xForwardedFor.split(",")[0].trim();
        }

        String xRealIp = request.getHeader("X-Real-IP");
        if (xRealIp != null && !xRealIp.isBlank()) {
            return xRealIp;
        }

        return request.getRemoteAddr();
    }

    private String maskSensitiveParams(String queryString) {
        String masked = queryString;

        for (Pattern pattern : SENSITIVE_PARAMS) {
            masked = masked.replaceAll(
                    "(?<=\\?|&)" + pattern.pattern() + "=[^&]*",
                    pattern.pattern() + "=***REDACTED***"
            );
        }

        return masked;
    }

    public static String getCurrentRequestId() {
        return MDC.get(REQUEST_ID_MDC_KEY);
    }

    public static void addToContext(String key, String value) {
        MDC.put(key, value);
    }
}
