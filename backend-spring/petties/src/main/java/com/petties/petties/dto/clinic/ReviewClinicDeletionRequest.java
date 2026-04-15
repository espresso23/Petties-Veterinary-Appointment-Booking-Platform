package com.petties.petties.dto.clinic;

import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;
import lombok.Getter;
import lombok.Setter;

@Getter
@Setter
public class ReviewClinicDeletionRequest {

    @NotNull(message = "Hành động duyệt là bắt buộc")
    private ClinicDeletionReviewAction action;

    @Size(max = 2000, message = "Ghi chú không được vượt quá 2000 ký tự")
    private String adminNote;
}
