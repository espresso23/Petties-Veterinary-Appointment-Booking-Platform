package com.petties.petties.dto.chat;

import jakarta.validation.Constraint;
import jakarta.validation.ConstraintValidator;
import jakarta.validation.ConstraintValidatorContext;
import jakarta.validation.Payload;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.lang.annotation.ElementType;
import java.lang.annotation.Retention;
import java.lang.annotation.RetentionPolicy;
import java.lang.annotation.Target;

/**
 * Request DTO for sending a message.
 */
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
@ValidMessageContent
public class SendMessageRequest {

    @Size(max = 2000, message = "Tin nhan khong duoc vuot qua 2000 ky tu")
    private String content;

    private String imageUrl;
}

/**
 * Custom validation annotation to ensure either content or imageUrl is provided.
 */
@Constraint(validatedBy = MessageContentValidator.class)
@Target({ ElementType.TYPE })
@Retention(RetentionPolicy.RUNTIME)
@interface ValidMessageContent {
    String message() default "Noi dung tin nhan hoac anh phai duoc cung cap";
    Class<?>[] groups() default {};
    Class<? extends Payload>[] payload() default {};
}

/**
 * Validator for ValidMessageContent annotation.
 */
class MessageContentValidator implements ConstraintValidator<ValidMessageContent, SendMessageRequest> {

    @Override
    public void initialize(ValidMessageContent constraintAnnotation) {
        // No initialization needed
    }

    @Override
    public boolean isValid(SendMessageRequest request, ConstraintValidatorContext context) {
        if (request == null) {
            return false;
        }

        boolean hasContent = request.getContent() != null && !request.getContent().trim().isEmpty();
        boolean hasImage = request.getImageUrl() != null && !request.getImageUrl().trim().isEmpty();

        return hasContent || hasImage;
    }
}
