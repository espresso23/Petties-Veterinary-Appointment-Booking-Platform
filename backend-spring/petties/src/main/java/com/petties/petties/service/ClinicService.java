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

import com.petties.petties.model.OperatingHours;
import java.time.LocalTime;
import java.util.Map;

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
        private final ClinicPriceService clinicPriceService;

        @Transactional(readOnly = true)
        public List<ClinicLocationResponse> getActiveLocations() {
                return clinicRepository.findActiveLocations();
        }

        @Transactional(readOnly = true)
        public Page<ClinicResponse> getAllClinics(ClinicStatus status, String name, Pageable pageable) {
                Page<Clinic> clinics = clinicRepository.findWithFilters(status, name, pageable);
                return mapToResponsePage(clinics);
        }

        @Transactional(readOnly = true)
        public ClinicResponse getClinicById(UUID clinicId) {
                Clinic clinic = clinicRepository.findByIdAndNotDeleted(clinicId)
                                .orElseThrow(() -> new ResourceNotFoundException(
                                                "Không tìm thấy phòng khám với ID: " + clinicId));
                return mapToResponse(clinic);
        }

        @Transactional
        public ClinicResponse createClinic(ClinicRequest request, UUID ownerId) {
                User owner = userRepository.findById(ownerId)
                                .orElseThrow(() -> new ResourceNotFoundException("Không tìm thấy người dùng"));

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
                clinic.setBusinessLicenseUrl(request.getBusinessLicenseUrl());
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

                // Save or update SOS fee via dedicated service
                if (request.getSosFee() != null) {
                        clinicPriceService.updatePricing(clinic.getClinicId(), null, request.getSosFee());
                }

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
                                .orElseThrow(() -> new ResourceNotFoundException("Không tìm thấy phòng khám"));

                validateClinicAccess(clinic, ownerId, "cập nhật");

                // !! FIX: Capture old address BEFORE updating to detect changes
                String oldAddress = clinic.getAddress();

                // Update fields
                clinic.setName(request.getName());
                clinic.setDescription(request.getDescription());
                clinic.setAddress(request.getAddress());
                clinic.setWard(request.getWard());
                clinic.setDistrict(request.getDistrict());
                clinic.setProvince(request.getProvince());
                clinic.setSpecificLocation(request.getSpecificLocation());
                clinic.setLogo(request.getLogo());
                clinic.setBusinessLicenseUrl(request.getBusinessLicenseUrl());
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
                } else if (request.getAddress() != null && !request.getAddress().equals(oldAddress)) {
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

                // Update SOS fee via dedicated service
                if (request.getSosFee() != null) {
                        clinicPriceService.updatePricing(clinicId, null, request.getSosFee());
                        log.info("SOS fee updated for clinic {}: {}", clinicId, request.getSosFee());
                }

                log.info("Clinic updated: {} by owner: {}", clinicId, ownerId);
                return mapToResponse(clinic);
        }

        @Transactional
        public void deleteClinic(UUID clinicId, UUID ownerId) {
                throw new BadRequestException("Tính năng xóa trực tiếp đã bị tắt. Vui lòng gửi đơn xóa để quản trị viên duyệt.");
        }

        @Transactional
        public ClinicResponse updateOwnerClinicStatus(UUID clinicId, UUID ownerId, ClinicStatus targetStatus) {
                if (targetStatus != ClinicStatus.APPROVED && targetStatus != ClinicStatus.SUSPENDED) {
                        throw new BadRequestException("Trạng thái cập nhật không hợp lệ");
                }

                Clinic clinic = clinicRepository.findByIdAndNotDeleted(clinicId)
                                .orElseThrow(() -> new ResourceNotFoundException("Không tìm thấy phòng khám"));

                if (!clinic.getOwner().getUserId().equals(ownerId)) {
                        throw new ForbiddenException("Chỉ chủ phòng khám mới có quyền cập nhật trạng thái phòng khám");
                }

                if (targetStatus == ClinicStatus.SUSPENDED && clinic.getStatus() != ClinicStatus.APPROVED) {
                        throw new BadRequestException("Chỉ có thể tạm ngưng phòng khám đang ở trạng thái đã duyệt");
                }

                if (targetStatus == ClinicStatus.APPROVED && clinic.getStatus() != ClinicStatus.SUSPENDED) {
                        throw new BadRequestException("Chỉ có thể kích hoạt lại phòng khám đang tạm ngưng");
                }

                clinic.setStatus(targetStatus);
                clinic = clinicRepository.save(clinic);
                log.info("Clinic status updated by owner. clinicId={}, ownerId={}, targetStatus={}", clinicId, ownerId,
                                targetStatus);
                return mapToResponse(clinic);
        }

        @Transactional(readOnly = true)
        public Page<ClinicResponse> searchClinics(
                        BigDecimal latitude, BigDecimal longitude, Double radiusKm,
                        String query, Boolean isOpenNow,
                        String province, String district,
                        BigDecimal minPrice, BigDecimal maxPrice,
                        String service,
                        Boolean sortByRating, Boolean sortByDistance,
                        Pageable pageable) {

                // 1. Fetch from repository with text and distance filters
                List<Clinic> clinics = clinicRepository.searchClinicsInternal(
                                query, latitude, longitude, radiusKm,
                                province, district, minPrice, maxPrice, service);

                // 2. Map and calculate distances
                // Batch fetch pricing
                List<java.util.UUID> clinicIds = clinics.stream().map(Clinic::getClinicId).toList();
                java.util.Map<java.util.UUID, com.petties.petties.model.ClinicPricePerKm> priceMap = clinicPriceService.getPricingBatch(clinicIds);
                
                List<ClinicResponse> responses = clinics.stream()
                                .map(clinic -> {
                                        ClinicResponse response = mapToResponse(clinic, priceMap.get(clinic.getClinicId()));
                                        if (latitude != null && longitude != null && clinic.getLatitude() != null
                                                        && clinic.getLongitude() != null) {
                                                double distance = locationService.calculateDistance(
                                                                latitude, longitude,
                                                                clinic.getLatitude(), clinic.getLongitude());
                                                response.setDistance(distance);
                                        }
                                        return response;
                                })
                                .collect(Collectors.toList());

                // 3. Filter by open status if requested
                if (Boolean.TRUE.equals(isOpenNow)) {
                        log.info("Filtering by isOpenNow. Before filter: {} clinics", responses.size());
                        responses = responses.stream()
                                        .filter(resp -> {
                                                boolean isOpen = isClinicOpen(resp.getOperatingHours());
                                                log.debug("Clinic '{}' isOpen: {}", resp.getName(), isOpen);
                                                return isOpen;
                                        })
                                        .collect(Collectors.toList());
                        log.info("After isOpenNow filter: {} clinics", responses.size());
                }

                // 4. Sort
                if (Boolean.TRUE.equals(sortByRating)) {
                        responses.sort((a, b) -> {
                                BigDecimal rA = a.getRatingAvg() != null ? a.getRatingAvg() : BigDecimal.ZERO;
                                BigDecimal rB = b.getRatingAvg() != null ? b.getRatingAvg() : BigDecimal.ZERO;
                                return rB.compareTo(rA);
                        });
                } else if (Boolean.TRUE.equals(sortByDistance)) {
                        responses.sort((a, b) -> {
                                Double dA = a.getDistance() != null ? a.getDistance() : Double.MAX_VALUE;
                                Double dB = b.getDistance() != null ? b.getDistance() : Double.MAX_VALUE;
                                return dA.compareTo(dB);
                        });
                }

                // 5. Paginate
                int start = (int) pageable.getOffset();
                int end = Math.min(start + pageable.getPageSize(), responses.size());
                List<ClinicResponse> pagedResponses = start < responses.size()
                                ? responses.subList(start, end)
                                : List.of();

                return new PageImpl<>(pagedResponses, pageable, responses.size());
        }

        private boolean isClinicOpen(Map<String, OperatingHours> hoursMap) {
                if (hoursMap == null || hoursMap.isEmpty()) {
                        log.debug("hoursMap is null or empty");
                        return false;
                }

                // Use Vietnam timezone (GMT+7) for accurate open/close status
                java.time.ZoneId vietnamZone = java.time.ZoneId.of("Asia/Ho_Chi_Minh");
                java.time.ZonedDateTime nowVietnam = java.time.ZonedDateTime.now(vietnamZone);
                LocalDateTime now = nowVietnam.toLocalDateTime();
                String day = now.getDayOfWeek().name().toLowerCase(); // e.g., monday
                log.debug("Checking isOpen for day: {}, currentTime: {}", day, now.toLocalTime());

                OperatingHours hours = hoursMap.entrySet().stream()
                                .filter(e -> e.getKey().equalsIgnoreCase(day))
                                .map(Map.Entry::getValue)
                                .findFirst()
                                .orElse(null);

                if (hours == null || Boolean.TRUE.equals(hours.getIsClosed())) {
                        log.debug("No hours found for day {} or clinic is closed", day);
                        return false;
                }

                LocalTime currentTime = now.toLocalTime();
                log.debug("Operating hours: {} - {}, current: {}", hours.getOpenTime(), hours.getCloseTime(),
                                currentTime);

                if (hours.getOpenTime() != null && hours.getCloseTime() != null) {
                        if (currentTime.isBefore(hours.getOpenTime()) || currentTime.isAfter(hours.getCloseTime())) {
                                return false;
                        }
                } else {
                        return false;
                }

                if (hours.getBreakStart() != null && hours.getBreakEnd() != null) {
                        if (currentTime.isAfter(hours.getBreakStart()) && currentTime.isBefore(hours.getBreakEnd())) {
                                return false;
                        }
                }

                return true;
        }

        @Transactional(readOnly = true)
        public Page<ClinicResponse> findNearbyClinics(BigDecimal latitude, BigDecimal longitude,
                        double radius, Pageable pageable) {
                if (latitude == null || longitude == null) {
                        throw new BadRequestException("Vị trí phòng khám (tọa độ) là bắt buộc");
                }

                List<Clinic> clinics = clinicRepository.findNearbyClinics(latitude, longitude, radius);

                // Calculate distances and map to response
                // Batch fetch pricing
                List<java.util.UUID> clinicIds = clinics.stream().map(Clinic::getClinicId).toList();
                java.util.Map<java.util.UUID, com.petties.petties.model.ClinicPricePerKm> priceMap = clinicPriceService.getPricingBatch(clinicIds);
                
                List<ClinicResponse> responses = clinics.stream()
                                .map(clinic -> {
                                        ClinicResponse response = mapToResponse(clinic, priceMap.get(clinic.getClinicId()));
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
                                .orElseThrow(() -> new ResourceNotFoundException("Không tìm thấy phòng khám"));

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
                return mapToResponsePage(clinics);
        }

        @Transactional(readOnly = true)
        public long countPendingClinics() {
                return clinicRepository.countByStatusAndDeletedAtIsNull(ClinicStatus.PENDING);
        }

        @Transactional(readOnly = true)
        public Page<ClinicResponse> getStruckClinics(Pageable pageable) {
                Page<Clinic> clinics = clinicRepository.findClinicsWithActiveStrike(pageable);
                return mapToResponsePage(clinics);
        }

        /** Admin: danh sách phòng khám (theo chủ sở hữu), lọc trạng thái / tên */
        @Transactional(readOnly = true)
        public Page<ClinicResponse> getAdminClinicRegistry(ClinicStatus status, String name, Pageable pageable) {
                return getAllClinics(status, name, pageable);
        }

        private static final LocalDateTime PERMANENT_STRIKE_UNTIL = LocalDateTime.of(9999, 12, 31, 23, 59);

        /**
         * Admin hạn chế vĩnh viễn (giống strike vĩnh viễn): không nhận booking, không hiển thị tìm kiếm.
         */
        @Transactional
        public ClinicResponse adminBanClinic(UUID clinicId, String reason) {
                Clinic clinic = clinicRepository.findByIdAndNotDeleted(clinicId)
                                .orElseThrow(() -> new ResourceNotFoundException("Không tìm thấy phòng khám"));
                if (clinic.getStatus() != ClinicStatus.APPROVED) {
                        throw new BadRequestException("Chỉ có thể hạn chế phòng khám đã được duyệt");
                }
                if (PERMANENT_STRIKE_UNTIL.equals(clinic.getStrikeUntil())) {
                        throw new BadRequestException("Phòng khám này đã đang bị hạn chế vĩnh viễn");
                }
                clinic.setStrikeUntil(PERMANENT_STRIKE_UNTIL);
                clinic = clinicRepository.save(clinic);
                log.info("Admin banned clinic {} permanently", clinicId);
                try {
                        String msg = "Phòng khám bị quản trị viên hạn chế nhận đặt lịch và tìm kiếm vĩnh viễn. Lý do: "
                                        + reason.trim();
                        notificationService.createClinicNotification(clinic, NotificationType.CLINIC_STRIKE, msg);
                } catch (Exception e) {
                        log.error("Failed to notify clinic {} after admin ban", clinicId, e);
                }
                return mapToResponse(clinic);
        }

        /** Admin gỡ hạn chế strike (kể cả hạn chế tạm hoặc vĩnh viễn). */
        @Transactional
        public ClinicResponse adminLiftClinicStrike(UUID clinicId) {
                Clinic clinic = clinicRepository.findByIdAndNotDeleted(clinicId)
                                .orElseThrow(() -> new ResourceNotFoundException("Không tìm thấy phòng khám"));
                if (clinic.getStrikeUntil() == null) {
                        throw new BadRequestException("Phòng khám không đang bị hạn chế do strike");
                }
                clinic.setStrikeUntil(null);
                clinic = clinicRepository.save(clinic);
                log.info("Admin lifted strike for clinic {}", clinicId);
                try {
                        notificationService.createClinicNotification(clinic, NotificationType.CLINIC_VERIFIED,
                                        "Quản trị viên đã gỡ hạn chế đặt lịch và tìm kiếm đối với phòng khám của bạn.");
                } catch (Exception e) {
                        log.error("Failed to notify clinic {} after lift strike", clinicId, e);
                }
                return mapToResponse(clinic);
        }

        @Transactional
        public ClinicResponse approveClinic(UUID clinicId, String reason) {
                Clinic clinic = clinicRepository.findByIdAndNotDeleted(clinicId)
                                .orElseThrow(() -> new ResourceNotFoundException("Không tìm thấy phòng khám"));

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
                                .orElseThrow(() -> new ResourceNotFoundException("Không tìm thấy phòng khám"));

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
        public Page<ClinicResponse> getClinicsByOwner(UUID userId, Pageable pageable) {
                User user = userRepository.findById(userId)
                                .orElseThrow(() -> new ResourceNotFoundException("Không tìm thấy người dùng"));

                if (user.getRole() == Role.CLINIC_MANAGER && user.getWorkingClinic() != null) {
                        // Manager: Return only the assigned clinic
                        return new PageImpl<>(List.of(mapToResponse(user.getWorkingClinic())), pageable, 1);
                }

                // Owner: Return all owned clinics
                Page<Clinic> clinics = clinicRepository.findByOwnerUserId(userId, pageable);
                return mapToResponsePage(clinics);
        }

        @Transactional(readOnly = true)
        public Page<ClinicResponse> getClinicsByOwner(UUID userId, Pageable pageable, boolean includeSandbox) {
                if (!includeSandbox) {
                        return getClinicsByOwner(userId, pageable);
                }

                User user = userRepository.findById(userId)
                                .orElseThrow(() -> new ResourceNotFoundException("Không tìm thấy người dùng"));

                if (user.getRole() == Role.CLINIC_MANAGER && user.getWorkingClinic() != null) {
                        return new PageImpl<>(List.of(mapToResponse(user.getWorkingClinic())), pageable, 1);
                }

                Page<Clinic> clinics = clinicRepository.findByOwnerUserIdIncludingSandbox(userId, pageable);
                return mapToResponsePage(clinics);
        }

        @Transactional
        public ClinicResponse uploadClinicImage(UUID clinicId, String imageUrl, String caption,
                        Integer displayOrder, Boolean isPrimary, UUID ownerId) {
                Clinic clinic = clinicRepository.findByIdAndNotDeleted(clinicId)
                                .orElseThrow(() -> new ResourceNotFoundException("Không tìm thấy phòng khám"));

                validateClinicAccess(clinic, ownerId, "tải ảnh lên cho");

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
                                .orElseThrow(() -> new ResourceNotFoundException("Không tìm thấy phòng khám"));
                return mapToResponse(clinic);
        }

        @Transactional
        public void deleteClinicImage(UUID clinicId, UUID imageId, UUID ownerId) {
                Clinic clinic = clinicRepository.findByIdAndNotDeleted(clinicId)
                                .orElseThrow(() -> new ResourceNotFoundException("Không tìm thấy phòng khám"));

                validateClinicAccess(clinic, ownerId, "xóa ảnh từ");

                ClinicImage clinicImage = clinicImageRepository
                                .findByImageIdAndClinicClinicId(imageId, clinicId)
                                .orElseThrow(() -> new ResourceNotFoundException("Không tìm thấy ảnh phòng khám"));

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
                                .orElseThrow(() -> new ResourceNotFoundException("Không tìm thấy phòng khám"));

                validateClinicAccess(clinic, ownerId, "cập nhật ảnh cho");

                ClinicImage targetImage = clinicImageRepository.findByImageIdAndClinicClinicId(imageId, clinicId)
                                .orElseThrow(() -> new ResourceNotFoundException("Không tìm thấy ảnh phòng khám"));

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
                                .orElseThrow(() -> new ResourceNotFoundException("Không tìm thấy phòng khám"));

                validateClinicAccess(clinic, ownerId, "cập nhật logo cho");

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

        private void validateClinicAccess(Clinic clinic, UUID ownerId, String actionName) {
                User currentUser = userRepository.findById(ownerId)
                                .orElseThrow(() -> new ResourceNotFoundException("Không tìm thấy người dùng"));

                boolean isOwner = clinic.getOwner().getUserId().equals(ownerId);
                boolean isManager = currentUser.getRole() == Role.CLINIC_MANAGER &&
                                currentUser.getWorkingClinic() != null &&
                                currentUser.getWorkingClinic().getClinicId().equals(clinic.getClinicId());

                if (!isOwner && !isManager) {
                        throw new ForbiddenException("Bạn không có quyền " + actionName + " phòng khám này");
                }
        }

        private ClinicResponse mapToResponse(Clinic clinic) {
                com.petties.petties.model.ClinicPricePerKm pricing = clinicPriceService.getPricing(clinic.getClinicId()).orElse(null);
                return mapToResponse(clinic, pricing);
        }

        private Page<ClinicResponse> mapToResponsePage(Page<Clinic> clinics) {
                if (clinics.isEmpty()) return clinics.map(c -> mapToResponse(c, null));
                
                List<UUID> clinicIds = clinics.getContent().stream().map(Clinic::getClinicId).toList();
                java.util.Map<UUID, com.petties.petties.model.ClinicPricePerKm> priceMap = clinicPriceService.getPricingBatch(clinicIds);
                
                return clinics.map(c -> mapToResponse(c, priceMap.get(c.getClinicId())));
        }

        private ClinicResponse mapToResponse(Clinic clinic, com.petties.petties.model.ClinicPricePerKm pricing) {
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
                                .businessLicenseUrl(clinic.getBusinessLicenseUrl())
                                .phone(clinic.getPhone())
                                .email(clinic.getEmail())
                                .bankName(clinic.getBankName())
                                .accountNumber(clinic.getAccountNumber())
                                .sosFee(pricing != null ? pricing.getSosFee() : null)
                                .pricePerKm(pricing != null ? pricing.getPricePerKm() : null)
                                .latitude(clinic.getLatitude())
                                .longitude(clinic.getLongitude())
                                .operatingHours(clinic.getOperatingHours())
                                .status(clinic.getStatus())
                                .rejectionReason(clinic.getRejectionReason())
                                .ratingAvg(clinic.getRatingAvg())
                                .ratingCount(clinic.getRatingCount())
                                .approvedAt(clinic.getApprovedAt())
                                .strikeUntil(clinic.getStrikeUntil())
                                .images(imageUrls)
                                .imageDetails(imageDetails)
                                .createdAt(clinic.getCreatedAt())
                                .updatedAt(clinic.getUpdatedAt())
                                .build();
        }
}
