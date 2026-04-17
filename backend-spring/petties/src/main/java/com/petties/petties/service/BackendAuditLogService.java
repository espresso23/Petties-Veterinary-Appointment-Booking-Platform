package com.petties.petties.service;

import jakarta.annotation.PostConstruct;
import lombok.RequiredArgsConstructor;
import org.bson.Document;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.slf4j.MDC;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.data.domain.Sort;
import org.springframework.data.mongodb.core.MongoTemplate;
import org.springframework.data.mongodb.core.index.Index;
import org.springframework.data.mongodb.core.index.IndexOperations;
import org.springframework.stereotype.Service;

import java.time.Duration;
import java.time.Instant;
import java.util.Date;
import java.util.Map;
import java.util.UUID;

@Service
@RequiredArgsConstructor
public class BackendAuditLogService {

    private static final Logger log = LoggerFactory.getLogger(BackendAuditLogService.class);
    private static final String COLLECTION = "audit_logs";

    private final MongoTemplate mongoTemplate;

    @Value("${audit.log.retention-days:365}")
    private int retentionDays;

    @Value("${spring.application.name:petties-backend-spring}")
    private String serviceName;

    @Value("${spring.profiles.active:dev}")
    private String activeProfile;

    @PostConstruct
    public void ensureIndexes() {
        try {
            IndexOperations indexOps = mongoTemplate.indexOps(COLLECTION);
            indexOps.ensureIndex(new Index().on("event_id", Sort.Direction.ASC).unique());
            indexOps.ensureIndex(new Index().on("occurred_at", Sort.Direction.DESC));
            indexOps.ensureIndex(new Index().on("actor.user_id", Sort.Direction.ASC).on("occurred_at", Sort.Direction.DESC));
            indexOps.ensureIndex(new Index().on("action", Sort.Direction.ASC).on("occurred_at", Sort.Direction.DESC));
            indexOps.ensureIndex(new Index().on("resource.type", Sort.Direction.ASC)
                    .on("resource.id", Sort.Direction.ASC)
                    .on("occurred_at", Sort.Direction.DESC));
            indexOps.ensureIndex(new Index().on("result.status", Sort.Direction.ASC).on("occurred_at", Sort.Direction.DESC));
            indexOps.ensureIndex(new Index().on("correlation.request_id", Sort.Direction.ASC));
            indexOps.ensureIndex(new Index().on("expire_at", Sort.Direction.ASC).expire(0));
        } catch (Exception ex) {
            log.warn("Khong the tao index cho backend audit logs: {}", ex.getMessage());
        }
    }

    public void writeHttpAuditEvent(
            String requestId,
            String traceId,
            String method,
            String path,
            String query,
            String userId,
            String role,
            String authType,
            String clientIp,
            int statusCode,
            long latencyMs,
            String errorReason
    ) {
        try {
            Instant now = Instant.now();
            Date occurredAt = Date.from(now);
            Date expireAt = Date.from(now.plus(Duration.ofDays(Math.max(1, retentionDays))));

            String resultStatus = mapResultStatus(statusCode);
            Document payload = new Document()
                    .append("event_id", UUID.randomUUID().toString())
                    .append("occurred_at", occurredAt)
                    .append("service", serviceName)
                    .append("environment", activeProfile)
                    .append("actor", new Document()
                            .append("user_id", userId)
                            .append("role", role)
                            .append("auth_type", authType)
                            .append("ip", clientIp))
                    .append("action", "API_" + method)
                    .append("resource", new Document()
                            .append("type", "http_endpoint")
                            .append("id", path))
                    .append("result", new Document()
                            .append("status", resultStatus)
                            .append("reason", errorReason))
                    .append("correlation", new Document()
                            .append("request_id", requestId)
                            .append("trace_id", traceId))
                    .append("metadata", new Document()
                            .append("method", method)
                            .append("path", path)
                            .append("query", query)
                            .append("status_code", statusCode)
                            .append("latency_ms", latencyMs))
                    .append("changes", new Document())
                    .append("expire_at", expireAt);

            mongoTemplate.insert(payload, COLLECTION);
        } catch (Exception ex) {
            log.warn("Khong the ghi backend audit log: {}", ex.getMessage());
        }
    }

    public void writeBusinessAuditEvent(
                String actorUserId,
                String actorRole,
                String action,
                String resourceType,
                String resourceId,
                Map<String, Object> oldValue,
                Map<String, Object> newValue,
                Map<String, Object> metadata
            ) {
            try {
                Instant now = Instant.now();
                Date occurredAt = Date.from(now);
                Date expireAt = Date.from(now.plus(Duration.ofDays(Math.max(1, retentionDays))));

                String requestId = MDC.get("requestId");
                String traceId = MDC.get("traceId");
                String clientIp = MDC.get("clientIp");

                Document payload = new Document()
                    .append("event_id", UUID.randomUUID().toString())
                    .append("occurred_at", occurredAt)
                    .append("service", serviceName)
                    .append("environment", activeProfile)
                    .append("actor", new Document()
                        .append("user_id", actorUserId)
                        .append("role", actorRole)
                        .append("auth_type", "jwt")
                        .append("ip", clientIp != null ? clientIp : "unknown"))
                    .append("action", action)
                    .append("resource", new Document()
                        .append("type", resourceType)
                        .append("id", resourceId))
                    .append("result", new Document()
                        .append("status", "SUCCESS")
                        .append("reason", null))
                    .append("correlation", new Document()
                        .append("request_id", requestId)
                        .append("trace_id", traceId))
                    .append("metadata", metadata != null ? new Document(metadata) : new Document())
                    .append("changes", new Document()
                        .append("old_value", oldValue != null ? new Document(oldValue) : null)
                        .append("new_value", newValue != null ? new Document(newValue) : null))
                    .append("expire_at", expireAt);

                mongoTemplate.insert(payload, COLLECTION);
            } catch (Exception ex) {
                log.warn("Khong the ghi business audit log backend: {}", ex.getMessage());
            }
            }

    private String mapResultStatus(int statusCode) {
        if (statusCode >= 500) {
            return "FAILED";
        }
        if (statusCode >= 400) {
            return "DENIED";
        }
        return "SUCCESS";
    }
}
