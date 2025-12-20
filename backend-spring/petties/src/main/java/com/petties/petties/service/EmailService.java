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
     * Gửi email OTP cho việc reset password
     *
     * @param to      Email người nhận
     * @param otpCode Mã OTP 6 số
     */
    @Async
    public void sendPasswordResetOtpEmail(String to, String otpCode) {
        try {
            MimeMessage message = mailSender.createMimeMessage();
            MimeMessageHelper helper = new MimeMessageHelper(message, true, "UTF-8");

            helper.setFrom(fromEmail);
            helper.setTo(to);
            helper.setSubject("Đặt lại mật khẩu - Petties");
            helper.setText(buildPasswordResetEmailTemplate(otpCode), true);

            mailSender.send(message);
            log.info("Password reset OTP email sent successfully to: {}", to);
        } catch (MessagingException e) {
            log.error("Failed to send password reset OTP email to: {}", to, e);
            throw new RuntimeException("Không thể gửi email OTP. Vui lòng thử lại sau.");
        }
    }

    /**
     * Build HTML email template cho reset password với style Neobrutalism
     */
    private String buildPasswordResetEmailTemplate(String otpCode) {
        return """
                <!DOCTYPE html>
                <html lang="vi">
                <head>
                    <meta charset="UTF-8">
                    <meta name="viewport" content="width=device-width, initial-scale=1.0">
                    <title>Đặt lại mật khẩu - Petties</title>
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
                                                ĐẶT LẠI MẬT KHẨU
                                            </h1>
                                            <p style="margin: 0 0 24px; font-size: 14px; color: #57534e; line-height: 1.6;">
                                                Chúng tôi nhận được yêu cầu đặt lại mật khẩu cho tài khoản của bạn.<br><br>
                                                Vui lòng sử dụng mã OTP bên dưới để xác nhận yêu cầu:
                                            </p>

                                            <!-- OTP Code -->
                                            <table width="100%%" cellpadding="0" cellspacing="0" style="margin: 24px 0;">
                                                <tr>
                                                    <td align="center">
                                                        <div style="display: inline-block; padding: 20px 40px; background-color: #fef3c7; border: 4px solid #1c1917; box-shadow: 4px 4px 0 #1c1917;">
                                                            <span style="font-size: 36px; font-weight: 700; color: #1c1917; letter-spacing: 8px;">%s</span>
                                                        </div>
                                                    </td>
                                                </tr>
                                            </table>

                                            <p style="margin: 0 0 8px; font-size: 13px; color: #78716c; text-align: center;">
                                                Mã có hiệu lực trong <strong style="color: #d97706;">5 phút</strong>
                                            </p>
                                            <p style="margin: 0; font-size: 12px; color: #a8a29e; text-align: center;">
                                                Nếu bạn không yêu cầu đặt lại mật khẩu, vui lòng bỏ qua email này.
                                            </p>
                                        </td>
                                    </tr>

                                    <!-- Security Notice -->
                                    <tr>
                                        <td style="padding: 0 40px 32px;">
                                            <div style="padding: 16px; background-color: #fef2f2; border: 2px solid #dc2626;">
                                                <p style="margin: 0; font-size: 12px; color: #991b1b; text-align: center;">
                                                    <strong>Lưu ý bảo mật:</strong> Không chia sẻ mã OTP này với bất kỳ ai.
                                                </p>
                                            </div>
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
                .formatted(otpCode);
    }

    /**
     * Gui email OTP cho viec thay doi email.
     * OTP se duoc gui den email moi de xac nhan.
     *
     * @param to      Email moi (noi se nhan OTP)
     * @param otpCode Ma OTP 6 so
     */
    @Async
    public void sendEmailChangeOtpEmail(String to, String otpCode) {
        try {
            MimeMessage message = mailSender.createMimeMessage();
            MimeMessageHelper helper = new MimeMessageHelper(message, true, "UTF-8");

            helper.setFrom(fromEmail);
            helper.setTo(to);
            helper.setSubject("Xac nhan thay doi email - Petties");
            helper.setText(buildEmailChangeOtpTemplate(otpCode), true);

            mailSender.send(message);
            log.info("Email change OTP email sent successfully to: {}", to);
        } catch (MessagingException e) {
            log.error("Failed to send email change OTP email to: {}", to, e);
            throw new RuntimeException("Khong the gui email OTP. Vui long thu lai sau.");
        }
    }

    /**
     * Build HTML email template cho thay doi email voi style Neobrutalism
     */
    private String buildEmailChangeOtpTemplate(String otpCode) {
        return """
                <!DOCTYPE html>
                <html lang="vi">
                <head>
                    <meta charset="UTF-8">
                    <meta name="viewport" content="width=device-width, initial-scale=1.0">
                    <title>Xac nhan thay doi email - Petties</title>
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
                                                XAC NHAN THAY DOI EMAIL
                                            </h1>
                                            <p style="margin: 0 0 24px; font-size: 14px; color: #57534e; line-height: 1.6;">
                                                Chung toi nhan duoc yeu cau thay doi email cho tai khoan cua ban.<br><br>
                                                Vui long su dung ma OTP ben duoi de xac nhan:
                                            </p>

                                            <!-- OTP Code -->
                                            <table width="100%%" cellpadding="0" cellspacing="0" style="margin: 24px 0;">
                                                <tr>
                                                    <td align="center">
                                                        <div style="display: inline-block; padding: 20px 40px; background-color: #ecfccb; border: 4px solid #1c1917; box-shadow: 4px 4px 0 #1c1917;">
                                                            <span style="font-size: 36px; font-weight: 700; color: #1c1917; letter-spacing: 8px;">%s</span>
                                                        </div>
                                                    </td>
                                                </tr>
                                            </table>

                                            <p style="margin: 0 0 8px; font-size: 13px; color: #78716c; text-align: center;">
                                                Ma co hieu luc trong <strong style="color: #d97706;">5 phut</strong>
                                            </p>
                                            <p style="margin: 0; font-size: 12px; color: #a8a29e; text-align: center;">
                                                Neu ban khong yeu cau thay doi email, vui long bo qua email nay.
                                            </p>
                                        </td>
                                    </tr>

                                    <!-- Security Notice -->
                                    <tr>
                                        <td style="padding: 0 40px 32px;">
                                            <div style="padding: 16px; background-color: #fef2f2; border: 2px solid #dc2626;">
                                                <p style="margin: 0; font-size: 12px; color: #991b1b; text-align: center;">
                                                    <strong>Luu y bao mat:</strong> Khong chia se ma OTP nay voi bat ky ai.
                                                </p>
                                            </div>
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
                                                &copy; 2026 Petties. All rights reserved.
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
                .formatted(otpCode);
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
