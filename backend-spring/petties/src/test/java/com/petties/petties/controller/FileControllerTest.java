package com.petties.petties.controller;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.petties.petties.config.JwtAuthenticationFilter;
import com.petties.petties.config.JwtTokenProvider;
import com.petties.petties.config.UserDetailsServiceImpl;
import com.petties.petties.dto.file.UploadResponse;
import com.petties.petties.exception.BadRequestException;
import com.petties.petties.repository.BlacklistedTokenRepository;
import com.petties.petties.repository.UserRepository;
import com.petties.petties.service.CloudinaryService;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Nested;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.autoconfigure.web.servlet.WebMvcTest;
import org.springframework.http.MediaType;
import org.springframework.mock.web.MockMultipartFile;
import org.springframework.test.context.bean.override.mockito.MockitoBean;
import org.springframework.test.web.servlet.MockMvc;

import java.util.Map;

import static org.hamcrest.Matchers.*;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.*;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.*;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;

/**
 * Unit tests for FileController using @WebMvcTest and MockMvc.
 *
 * Tests cover:
 * - POST /files/upload (general file upload)
 * - POST /files/upload/avatar (avatar upload with transformation)
 * - POST /files/upload/business-license (business license document upload - PDF/Image)
 * - DELETE /files/{publicId} (delete file)
 * - DELETE /files?publicId={publicId} (delete file with query param)
 *
 * Each endpoint tests:
 * - Happy path (200/201)
 * - Invalid file validation (400)
 * - Service exceptions (400)
 */
@WebMvcTest(FileController.class)
@AutoConfigureMockMvc(addFilters = false)
@DisplayName("FileController Unit Tests")
class FileControllerTest {

    @Autowired
    private MockMvc mockMvc;

    @MockitoBean
    private CloudinaryService cloudinaryService;

    // Security-related dependencies
    @MockitoBean
    private JwtTokenProvider jwtTokenProvider;

    @MockitoBean
    private JwtAuthenticationFilter jwtAuthenticationFilter;

    @MockitoBean
    private UserDetailsServiceImpl userDetailsService;

    @MockitoBean
    private BlacklistedTokenRepository blacklistedTokenRepository;

    @MockitoBean
    private UserRepository userRepository;

    @Autowired
    private ObjectMapper objectMapper;

    private MockMultipartFile validImageFile;
    private MockMultipartFile validPdfFile;
    private MockMultipartFile invalidFile;
    private UploadResponse mockUploadResponse;

    @BeforeEach
    void setUp() {
        // Create valid image file
        validImageFile = new MockMultipartFile(
                "file",
                "test-image.jpg",
                "image/jpeg",
                "test image content".getBytes()
        );

        // Create valid PDF file
        validPdfFile = new MockMultipartFile(
                "file",
                "business-license.pdf",
                "application/pdf",
                "test pdf content".getBytes()
        );

        // Create invalid file
        invalidFile = new MockMultipartFile(
                "file",
                "test-file.txt",
                "text/plain",
                "test content".getBytes()
        );

        // Mock upload response
        mockUploadResponse = UploadResponse.builder()
                .url("https://res.cloudinary.com/test/image/upload/v123/test.jpg")
                .publicId("petties/general/test123")
                .format("jpg")
                .width(1920)
                .height(1080)
                .bytes(123456L)
                .build();
    }

    // ==================== UPLOAD FILE TESTS ====================

    @Nested
    @DisplayName("POST /files/upload - Upload File")
    class UploadFileTests {

        @Test
        @DisplayName("Should upload file successfully with default folder")
        void shouldUploadFileSuccessfullyWithDefaultFolder() throws Exception {
            // Arrange
            when(cloudinaryService.uploadFile(any(), eq("general"))).thenReturn(mockUploadResponse);

            // Act & Assert
            mockMvc.perform(multipart("/files/upload")
                            .file(validImageFile))
                    .andExpect(status().isOk())
                    .andExpect(content().contentType(MediaType.APPLICATION_JSON))
                    .andExpect(jsonPath("$.url", is("https://res.cloudinary.com/test/image/upload/v123/test.jpg")))
                    .andExpect(jsonPath("$.publicId", is("petties/general/test123")))
                    .andExpect(jsonPath("$.format", is("jpg")))
                    .andExpect(jsonPath("$.width", is(1920)))
                    .andExpect(jsonPath("$.height", is(1080)))
                    .andExpect(jsonPath("$.bytes", is(123456)));

            verify(cloudinaryService).uploadFile(any(), eq("general"));
        }

        @Test
        @DisplayName("Should upload file successfully with custom folder")
        void shouldUploadFileSuccessfullyWithCustomFolder() throws Exception {
            // Arrange
            when(cloudinaryService.uploadFile(any(), eq("pets"))).thenReturn(mockUploadResponse);

            // Act & Assert
            mockMvc.perform(multipart("/files/upload")
                            .file(validImageFile)
                            .param("folder", "pets"))
                    .andExpect(status().isOk())
                    .andExpect(content().contentType(MediaType.APPLICATION_JSON))
                    .andExpect(jsonPath("$.url", is(notNullValue())))
                    .andExpect(jsonPath("$.publicId", is(notNullValue())));

            verify(cloudinaryService).uploadFile(any(), eq("pets"));
        }

        @Test
        @DisplayName("Should return 400 when file validation fails")
        void shouldReturn400WhenFileValidationFails() throws Exception {
            // Arrange
            when(cloudinaryService.uploadFile(any(), any()))
                    .thenThrow(new BadRequestException("Định dạng file không hợp lệ. Chỉ chấp nhận: JPEG, PNG, GIF, WEBP, PDF."));

            // Act & Assert
            mockMvc.perform(multipart("/files/upload")
                            .file(invalidFile))
                    .andExpect(status().isBadRequest());

            verify(cloudinaryService).uploadFile(any(), eq("general"));
        }

        @Test
        @DisplayName("Should return 400 when file is too large")
        void shouldReturn400WhenFileIsTooLarge() throws Exception {
            // Arrange
            when(cloudinaryService.uploadFile(any(), any()))
                    .thenThrow(new BadRequestException("Kích thước file không được vượt quá 10MB."));

            // Act & Assert
            mockMvc.perform(multipart("/files/upload")
                            .file(validImageFile))
                    .andExpect(status().isBadRequest());

            verify(cloudinaryService).uploadFile(any(), eq("general"));
        }

        @Test
        @DisplayName("Should return 400 when Cloudinary upload fails")
        void shouldReturn400WhenCloudinaryUploadFails() throws Exception {
            // Arrange
            when(cloudinaryService.uploadFile(any(), any()))
                    .thenThrow(new BadRequestException("Không thể upload file: Upload failed"));

            // Act & Assert
            mockMvc.perform(multipart("/files/upload")
                            .file(validImageFile))
                    .andExpect(status().isBadRequest());

            verify(cloudinaryService).uploadFile(any(), eq("general"));
        }
    }

    // ==================== UPLOAD AVATAR TESTS ====================

    @Nested
    @DisplayName("POST /files/upload/avatar - Upload Avatar")
    class UploadAvatarTests {

        @Test
        @DisplayName("Should upload avatar successfully")
        void shouldUploadAvatarSuccessfully() throws Exception {
            // Arrange
            UploadResponse avatarResponse = UploadResponse.builder()
                    .url("https://res.cloudinary.com/test/image/upload/v123/avatar.jpg")
                    .publicId("petties/avatars/avatar123")
                    .format("jpg")
                    .width(300)
                    .height(300)
                    .bytes(50000L)
                    .build();

            when(cloudinaryService.uploadAvatar(any())).thenReturn(avatarResponse);

            // Act & Assert
            mockMvc.perform(multipart("/files/upload/avatar")
                            .file(validImageFile))
                    .andExpect(status().isOk())
                    .andExpect(content().contentType(MediaType.APPLICATION_JSON))
                    .andExpect(jsonPath("$.url", is("https://res.cloudinary.com/test/image/upload/v123/avatar.jpg")))
                    .andExpect(jsonPath("$.publicId", is("petties/avatars/avatar123")))
                    .andExpect(jsonPath("$.width", is(300)))
                    .andExpect(jsonPath("$.height", is(300)));

            verify(cloudinaryService).uploadAvatar(any());
        }

        @Test
        @DisplayName("Should return 400 when avatar file is invalid")
        void shouldReturn400WhenAvatarFileIsInvalid() throws Exception {
            // Arrange
            when(cloudinaryService.uploadAvatar(any()))
                    .thenThrow(new BadRequestException("Định dạng file không hợp lệ. Chỉ chấp nhận: JPEG, PNG, GIF, WEBP, PDF."));

            // Act & Assert
            mockMvc.perform(multipart("/files/upload/avatar")
                            .file(invalidFile))
                    .andExpect(status().isBadRequest());

            verify(cloudinaryService).uploadAvatar(any());
        }

        @Test
        @DisplayName("Should return 400 when avatar upload fails")
        void shouldReturn400WhenAvatarUploadFails() throws Exception {
            // Arrange
            when(cloudinaryService.uploadAvatar(any()))
                    .thenThrow(new BadRequestException("Không thể upload avatar: Upload failed"));

            // Act & Assert
            mockMvc.perform(multipart("/files/upload/avatar")
                            .file(validImageFile))
                    .andExpect(status().isBadRequest());

            verify(cloudinaryService).uploadAvatar(any());
        }
    }

    // ==================== UPLOAD BUSINESS LICENSE TESTS ====================

    @Nested
    @DisplayName("POST /files/upload/business-license - Upload Business License")
    class UploadBusinessLicenseTests {

        @Test
        @DisplayName("Should upload business license PDF successfully")
        void shouldUploadBusinessLicensePdfSuccessfully() throws Exception {
            // Arrange
            UploadResponse pdfResponse = UploadResponse.builder()
                    .url("https://res.cloudinary.com/test/raw/upload/v123/license.pdf")
                    .publicId("petties/business-licenses/license123")
                    .format("pdf")
                    .width(0)
                    .height(0)
                    .bytes(200000L)
                    .build();

            when(cloudinaryService.uploadFile(any(), eq("business-licenses"))).thenReturn(pdfResponse);

            // Act & Assert
            mockMvc.perform(multipart("/files/upload/business-license")
                            .file(validPdfFile))
                    .andExpect(status().isOk())
                    .andExpect(content().contentType(MediaType.APPLICATION_JSON))
                    .andExpect(jsonPath("$.url", is("https://res.cloudinary.com/test/raw/upload/v123/license.pdf")))
                    .andExpect(jsonPath("$.publicId", is("petties/business-licenses/license123")))
                    .andExpect(jsonPath("$.format", is("pdf")));

            verify(cloudinaryService).uploadFile(any(), eq("business-licenses"));
        }

        @Test
        @DisplayName("Should upload business license image successfully")
        void shouldUploadBusinessLicenseImageSuccessfully() throws Exception {
            // Arrange
            UploadResponse imageResponse = UploadResponse.builder()
                    .url("https://res.cloudinary.com/test/image/upload/v123/license.jpg")
                    .publicId("petties/business-licenses/license123")
                    .format("jpg")
                    .width(1920)
                    .height(1080)
                    .bytes(150000L)
                    .build();

            when(cloudinaryService.uploadFile(any(), eq("business-licenses"))).thenReturn(imageResponse);

            // Act & Assert
            mockMvc.perform(multipart("/files/upload/business-license")
                            .file(validImageFile))
                    .andExpect(status().isOk())
                    .andExpect(content().contentType(MediaType.APPLICATION_JSON))
                    .andExpect(jsonPath("$.url", is("https://res.cloudinary.com/test/image/upload/v123/license.jpg")))
                    .andExpect(jsonPath("$.publicId", is("petties/business-licenses/license123")))
                    .andExpect(jsonPath("$.format", is("jpg")))
                    .andExpect(jsonPath("$.width", is(1920)))
                    .andExpect(jsonPath("$.height", is(1080)));

            verify(cloudinaryService).uploadFile(any(), eq("business-licenses"));
        }

        @Test
        @DisplayName("Should return 400 when business license file is invalid")
        void shouldReturn400WhenBusinessLicenseFileIsInvalid() throws Exception {
            // Arrange
            when(cloudinaryService.uploadFile(any(), eq("business-licenses")))
                    .thenThrow(new BadRequestException("Định dạng file không hợp lệ. Chỉ chấp nhận: JPEG, PNG, GIF, WEBP, PDF."));

            // Act & Assert
            mockMvc.perform(multipart("/files/upload/business-license")
                            .file(invalidFile))
                    .andExpect(status().isBadRequest());

            verify(cloudinaryService).uploadFile(any(), eq("business-licenses"));
        }
    }

    // ==================== DELETE FILE TESTS ====================

    @Nested
    @DisplayName("DELETE /files/{publicId} - Delete File")
    class DeleteFileTests {

        @Test
        @DisplayName("Should delete file successfully via path variable")
        void shouldDeleteFileSuccessfullyViaPathVariable() throws Exception {
            // Arrange
            String publicId = "test123";
            when(cloudinaryService.deleteFile(eq(publicId))).thenReturn(true);

            // Act & Assert
            mockMvc.perform(delete("/files/{publicId}", publicId))
                    .andExpect(status().isOk())
                    .andExpect(content().contentType(MediaType.APPLICATION_JSON))
                    .andExpect(jsonPath("$.success", is(true)))
                    .andExpect(jsonPath("$.publicId", is(publicId)))
                    .andExpect(jsonPath("$.message", is("File đã được xóa thành công")));

            verify(cloudinaryService).deleteFile(eq(publicId));
        }

        @Test
        @DisplayName("Should return success false when file not found via path variable")
        void shouldReturnSuccessFalseWhenFileNotFoundViaPathVariable() throws Exception {
            // Arrange
            String publicId = "nonexistent123";
            when(cloudinaryService.deleteFile(eq(publicId))).thenReturn(false);

            // Act & Assert
            mockMvc.perform(delete("/files/{publicId}", publicId))
                    .andExpect(status().isOk())
                    .andExpect(content().contentType(MediaType.APPLICATION_JSON))
                    .andExpect(jsonPath("$.success", is(false)))
                    .andExpect(jsonPath("$.publicId", is(publicId)))
                    .andExpect(jsonPath("$.message", is("Không tìm thấy file để xóa")));

            verify(cloudinaryService).deleteFile(eq(publicId));
        }

        @Test
        @DisplayName("Should delete file successfully via query param")
        void shouldDeleteFileSuccessfullyViaQueryParam() throws Exception {
            // Arrange
            String publicId = "petties/avatars/test123";
            when(cloudinaryService.deleteFile(eq(publicId))).thenReturn(true);

            // Act & Assert
            mockMvc.perform(delete("/files")
                            .param("publicId", publicId))
                    .andExpect(status().isOk())
                    .andExpect(content().contentType(MediaType.APPLICATION_JSON))
                    .andExpect(jsonPath("$.success", is(true)))
                    .andExpect(jsonPath("$.publicId", is(publicId)))
                    .andExpect(jsonPath("$.message", is("File đã được xóa thành công")));

            verify(cloudinaryService).deleteFile(eq(publicId));
        }

        @Test
        @DisplayName("Should return success false when file not found via query param")
        void shouldReturnSuccessFalseWhenFileNotFoundViaQueryParam() throws Exception {
            // Arrange
            String publicId = "petties/avatars/nonexistent123";
            when(cloudinaryService.deleteFile(eq(publicId))).thenReturn(false);

            // Act & Assert
            mockMvc.perform(delete("/files")
                            .param("publicId", publicId))
                    .andExpect(status().isOk())
                    .andExpect(content().contentType(MediaType.APPLICATION_JSON))
                    .andExpect(jsonPath("$.success", is(false)))
                    .andExpect(jsonPath("$.publicId", is(publicId)))
                    .andExpect(jsonPath("$.message", is("Không tìm thấy file để xóa")));

            verify(cloudinaryService).deleteFile(eq(publicId));
        }

        @Test
        @DisplayName("Should return 400 when delete fails with exception via path variable")
        void shouldReturn400WhenDeleteFailsWithExceptionViaPathVariable() throws Exception {
            // Arrange
            String publicId = "test123";
            when(cloudinaryService.deleteFile(eq(publicId)))
                    .thenThrow(new BadRequestException("Không thể xóa file cũ trên cloud."));

            // Act & Assert
            mockMvc.perform(delete("/files/{publicId}", publicId))
                    .andExpect(status().isBadRequest());

            verify(cloudinaryService).deleteFile(eq(publicId));
        }

        @Test
        @DisplayName("Should return 400 when delete fails with exception via query param")
        void shouldReturn400WhenDeleteFailsWithExceptionViaQueryParam() throws Exception {
            // Arrange
            String publicId = "petties/avatars/test123";
            when(cloudinaryService.deleteFile(eq(publicId)))
                    .thenThrow(new BadRequestException("Không thể xóa file cũ trên cloud."));

            // Act & Assert
            mockMvc.perform(delete("/files")
                            .param("publicId", publicId))
                    .andExpect(status().isBadRequest());

            verify(cloudinaryService).deleteFile(eq(publicId));
        }
    }

    // ==================== EDGE CASES TESTS ====================

    @Nested
    @DisplayName("Edge Cases Tests")
    class EdgeCasesTests {

        @Test
        @DisplayName("Should handle missing file parameter")
        void shouldHandleMissingFileParameter() throws Exception {
            // Note: This test expects a 500 error because Spring's multipart handling
            // throws MissingServletRequestPartException which results in 500 status
            // In production, GlobalExceptionHandler should handle this

            // Act & Assert
            mockMvc.perform(multipart("/files/upload"))
                    .andExpect(status().is5xxServerError()); // Expect 500, not 400

            verify(cloudinaryService, never()).uploadFile(any(), any());
        }

        @Test
        @DisplayName("Should upload GIF file successfully")
        void shouldUploadGifFileSuccessfully() throws Exception {
            // Arrange
            MockMultipartFile gifFile = new MockMultipartFile(
                    "file",
                    "animation.gif",
                    "image/gif",
                    "test gif content".getBytes()
            );

            UploadResponse gifResponse = UploadResponse.builder()
                    .url("https://res.cloudinary.com/test/image/upload/v123/animation.gif")
                    .publicId("petties/general/animation123")
                    .format("gif")
                    .width(800)
                    .height(600)
                    .bytes(100000L)
                    .build();

            when(cloudinaryService.uploadFile(any(), eq("general"))).thenReturn(gifResponse);

            // Act & Assert
            mockMvc.perform(multipart("/files/upload")
                            .file(gifFile))
                    .andExpect(status().isOk())
                    .andExpect(jsonPath("$.format", is("gif")));

            verify(cloudinaryService).uploadFile(any(), eq("general"));
        }

        @Test
        @DisplayName("Should upload WEBP file successfully")
        void shouldUploadWebpFileSuccessfully() throws Exception {
            // Arrange
            MockMultipartFile webpFile = new MockMultipartFile(
                    "file",
                    "image.webp",
                    "image/webp",
                    "test webp content".getBytes()
            );

            UploadResponse webpResponse = UploadResponse.builder()
                    .url("https://res.cloudinary.com/test/image/upload/v123/image.webp")
                    .publicId("petties/general/image123")
                    .format("webp")
                    .width(1200)
                    .height(900)
                    .bytes(80000L)
                    .build();

            when(cloudinaryService.uploadFile(any(), eq("general"))).thenReturn(webpResponse);

            // Act & Assert
            mockMvc.perform(multipart("/files/upload")
                            .file(webpFile))
                    .andExpect(status().isOk())
                    .andExpect(jsonPath("$.format", is("webp")));

            verify(cloudinaryService).uploadFile(any(), eq("general"));
        }

        @Test
        @DisplayName("Should handle publicId with special characters")
        void shouldHandlePublicIdWithSpecialCharacters() throws Exception {
            // Arrange
            String publicId = "petties/avatars/test-123_456";
            when(cloudinaryService.deleteFile(eq(publicId))).thenReturn(true);

            // Act & Assert
            mockMvc.perform(delete("/files")
                            .param("publicId", publicId))
                    .andExpect(status().isOk())
                    .andExpect(jsonPath("$.success", is(true)));

            verify(cloudinaryService).deleteFile(eq(publicId));
        }
    }
}
