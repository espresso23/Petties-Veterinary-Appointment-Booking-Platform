package com.petties.petties.config;

import org.springframework.beans.factory.annotation.Value;
import org.springframework.context.annotation.Configuration;
import org.springframework.messaging.simp.config.MessageBrokerRegistry;
import org.springframework.web.socket.config.annotation.EnableWebSocketMessageBroker;
import org.springframework.web.socket.config.annotation.StompEndpointRegistry;
import org.springframework.web.socket.config.annotation.WebSocketMessageBrokerConfigurer;

/**
 * WebSocket Configuration with STOMP protocol.
 *
 * Endpoints:
 * - /ws: WebSocket handshake endpoint (SockJS fallback for browsers)
 *
 * Destinations:
 * - /topic/*: Public broadcasts (e.g., clinic announcements)
 * - /queue/*: Private messages (e.g., booking updates for specific user)
 * - /app/*: Client-to-server messages (handled by @MessageMapping)
 * - /user/*: User-specific destinations (auto-prefixed)
 *
 * Use Cases (Petties):
 * - Real-time notifications (booking confirmations, reminders)
 * - Chat between Pet Owner and Clinic Staff
 * - Live booking status updates
 *
 * Environments:
 * - Dev: Allow localhost origins
 * - Test: Allow test.petties.world
 * - Prod: Allow petties.world only
 */
@Configuration
@EnableWebSocketMessageBroker
public class WebSocketConfig implements WebSocketMessageBrokerConfigurer {

    @Value("${cors.allowed-origins:http://localhost:5173,http://localhost:3000}")
    private String allowedOriginsString;

    @Override
    public void configureMessageBroker(MessageBrokerRegistry registry) {
        // Enable simple in-memory broker for /topic and /queue prefixes
        // /topic: for public broadcasts to multiple subscribers
        // /queue: for private point-to-point messages
        registry.enableSimpleBroker("/topic", "/queue");

        // Prefix for messages FROM client TO server (handled by @MessageMapping)
        registry.setApplicationDestinationPrefixes("/app");

        // Prefix for user-specific destinations
        // Allows sending to specific users: /user/{userId}/queue/notifications
        registry.setUserDestinationPrefix("/user");
    }

    @Override
    public void registerStompEndpoints(StompEndpointRegistry registry) {
        String[] allowedOrigins = allowedOriginsString.split(",");

        // WebSocket endpoint with SockJS fallback (for browsers that don't support WS)
        registry.addEndpoint("/ws")
                .setAllowedOrigins(allowedOrigins)
                .withSockJS();

        // Pure WebSocket endpoint (for native mobile clients - React Native, Flutter)
        registry.addEndpoint("/ws")
                .setAllowedOrigins(allowedOrigins);
    }
}
