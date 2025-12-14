package com.petties.petties.service;

import jakarta.mail.MessagingException;
import jakarta.mail.internet.MimeMessage;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.mail.javamail.JavaMailSender;
import org.springframework.mail.javamail.MimeMessageHelper;
import org.springframework.scheduling.annotation.Async;
import org.springframework.stereotype.Service;

/**
 * Email Service cho việc gửi email OTP verification
 * Sử dụng Gmail SMTP với App Password
 */
@Slf4j
@Service
@RequiredArgsConstructor
public class EmailService {

    private final JavaMailSender mailSender;

    @Value("${spring.mail.username:pettiesservice@gmail.com}")
    private String fromEmail;

    /**
     * Gửi email OTP verification
     * 
     * @param to       Email người nhận
     * @param username Tên người dùng
     * @param otpCode  Mã OTP 6 số
     */
    @Async
    public void sendOtpEmail(String to, String username, String otpCode) {
        try {
            MimeMessage message = mailSender.createMimeMessage();
            MimeMessageHelper helper = new MimeMessageHelper(message, true, "UTF-8");

            helper.setFrom(fromEmail);
            helper.setTo(to);
            helper.setSubject("Xác thực Email - Petties");
            helper.setText(buildOtpEmailTemplate(username, otpCode), true);

            mailSender.send(message);
            log.info("OTP email sent successfully to: {}", to);
        } catch (MessagingException e) {
            log.error("Failed to send OTP email to: {}", to, e);
            throw new RuntimeException("Không thể gửi email OTP. Vui lòng thử lại sau.");
        }
    }

    /**
     * Build HTML email template với style Neobrutalism
     */
    private String buildOtpEmailTemplate(String username, String otpCode) {
        return """
                <!DOCTYPE html>
                <html lang="vi">
                <head>
                    <meta charset="UTF-8">
                    <meta name="viewport" content="width=device-width, initial-scale=1.0">
                    <title>Xác thực Email - Petties</title>
                </head>
                <body style="margin: 0; padding: 0; background-color: #fafaf9; font-family: 'Inter', Arial, sans-serif;">
                    <table width="100%%" cellpadding="0" cellspacing="0" style="background-color: #fafaf9; padding: 40px 20px;">
                        <tr>
                            <td align="center">
                                <table width="480" cellpadding="0" cellspacing="0" style="background-color: #ffffff; border: 4px solid #1c1917; box-shadow: 8px 8px 0 #1c1917;">

                                    <!-- Header -->
                                    <tr>
                                        <td style="padding: 32px 40px 24px; text-align: center; border-bottom: 4px solid #1c1917;">
                                            <span style="font-size: 32px; font-weight: 700; color: #d97706; letter-spacing: 2px;">PETTIES</span>
                                        </td>
                                    </tr>

                                    <!-- Content -->
                                    <tr>
                                        <td style="padding: 32px 40px;">
                                            <h1 style="margin: 0 0 16px; font-size: 24px; font-weight: 700; color: #1c1917; text-transform: uppercase; letter-spacing: 1px;">
                                                XÁC THỰC EMAIL
                                            </h1>
                                            <p style="margin: 0 0 24px; font-size: 14px; color: #57534e; line-height: 1.6;">
                                                Chào <strong style="color: #1c1917;">%s</strong>,<br><br>
                                                Cảm ơn bạn đã đăng ký tài khoản tại Petties. Vui lòng sử dụng mã OTP bên dưới để xác thực email của bạn:
                                            </p>

                                            <!-- OTP Code -->
                                            <table width="100%%" cellpadding="0" cellspacing="0" style="margin: 24px 0;">
                                                <tr>
                                                    <td align="center">
                                                        <div style="display: inline-block; padding: 20px 40px; background-color: #fffbeb; border: 4px solid #1c1917; box-shadow: 4px 4px 0 #1c1917;">
                                                            <span style="font-size: 36px; font-weight: 700; color: #1c1917; letter-spacing: 8px;">%s</span>
                                                        </div>
                                                    </td>
                                                </tr>
                                            </table>

                                            <p style="margin: 0 0 8px; font-size: 13px; color: #78716c; text-align: center;">
                                                Mã có hiệu lực trong <strong style="color: #d97706;">5 phút</strong>
                                            </p>
                                            <p style="margin: 0; font-size: 12px; color: #a8a29e; text-align: center;">
                                                Nếu bạn không yêu cầu mã này, vui lòng bỏ qua email này.
                                            </p>
                                        </td>
                                    </tr>

                                    <!-- Footer -->
                                    <tr>
                                        <td style="padding: 24px 40px; background-color: #fafaf9; border-top: 4px solid #1c1917;">
                                            <p style="margin: 0; font-size: 12px; color: #78716c; text-align: center;">
                                                <strong style="color: #1c1917;">Petties Team</strong><br>
                                                Veterinary Appointment Booking Platform
                                            </p>
                                            <p style="margin: 12px 0 0; font-size: 11px; color: #a8a29e; text-align: center;">
                                                © 2026 Petties. All rights reserved.
                                            </p>
                                        </td>
                                    </tr>

                                </table>
                            </td>
                        </tr>
                    </table>
                </body>
                </html>
                """
                .formatted(username, otpCode);
    }
}
