package com.petties.petties.controller;

import com.petties.petties.integration.sepay.SePayClient;
import com.petties.petties.integration.sepay.dto.SePayTransactionsListResponseDto;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import java.util.HashMap;
import java.util.Map;

@RestController
@RequestMapping("/sepay")
@RequiredArgsConstructor
@Slf4j
public class SePayController {

    private final SePayClient sePayClient;

    @GetMapping("/transactions")
    public ResponseEntity<Map<String, Object>> listTransactions(
            @RequestParam(defaultValue = "200") Integer limit,
            @RequestParam(required = false, name = "account_number") String accountNumber,
            @RequestParam(required = false, name = "transaction_date_min") String transactionDateMin,
            @RequestParam(required = false, name = "transaction_date_max") String transactionDateMax,
            @RequestParam(required = false, name = "since_id") String sinceId
    ) {
        log.info("List SePay transactions, limit={}", limit);

        SePayTransactionsListResponseDto responseDto = sePayClient.listTransactions(
                limit,
                accountNumber,
                transactionDateMin,
                transactionDateMax,
                sinceId
        );

        Map<String, Object> response = new HashMap<>();
        response.put("success", true);
        response.put("count", responseDto.getTransactions() != null ? responseDto.getTransactions().size() : 0);
        response.put("transactions", responseDto.getTransactions());
        response.put("message", "Lấy danh sách giao dịch thành công");

        return ResponseEntity.ok(response);
    }
}
