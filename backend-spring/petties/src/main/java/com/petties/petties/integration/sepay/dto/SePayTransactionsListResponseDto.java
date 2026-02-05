package com.petties.petties.integration.sepay.dto;

import com.fasterxml.jackson.annotation.JsonIgnoreProperties;

import java.util.List;

@JsonIgnoreProperties(ignoreUnknown = true)
public class SePayTransactionsListResponseDto {

    private Integer status;
    private Object error;
    private SePayMessagesWrapperDto messages;
    private List<SePayTransactionDto> transactions;

    public Integer getStatus() {
        return status;
    }

    public void setStatus(Integer status) {
        this.status = status;
    }

    public Object getError() {
        return error;
    }

    public void setError(Object error) {
        this.error = error;
    }

    public SePayMessagesWrapperDto getMessages() {
        return messages;
    }

    public void setMessages(SePayMessagesWrapperDto messages) {
        this.messages = messages;
    }

    public List<SePayTransactionDto> getTransactions() {
        return transactions;
    }

    public void setTransactions(List<SePayTransactionDto> transactions) {
        this.transactions = transactions;
    }
}
