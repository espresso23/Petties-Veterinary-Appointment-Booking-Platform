package com.petties.petties.controller;

import com.petties.petties.dto.file.UploadResponse;
import com.petties.petties.service.CloudinaryService;
import lombok.RequiredArgsConstructor;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.multipart.MultipartFile;

import java.util.Map;

/**
 * Controller xử lý upload/delete file lên Cloudinary
 *
 * Endpoints:
 * - POST /api/files/upload - Upload file chung
 * - POST /api/files/upload/avatar - Upload avatar với resize
 * - DELETE /api/files/{publicId} - Xóa file
 */
@RestController
@RequestMapping("/files")
@RequiredArgsConstructor
public class FileController {

    private final CloudinaryService cloudinaryService;

    /**
     * Upload file lên Cloudinary
     *
     * @param file   File cần upload (JPEG, PNG, GIF, WEBP - max 10MB)
     * @param folder Folder lưu trữ: avatars, pets, clinics, medical (default: general)
     * @return UploadResponse với url, publicId, format, dimensions
     */
    @PostMapping(value = "/upload", consumes = MediaType.MULTIPART_FORM_DATA_VALUE)
    public ResponseEntity<UploadResponse> uploadFile(
            @RequestParam("file") MultipartFile file,
            @RequestParam(value = "folder", required = false, defaultValue = "general") String folder
    ) {
        UploadResponse response = cloudinaryService.uploadFile(file, folder);
        return ResponseEntity.ok(response);
    }

    /**
     * Upload avatar với auto-resize 300x300, crop face
     *
     * @param file File avatar (JPEG, PNG, GIF, WEBP - max 10MB)
     * @return UploadResponse với url avatar đã resize
     */
    @PostMapping(value = "/upload/avatar", consumes = MediaType.MULTIPART_FORM_DATA_VALUE)
    public ResponseEntity<UploadResponse> uploadAvatar(
            @RequestParam("file") MultipartFile file
    ) {
        UploadResponse response = cloudinaryService.uploadAvatar(file);
        return ResponseEntity.ok(response);
    }

    /**
     * Xóa file trên Cloudinary
     *
     * @param publicId Public ID của file (vd: petties/avatars/abc123)
     * @return Success message
     */
    @DeleteMapping("/{publicId}")
    public ResponseEntity<Map<String, Object>> deleteFile(
            @PathVariable String publicId
    ) {
        boolean deleted = cloudinaryService.deleteFile(publicId);
        return ResponseEntity.ok(Map.of(
                "success", deleted,
                "publicId", publicId,
                "message", deleted ? "File đã được xóa thành công" : "Không tìm thấy file để xóa"
        ));
    }

    /**
     * Xóa file với publicId chứa "/" (sử dụng request param thay vì path variable)
     *
     * @param publicId Public ID của file (vd: petties/avatars/abc123)
     * @return Success message
     */
    @DeleteMapping
    public ResponseEntity<Map<String, Object>> deleteFileByParam(
            @RequestParam("publicId") String publicId
    ) {
        boolean deleted = cloudinaryService.deleteFile(publicId);
        return ResponseEntity.ok(Map.of(
                "success", deleted,
                "publicId", publicId,
                "message", deleted ? "File đã được xóa thành công" : "Không tìm thấy file để xóa"
        ));
    }
}
