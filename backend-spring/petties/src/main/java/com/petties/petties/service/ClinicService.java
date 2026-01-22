package com.petties.petties.service;

import com.petties.petties.dto.clinic.ClinicLocationResponse;
import com.petties.petties.dto.clinic.ClinicRequest;
import com.petties.petties.dto.clinic.ClinicResponse;
import com.petties.petties.dto.clinic.DistanceResponse;
import com.petties.petties.dto.clinic.GeocodeResponse;
import com.petties.petties.exception.BadRequestException;
import com.petties.petties.exception.ForbiddenException;
import com.petties.petties.exception.ResourceNotFoundException;
import com.petties.petties.model.Clinic;
import com.petties.petties.model.User;
import com.petties.petties.model.enums.ClinicStatus;
import com.petties.petties.model.enums.Role;
import com.petties.petties.model.ClinicImage;
import com.petties.petties.repository.ClinicImageRepository;
import com.petties.petties.repository.ClinicRepository;
import com.petties.petties.repository.UserRepository;
import com.petties.petties.model.enums.NotificationType;
import com.petties.petties.model.Notification;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageImpl;
import org.springframework.data.domain.Pageable;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.time.LocalDateTime;
import java.util.List;
import java.util.UUID;
import java.util.stream.Collectors;

@Service
@RequiredArgsConstructor
@Slf4j
public class ClinicService {

        private final ClinicRepository clinicRepository;
        private final ClinicImageRepository clinicImageRepository;
        private final UserRepository userRepository;
        private final LocationService locationService;
        private final CloudinaryService cloudinaryService;
        private final EmailService emailService;
        private final NotificationService notificationService;

        @Transactional(readOnly = true)
        public List<ClinicLocationResponse> getActiveLocations() {
                return clinicRepository.findActiveLocations();
        }

        @Transactional(readOnly = true)
        public Page<ClinicResponse> getAllClinics(ClinicStatus status, String name, Pageable pageable) {
                Page<Clinic> clinics = clinicRepository.findWithFilters(status, name, pageable);
                return clinics.map(this::mapToResponse);
        }

        @Transactional(readOnly = true)
        public ClinicResponse getClinicById(UUID clinicId) {
                Clinic clinic = clinicRepository.findByIdAndNotDeleted(clinicId)
                                .orElseThrow(() -> new ResourceNotFoundException(
                                                "Clinic not found with id: " + clinicId));
                return mapToResponse(clinic);
        }

        @Transactional
        public ClinicResponse createClinic(ClinicRequest request, UUID ownerId) {
                User owner = userRepository.findById(ownerId)
                                .orElseThrow(() -> new ResourceNotFoundException("User not found"));

                // Verify user is CLINIC_OWNER
                if (owner.getRole() != Role.CLINIC_OWNER) {
                        throw new ForbiddenException("Chỉ chủ phòng khám mới có thể tạo phòng khám");
                }

                Clinic clinic = new Clinic();
                clinic.setOwner(owner);
                clinic.setName(request.getName());
                clinic.setDescription(request.getDescription());
                clinic.setAddress(request.getAddress());
                clinic.setWard(request.getWard());
                clinic.setDistrict(request.getDistrict());
                clinic.setProvince(request.getProvince());
                clinic.setSpecificLocation(request.getSpecificLocation());
                clinic.setLogo(request.getLogo());
                clinic.setPhone(request.getPhone());
                clinic.setEmail(request.getEmail());
                clinic.setBankName(request.getBankName());
                clinic.setAccountNumber(request.getAccountNumber());
                clinic.setOperatingHours(request.getOperatingHours());
                clinic.setStatus(ClinicStatus.PENDING);

                // Set latitude/longitude from request if provided, otherwise try to geocode
                if (request.getLatitude() != null && request.getLongitude() != null) {
                        clinic.setLatitude(request.getLatitude());
                        clinic.setLongitude(request.getLongitude());
                        log.info("Using provided coordinates: lat={}, lng={}", request.getLatitude(),
                                        request.getLongitude());
                } else if (request.getAddress() != null && !request.getAddress().isEmpty()) {
                        // Try to geocode address if coordinates not provided
                        try {
                                GeocodeResponse geocode = locationService.geocode(request.getAddress());
                                clinic.setLatitude(geocode.getLatitude());
                                clinic.setLongitude(geocode.getLongitude());
                                log.info("Geocoded address to: lat={}, lng={}", geocode.getLatitude(),
                                                geocode.getLongitude());
                        } catch (Exception e) {
                                log.warn("Failed to geocode address for clinic: {}", request.getAddress(), e);
                                // Continue without geocoding - lat/lng can be set later
                        }
                }

                clinic = clinicRepository.saveAndFlush(clinic);
                log.info("Clinic created: {} by owner: {}", clinic.getClinicId(), ownerId);

                // Notify all Admins about new clinic registration
                try {
                        notificationService.notifyAdminsNewClinicRegistration(clinic);
                        // Push updated counter to all admins
                        notificationService.broadcastClinicCounterUpdate(
                                        clinicRepository.countByStatusAndDeletedAtIsNull(ClinicStatus.PENDING));
                } catch (Exception e) {
                        log.error("Failed to notify admins about new clinic: {}", clinic.getClinicId(), e);
                        // Don't fail the transaction if notification creation fails
                }

                return mapToResponse(clinic);
        }

        @Transactional
        public ClinicResponse updateClinic(UUID clinicId, ClinicRequest request, UUID ownerId) {
                Clinic clinic = clinicRepository.findByIdAndNotDeleted(clinicId)
                                .orElseThrow(() -> new ResourceNotFoundException("Clinic not found"));

                // Check ownership
                if (!clinic.getOwner().getUserId().equals(ownerId)) {
                        throw new ForbiddenException("Bạn chỉ có thể cập nhật phòng khám của mình");
                }

                // Update fields
                clinic.setName(request.getName());
                clinic.setDescription(request.getDescription());
                clinic.setAddress(request.getAddress());
                clinic.setWard(request.getWard());
                clinic.setDistrict(request.getDistrict());
                clinic.setProvince(request.getProvince());
                clinic.setSpecificLocation(request.getSpecificLocation());
                clinic.setLogo(request.getLogo());
                clinic.setPhone(request.getPhone());
                clinic.setEmail(request.getEmail());
                clinic.setBankName(request.getBankName());
                clinic.setAccountNumber(request.getAccountNumber());
                clinic.setOperatingHours(request.getOperatingHours());

                // Update coordinates: prioritize provided coordinates, otherwise geocode if
                // address changed
                if (request.getLatitude() != null && request.getLongitude() != null) {
                        clinic.setLatitude(request.getLatitude());
                        clinic.setLongitude(request.getLongitude());
                        log.info("Using provided coordinates for update: lat={}, lng={}", request.getLatitude(),
                                        request.getLongitude());
                } else if (request.getAddress() != null && !request.getAddress().equals(clinic.getAddress())) {
                        // Re-geocode if address changed and no coordinates provided
                        try {
                                GeocodeResponse geocode = locationService.geocode(request.getAddress());
                                clinic.setLatitude(geocode.getLatitude());
                                clinic.setLongitude(geocode.getLongitude());
                                log.info("Re-geocoded address to: lat={}, lng={}", geocode.getLatitude(),
                                                geocode.getLongitude());
                        } catch (Exception e) {
                                log.warn("Failed to geocode address for clinic update: {}", request.getAddress(), e);
                        }
                }

                clinic = clinicRepository.save(clinic);
                log.info("Clinic updated: {} by owner: {}", clinicId, ownerId);
                return mapToResponse(clinic);
        }

        @Transactional
        public void deleteClinic(UUID clinicId, UUID ownerId) {
                Clinic clinic = clinicRepository.findByIdAndNotDeleted(clinicId)
                                .orElseThrow(() -> new ResourceNotFoundException("Clinic not found"));

                // Check ownership
                if (!clinic.getOwner().getUserId().equals(ownerId)) {
                        throw new ForbiddenException("Bạn chỉ có thể xóa phòng khám của mình");
                }

                clinicRepository.delete(clinic);
                log.info("Clinic deleted (soft): {} by owner: {}", clinicId, ownerId);
        }

        @Transactional(readOnly = true)
        public Page<ClinicResponse> searchClinics(String name, Pageable pageable) {
                Page<Clinic> clinics = clinicRepository.searchByName(name, pageable);
                return clinics.map(this::mapToResponse);
        }

        @Transactional(readOnly = true)
        public Page<ClinicResponse> findNearbyClinics(BigDecimal latitude, BigDecimal longitude,
                        double radius, Pageable pageable) {
                if (latitude == null || longitude == null) {
                        throw new BadRequestException("Vị trí phòng khám (tọa độ) là bắt buộc");
                }

                List<Clinic> clinics = clinicRepository.findNearbyClinics(latitude, longitude, radius);

                // Calculate distances and map to response
                List<ClinicResponse> responses = clinics.stream()
                                .map(clinic -> {
                                        ClinicResponse response = mapToResponse(clinic);
                                        double distance = locationService.calculateDistance(
                                                        latitude, longitude,
                                                        clinic.getLatitude(), clinic.getLongitude());
                                        response.setDistance(distance);
                                        return response;
                                })
                                .collect(Collectors.toList());

                // Apply pagination manually (since native query doesn't support Pageable)
                int start = (int) pageable.getOffset();
                int end = Math.min(start + pageable.getPageSize(), responses.size());
                List<ClinicResponse> pagedResponses = start < responses.size()
                                ? responses.subList(start, end)
                                : List.of();

                return new PageImpl<>(pagedResponses, pageable, responses.size());
        }

        @Transactional
        public GeocodeResponse geocodeAddress(String address) {
                return locationService.geocode(address);
        }

        @Transactional(readOnly = true)
        public DistanceResponse calculateDistance(UUID clinicId, BigDecimal latitude, BigDecimal longitude) {
                Clinic clinic = clinicRepository.findByIdAndNotDeleted(clinicId)
                                .orElseThrow(() -> new ResourceNotFoundException("Clinic not found"));

                if (clinic.getLatitude() == null || clinic.getLongitude() == null) {
                        throw new BadRequestException("Vị trí phòng khám chưa được thiết lập");
                }

                return locationService.calculateDistanceMatrix(
                                latitude, longitude,
                                clinic.getLatitude(), clinic.getLongitude());
        }

        @Transactional(readOnly = true)
        public Page<ClinicResponse> getPendingClinics(Pageable pageable) {
                Page<Clinic> clinics = clinicRepository.findByStatus(ClinicStatus.PENDING, pageable);
                return clinics.map(this::mapToResponse);
        }

        @Transactional(readOnly = true)
        public long countPendingClinics() {
                return clinicRepository.countByStatusAndDeletedAtIsNull(ClinicStatus.PENDING);
        }

        @Transactional
        public ClinicResponse approveClinic(UUID clinicId, String reason) {
                Clinic clinic = clinicRepository.findByIdAndNotDeleted(clinicId)
                                .orElseThrow(() -> new ResourceNotFoundException("Clinic not found"));

                if (clinic.getStatus() != ClinicStatus.PENDING) {
                        throw new BadRequestException("Chỉ có thể duyệt phòng khám đang chờ xét duyệt");
                }

                clinic.setStatus(ClinicStatus.APPROVED);
                clinic.setApprovedAt(LocalDateTime.now());
                clinic.setRejectionReason(null);

                clinic = clinicRepository.saveAndFlush(clinic);
                log.info("Clinic approved: {} with reason: {}", clinicId, reason);

                // Create notification for clinic owner (only if status actually changed)
                // The notification service will check for duplicates
                try {
                        Notification notification = notificationService.createClinicNotification(clinic,
                                        NotificationType.APPROVED,
                                        reason);
                        if (notification == null) {
                                log.debug("Notification creation skipped (duplicate check) for clinic: {}", clinicId);
                        }

                        // Push updated counter to all admins after approval
                        notificationService.broadcastClinicCounterUpdate(
                                        clinicRepository.countByStatusAndDeletedAtIsNull(ClinicStatus.PENDING));
                } catch (Exception e) {
                        log.error("Failed to create approval notification for clinic: {}", clinicId, e);
                        // Don't fail the transaction if notification creation fails
                }

                return mapToResponse(clinic);
        }

        @Transactional
        public ClinicResponse rejectClinic(UUID clinicId, String reason) {
                Clinic clinic = clinicRepository.findByIdAndNotDeleted(clinicId)
                                .orElseThrow(() -> new ResourceNotFoundException("Clinic not found"));

                if (clinic.getStatus() != ClinicStatus.PENDING) {
                        throw new BadRequestException("Chỉ có thể từ chối phòng khám đang chờ xét duyệt");
                }

                if (reason == null || reason.trim().isEmpty()) {
                        throw new BadRequestException("Lý do từ chối là bắt buộc");
                }

                clinic.setStatus(ClinicStatus.REJECTED);
                clinic.setRejectionReason(reason);

                clinic = clinicRepository.saveAndFlush(clinic);
                log.info("Clinic rejected: {} with reason: {}", clinicId, reason);

                // Create notification for clinic owner (only if status actually changed)
                // The notification service will check for duplicates
                try {
                        Notification notification = notificationService.createClinicNotification(clinic,
                                        NotificationType.REJECTED,
                                        reason);
                        if (notification == null) {
                                log.debug("Notification creation skipped (duplicate check) for clinic: {}", clinicId);
                        }

                        // Push updated counter to all admins after rejection
                        notificationService.broadcastClinicCounterUpdate(
                                        clinicRepository.countByStatusAndDeletedAtIsNull(ClinicStatus.PENDING));
                } catch (Exception e) {
                        log.error("Failed to create rejection notification for clinic: {}", clinicId, e);
                        // Don't fail the transaction if notification creation fails
                }

                return mapToResponse(clinic);
        }

        @Transactional(readOnly = true)
        public Page<ClinicResponse> getClinicsByOwner(UUID ownerId, Pageable pageable) {
                // Get ALL clinics owned by user (any status: PENDING, APPROVED, REJECTED)
                Page<Clinic> clinics = clinicRepository.findByOwnerUserId(ownerId, pageable);
                return clinics.map(this::mapToResponse);
        }

        @Transactional
        public ClinicResponse uploadClinicImage(UUID clinicId, String imageUrl, String caption,
                        Integer displayOrder, Boolean isPrimary, UUID ownerId) {
                Clinic clinic = clinicRepository.findByIdAndNotDeleted(clinicId)
                                .orElseThrow(() -> new ResourceNotFoundException("Clinic not found"));

                // Check ownership
                if (!clinic.getOwner().getUserId().equals(ownerId)) {
                        throw new ForbiddenException("Bạn chỉ có thể tải ảnh lên cho phòng khám của mình");
                }

                // If this is set as primary, unset other primary images
                if (Boolean.TRUE.equals(isPrimary)) {
                        clinicImageRepository.findByClinicClinicIdAndIsPrimaryTrue(clinicId)
                                        .ifPresent(existingPrimary -> {
                                                existingPrimary.setIsPrimary(false);
                                                clinicImageRepository.save(existingPrimary);
                                        });
                }

                // If displayOrder is null, set it to the next available order
                if (displayOrder == null) {
                        long imageCount = clinicImageRepository.countByClinicClinicId(clinicId);
                        displayOrder = (int) imageCount;
                }

                // Create new ClinicImage
                ClinicImage clinicImage = new ClinicImage();
                clinicImage.setClinic(clinic);
                clinicImage.setImageUrl(imageUrl);
                clinicImage.setCaption(caption);
                clinicImage.setDisplayOrder(displayOrder);
                clinicImage.setIsPrimary(isPrimary != null ? isPrimary : false);

                clinicImageRepository.save(clinicImage);
                log.info("Clinic image uploaded: {} for clinic: {} by owner: {}",
                                clinicImage.getImageId(), clinicId, ownerId);

                // Reload clinic to get updated images
                clinic = clinicRepository.findByIdAndNotDeleted(clinicId)
                                .orElseThrow(() -> new ResourceNotFoundException("Clinic not found"));
                return mapToResponse(clinic);
        }

        @Transactional
        public void deleteClinicImage(UUID clinicId, UUID imageId, UUID ownerId) {
                Clinic clinic = clinicRepository.findByIdAndNotDeleted(clinicId)
                                .orElseThrow(() -> new ResourceNotFoundException("Clinic not found"));

                // Check ownership
                if (!clinic.getOwner().getUserId().equals(ownerId)) {
                        throw new ForbiddenException("Bạn chỉ có thể xóa ảnh từ phòng khám của mình");
                }

                ClinicImage clinicImage = clinicImageRepository
                                .findByImageIdAndClinicClinicId(imageId, clinicId)
                                .orElseThrow(() -> new ResourceNotFoundException("Clinic image not found"));

                // Extract publicId from imageUrl to delete from Cloudinary
                String imageUrl = clinicImage.getImageUrl();
                if (imageUrl != null && imageUrl.contains("cloudinary.com")) {
                        try {
                                // Extract public_id from URL (format:
                                // https://res.cloudinary.com/.../v1234567890/petties/clinics/xxx.jpg)
                                // We need to extract the path after the version number
                                String[] parts = imageUrl.split("/v\\d+/");
                                if (parts.length > 1) {
                                        String publicId = parts[1].replaceAll("\\.(jpg|jpeg|png|gif|webp)$", "");
                                        cloudinaryService.deleteFile(publicId);
                                }
                        } catch (Exception e) {
                                log.warn("Failed to delete image from Cloudinary: {}", imageUrl, e);
                                // Continue with database deletion even if Cloudinary deletion fails
                        }
                }

                clinicImageRepository.delete(clinicImage);
                log.info("Clinic image deleted: {} from clinic: {} by owner: {}", imageId, clinicId, ownerId);
        }

        @Transactional
        public ClinicResponse setPrimaryClinicImage(UUID clinicId, UUID imageId, UUID ownerId) {
                Clinic clinic = clinicRepository.findByIdAndNotDeleted(clinicId)
                                .orElseThrow(() -> new ResourceNotFoundException("Clinic not found"));

                // Check ownership
                if (!clinic.getOwner().getUserId().equals(ownerId)) {
                        throw new ForbiddenException("Bạn chỉ có thể cập nhật ảnh cho phòng khám của mình");
                }

                ClinicImage targetImage = clinicImageRepository.findByImageIdAndClinicClinicId(imageId, clinicId)
                                .orElseThrow(() -> new ResourceNotFoundException("Clinic image not found"));

                // Set all images isPrimary=false, then set target true
                clinic.getImages().forEach(img -> img.setIsPrimary(false));
                targetImage.setIsPrimary(true);

                clinicImageRepository.saveAll(clinic.getImages());
                clinic = clinicRepository.save(clinic);

                log.info("Clinic image set as primary: {} for clinic: {} by owner: {}", imageId, clinicId, ownerId);
                return mapToResponse(clinic);
        }

        @Transactional
        public ClinicResponse updateClinicLogo(UUID clinicId, String logoUrl, UUID ownerId) {
                Clinic clinic = clinicRepository.findByIdAndNotDeleted(clinicId)
                                .orElseThrow(() -> new ResourceNotFoundException("Clinic not found"));

                // Check ownership
                if (!clinic.getOwner().getUserId().equals(ownerId)) {
                        throw new ForbiddenException("Bạn chỉ có thể cập nhật logo cho phòng khám của mình");
                }

                // Delete old logo from Cloudinary if exists
                String oldLogoUrl = clinic.getLogo();
                if (oldLogoUrl != null && oldLogoUrl.contains("cloudinary.com")) {
                        try {
                                String[] parts = oldLogoUrl.split("/v\\d+/");
                                if (parts.length > 1) {
                                        String publicId = parts[1].replace(".jpg", "").replace(".png", "")
                                                        .replace(".webp", "");
                                        cloudinaryService.deleteFile(publicId);
                                        log.info("Old logo deleted from Cloudinary: {}", publicId);
                                }
                        } catch (Exception e) {
                                log.warn("Failed to delete old logo from Cloudinary: {}", oldLogoUrl, e);
                                // Continue even if deletion fails
                        }
                }

                // Update logo
                clinic.setLogo(logoUrl);
                clinic = clinicRepository.save(clinic);
                log.info("Clinic logo updated: {} for clinic: {} by owner: {}", logoUrl, clinicId, ownerId);

                return mapToResponse(clinic);
        }

        private ClinicResponse mapToResponse(Clinic clinic) {
                List<ClinicImage> sortedImages = clinic.getImages().stream()
                                .sorted((a, b) -> {
                                        boolean aPrimary = Boolean.TRUE.equals(a.getIsPrimary());
                                        boolean bPrimary = Boolean.TRUE.equals(b.getIsPrimary());
                                        if (aPrimary != bPrimary) {
                                                return aPrimary ? -1 : 1;
                                        }
                                        Integer aOrder = a.getDisplayOrder() != null ? a.getDisplayOrder()
                                                        : Integer.MAX_VALUE;
                                        Integer bOrder = b.getDisplayOrder() != null ? b.getDisplayOrder()
                                                        : Integer.MAX_VALUE;
                                        return aOrder.compareTo(bOrder);
                                })
                                .collect(Collectors.toList());

                List<String> imageUrls = sortedImages.stream()
                                .map(ClinicImage::getImageUrl)
                                .collect(Collectors.toList());

                List<ClinicResponse.ImageInfo> imageDetails = sortedImages.stream()
                                .map(img -> ClinicResponse.ImageInfo.builder()
                                                .imageId(img.getImageId())
                                                .clinicId(clinic.getClinicId())
                                                .imageUrl(img.getImageUrl())
                                                .caption(img.getCaption())
                                                .displayOrder(img.getDisplayOrder())
                                                .isPrimary(img.getIsPrimary())
                                                .build())
                                .collect(Collectors.toList());

                ClinicResponse.OwnerInfo ownerInfo = ClinicResponse.OwnerInfo.builder()
                                .userId(clinic.getOwner().getUserId())
                                .fullName(clinic.getOwner().getFullName())
                                .email(clinic.getOwner().getEmail())
                                .build();

                return ClinicResponse.builder()
                                .clinicId(clinic.getClinicId())
                                .owner(ownerInfo)
                                .name(clinic.getName())
                                .description(clinic.getDescription())
                                .address(clinic.getAddress())
                                .ward(clinic.getWard())
                                .district(clinic.getDistrict())
                                .province(clinic.getProvince())
                                .specificLocation(clinic.getSpecificLocation())
                                .logo(clinic.getLogo())
                                .phone(clinic.getPhone())
                                .email(clinic.getEmail())
                                .bankName(clinic.getBankName())
                                .accountNumber(clinic.getAccountNumber())
                                .latitude(clinic.getLatitude())
                                .longitude(clinic.getLongitude())
                                .operatingHours(clinic.getOperatingHours())
                                .status(clinic.getStatus())
                                .rejectionReason(clinic.getRejectionReason())
                                .ratingAvg(clinic.getRatingAvg())
                                .ratingCount(clinic.getRatingCount())
                                .approvedAt(clinic.getApprovedAt())
                                .images(imageUrls)
                                .imageDetails(imageDetails)
                                .createdAt(clinic.getCreatedAt())
                                .updatedAt(clinic.getUpdatedAt())
                                .build();
        }
}
