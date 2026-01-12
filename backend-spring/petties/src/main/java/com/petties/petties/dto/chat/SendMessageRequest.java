package com.petties.petties.dto.chat;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

/**
 * Request DTO for sending a message.
 */
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class SendMessageRequest {

    @NotBlank(message = "Noi dung tin nhan khong duoc de trong")
    @Size(max = 2000, message = "Tin nhan khong duoc vuot qua 2000 ky tu")
    private String content;
}
