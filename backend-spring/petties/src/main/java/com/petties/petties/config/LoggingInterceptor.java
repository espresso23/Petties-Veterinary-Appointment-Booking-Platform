package com.petties.petties.config;

import com.petties.petties.service.BackendAuditLogService;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import lombok.RequiredArgsConstructor;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.slf4j.MDC;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.stereotype.Component;
import org.springframework.http.HttpStatus;
import org.springframework.web.servlet.HandlerInterceptor;
import org.springframework.web.servlet.ModelAndView;

import java.util.Arrays;
import java.util.List;
import java.util.UUID;
import java.util.regex.Pattern;

@Component
@RequiredArgsConstructor
public class LoggingInterceptor implements HandlerInterceptor {

    private static final Logger log = LoggerFactory.getLogger(LoggingInterceptor.class);
    private static final String START_TIME_ATTRIBUTE = "startTime";
    private static final String SKIP_LOGGING_ATTRIBUTE = "skipLogging";
    private static final String REQUEST_ID_HEADER = "X-Request-ID";
    private static final String TRACEPARENT_HEADER = "traceparent";
    private static final String B3_TRACE_ID_HEADER = "X-B3-TraceId";
    private static final String REQUEST_ID_MDC_KEY = "requestId";
    private static final String TRACE_ID_MDC_KEY = "traceId";
    private static final String USER_ID_HEADER = "X-User-ID";
    private static final String USER_ROLE_HEADER = "X-User-Roles";

    private final BackendAuditLogService backendAuditLogService;

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
        String requestPath = request.getRequestURI();
        boolean skipLogging = shouldSkipLogging(requestPath);
        request.setAttribute(SKIP_LOGGING_ATTRIBUTE, skipLogging);

        String requestId = request.getHeader(REQUEST_ID_HEADER);
        if (requestId == null || requestId.isBlank()) {
            requestId = UUID.randomUUID().toString().substring(0, 8);
        }
        String traceId = resolveTraceId(request, requestId);
        response.setHeader(REQUEST_ID_HEADER, requestId);

        MDC.put(REQUEST_ID_MDC_KEY, requestId);
        MDC.put(TRACE_ID_MDC_KEY, traceId);
        MDC.put("method", request.getMethod());
        MDC.put("path", requestPath);

        String queryString = request.getQueryString();
        if (queryString != null && !queryString.isBlank()) {
            String maskedQuery = maskSensitiveParams(queryString);
            MDC.put("query", maskedQuery);
        }

        String userId = request.getHeader(USER_ID_HEADER);
        if (userId != null) {
            MDC.put("userId", userId);
        } else {
            userId = getCurrentUserId();
            MDC.put("userId", userId != null ? userId : "anonymous");
        }

        String role = resolveCurrentRole(request);
        MDC.put("role", role);

        MDC.put("clientIp", getClientIp(request));

        long startTime = System.currentTimeMillis();
        request.setAttribute(START_TIME_ATTRIBUTE, startTime);

        if (!skipLogging) {
            log.info("[{}] --> {} {} (IP: {}, User: {})",
                    requestId,
                    request.getMethod(),
                    requestPath,
                    getClientIp(request),
                    userId != null ? userId : "anonymous");
        }

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

        Long startTime = (Long) request.getAttribute(START_TIME_ATTRIBUTE);
        long duration = startTime != null ? System.currentTimeMillis() - startTime : 0;

        int status = response.getStatus();
        boolean skipLogging = Boolean.TRUE.equals(request.getAttribute(SKIP_LOGGING_ATTRIBUTE));

        MDC.put("status", String.valueOf(status));
        MDC.put("latencyMs", String.valueOf(duration));

        String method = request.getMethod();
        String path = request.getRequestURI();
        String traceId = MDC.get(TRACE_ID_MDC_KEY);
        String query = MDC.get("query");
        String userId = MDC.get("userId");
        String role = MDC.get("role");
        String clientIp = MDC.get("clientIp");
        String authType = SecurityContextHolder.getContext().getAuthentication() != null ? "jwt" : "anonymous";
        String handledErrorReason = readRequestAttributeAsString(request, AuditLogRequestAttributes.AUDIT_ERROR_REASON);
        String errorReason = resolveErrorReason(ex, handledErrorReason, status);

        if (ex != null) {
            if (!skipLogging) {
                log.error("[{}] <-- {} {} | Status: {} | Duration: {}ms | Exception: {}",
                        requestId,
                        request.getMethod(),
                        request.getRequestURI(),
                        status,
                        duration,
                        ex.getMessage());
            }
        } else if (status >= 500) {
            if (!skipLogging) {
                log.error("[{}] <-- {} {} | Status: {} | Duration: {}ms",
                        requestId,
                        request.getMethod(),
                        request.getRequestURI(),
                        status,
                        duration);
            }
        } else if (status >= 400) {
            if (!skipLogging) {
                log.warn("[{}] <-- {} {} | Status: {} | Duration: {}ms",
                        requestId,
                        request.getMethod(),
                        request.getRequestURI(),
                        status,
                        duration);
            }
        } else {
            if (!skipLogging) {
                log.info("[{}] <-- {} {} | Status: {} | Duration: {}ms",
                        requestId,
                        request.getMethod(),
                        request.getRequestURI(),
                        status,
                        duration);
            }
        }

        if (!skipLogging) {
            backendAuditLogService.writeHttpAuditEvent(
                    requestId,
                    traceId,
                    method,
                    path,
                    query,
                    userId != null ? userId : "anonymous",
                    role != null ? role : "ANONYMOUS",
                    authType,
                    clientIp != null ? clientIp : "unknown",
                    status,
                    duration,
                    errorReason
            );
        }

        MDC.clear();
    }

    private String resolveTraceId(HttpServletRequest request, String fallbackRequestId) {
        String traceparent = request.getHeader(TRACEPARENT_HEADER);
        if (traceparent != null && !traceparent.isBlank()) {
            String[] parts = traceparent.split("-");
            if (parts.length >= 4 && !parts[1].isBlank()) {
                return parts[1];
            }
        }

        String b3TraceId = request.getHeader(B3_TRACE_ID_HEADER);
        if (b3TraceId != null && !b3TraceId.isBlank()) {
            return b3TraceId;
        }

        return fallbackRequestId;
    }

    private boolean shouldSkipLogging(String path) {
        if (path == null) {
            return false;
        }
        return EXCLUDE_PATHS.stream().anyMatch(path::startsWith);
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

    private String resolveErrorReason(Exception ex, String handledErrorReason, int statusCode) {
        if (ex != null) {
            String message = ex.getMessage();
            if (message == null || message.isBlank()) {
                return ex.getClass().getSimpleName();
            }
            return ex.getClass().getSimpleName() + ": " + message;
        }

        if (handledErrorReason != null && !handledErrorReason.isBlank()) {
            return handledErrorReason;
        }

        if (statusCode < 400) {
            return null;
        }

        return switch (statusCode) {
            case 400 -> "Dữ liệu yêu cầu không hợp lệ";
            case 401 -> "Chưa xác thực hoặc phiên đăng nhập đã hết hạn";
            case 403 -> "Bạn không có quyền truy cập tài nguyên này";
            case 404 -> "Không tìm thấy tài nguyên yêu cầu";
            case 405 -> "Phương thức HTTP không được hỗ trợ";
            default -> {
                HttpStatus httpStatus = HttpStatus.resolve(statusCode);
                if (httpStatus != null) {
                    yield "Yêu cầu thất bại với mã HTTP " + statusCode + " (" + httpStatus.getReasonPhrase() + ")";
                }
                yield "Yêu cầu thất bại với mã HTTP " + statusCode;
            }
        };
    }

    private String readRequestAttributeAsString(HttpServletRequest request, String attributeName) {
        Object value = request.getAttribute(attributeName);
        if (value instanceof String text) {
            return text;
        }
        return null;
    }

    private String getCurrentUserId() {
        Authentication authentication = SecurityContextHolder.getContext().getAuthentication();
        if (authentication == null || !authentication.isAuthenticated()) {
            return null;
        }

        Object principal = authentication.getPrincipal();
        if (principal instanceof UserDetailsServiceImpl.UserPrincipal userPrincipal) {
            return userPrincipal.getUserId().toString();
        }

        return null;
    }

    private String resolveCurrentRole(HttpServletRequest request) {
        String roleFromHeader = request.getHeader(USER_ROLE_HEADER);
        if (roleFromHeader != null && !roleFromHeader.isBlank()) {
            return roleFromHeader;
        }

        Authentication authentication = SecurityContextHolder.getContext().getAuthentication();
        if (authentication == null || !authentication.isAuthenticated()) {
            return "ANONYMOUS";
        }

        Object principal = authentication.getPrincipal();
        if (principal instanceof UserDetailsServiceImpl.UserPrincipal userPrincipal) {
            return userPrincipal.getRole();
        }

        return "USER";
    }
}
