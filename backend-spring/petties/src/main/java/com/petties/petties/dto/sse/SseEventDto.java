package com.petties.petties.dto.sse;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.time.LocalDateTime;

/**
 * DTO for Server-Sent Events (SSE)
 *
 * Used to push real-time events to clients
 *
 * Event Types:
 * - NOTIFICATION: New notification arrived
 * - HEARTBEAT: Keep-alive ping
 * - SHIFT_UPDATE: VetShift changed (for auto-refresh)
 */
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class SseEventDto {

    /**
     * Event type identifier
     * Client uses this to route the event to appropriate handler
     */
    private String type;

    /**
     * Event payload
     * Could be NotificationResponse, String, or null (for heartbeat)
     */
    private Object data;

    /**
     * Event timestamp
     */
    @Builder.Default
    private LocalDateTime timestamp = LocalDateTime.now();

    /**
     * Create a heartbeat event
     */
    public static SseEventDto heartbeat() {
        return SseEventDto.builder()
                .type("HEARTBEAT")
                .data(null)
                .build();
    }

    /**
     * Create a notification event
     */
    public static SseEventDto notification(Object notificationData) {
        return SseEventDto.builder()
                .type("NOTIFICATION")
                .data(notificationData)
                .build();
    }

    /**
     * Create a shift update event (for calendar auto-refresh)
     */
    public static SseEventDto shiftUpdate(Object shiftData) {
        return SseEventDto.builder()
                .type("SHIFT_UPDATE")
                .data(shiftData)
                .build();
    }

    /**
     * Create a clinic counter update event (for admin badge)
     */
    public static SseEventDto clinicCounterUpdate(long count) {
        return SseEventDto.builder()
                .type("CLINIC_COUNTER_UPDATE")
                .data(count)
                .build();
    }
}
