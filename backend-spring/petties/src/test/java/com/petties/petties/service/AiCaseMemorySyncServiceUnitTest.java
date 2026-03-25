package com.petties.petties.service;

import com.petties.petties.dto.emr.InternalConfirmedEmrItemDto;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.http.HttpEntity;
import org.springframework.http.HttpHeaders;
import org.springframework.test.util.ReflectionTestUtils;
import org.springframework.web.client.RestTemplate;

import java.util.UUID;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.mockingDetails;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;

@DisplayName("AiCaseMemorySyncService Unit Tests")
@org.junit.jupiter.api.Disabled("Compilation issue - needs Lombok fix")
class AiCaseMemorySyncServiceUnitTest {

    @Test
    @DisplayName("Sync confirmed EMR - Gui den AI service khi co url")
    void syncConfirmedEmr_postsToAiServiceWhenEnabled() {
        RestTemplate restTemplate = mock(RestTemplate.class);
        AiCaseMemorySyncService service = new AiCaseMemorySyncService(restTemplate);
        ReflectionTestUtils.setField(service, "aiServiceUrl", "http://ai-service:8000");

        InternalConfirmedEmrItemDto payload = InternalConfirmedEmrItemDto.builder()
                .emrId("emr-1")
                .petId(UUID.randomUUID())
                .finalDiagnosisText("Viem da do vi khuan")
                .verified(true)
                .build();

        service.syncConfirmedEmr(payload);

        verify(restTemplate).postForEntity(
                eq("http://ai-service:8000/api/v1/internal/case-memory/emr-sync"),
                any(HttpEntity.class),
                eq(Void.class)
        );

        HttpEntity<?> requestEntity = (HttpEntity<?>) mockingDetails(restTemplate)
                .getInvocations()
                .stream()
                .filter(invocation -> invocation.getMethod().getName().equals("postForEntity"))
                .findFirst()
                .orElseThrow()
                .getArgument(1);

        HttpHeaders headers = requestEntity.getHeaders();
        assertEquals(payload, requestEntity.getBody());
    }

    @Test
    @DisplayName("Sync confirmed EMR - Bo qua khi payload null")
    void syncConfirmedEmr_skipsWhenPayloadNull() {
        RestTemplate restTemplate = mock(RestTemplate.class);
        AiCaseMemorySyncService service = new AiCaseMemorySyncService(restTemplate);
        ReflectionTestUtils.setField(service, "aiServiceUrl", "http://ai-service:8000");

        service.syncConfirmedEmr(null);

        verify(restTemplate, never()).postForEntity(any(String.class), any(), eq(Void.class));
    }

    @Test
    @DisplayName("Sync confirmed EMR - Bo qua khi ai-service-url empty")
    void syncConfirmedEmr_skipsWhenAiServiceUrlEmpty() {
        RestTemplate restTemplate = mock(RestTemplate.class);
        AiCaseMemorySyncService service = new AiCaseMemorySyncService(restTemplate);
        ReflectionTestUtils.setField(service, "aiServiceUrl", "");

        InternalConfirmedEmrItemDto payload = InternalConfirmedEmrItemDto.builder()
                .emrId("emr-1")
                .finalDiagnosisText("Viem da do vi khuan")
                .build();

        service.syncConfirmedEmr(payload);

        verify(restTemplate, never()).postForEntity(any(String.class), any(), eq(Void.class));
    }
}
