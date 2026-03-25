package com.petties.petties.service;

import com.petties.petties.dto.emr.InternalConfirmedEmrItemDto;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.HttpEntity;
import org.springframework.http.HttpHeaders;
import org.springframework.http.MediaType;
import org.springframework.stereotype.Service;
import org.springframework.util.StringUtils;
import org.springframework.web.client.RestTemplate;

import java.util.List;
@Service
@RequiredArgsConstructor
@Slf4j
public class AiCaseMemorySyncService {

    private static final String INTERNAL_SYNC_PATH = "/api/v1/internal/case-memory/emr-sync";

    private final RestTemplate restTemplate;

    @Value("${app.ai-service-url:http://localhost:8000}")
    private String aiServiceUrl;

    public void syncConfirmedEmr(InternalConfirmedEmrItemDto payload) {
        if (payload == null || !StringUtils.hasText(payload.getFinalDiagnosisText())) {
            return;
        }
        if (!StringUtils.hasText(aiServiceUrl)) {
            log.warn("Skip AI case memory sync because app.ai-service-url is empty");
            return;
        }

        String url = normalizeBaseUrl(aiServiceUrl) + INTERNAL_SYNC_PATH;
        HttpHeaders headers = new HttpHeaders();
        headers.setContentType(MediaType.APPLICATION_JSON);
        headers.setAccept(List.of(MediaType.APPLICATION_JSON));

        try {
            restTemplate.postForEntity(url, new HttpEntity<>(payload, headers), Void.class);
            log.info("Synced confirmed EMR {} to AI case memory", payload.getEmrId());
        } catch (Exception ex) {
            log.warn(
                    "Failed to sync confirmed EMR {} to AI case memory: {}",
                    payload.getEmrId(),
                    ex.getMessage()
            );
        }
    }

    private String normalizeBaseUrl(String baseUrl) {
        return baseUrl.endsWith("/") ? baseUrl.substring(0, baseUrl.length() - 1) : baseUrl;
    }
}
