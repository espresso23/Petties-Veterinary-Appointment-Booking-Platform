package com.petties.petties.service;

import com.petties.petties.exception.BadRequestException;
import lombok.RequiredArgsConstructor;
import org.bson.Document;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.data.domain.Sort;
import org.springframework.data.mongodb.core.MongoTemplate;
import org.springframework.data.mongodb.core.query.Criteria;
import org.springframework.data.mongodb.core.query.Query;
import org.springframework.stereotype.Service;

import java.time.OffsetDateTime;
import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

@Service
@RequiredArgsConstructor
public class SystemLogService {

    private static final String COLLECTION = "audit_logs";
    private static final int DEFAULT_PAGE = 1;
    private static final int DEFAULT_PAGE_SIZE = 30;
    private static final int MAX_PAGE_SIZE = 200;

    private final MongoTemplate mongoTemplate;

    @Value("${spring.application.name:petties-backend-spring}")
    private String serviceName;

    public Map<String, Object> getBackendLogs(
            Integer page,
            Integer pageSize,
            String status,
            String action,
            String userId,
            String requestId
    ) {
        int safePage = normalizePage(page);
        int safePageSize = normalizePageSize(pageSize);

        Query query = new Query().addCriteria(Criteria.where("service").is(serviceName));
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
        payload.put("service", serviceName);
        payload.put("total", total);
        payload.put("page", safePage);
        payload.put("page_size", safePageSize);
        payload.put("items", items);
        payload.put("fetchedAt", OffsetDateTime.now().toString());
        return payload;
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
}
