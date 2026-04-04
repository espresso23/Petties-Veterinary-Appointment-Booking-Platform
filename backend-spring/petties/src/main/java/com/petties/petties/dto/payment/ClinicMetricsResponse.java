package com.petties.petties.dto.payment;

import java.util.List;
import java.util.Map;

/**
 * Clinic performance metrics response.
 * Used by AI Copilot analytics tools.
 */
public class ClinicMetricsResponse {

    private String clinicId;
    private String clinicName;
    private int totalBookings;
    private int completedBookings;
    private int cancelledBookings;
    private int pendingBookings;
    private double totalRevenue;
    private String currency;
    private String period;
    private List<ServiceMetric> topServices;

    public ClinicMetricsResponse() {
    }

    public ClinicMetricsResponse(String clinicId, String clinicName, int totalBookings,
                                  int completedBookings, int cancelledBookings, int pendingBookings,
                                  double totalRevenue, String currency, String period,
                                  List<ServiceMetric> topServices) {
        this.clinicId = clinicId;
        this.clinicName = clinicName;
        this.totalBookings = totalBookings;
        this.completedBookings = completedBookings;
        this.cancelledBookings = cancelledBookings;
        this.pendingBookings = pendingBookings;
        this.totalRevenue = totalRevenue;
        this.currency = currency;
        this.period = period;
        this.topServices = topServices;
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

    public int getTotalBookings() {
        return totalBookings;
    }

    public void setTotalBookings(int totalBookings) {
        this.totalBookings = totalBookings;
    }

    public int getCompletedBookings() {
        return completedBookings;
    }

    public void setCompletedBookings(int completedBookings) {
        this.completedBookings = completedBookings;
    }

    public int getCancelledBookings() {
        return cancelledBookings;
    }

    public void setCancelledBookings(int cancelledBookings) {
        this.cancelledBookings = cancelledBookings;
    }

    public int getPendingBookings() {
        return pendingBookings;
    }

    public void setPendingBookings(int pendingBookings) {
        this.pendingBookings = pendingBookings;
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

    public String getPeriod() {
        return period;
    }

    public void setPeriod(String period) {
        this.period = period;
    }

    public List<ServiceMetric> getTopServices() {
        return topServices;
    }

    public void setTopServices(List<ServiceMetric> topServices) {
        this.topServices = topServices;
    }

    /**
     * Top service metric.
     */
    public static class ServiceMetric {
        private String name;
        private int count;
        private double revenue;

        public ServiceMetric() {
        }

        public ServiceMetric(String name, int count, double revenue) {
            this.name = name;
            this.count = count;
            this.revenue = revenue;
        }

        public String getName() {
            return name;
        }

        public void setName(String name) {
            this.name = name;
        }

        public int getCount() {
            return count;
        }

        public void setCount(int count) {
            this.count = count;
        }

        public double getRevenue() {
            return revenue;
        }

        public void setRevenue(double revenue) {
            this.revenue = revenue;
        }
    }

    /**
     * Build from raw revenue summary data.
     */
    @SuppressWarnings("unchecked")
    public static ClinicMetricsResponse fromRevenueData(String clinicId, String clinicName,
                                                         String period, List<Map<String, Object>> items) {
        ClinicMetricsResponse response = new ClinicMetricsResponse();
        response.setClinicId(clinicId);
        response.setClinicName(clinicName);
        response.setPeriod(period);
        response.setCurrency("VND");

        int totalBookings = 0;
        double totalRevenue = 0.0;

        for (Map<String, Object> item : items) {
            int count = item.get("count") != null ? ((Number) item.get("count")).intValue() : 0;
            double revenue = item.get("totalRevenue") != null
                    ? ((Number) item.get("totalRevenue")).doubleValue() : 0.0;
            totalBookings += count;
            totalRevenue += revenue;
        }

        response.setTotalBookings(totalBookings);
        response.setTotalRevenue(totalRevenue);

        // Placeholder for detailed breakdown - would need additional queries
        response.setCompletedBookings(0);
        response.setCancelledBookings(0);
        response.setPendingBookings(0);
        response.setTopServices(List.of());

        return response;
    }
}
