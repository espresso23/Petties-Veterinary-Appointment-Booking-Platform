package com.petties.petties.config;

import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.messaging.Message;
import org.springframework.messaging.MessageChannel;
import org.springframework.messaging.simp.stomp.StompCommand;
import org.springframework.messaging.simp.stomp.StompHeaderAccessor;
import org.springframework.messaging.support.ChannelInterceptor;
import org.springframework.messaging.support.MessageHeaderAccessor;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.core.authority.SimpleGrantedAuthority;
import org.springframework.stereotype.Component;

import java.util.List;
import java.util.UUID;

/**
 * WebSocket STOMP Interceptor for JWT Authentication.
 * 
 * Extracts and validates JWT token from STOMP CONNECT headers.
 * Sets the Principal for the WebSocket session.
 */
@Component
@RequiredArgsConstructor
@Slf4j
public class WebSocketAuthInterceptor implements ChannelInterceptor {

    private final JwtTokenProvider jwtTokenProvider;

    @Override
    public Message<?> preSend(Message<?> message, MessageChannel channel) {
        StompHeaderAccessor accessor = MessageHeaderAccessor.getAccessor(message, StompHeaderAccessor.class);

        if (accessor != null && StompCommand.CONNECT.equals(accessor.getCommand())) {
            String authHeader = accessor.getFirstNativeHeader("Authorization");
            
            if (authHeader != null && authHeader.startsWith("Bearer ")) {
                String token = authHeader.substring(7);
                
                try {
                    if (jwtTokenProvider.validateToken(token)) {
                        UUID userId = jwtTokenProvider.getUserIdFromToken(token);
                        String role = jwtTokenProvider.getRoleFromToken(token);
                        
                        // Create authentication with userId as principal name
                        UsernamePasswordAuthenticationToken auth = new UsernamePasswordAuthenticationToken(
                                userId.toString(), // Principal name - used by Principal.getName()
                                null,
                                List.of(new SimpleGrantedAuthority("ROLE_" + role))
                        );
                        
                        accessor.setUser(auth);
                        log.debug("WebSocket authenticated for user: {}", userId);
                    } else {
                        log.warn("Invalid JWT token in WebSocket connection");
                    }
                } catch (Exception e) {
                    log.error("WebSocket JWT validation error: {}", e.getMessage());
                }
            } else {
                log.warn("Missing Authorization header in WebSocket CONNECT");
            }
        }

        return message;
    }
}
