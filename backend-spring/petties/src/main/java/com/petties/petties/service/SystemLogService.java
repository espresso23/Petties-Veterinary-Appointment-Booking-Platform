package com.petties.petties.service;

import com.petties.petties.exception.BadRequestException;
import lombok.RequiredArgsConstructor;
import org.bson.Document;
import org.springframework.beans.factory.ObjectProvider;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.data.domain.Sort;
import org.springframework.data.mongodb.core.MongoTemplate;
import org.springframework.data.mongodb.core.query.Criteria;
import org.springframework.data.mongodb.core.query.Query;
import org.springframework.stereotype.Service;

import java.time.Instant;
import java.time.OffsetDateTime;
import java.time.ZoneOffset;
import java.util.ArrayList;
import java.util.Date;
import java.util.LinkedHashSet;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.stream.Collectors;

@Service
@RequiredArgsConstructor
public class SystemLogService {

    private static final String COLLECTION = "audit_logs";
    private static final int DEFAULT_PAGE = 1;
    private static final int DEFAULT_PAGE_SIZE = 30;
    private static final int MAX_PAGE_SIZE = 200;
    private static final int MAX_BULK_DELETE_IDS = 1000;

    private enum AuditLogSourceScope {
        ALL,
        BACKEND,
        AI
    }

    private final MongoTemplate mongoTemplate;
    private final ObjectProvider<BackendAuditLogService> backendAuditLogServiceProvider;

    @Value("${spring.application.name:petties-backend-spring}")
    private String serviceName;

    public Map<String, Object> getBackendLogs(
            Integer page,
            Integer pageSize,
            String status,
            String action,
            String userId,
            String requestId,
            String source
    ) {
        int safePage = normalizePage(page);
        int safePageSize = normalizePageSize(pageSize);
        AuditLogSourceScope sourceScope = normalizeSourceScope(source);

        Query query = new Query();
        Criteria sourceCriteria = buildSourceCriteria(sourceScope);
        if (sourceCriteria != null) {
            query.addCriteria(sourceCriteria);
        }

        if (status != null && !status.isBlank()) {
            query.addCriteria(Criteria.where("result.status").is(status.trim()));
        }
        if (action != null && !action.isBlank()) {
            query.addCriteria(Criteria.where("action").is(action.trim()));
        }
        if (userId != null && !userId.isBlank()) {
            query.addCriteria(Criteria.where("actor.user_id").is(userId.trim()));
        }
        if (requestId != null && !requestId.isBlank()) {
            query.addCriteria(Criteria.where("correlation.request_id").is(requestId.trim()));
        }

        long total = mongoTemplate.count(query, COLLECTION);

        query.with(Sort.by(Sort.Direction.DESC, "occurred_at"));
        query.skip((long) (safePage - 1) * safePageSize);
        query.limit(safePageSize);

        List<Document> documents = mongoTemplate.find(query, Document.class, COLLECTION);
        List<Map<String, Object>> items = new ArrayList<>();
        for (Document document : documents) {
            document.remove("_id");
            items.add(new LinkedHashMap<>(document));
        }

        Map<String, Object> payload = new LinkedHashMap<>();
        payload.put("source", "backend-audit-mongo");
        payload.put("service", sourceScope == AuditLogSourceScope.BACKEND ? serviceName : "mixed");
        payload.put("backend_service", serviceName);
        payload.put("scope", sourceScope.name());
        payload.put("total", total);
        payload.put("page", safePage);
        payload.put("page_size", safePageSize);
        payload.put("items", items);
        payload.put("fetchedAt", OffsetDateTime.now().toString());
        return payload;
    }

    public Map<String, Object> bulkDeleteAuditLogs(
            List<String> eventIds,
            String source,
            String actorUserId
    ) {
        AuditLogSourceScope sourceScope = normalizeSourceScope(source);
        List<String> safeEventIds = normalizeEventIds(eventIds);
        if (safeEventIds.isEmpty()) {
            throw new BadRequestException("Danh sach eventId khong hop le.");
        }

        Query query = new Query().addCriteria(Criteria.where("event_id").in(safeEventIds));
        Criteria sourceCriteria = buildSourceCriteria(sourceScope);
        if (sourceCriteria != null) {
            query.addCriteria(sourceCriteria);
        }

        long deletedCount = mongoTemplate.remove(query, COLLECTION).getDeletedCount();
        writeDeleteAuditAction(
                actorUserId,
                "DELETE_AUDIT_LOGS_BULK",
                sourceScope,
                Map.of(
                        "requested_count", safeEventIds.size(),
                        "deleted_count", deletedCount,
                        "mode", "selected_rows"
                )
        );

        Map<String, Object> payload = new LinkedHashMap<>();
        payload.put("scope", sourceScope.name());
        payload.put("requested_count", safeEventIds.size());
        payload.put("deleted_count", deletedCount);
        payload.put("message", "Đã xóa " + deletedCount + " bản ghi audit log.");
        payload.put("deletedAt", OffsetDateTime.now(ZoneOffset.UTC).toString());
        return payload;
    }

    public Map<String, Object> deleteAuditLogsByTimeRange(
            OffsetDateTime fromTime,
            OffsetDateTime toTime,
            String source,
            String actorUserId
    ) {
        if (fromTime == null || toTime == null) {
            throw new BadRequestException("Thoi gian bat dau va ket thuc khong duoc de trong.");
        }
        if (fromTime.isAfter(toTime)) {
            throw new BadRequestException("Thoi gian bat dau khong duoc lon hon thoi gian ket thuc.");
        }

        AuditLogSourceScope sourceScope = normalizeSourceScope(source);

        Instant fromInstant = fromTime.toInstant();
        Instant toInstant = toTime.toInstant();

        Query query = new Query().addCriteria(
                Criteria.where("occurred_at").gte(Date.from(fromInstant)).lte(Date.from(toInstant))
        );
        Criteria sourceCriteria = buildSourceCriteria(sourceScope);
        if (sourceCriteria != null) {
            query.addCriteria(sourceCriteria);
        }

        long deletedCount = mongoTemplate.remove(query, COLLECTION).getDeletedCount();
        writeDeleteAuditAction(
                actorUserId,
                "DELETE_AUDIT_LOGS_TIME_RANGE",
                sourceScope,
                Map.of(
                        "from_time", fromTime.toString(),
                        "to_time", toTime.toString(),
                        "deleted_count", deletedCount,
                        "mode", "time_range"
                )
        );

        Map<String, Object> payload = new LinkedHashMap<>();
        payload.put("scope", sourceScope.name());
        payload.put("from_time", fromTime.toString());
        payload.put("to_time", toTime.toString());
        payload.put("deleted_count", deletedCount);
        payload.put("message", "Đã xóa " + deletedCount + " bản ghi audit log theo khoảng thời gian.");
        payload.put("deletedAt", OffsetDateTime.now(ZoneOffset.UTC).toString());
        return payload;
    }

    private void writeDeleteAuditAction(
            String actorUserId,
            String action,
            AuditLogSourceScope sourceScope,
            Map<String, Object> metadata
    ) {
        BackendAuditLogService backendAuditLogService = backendAuditLogServiceProvider.getIfAvailable();
        if (backendAuditLogService == null) {
            return;
        }

        String safeActorUserId = actorUserId != null && !actorUserId.isBlank() ? actorUserId : "unknown-admin";

        Map<String, Object> safeMetadata = new LinkedHashMap<>(metadata);
        safeMetadata.put("source_scope", sourceScope.name());

        backendAuditLogService.writeBusinessAuditEvent(
                safeActorUserId,
                "ADMIN",
                action,
                "audit_logs",
                "admin-system-logs",
                null,
                null,
                safeMetadata
        );
    }

    private int normalizePage(Integer page) {
        if (page == null) {
            return DEFAULT_PAGE;
        }
        if (page < 1) {
            throw new BadRequestException("Page phai lon hon hoac bang 1.");
        }
        return page;
    }

    private int normalizePageSize(Integer pageSize) {
        if (pageSize == null) {
            return DEFAULT_PAGE_SIZE;
        }
        if (pageSize < 1 || pageSize > MAX_PAGE_SIZE) {
            throw new BadRequestException("Page size phai trong khoang 1 den " + MAX_PAGE_SIZE + ".");
        }
        return pageSize;
    }

    private AuditLogSourceScope normalizeSourceScope(String source) {
        if (source == null || source.isBlank()) {
            return AuditLogSourceScope.ALL;
        }

        try {
            return AuditLogSourceScope.valueOf(source.trim().toUpperCase());
        } catch (IllegalArgumentException ex) {
            throw new BadRequestException("Source khong hop le. Ho tro: ALL, BACKEND, AI.");
        }
    }

    private Criteria buildSourceCriteria(AuditLogSourceScope sourceScope) {
        return switch (sourceScope) {
            case BACKEND -> Criteria.where("service").is(serviceName);
            case AI -> Criteria.where("service").ne(serviceName);
            case ALL -> null;
        };
    }

    private List<String> normalizeEventIds(List<String> eventIds) {
        if (eventIds == null || eventIds.isEmpty()) {
            return List.of();
        }

        List<String> safeEventIds = eventIds.stream()
                .filter(id -> id != null && !id.isBlank())
                .map(String::trim)
                .collect(Collectors.toCollection(LinkedHashSet::new))
                .stream()
                .toList();

        if (safeEventIds.size() > MAX_BULK_DELETE_IDS) {
            throw new BadRequestException("So luong eventId toi da moi lan xoa la " + MAX_BULK_DELETE_IDS + ".");
        }

        return safeEventIds;
    }
}
