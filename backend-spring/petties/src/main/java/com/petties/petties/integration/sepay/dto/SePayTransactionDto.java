package com.petties.petties.integration.sepay.dto;

import com.fasterxml.jackson.annotation.JsonIgnoreProperties;
import com.fasterxml.jackson.databind.PropertyNamingStrategies;
import com.fasterxml.jackson.databind.annotation.JsonNaming;

@JsonIgnoreProperties(ignoreUnknown = true)
@JsonNaming(PropertyNamingStrategies.SnakeCaseStrategy.class)
public class SePayTransactionDto {

    private String id;
    private String bankBrandName;
    private String accountNumber;
    private String transactionDate;
    private String amountOut;
    private String amountIn;
    private String accumulated;
    private String transactionContent;
    private String referenceNumber;
    private String code;
    private String subAccount;
    private String bankAccountId;

    public String getId() {
        return id;
    }

    public void setId(String id) {
        this.id = id;
    }

    public String getBankBrandName() {
        return bankBrandName;
    }

    public void setBankBrandName(String bankBrandName) {
        this.bankBrandName = bankBrandName;
    }

    public String getAccountNumber() {
        return accountNumber;
    }

    public void setAccountNumber(String accountNumber) {
        this.accountNumber = accountNumber;
    }

    public String getTransactionDate() {
        return transactionDate;
    }

    public void setTransactionDate(String transactionDate) {
        this.transactionDate = transactionDate;
    }

    public String getAmountOut() {
        return amountOut;
    }

    public void setAmountOut(String amountOut) {
        this.amountOut = amountOut;
    }

    public String getAmountIn() {
        return amountIn;
    }

    public void setAmountIn(String amountIn) {
        this.amountIn = amountIn;
    }

    public String getAccumulated() {
        return accumulated;
    }

    public void setAccumulated(String accumulated) {
        this.accumulated = accumulated;
    }

    public String getTransactionContent() {
        return transactionContent;
    }

    public void setTransactionContent(String transactionContent) {
        this.transactionContent = transactionContent;
    }

    public String getReferenceNumber() {
        return referenceNumber;
    }

    public void setReferenceNumber(String referenceNumber) {
        this.referenceNumber = referenceNumber;
    }

    public String getCode() {
        return code;
    }

    public void setCode(String code) {
        this.code = code;
    }

    public String getSubAccount() {
        return subAccount;
    }

    public void setSubAccount(String subAccount) {
        this.subAccount = subAccount;
    }

    public String getBankAccountId() {
        return bankAccountId;
    }

    public void setBankAccountId(String bankAccountId) {
        this.bankAccountId = bankAccountId;
    }
}
