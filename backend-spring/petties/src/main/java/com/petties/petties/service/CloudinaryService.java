package com.petties.petties.service;

import com.cloudinary.Cloudinary;
import com.cloudinary.Transformation;
import com.cloudinary.utils.ObjectUtils;
import com.petties.petties.dto.file.UploadResponse;
import com.petties.petties.exception.BadRequestException;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;
import org.springframework.web.multipart.MultipartFile;

import java.io.IOException;
import java.util.Arrays;
import java.util.List;
import java.util.Map;

/**
 * Service xử lý upload, xóa file lên Cloudinary
 */
@Slf4j
@Service
@RequiredArgsConstructor
public class CloudinaryService {

    private final Cloudinary cloudinary;

    private static final List<String> ALLOWED_CONTENT_TYPES = Arrays.asList(
            "image/jpeg",
            "image/png",
            "image/gif",
            "image/webp");

    private static final long MAX_FILE_SIZE = 10 * 1024 * 1024; // 10MB

    /**
     * Upload file lên Cloudinary
     */
    public UploadResponse uploadFile(MultipartFile file, String folder) {
        validateFile(file);
        checkCloudinaryConfig();

        try {
            String cloudinaryFolder = "petties/" + (folder != null ? folder : "general");// biến này dùng để tạo folder
                                                                                         // trong cloudinary

            @SuppressWarnings("unchecked")
            Map<String, Object> uploadResult = cloudinary.uploader().upload(
                    file.getBytes(),
                    ObjectUtils.asMap(
                            "folder", cloudinaryFolder,
                            "resource_type", "auto",
                            "transformation", new Transformation<>()
                                    .quality("auto:good")
                                    .fetchFormat("auto")));

            log.info("File uploaded successfully: {}", uploadResult.get("public_id"));

            return mapUploadResult(uploadResult);

        } catch (Exception e) {
            log.error("Failed to upload file to Cloudinary: {}", e.getMessage(), e);
            throw new BadRequestException("Không thể upload file: " + e.getMessage());
        }
    }

    /**
     * Upload avatar với transformation resize
     */
    public UploadResponse uploadAvatar(MultipartFile file) {
        validateFile(file);
        checkCloudinaryConfig();

        try {
            @SuppressWarnings("unchecked")
            Map<String, Object> uploadResult = cloudinary.uploader().upload(
                    file.getBytes(),
                    ObjectUtils.asMap(
                            "folder", "petties/avatars",
                            "resource_type", "image",
                            "transformation", new Transformation<>()
                                    .width(300)
                                    .height(300)
                                    .crop("fill")
                                    .gravity("face")
                                    .quality("auto:good")
                                    .fetchFormat("auto")));

            log.info("Avatar uploaded successfully: {}", uploadResult.get("public_id"));

            return mapUploadResult(uploadResult);

        } catch (Exception e) {
            log.error("Failed to upload avatar to Cloudinary: {}", e.getMessage(), e);
            throw new BadRequestException("Không thể upload avatar: " + e.getMessage());
        }
    }

    /**
     * Xóa file trên Cloudinary
     */
    public boolean deleteFile(String publicId) {
        if (publicId == null || publicId.isEmpty())
            return true;
        checkCloudinaryConfig();

        try {
            @SuppressWarnings("unchecked")
            Map<String, Object> result = cloudinary.uploader().destroy(publicId, ObjectUtils.emptyMap());
            String resultStatus = (String) result.get("result");

            if ("ok".equals(resultStatus)) {
                log.info("File deleted successfully: {}", publicId);
                return true;
            } else {
                log.warn("File deletion returned status: {} for publicId: {}", resultStatus, publicId);
                return false;
            }
        } catch (IOException e) {
            log.error("Failed to delete file from Cloudinary: {}", publicId, e);
            throw new BadRequestException("Không thể xóa file cũ trên cloud.");
        }
    }

    private void validateFile(MultipartFile file) {
        if (file == null || file.isEmpty()) {
            throw new BadRequestException("File không được để trống.");
        }

        if (file.getSize() > MAX_FILE_SIZE) {
            throw new BadRequestException("Kích thước file không được vượt quá 10MB.");
        }

        String contentType = file.getContentType();
        if (contentType == null || !ALLOWED_CONTENT_TYPES.contains(contentType)) {
            throw new BadRequestException("Định dạng file không hợp lệ. Chỉ chấp nhận: JPEG, PNG, GIF, WEBP.");
        }
    }

    private void checkCloudinaryConfig() {
        if (cloudinary.config.cloudName == null || cloudinary.config.cloudName.isEmpty()) {
            throw new BadRequestException(
                    "Cấu hình Cloudinary chưa hoàn thiện (thiếu Cloud Name). Vui lòng kiểm tra biến môi trường.");
        }
    }

    private UploadResponse mapUploadResult(Map<String, Object> uploadResult) {
        return UploadResponse.builder()
                .url((String) uploadResult.get("secure_url"))
                .publicId((String) uploadResult.get("public_id"))
                .format((String) uploadResult.get("format"))
                .width(uploadResult.get("width") != null ? ((Number) uploadResult.get("width")).intValue() : 0)
                .height(uploadResult.get("height") != null ? ((Number) uploadResult.get("height")).intValue() : 0)
                .bytes(uploadResult.get("bytes") != null ? ((Number) uploadResult.get("bytes")).longValue() : 0L)
                .build();
    }
}
