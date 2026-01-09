package com.petties.petties.dto.chat;

import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.util.UUID;

/**
 * Request DTO for creating a new chat box.
 * Used by Pet Owner to start a chat with a Clinic.
 */
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class CreateChatBoxRequest {

    @NotNull(message = "ID phong kham khong duoc de trong")
    private UUID clinicId;

    @Size(max = 500, message = "Tin nhan khong duoc vuot qua 500 ky tu")
    private String initialMessage;
}
