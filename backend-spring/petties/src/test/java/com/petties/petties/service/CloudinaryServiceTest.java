package com.petties.petties.service;

import com.cloudinary.Cloudinary;
import com.cloudinary.Uploader;
import com.petties.petties.dto.file.UploadResponse;
import com.petties.petties.exception.BadRequestException;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Nested;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.mock.web.MockMultipartFile;
import org.springframework.web.multipart.MultipartFile;

import java.io.IOException;
import java.util.HashMap;
import java.util.Map;

import static org.assertj.core.api.Assertions.*;
import static org.mockito.ArgumentMatchers.*;
import static org.mockito.Mockito.*;

/**
 * Unit tests for CloudinaryService.
 *
 * Tests cover:
 * - uploadFile() with valid/invalid files
 * - uploadAvatar() with transformation
 * - uploadClinicImage() with transformation
 * - uploadEmrImage() with transformation
 * - deleteFile() success and failure scenarios
 * - File validation (size, content type, null/empty)
 * - Cloudinary configuration check
 */
@ExtendWith(MockitoExtension.class)
@DisplayName("CloudinaryService Unit Tests")
class CloudinaryServiceTest {

    @Mock(lenient = true)
    private Uploader uploader;

    @InjectMocks
    private CloudinaryService cloudinaryService;

    private Cloudinary cloudinary;
    private MockMultipartFile validImageFile;
    private MockMultipartFile validPdfFile;
    private MockMultipartFile invalidFile;
    private MockMultipartFile oversizedFile;
    private Map<String, Object> mockUploadResult;

    @BeforeEach
    void setUp() throws NoSuchFieldException, IllegalAccessException {
        // Create real Cloudinary instance with test config
        Map<String, String> config = new HashMap<>();
        config.put("cloud_name", "test-cloud");
        config.put("api_key", "test-key");
        config.put("api_secret", "test-secret");
        cloudinary = new Cloudinary(config);

        // Inject mocked Cloudinary into CloudinaryService using reflection
        java.lang.reflect.Field cloudinaryField = CloudinaryService.class.getDeclaredField("cloudinary");
        cloudinaryField.setAccessible(true);
        cloudinaryField.set(cloudinaryService, cloudinary);

        // Mock the uploader method to return our mocked uploader (lenient mode)
        cloudinary = spy(cloudinary);
        lenient().when(cloudinary.uploader()).thenReturn(uploader);

        // Re-inject the spied Cloudinary
        cloudinaryField.set(cloudinaryService, cloudinary);

        // Create valid image file (JPEG)
        validImageFile = new MockMultipartFile(
                "file",
                "test-image.jpg",
                "image/jpeg",
                "test image content".getBytes()
        );

        // Create valid PDF file
        validPdfFile = new MockMultipartFile(
                "file",
                "test-document.pdf",
                "application/pdf",
                "test pdf content".getBytes()
        );

        // Create invalid file (unsupported type)
        invalidFile = new MockMultipartFile(
                "file",
                "test-file.txt",
                "text/plain",
                "test content".getBytes()
        );

        // Create oversized file (> 10MB)
        byte[] largeContent = new byte[11 * 1024 * 1024]; // 11MB
        oversizedFile = new MockMultipartFile(
                "file",
                "large-image.jpg",
                "image/jpeg",
                largeContent
        );

        // Mock upload result
        mockUploadResult = new HashMap<>();
        mockUploadResult.put("secure_url", "https://res.cloudinary.com/test/image/upload/v123/test.jpg");
        mockUploadResult.put("public_id", "petties/general/test123");
        mockUploadResult.put("format", "jpg");
        mockUploadResult.put("width", 1920);
        mockUploadResult.put("height", 1080);
        mockUploadResult.put("bytes", 123456L);
    }

    // ==================== UPLOAD FILE TESTS ====================

    @Nested
    @DisplayName("uploadFile() Tests")
    class UploadFileTests {

        @Test
        @DisplayName("Should upload valid JPEG image successfully")
        void shouldUploadValidJpegImage() throws IOException {
            // Arrange
            when(uploader.upload(any(byte[].class), anyMap())).thenReturn(mockUploadResult);

            // Act
            UploadResponse response = cloudinaryService.uploadFile(validImageFile, "general");

            // Assert
            assertThat(response).isNotNull();
            assertThat(response.getUrl()).isEqualTo("https://res.cloudinary.com/test/image/upload/v123/test.jpg");
            assertThat(response.getPublicId()).isEqualTo("petties/general/test123");
            assertThat(response.getFormat()).isEqualTo("jpg");
            assertThat(response.getWidth()).isEqualTo(1920);
            assertThat(response.getHeight()).isEqualTo(1080);
            assertThat(response.getBytes()).isEqualTo(123456L);

            verify(uploader).upload(eq(validImageFile.getBytes()), anyMap());
        }

        @Test
        @DisplayName("Should upload valid PNG image successfully")
        void shouldUploadValidPngImage() throws IOException {
            // Arrange
            MockMultipartFile pngFile = new MockMultipartFile(
                    "file",
                    "test-image.png",
                    "image/png",
                    "test png content".getBytes()
            );
            when(uploader.upload(any(byte[].class), anyMap())).thenReturn(mockUploadResult);

            // Act
            UploadResponse response = cloudinaryService.uploadFile(pngFile, "general");

            // Assert
            assertThat(response).isNotNull();
            assertThat(response.getUrl()).isNotBlank();
            verify(uploader).upload(eq(pngFile.getBytes()), anyMap());
        }

        @Test
        @DisplayName("Should upload valid PDF successfully")
        void shouldUploadValidPdf() throws IOException {
            // Arrange
            when(uploader.upload(any(byte[].class), anyMap())).thenReturn(mockUploadResult);

            // Act
            UploadResponse response = cloudinaryService.uploadFile(validPdfFile, "business-licenses");

            // Assert
            assertThat(response).isNotNull();
            assertThat(response.getUrl()).isNotBlank();
            verify(uploader).upload(eq(validPdfFile.getBytes()), anyMap());
        }

        @Test
        @DisplayName("Should throw BadRequestException when file is null")
        void shouldThrowExceptionWhenFileIsNull() throws IOException {
            // Act & Assert
            assertThatThrownBy(() -> cloudinaryService.uploadFile(null, "general"))
                    .isInstanceOf(BadRequestException.class)
                    .hasMessageContaining("File không được để trống");

            verify(uploader, never()).upload(any(), anyMap());
        }

        @Test
        @DisplayName("Should throw BadRequestException when file is empty")
        void shouldThrowExceptionWhenFileIsEmpty() throws IOException {
            // Arrange
            MockMultipartFile emptyFile = new MockMultipartFile(
                    "file",
                    "empty.jpg",
                    "image/jpeg",
                    new byte[0]
            );

            // Act & Assert
            assertThatThrownBy(() -> cloudinaryService.uploadFile(emptyFile, "general"))
                    .isInstanceOf(BadRequestException.class)
                    .hasMessageContaining("File không được để trống");

            verify(uploader, never()).upload(any(), anyMap());
        }

        @Test
        @DisplayName("Should throw BadRequestException when file size exceeds 10MB")
        void shouldThrowExceptionWhenFileSizeExceeds10MB() throws IOException {
            // Act & Assert
            assertThatThrownBy(() -> cloudinaryService.uploadFile(oversizedFile, "general"))
                    .isInstanceOf(BadRequestException.class)
                    .hasMessageContaining("Kích thước file không được vượt quá 10MB");

            verify(uploader, never()).upload(any(), anyMap());
        }

        @Test
        @DisplayName("Should throw BadRequestException when content type is invalid")
        void shouldThrowExceptionWhenContentTypeIsInvalid() throws IOException {
            // Act & Assert
            assertThatThrownBy(() -> cloudinaryService.uploadFile(invalidFile, "general"))
                    .isInstanceOf(BadRequestException.class)
                    .hasMessageContaining("Định dạng file không hợp lệ");

            verify(uploader, never()).upload(any(), anyMap());
        }

        @Test
        @DisplayName("Should throw BadRequestException when content type is null")
        void shouldThrowExceptionWhenContentTypeIsNull() throws IOException {
            // Arrange
            MockMultipartFile fileWithNullContentType = new MockMultipartFile(
                    "file",
                    "test.jpg",
                    null,
                    "test content".getBytes()
            );

            // Act & Assert
            assertThatThrownBy(() -> cloudinaryService.uploadFile(fileWithNullContentType, "general"))
                    .isInstanceOf(BadRequestException.class)
                    .hasMessageContaining("Định dạng file không hợp lệ");

            verify(uploader, never()).upload(any(), anyMap());
        }

        @Test
        @DisplayName("Should throw BadRequestException when Cloudinary config is missing")
        void shouldThrowExceptionWhenCloudinaryConfigMissing() throws NoSuchFieldException, IllegalAccessException {
            // Arrange - create Cloudinary with empty cloud name
            Map<String, String> emptyConfig = new HashMap<>();
            emptyConfig.put("cloud_name", "");
            emptyConfig.put("api_key", "test-key");
            emptyConfig.put("api_secret", "test-secret");
            Cloudinary emptyCloudinary = new Cloudinary(emptyConfig);

            // Inject empty Cloudinary into service
            java.lang.reflect.Field cloudinaryField = CloudinaryService.class.getDeclaredField("cloudinary");
            cloudinaryField.setAccessible(true);
            cloudinaryField.set(cloudinaryService, emptyCloudinary);

            // Act & Assert
            assertThatThrownBy(() -> cloudinaryService.uploadFile(validImageFile, "general"))
                    .isInstanceOf(BadRequestException.class)
                    .hasMessageContaining("Cấu hình Cloudinary chưa hoàn thiện");

            try {
                verify(uploader, never()).upload(any(), anyMap());
            } catch (IOException e) {
                // This exception is not expected in test flow
            }

            // Restore original cloudinary
            cloudinaryField.set(cloudinaryService, cloudinary);
        }

        @Test
        @DisplayName("Should throw BadRequestException when Cloudinary upload fails")
        void shouldThrowExceptionWhenCloudinaryUploadFails() throws IOException {
            // Arrange
            when(uploader.upload(any(byte[].class), anyMap())).thenThrow(new IOException("Upload failed"));

            // Act & Assert
            assertThatThrownBy(() -> cloudinaryService.uploadFile(validImageFile, "general"))
                    .isInstanceOf(BadRequestException.class)
                    .hasMessageContaining("Không thể upload file");

            verify(uploader).upload(any(byte[].class), anyMap());
        }

        @Test
        @DisplayName("Should use default folder when folder is null")
        void shouldUseDefaultFolderWhenFolderIsNull() throws IOException {
            // Arrange
            when(uploader.upload(any(byte[].class), anyMap())).thenReturn(mockUploadResult);

            // Act
            cloudinaryService.uploadFile(validImageFile, null);

            // Assert - verify folder parameter passed to Cloudinary
            verify(uploader).upload(eq(validImageFile.getBytes()), argThat(map ->
                    map.get("folder").equals("petties/general")
            ));
        }
    }

    // ==================== UPLOAD AVATAR TESTS ====================

    @Nested
    @DisplayName("uploadAvatar() Tests")
    class UploadAvatarTests {

        @Test
        @DisplayName("Should upload avatar with transformation successfully")
        void shouldUploadAvatarWithTransformation() throws IOException {
            // Arrange
            when(uploader.upload(any(byte[].class), anyMap())).thenReturn(mockUploadResult);

            // Act
            UploadResponse response = cloudinaryService.uploadAvatar(validImageFile);

            // Assert
            assertThat(response).isNotNull();
            assertThat(response.getUrl()).isNotBlank();
            assertThat(response.getPublicId()).isNotBlank();

            // Verify upload was called with avatars folder
            verify(uploader).upload(eq(validImageFile.getBytes()), argThat(map ->
                    map.get("folder").equals("petties/avatars") &&
                            map.get("resource_type").equals("image")
            ));
        }

        @Test
        @DisplayName("Should throw BadRequestException when avatar file is invalid")
        void shouldThrowExceptionWhenAvatarFileIsInvalid() throws IOException {
            // Act & Assert
            assertThatThrownBy(() -> cloudinaryService.uploadAvatar(invalidFile))
                    .isInstanceOf(BadRequestException.class)
                    .hasMessageContaining("Định dạng file không hợp lệ");

            verify(uploader, never()).upload(any(), anyMap());
        }

        @Test
        @DisplayName("Should throw BadRequestException when avatar upload fails")
        void shouldThrowExceptionWhenAvatarUploadFails() throws IOException {
            // Arrange
            when(uploader.upload(any(byte[].class), anyMap())).thenThrow(new IOException("Upload failed"));

            // Act & Assert
            assertThatThrownBy(() -> cloudinaryService.uploadAvatar(validImageFile))
                    .isInstanceOf(BadRequestException.class)
                    .hasMessageContaining("Không thể upload avatar");

            verify(uploader).upload(any(byte[].class), anyMap());
        }
    }

    // ==================== UPLOAD CLINIC IMAGE TESTS ====================

    @Nested
    @DisplayName("uploadClinicImage() Tests")
    class UploadClinicImageTests {

        @Test
        @DisplayName("Should upload clinic image with transformation successfully")
        void shouldUploadClinicImageWithTransformation() throws IOException {
            // Arrange
            when(uploader.upload(any(byte[].class), anyMap())).thenReturn(mockUploadResult);

            // Act
            UploadResponse response = cloudinaryService.uploadClinicImage(validImageFile);

            // Assert
            assertThat(response).isNotNull();
            assertThat(response.getUrl()).isNotBlank();

            // Verify upload was called with clinics folder
            verify(uploader).upload(eq(validImageFile.getBytes()), argThat(map ->
                    map.get("folder").equals("petties/clinics") &&
                            map.get("resource_type").equals("image")
            ));
        }

        @Test
        @DisplayName("Should throw BadRequestException when clinic image upload fails")
        void shouldThrowExceptionWhenClinicImageUploadFails() throws IOException {
            // Arrange
            when(uploader.upload(any(byte[].class), anyMap())).thenThrow(new IOException("Upload failed"));

            // Act & Assert
            assertThatThrownBy(() -> cloudinaryService.uploadClinicImage(validImageFile))
                    .isInstanceOf(BadRequestException.class)
                    .hasMessageContaining("Không thể upload ảnh phòng khám");

            verify(uploader).upload(any(byte[].class), anyMap());
        }
    }

    // ==================== UPLOAD EMR IMAGE TESTS ====================

    @Nested
    @DisplayName("uploadEmrImage() Tests")
    class UploadEmrImageTests {

        @Test
        @DisplayName("Should upload EMR image with transformation successfully")
        void shouldUploadEmrImageWithTransformation() throws IOException {
            // Arrange
            when(uploader.upload(any(byte[].class), anyMap())).thenReturn(mockUploadResult);

            // Act
            UploadResponse response = cloudinaryService.uploadEmrImage(validImageFile);

            // Assert
            assertThat(response).isNotNull();
            assertThat(response.getUrl()).isNotBlank();

            // Verify upload was called with emr folder
            verify(uploader).upload(eq(validImageFile.getBytes()), argThat(map ->
                    map.get("folder").equals("petties/emr") &&
                            map.get("resource_type").equals("image")
            ));
        }

        @Test
        @DisplayName("Should throw BadRequestException when EMR image upload fails")
        void shouldThrowExceptionWhenEmrImageUploadFails() throws IOException {
            // Arrange
            when(uploader.upload(any(byte[].class), anyMap())).thenThrow(new IOException("Upload failed"));

            // Act & Assert
            assertThatThrownBy(() -> cloudinaryService.uploadEmrImage(validImageFile))
                    .isInstanceOf(BadRequestException.class)
                    .hasMessageContaining("Không thể upload ảnh lâm sàng");

            verify(uploader).upload(any(byte[].class), anyMap());
        }
    }

    // ==================== DELETE FILE TESTS ====================

    @Nested
    @DisplayName("deleteFile() Tests")
    class DeleteFileTests {

        @Test
        @DisplayName("Should delete file successfully when result is 'ok'")
        void shouldDeleteFileSuccessfully() throws IOException {
            // Arrange
            String publicId = "petties/avatars/test123";
            Map<String, Object> deleteResult = new HashMap<>();
            deleteResult.put("result", "ok");

            when(uploader.destroy(eq(publicId), anyMap())).thenReturn(deleteResult);

            // Act
            boolean result = cloudinaryService.deleteFile(publicId);

            // Assert
            assertThat(result).isTrue();
            verify(uploader).destroy(eq(publicId), anyMap());
        }

        @Test
        @DisplayName("Should return false when delete result is not 'ok'")
        void shouldReturnFalseWhenDeleteResultIsNotOk() throws IOException {
            // Arrange
            String publicId = "petties/avatars/test123";
            Map<String, Object> deleteResult = new HashMap<>();
            deleteResult.put("result", "not found");

            when(uploader.destroy(eq(publicId), anyMap())).thenReturn(deleteResult);

            // Act
            boolean result = cloudinaryService.deleteFile(publicId);

            // Assert
            assertThat(result).isFalse();
            verify(uploader).destroy(eq(publicId), anyMap());
        }

        @Test
        @DisplayName("Should return true when publicId is null")
        void shouldReturnTrueWhenPublicIdIsNull() throws IOException {
            // Act
            boolean result = cloudinaryService.deleteFile(null);

            // Assert
            assertThat(result).isTrue();
            verify(uploader, never()).destroy(anyString(), anyMap());
        }

        @Test
        @DisplayName("Should return true when publicId is empty")
        void shouldReturnTrueWhenPublicIdIsEmpty() throws IOException {
            // Act
            boolean result = cloudinaryService.deleteFile("");

            // Assert
            assertThat(result).isTrue();
            verify(uploader, never()).destroy(anyString(), anyMap());
        }

        @Test
        @DisplayName("Should throw BadRequestException when delete fails with IOException")
        void shouldThrowExceptionWhenDeleteFails() throws IOException {
            // Arrange
            String publicId = "petties/avatars/test123";
            when(uploader.destroy(eq(publicId), anyMap())).thenThrow(new IOException("Delete failed"));

            // Act & Assert
            assertThatThrownBy(() -> cloudinaryService.deleteFile(publicId))
                    .isInstanceOf(BadRequestException.class)
                    .hasMessageContaining("Không thể xóa file cũ trên cloud");

            verify(uploader).destroy(eq(publicId), anyMap());
        }

        @Test
        @DisplayName("Should throw BadRequestException when Cloudinary config is missing during delete")
        void shouldThrowExceptionWhenCloudinaryConfigMissingDuringDelete() throws NoSuchFieldException, IllegalAccessException {
            // Arrange - create Cloudinary with empty cloud name
            Map<String, String> emptyConfig = new HashMap<>();
            emptyConfig.put("cloud_name", "");
            emptyConfig.put("api_key", "test-key");
            emptyConfig.put("api_secret", "test-secret");
            Cloudinary emptyCloudinary = new Cloudinary(emptyConfig);

            // Inject empty Cloudinary into service
            java.lang.reflect.Field cloudinaryField = CloudinaryService.class.getDeclaredField("cloudinary");
            cloudinaryField.setAccessible(true);
            cloudinaryField.set(cloudinaryService, emptyCloudinary);

            String publicId = "petties/avatars/test123";

            // Act & Assert
            assertThatThrownBy(() -> cloudinaryService.deleteFile(publicId))
                    .isInstanceOf(BadRequestException.class)
                    .hasMessageContaining("Cấu hình Cloudinary chưa hoàn thiện");

            try {
                verify(uploader, never()).destroy(anyString(), anyMap());
            } catch (IOException e) {
                // This exception is not expected in test flow
            }

            // Restore original cloudinary
            cloudinaryField.set(cloudinaryService, cloudinary);
        }
    }

    // ==================== EDGE CASES TESTS ====================

    @Nested
    @DisplayName("Edge Cases Tests")
    class EdgeCasesTests {

        @Test
        @DisplayName("Should handle GIF upload successfully")
        void shouldHandleGifUpload() throws IOException {
            // Arrange
            MockMultipartFile gifFile = new MockMultipartFile(
                    "file",
                    "test.gif",
                    "image/gif",
                    "test gif content".getBytes()
            );
            when(uploader.upload(any(byte[].class), anyMap())).thenReturn(mockUploadResult);

            // Act
            UploadResponse response = cloudinaryService.uploadFile(gifFile, "general");

            // Assert
            assertThat(response).isNotNull();
            verify(uploader).upload(eq(gifFile.getBytes()), anyMap());
        }

        @Test
        @DisplayName("Should handle WEBP upload successfully")
        void shouldHandleWebpUpload() throws IOException {
            // Arrange
            MockMultipartFile webpFile = new MockMultipartFile(
                    "file",
                    "test.webp",
                    "image/webp",
                    "test webp content".getBytes()
            );
            when(uploader.upload(any(byte[].class), anyMap())).thenReturn(mockUploadResult);

            // Act
            UploadResponse response = cloudinaryService.uploadFile(webpFile, "general");

            // Assert
            assertThat(response).isNotNull();
            verify(uploader).upload(eq(webpFile.getBytes()), anyMap());
        }

        @Test
        @DisplayName("Should handle file exactly at 10MB limit")
        void shouldHandleFileExactlyAt10MBLimit() throws IOException {
            // Arrange
            byte[] exactSizeContent = new byte[10 * 1024 * 1024]; // Exactly 10MB
            MockMultipartFile exactSizeFile = new MockMultipartFile(
                    "file",
                    "exact-size.jpg",
                    "image/jpeg",
                    exactSizeContent
            );
            when(uploader.upload(any(byte[].class), anyMap())).thenReturn(mockUploadResult);

            // Act
            UploadResponse response = cloudinaryService.uploadFile(exactSizeFile, "general");

            // Assert
            assertThat(response).isNotNull();
            verify(uploader).upload(eq(exactSizeFile.getBytes()), anyMap());
        }

        @Test
        @DisplayName("Should handle upload result with null dimensions")
        void shouldHandleUploadResultWithNullDimensions() throws IOException {
            // Arrange
            Map<String, Object> resultWithNullDimensions = new HashMap<>();
            resultWithNullDimensions.put("secure_url", "https://example.com/file.pdf");
            resultWithNullDimensions.put("public_id", "petties/general/test");
            resultWithNullDimensions.put("format", "pdf");
            resultWithNullDimensions.put("width", null);
            resultWithNullDimensions.put("height", null);
            resultWithNullDimensions.put("bytes", null);

            when(uploader.upload(any(byte[].class), anyMap())).thenReturn(resultWithNullDimensions);

            // Act
            UploadResponse response = cloudinaryService.uploadFile(validPdfFile, "general");

            // Assert
            assertThat(response).isNotNull();
            assertThat(response.getWidth()).isEqualTo(0);
            assertThat(response.getHeight()).isEqualTo(0);
            assertThat(response.getBytes()).isEqualTo(0L);
        }
    }
}
