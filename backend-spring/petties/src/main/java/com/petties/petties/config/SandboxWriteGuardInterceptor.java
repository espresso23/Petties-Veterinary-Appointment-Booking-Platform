package com.petties.petties.config;

import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import org.springframework.stereotype.Component;
import org.springframework.web.servlet.HandlerInterceptor;

import java.io.IOException;
import java.util.Set;

@Component
public class SandboxWriteGuardInterceptor implements HandlerInterceptor {

    private static final String SANDBOX_MODE_HEADER = "X-Sandbox-Mode";
    private static final Set<String> SAFE_METHODS = Set.of("GET", "HEAD", "OPTIONS");

    @Override
    public boolean preHandle(HttpServletRequest request, HttpServletResponse response, Object handler) throws IOException {
        String method = request.getMethod();
        if (SAFE_METHODS.contains(method)) {
            return true;
        }

        String sandboxModeHeader = request.getHeader(SANDBOX_MODE_HEADER);
        boolean isSandboxMode = "true".equalsIgnoreCase(sandboxModeHeader);
        if (!isSandboxMode) {
            return true;
        }

        String uri = request.getRequestURI();
        if (uri.startsWith("/api/sandbox")) {
            return true;
        }

        response.setStatus(HttpServletResponse.SC_FORBIDDEN);
        response.setContentType("application/json;charset=UTF-8");
        response.getWriter().write("{\"message\":\"Bạn đang ở chế độ dùng thử. Hệ thống đã chặn thao tác ghi dữ liệu thật.\"}");
        return false;
    }
}
