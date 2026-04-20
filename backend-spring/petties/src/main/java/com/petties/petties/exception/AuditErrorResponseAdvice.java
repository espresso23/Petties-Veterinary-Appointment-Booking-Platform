package com.petties.petties.exception;

import com.petties.petties.config.AuditLogRequestAttributes;
import org.springframework.core.MethodParameter;
import org.springframework.http.MediaType;
import org.springframework.http.converter.HttpMessageConverter;
import org.springframework.http.server.ServerHttpRequest;
import org.springframework.http.server.ServerHttpResponse;
import org.springframework.http.server.ServletServerHttpRequest;
import org.springframework.web.bind.annotation.RestControllerAdvice;
import org.springframework.web.servlet.mvc.method.annotation.ResponseBodyAdvice;

@RestControllerAdvice
public class AuditErrorResponseAdvice implements ResponseBodyAdvice<Object> {

    @Override
    public boolean supports(MethodParameter returnType, Class<? extends HttpMessageConverter<?>> converterType) {
        return true;
    }

    @Override
    public Object beforeBodyWrite(
            Object body,
            MethodParameter returnType,
            MediaType selectedContentType,
            Class<? extends HttpMessageConverter<?>> selectedConverterType,
            ServerHttpRequest request,
            ServerHttpResponse response
    ) {
        if (body instanceof ErrorResponse errorResponse && request instanceof ServletServerHttpRequest servletRequest) {
            String message = errorResponse.getMessage();
            if (message != null && !message.isBlank()) {
                servletRequest.getServletRequest().setAttribute(AuditLogRequestAttributes.AUDIT_ERROR_REASON, message);
            }
        }
        return body;
    }
}