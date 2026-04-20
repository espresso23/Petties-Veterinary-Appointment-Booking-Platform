package com.petties.petties.config;

import org.springframework.beans.factory.annotation.Value;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.web.client.RestTemplate;
import org.springframework.web.servlet.config.annotation.CorsRegistry;
import org.springframework.web.servlet.config.annotation.InterceptorRegistry;
import org.springframework.web.servlet.config.annotation.WebMvcConfigurer;

import java.util.Arrays;
import java.util.List;

/**
 * Web MVC CORS Configuration.
 * This configuration works at the Spring MVC level (before Spring Security)
 * to ensure CORS headers are properly added to all responses.
 */
@Configuration
public class WebMvcConfig implements WebMvcConfigurer {

    @Value("${cors.allowed-origins:http://localhost:5173,http://localhost:3000,https://*.ngrok.io,https://*.ngrok-free.app,https://*.ngrok.dev}")
    private String allowedOrigins;

    private final LoggingInterceptor loggingInterceptor;
    private final SandboxWriteGuardInterceptor sandboxWriteGuardInterceptor;

    public WebMvcConfig(
            LoggingInterceptor loggingInterceptor,
            SandboxWriteGuardInterceptor sandboxWriteGuardInterceptor
    ) {
        this.loggingInterceptor = loggingInterceptor;
        this.sandboxWriteGuardInterceptor = sandboxWriteGuardInterceptor;
    }

    @Override
    public void addCorsMappings(CorsRegistry registry) {
        List<String> origins = Arrays.stream(allowedOrigins.split(","))
                .map(String::trim)
                .filter(s -> !s.isBlank())
                .toList();

        var corsRegistration = registry.addMapping("/**")
                .allowedMethods("GET", "POST", "PUT", "DELETE", "PATCH", "OPTIONS", "HEAD")
                .allowedHeaders("*")
                .exposedHeaders("Authorization", "X-Total-Count", "Content-Disposition", "X-Request-ID")
                .allowCredentials(true)
                .maxAge(3600);

        boolean hasWildcard = origins.stream().anyMatch(o -> o.contains("*"));
        if (hasWildcard) {
            corsRegistration.allowedOriginPatterns(origins.toArray(new String[0]));
        } else {
            corsRegistration.allowedOrigins(origins.toArray(new String[0]));
        }
    }

    @Override
    public void addInterceptors(InterceptorRegistry registry) {
        registry.addInterceptor(sandboxWriteGuardInterceptor)
            .addPathPatterns("/api/**")
            .excludePathPatterns(
                "/api/actuator/**",
                "/health",
                "/favicon.ico"
            );

        registry.addInterceptor(loggingInterceptor)
            .addPathPatterns("/**")
                .excludePathPatterns(
                "/actuator/**",
                        "/api/actuator/**",
                        "/health",
                        "/favicon.ico"
                );
    }

    @Bean
    public RestTemplate restTemplate() {
        return new RestTemplate();
    }
}
