package com.petties.petties.integration.sepay;

import com.petties.petties.exception.BadRequestException;
import com.petties.petties.integration.sepay.dto.SePayTransactionsListResponseDto;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.HttpEntity;
import org.springframework.http.HttpHeaders;
import org.springframework.http.HttpMethod;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.stereotype.Component;
import org.springframework.web.client.RestTemplate;
import org.springframework.web.util.UriComponentsBuilder;

import java.net.URI;
import java.util.Objects;

@Component
@RequiredArgsConstructor
@Slf4j
public class SePayClient {

    private final RestTemplate restTemplate;

    @Value("${sepay.base-url:https://my.sepay.vn/userapi}")
    private String baseUrl;

    @Value("${sepay.api-token:}")
    private String apiToken;

    public SePayTransactionsListResponseDto listTransactions(Integer limit,
                                                            String accountNumber,
                                                            String transactionDateMin,
                                                            String transactionDateMax,
                                                            String sinceId) {
        if (apiToken == null || apiToken.isBlank()) {
            throw new BadRequestException("Chưa cấu hình SEPAY_API_TOKEN");
        }

        UriComponentsBuilder builder = UriComponentsBuilder
                .fromHttpUrl(baseUrl)
                .path("/transactions/list");

        if (limit != null) {
            builder.queryParam("limit", limit);
        }
        if (accountNumber != null && !accountNumber.isBlank()) {
            builder.queryParam("account_number", accountNumber);
        }
        if (transactionDateMin != null && !transactionDateMin.isBlank()) {
            builder.queryParam("transaction_date_min", transactionDateMin);
        }
        if (transactionDateMax != null && !transactionDateMax.isBlank()) {
            builder.queryParam("transaction_date_max", transactionDateMax);
        }
        if (sinceId != null && !sinceId.isBlank()) {
            builder.queryParam("since_id", sinceId);
        }

        URI uri = builder.build().encode().toUri();

        HttpHeaders headers = new HttpHeaders();
        headers.setContentType(MediaType.APPLICATION_JSON);
        headers.set(HttpHeaders.AUTHORIZATION, "Bearer " + apiToken);

        HttpEntity<Void> entity = new HttpEntity<>(headers);

        try {
            ResponseEntity<SePayTransactionsListResponseDto> response = restTemplate.exchange(
                    uri,
                    HttpMethod.GET,
                    entity,
                    SePayTransactionsListResponseDto.class
            );

            SePayTransactionsListResponseDto body = response.getBody();
            if (body == null) {
                throw new BadRequestException("Không nhận được dữ liệu từ SePay");
            }

            if (!Objects.equals(body.getStatus(), 200)) {
                throw new BadRequestException("Gọi SePay thất bại");
            }

            return body;
        } catch (BadRequestException e) {
            throw e;
        } catch (Exception e) {
            log.error("SePay listTransactions error: {}", e.getMessage());
            throw new BadRequestException("Không thể kết nối SePay. Vui lòng thử lại sau");
        }
    }
}
