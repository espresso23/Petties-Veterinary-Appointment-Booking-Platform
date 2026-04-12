package com.petties.petties.dto.emr;

import com.fasterxml.jackson.databind.PropertyNamingStrategies;
import com.fasterxml.jackson.databind.annotation.JsonNaming;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.time.LocalDateTime;
import java.util.List;
import java.util.Map;
import java.util.UUID;

import com.fasterxml.jackson.annotation.JsonFormat;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
@JsonNaming(PropertyNamingStrategies.SnakeCaseStrategy.class)
public class InternalConfirmedEmrItemDto {
    private String emrId;
    private UUID petId;
    private UUID clinicId;
    private UUID bookingId;
    private UUID doctorId;
    private String species;
    private String breed;
    /** Tuổi thú cưng tính theo tháng (từ ngày sinh trên hồ sơ), phục vụ Case Memory / AI. */
    private Integer ageMonths;
    /** Giới tính trên hồ sơ thú cưng (ví dụ MALE/FEMALE hoặc chuỗi lưu trong DB). */
    private String sex;
    /** Tiền sử dị ứng trên hồ sơ thú cưng (text). */
    private String allergies;
    private String chiefComplaint;
    private List<String> symptoms;
    private List<String> physicalExam;
    private String clinicalNotes;
    private String finalDiagnosisText;
    private Map<String, Object> soap;
    private Map<String, Object> vitals;
    private List<Map<String, Object>> prescriptions;
    private Map<String, Object> aiDiagnosisContext;
    private boolean verified;
    @JsonFormat(pattern = "yyyy-MM-dd'T'HH:mm:ss")
    private LocalDateTime examAt;
    @JsonFormat(pattern = "yyyy-MM-dd'T'HH:mm:ss")
    private LocalDateTime updatedAt;
    @JsonFormat(pattern = "yyyy-MM-dd'T'HH:mm:ss")
    private LocalDateTime reExaminationDate;
    private Map<String, Object> attachments;
}
