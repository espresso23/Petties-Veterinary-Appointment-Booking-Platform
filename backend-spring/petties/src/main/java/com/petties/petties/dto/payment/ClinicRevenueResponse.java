package com.petties.petties.dto.payment;

import java.math.BigDecimal;
import java.util.List;
import java.util.Map;

/**
 * Revenue summary response for a clinic.
 * Used by AI assistant analytics tools.
 */
public class ClinicRevenueResponse {

    private String clinicId;
    private String clinicName;
    private String period;
    private double totalRevenue;
    private String currency;
    private List<RevenueItem> items;
    private RevenueBreakdown breakdown;

    public ClinicRevenueResponse() {
    }

    public ClinicRevenueResponse(String clinicId, String clinicName, String period,
                                  double totalRevenue, String currency, List<RevenueItem> items) {
        this.clinicId = clinicId;
        this.clinicName = clinicName;
        this.period = period;
        this.totalRevenue = totalRevenue;
        this.currency = currency;
        this.items = items;
    }

    public String getClinicId() {
        return clinicId;
    }

    public void setClinicId(String clinicId) {
        this.clinicId = clinicId;
    }

    public String getClinicName() {
        return clinicName;
    }

    public void setClinicName(String clinicName) {
        this.clinicName = clinicName;
    }

    public String getPeriod() {
        return period;
    }

    public void setPeriod(String period) {
        this.period = period;
    }

    public double getTotalRevenue() {
        return totalRevenue;
    }

    public void setTotalRevenue(double totalRevenue) {
        this.totalRevenue = totalRevenue;
    }

    public String getCurrency() {
        return currency;
    }

    public void setCurrency(String currency) {
        this.currency = currency;
    }

    public List<RevenueItem> getItems() {
        return items;
    }

    public void setItems(List<RevenueItem> items) {
        this.items = items;
    }

    public RevenueBreakdown getBreakdown() {
        return breakdown;
    }

    public void setBreakdown(RevenueBreakdown breakdown) {
        this.breakdown = breakdown;
    }

    /**
     * Individual revenue item (e.g., daily/monthly aggregate).
     */
    public static class RevenueItem {
        private String label;
        private int count;
        private double totalRevenue;

        public RevenueItem() {
        }

        public RevenueItem(String label, int count, double totalRevenue) {
            this.label = label;
            this.count = count;
            this.totalRevenue = totalRevenue;
        }

        @SuppressWarnings("unchecked")
        public static RevenueItem fromMap(Map<String, Object> map) {
            RevenueItem item = new RevenueItem();
            item.label = map.get("label") != null ? map.get("label").toString() : "";
            item.count = map.get("count") != null ? ((Number) map.get("count")).intValue() : 0;
            item.totalRevenue = map.get("totalRevenue") != null
                    ? ((Number) map.get("totalRevenue")).doubleValue() : 0.0;
            return item;
        }

        public String getLabel() {
            return label;
        }

        public void setLabel(String label) {
            this.label = label;
        }

        public int getCount() {
            return count;
        }

        public void setCount(int count) {
            this.count = count;
        }

        public double getTotalRevenue() {
            return totalRevenue;
        }

        public void setTotalRevenue(double totalRevenue) {
            this.totalRevenue = totalRevenue;
        }
    }

    /**
     * Revenue breakdown by payment method.
     */
    public static class RevenueBreakdown {
        private double qrRevenue;
        private double cashRevenue;
        private double withdrawableAmount;
        private double pendingAmount;

        public RevenueBreakdown() {
        }

        @SuppressWarnings("unchecked")
        public static RevenueBreakdown fromMap(Map<String, Object> map) {
            RevenueBreakdown breakdown = new RevenueBreakdown();
            if (map != null) {
                breakdown.qrRevenue = getDoubleValue(map, "qrRevenue");
                breakdown.cashRevenue = getDoubleValue(map, "cashRevenue");
                breakdown.withdrawableAmount = getDoubleValue(map, "withdrawableAmount");
                breakdown.pendingAmount = getDoubleValue(map, "pendingAmount");
            }
            return breakdown;
        }

        private static double getDoubleValue(Map<String, Object> map, String key) {
            Object value = map.get(key);
            return value != null ? ((Number) value).doubleValue() : 0.0;
        }

        public double getQrRevenue() {
            return qrRevenue;
        }

        public void setQrRevenue(double qrRevenue) {
            this.qrRevenue = qrRevenue;
        }

        public double getCashRevenue() {
            return cashRevenue;
        }

        public void setCashRevenue(double cashRevenue) {
            this.cashRevenue = cashRevenue;
        }

        public double getWithdrawableAmount() {
            return withdrawableAmount;
        }

        public void setWithdrawableAmount(double withdrawableAmount) {
            this.withdrawableAmount = withdrawableAmount;
        }

        public double getPendingAmount() {
            return pendingAmount;
        }

        public void setPendingAmount(double pendingAmount) {
            this.pendingAmount = pendingAmount;
        }
    }
}
