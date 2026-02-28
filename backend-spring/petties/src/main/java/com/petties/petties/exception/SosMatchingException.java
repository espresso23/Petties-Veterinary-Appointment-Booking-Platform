package com.petties.petties.exception;

/**
 * Custom exception for SOS Matching errors
 * Used when SOS matching process fails due to business logic violations
 */
public class SosMatchingException extends RuntimeException {

    private final SosErrorCode errorCode;

    public SosMatchingException(String message) {
        super(message);
        this.errorCode = SosErrorCode.GENERAL_ERROR;
    }

    public SosMatchingException(String message, SosErrorCode errorCode) {
        super(message);
        this.errorCode = errorCode;
    }

    public SosMatchingException(String message, Throwable cause) {
        super(message, cause);
        this.errorCode = SosErrorCode.GENERAL_ERROR;
    }

    public SosMatchingException(String message, SosErrorCode errorCode, Throwable cause) {
        super(message, cause);
        this.errorCode = errorCode;
    }

    public SosErrorCode getErrorCode() {
        return errorCode;
    }

    /**
     * Error codes for SOS matching operations
     */
    public enum SosErrorCode {
        // Active booking errors
        ACTIVE_BOOKING_EXISTS("Bạn đã có yêu cầu SOS đang hoạt động"),

        // Pet/ownership errors
        PET_NOT_FOUND("Không tìm thấy thú cưng"),
        PET_NOT_OWNED("Bạn không sở hữu thú cưng này"),

        // Clinic matching errors
        NO_CLINICS_IN_RANGE("Không tìm thấy phòng khám trong phạm vi tìm kiếm"),
        ALL_CLINICS_DECLINED("Tất cả phòng khám đã từ chối yêu cầu"),
        CLINIC_TIMEOUT("Phòng khám không phản hồi trong thời gian quy định"),

        // Confirmation errors
        BOOKING_NOT_PENDING("Yêu cầu không ở trạng thái chờ xác nhận"),
        MANAGER_NOT_AUTHORIZED("Bạn không có quyền xác nhận yêu cầu này"),
        STAFF_NOT_AVAILABLE("Nhân viên được chọn không khả dụng"),

        // Session/state errors
        SESSION_EXPIRED("Phiên tìm kiếm đã hết hạn"),
        SESSION_NOT_FOUND("Không tìm thấy phiên tìm kiếm"),

        // Cancellation errors
        CANNOT_CANCEL("Không thể hủy yêu cầu ở trạng thái hiện tại"),
        NOT_OWNER("Bạn không có quyền hủy yêu cầu này"),

        // General
        GENERAL_ERROR("Có lỗi xảy ra trong quá trình xử lý SOS");

        private final String defaultMessage;

        SosErrorCode(String defaultMessage) {
            this.defaultMessage = defaultMessage;
        }

        public String getDefaultMessage() {
            return defaultMessage;
        }
    }
}
