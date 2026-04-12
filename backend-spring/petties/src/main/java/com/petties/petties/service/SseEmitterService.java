package com.petties.petties.service;

import com.petties.petties.dto.sse.SseEventDto;
import lombok.extern.slf4j.Slf4j;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Service;
import org.springframework.web.servlet.mvc.method.annotation.SseEmitter;

import java.io.IOException;
import java.util.List;
import java.util.Map;
import java.util.UUID;
import java.util.concurrent.ConcurrentHashMap;
import java.util.concurrent.CopyOnWriteArrayList;

/**
 * Service for managing Server-Sent Events (SSE) connections
 *
 * Handles:
 * - User subscription (multiple tabs/devices per user)
 * - Pushing events to specific users
 * - Connection lifecycle (completion, timeout, error)
 * - Heartbeat to keep connections alive
 */
@Service
@Slf4j
public class SseEmitterService {

    /**
     * Map of userId to list of SseEmitters
     * A user can have multiple connections (multiple tabs, devices)
     */
    private final Map<UUID, List<SseEmitter>> emitters = new ConcurrentHashMap<>();

    /**
     * Connection timeout in milliseconds
     * Long.MAX_VALUE = no timeout (connection stays open)
     * 30 minutes = 1800000ms (safer for production)
     */
    private static final long SSE_TIMEOUT = 30 * 60 * 1000L; // 30 minutes

    /**
     * Subscribe a user to SSE events
     *
     * @param userId The user's ID
     * @return SseEmitter for the connection
     */
    public SseEmitter subscribe(UUID userId) {
        SseEmitter emitter = new SseEmitter(SSE_TIMEOUT);

        // Add to user's emitter list
        emitters.computeIfAbsent(userId, k -> new CopyOnWriteArrayList<>()).add(emitter);

        // Register lifecycle callbacks
        emitter.onCompletion(() -> {
            log.debug("SSE connection completed for user: {}", userId);
            removeEmitter(userId, emitter);
        });

        emitter.onTimeout(() -> {
            log.debug("SSE connection timed out for user: {}", userId);
            removeEmitter(userId, emitter);
        });

        emitter.onError(e -> {
            log.debug("SSE connection error for user: {}, error: {}", userId, e.getMessage());
            removeEmitter(userId, emitter);
        });

        // Send initial heartbeat to confirm connection
        sendHeartbeat(userId, emitter);

        log.info("SSE subscription created for user: {} (total connections: {})",
                userId, getConnectionCount(userId));

        return emitter;
    }

    /**
     * Push an event to a specific user (all their connections)
     *
     * @param userId The target user's ID
     * @param event  The event to send
     */
    public void pushToUser(UUID userId, SseEventDto event) {
        List<SseEmitter> userEmitters = emitters.get(userId);
        if (userEmitters == null || userEmitters.isEmpty()) {
            log.debug("No SSE connections for user: {}, event not sent", userId);
            return;
        }

        log.debug("Pushing {} event to user: {} ({} connections)",
                event.getType(), userId, userEmitters.size());

        for (SseEmitter emitter : userEmitters) {
            try {
                emitter.send(SseEmitter.event()
                        .name(event.getType())
                        .data(event));
            } catch (IOException e) {
                log.debug("Failed to send event to user: {}, removing connection", userId);
                removeEmitter(userId, emitter);
            }
        }
    }

    /**
     * Push an event to multiple users
     *
     * @param userIds List of target user IDs
     * @param event   The event to send
     */
    public void pushToUsers(List<UUID> userIds, SseEventDto event) {
        for (UUID userId : userIds) {
            pushToUser(userId, event);
        }
    }

    /**
     * Send heartbeat to keep connections alive
     * Called every 30 seconds by scheduler
     */
    @Scheduled(fixedRate = 30000) // Every 30 seconds
    public void sendHeartbeats() {
        if (emitters.isEmpty()) {
            return;
        }

        log.debug("Sending heartbeats to {} users", emitters.size());

        SseEventDto heartbeat = SseEventDto.heartbeat();

        emitters.forEach((userId, userEmitters) -> {
            for (SseEmitter emitter : userEmitters) {
                try {
                    emitter.send(SseEmitter.event()
                            .name("HEARTBEAT")
                            .data(heartbeat));
                } catch (IOException e) {
                    removeEmitter(userId, emitter);
                }
            }
        });
    }

    /**
     * Send initial heartbeat to a new connection
     */
    private void sendHeartbeat(UUID userId, SseEmitter emitter) {
        try {
            emitter.send(SseEmitter.event()
                    .name("CONNECTED")
                    .data(SseEventDto.builder()
                            .type("CONNECTED")
                            .data("SSE connection established")
                            .build()));
        } catch (IOException e) {
            log.error("Failed to send initial heartbeat to user: {}", userId);
            removeEmitter(userId, emitter);
        }
    }

    /**
     * Remove an emitter from the user's list
     */
    private void removeEmitter(UUID userId, SseEmitter emitter) {
        List<SseEmitter> userEmitters = emitters.get(userId);
        if (userEmitters != null) {
            userEmitters.remove(emitter);

            // Clean up empty list
            if (userEmitters.isEmpty()) {
                emitters.remove(userId);
                log.debug("Removed last SSE connection for user: {}", userId);
            }
        }
    }

    /**
     * Get the number of active connections for a user
     */
    public int getConnectionCount(UUID userId) {
        List<SseEmitter> userEmitters = emitters.get(userId);
        return userEmitters != null ? userEmitters.size() : 0;
    }

    /**
     * Get total number of active SSE connections
     */
    public int getTotalConnectionCount() {
        return emitters.values().stream()
                .mapToInt(List::size)
                .sum();
    }

    /**
     * Check if a user has any active SSE connections
     */
    public boolean isUserConnected(UUID userId) {
        return getConnectionCount(userId) > 0;
    }

    /**
     * Disconnect all connections for a user (e.g., on logout)
     */
    public void disconnectUser(UUID userId) {
        List<SseEmitter> userEmitters = emitters.remove(userId);
        if (userEmitters != null) {
            for (SseEmitter emitter : userEmitters) {
                try {
                    emitter.complete();
                } catch (Exception e) {
                    // Ignore errors during cleanup
                }
            }
            log.info("Disconnected {} SSE connections for user: {}", userEmitters.size(), userId);
        }
    }
}
