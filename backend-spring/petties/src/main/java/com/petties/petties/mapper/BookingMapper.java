package com.petties.petties.mapper;

import com.petties.petties.dto.booking.BookingResponse;
import com.petties.petties.dto.booking.ClinicTodayBookingResponse;
import com.petties.petties.dto.booking.UpcomingBookingDTO;
import com.petties.petties.dto.clinicService.ClinicServiceResponse;
import com.petties.petties.model.Booking;
import com.petties.petties.model.BookingServiceItem;
import com.petties.petties.model.Clinic;
import com.petties.petties.model.ClinicService;
import com.petties.petties.model.EmrRecord;
import com.petties.petties.model.Payment;
import com.petties.petties.model.Pet;
import com.petties.petties.model.User;
import com.petties.petties.model.enums.BookingStatus;
import com.petties.petties.model.enums.PaymentMethod;
import com.petties.petties.model.enums.PaymentStatus;
import com.petties.petties.repository.EmrRecordRepository;
import com.petties.petties.util.BookingScheduleUtil;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Component;

import java.time.LocalDate;
import java.time.LocalTime;
import java.time.Period;
import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.UUID;

/**
 * BookingMapper - Component for mapping Booking entities to DTOs.
 */
@Component
@RequiredArgsConstructor
@Slf4j
public class BookingMapper {

    private final EmrRecordRepository emrRecordRepository;

    @Value("${sepay.qr.acc:}")
    private String sepayQrAcc;

    @Value("${sepay.qr.bank:}")
    private String sepayQrBank;

    /**
     * Map Booking entity to BookingResponse DTO
     */
    public BookingResponse mapToResponse(Booking booking) {
        try {
            Pet pet = booking.getPet();
            User owner = booking.getPetOwner();
            Clinic clinic = booking.getClinic();
            User staff = booking.getAssignedStaff();

            if (pet == null || owner == null) {
                log.warn("Booking {} has null pet or owner - cannot map to response", booking.getBookingId());
                throw new IllegalArgumentException(
                        "Dữ liệu lịch hẹn không hợp lệ: thiếu thông tin thú cưng hoặc chủ sở hữu");
            }

            // EMR
            List<EmrRecord> emrs = emrRecordRepository.findByBookingId(booking.getBookingId());
            String emrId = !emrs.isEmpty() ? emrs.get(0).getId() : null;

            // Tuổi thú cưng
            String petAge = "N/A";
            if (pet.getDateOfBirth() != null) {
                Period age = Period.between(pet.getDateOfBirth(), LocalDate.now());
                petAge = age.getYears() > 0
                        ? age.getYears() + " tuổi"
                        : age.getMonths() + " tháng";
            }

            boolean isReviewed = booking.getReview() != null;

            // Lịch dịch vụ + staff
            Map<UUID, LocalTime[]> schedule = BookingScheduleUtil.computeSchedule(booking);
            List<BookingResponse.BookingServiceItemResponse> serviceResponses = new ArrayList<>();

            List<BookingServiceItem> bookingServices = booking.getBookingServices() != null
                    ? booking.getBookingServices()
                    : new ArrayList<>();

            for (BookingServiceItem item : bookingServices) {
                if (item.getService() == null) {
                    log.warn("BookingServiceItem {} has null service, skipping", item.getBookingServiceId());
                    continue;
                }

                Pet itemPet = item.getPet() != null ? item.getPet() : booking.getPet();
                User itemStaff = item.getAssignedStaff();

                int durationMinutes = item.getService().getDurationTime() != null
                        ? item.getService().getDurationTime()
                        : 30;

                int slotsRequired = (int) Math.ceil(durationMinutes / 30.0);
                int slotDurationMinutes = slotsRequired * 30;

                LocalTime[] range = schedule.get(item.getBookingServiceId());
                LocalTime startTime = range != null ? range[0] : booking.getBookingTime();
                LocalTime endTime = range != null ? range[1] : startTime.plusMinutes(slotDurationMinutes);

                Boolean isAddOn = item.getIsAddOn() != null ? item.getIsAddOn() : false;

                serviceResponses.add(BookingResponse.BookingServiceItemResponse.builder()
                        .bookingServiceId(item.getBookingServiceId())
                        .serviceId(item.getService().getServiceId())
                        .serviceName(item.getService().getName())
                        .serviceCategory(item.getService().getServiceCategory() != null
                                ? item.getService().getServiceCategory().name()
                                : null)
                        .price(item.getUnitPrice())
                        .slotsRequired(slotsRequired)
                        .durationMinutes(durationMinutes)
                        .basePrice(item.getBasePrice())
                        .weightPrice(item.getWeightPrice())
                        .assignedStaffId(itemStaff != null ? itemStaff.getUserId() : null)
                        .assignedStaffName(itemStaff != null ? itemStaff.getFullName() : null)
                        .assignedStaffAvatarUrl(itemStaff != null ? itemStaff.getAvatar() : null)
                        .assignedStaffSpecialty(
                                itemStaff != null && itemStaff.getSpecialty() != null
                                        ? itemStaff.getSpecialty().name()
                                        : null)
                        .petId(itemPet != null ? itemPet.getId() : null)
                        .petName(itemPet != null ? itemPet.getName() : null)
                        .scheduledStartTime(startTime)
                        .scheduledEndTime(endTime)
                        .isAddOn(isAddOn)
                        .build());
            }

            // Nhóm service theo pet
            Map<UUID, List<BookingResponse.BookingServiceItemResponse>> byPet = new LinkedHashMap<>();
            for (BookingResponse.BookingServiceItemResponse sr : serviceResponses) {
                UUID key = sr.getPetId() != null
                        ? sr.getPetId()
                        : UUID.fromString("00000000-0000-0000-0000-000000000000");
                byPet.computeIfAbsent(key, k -> new ArrayList<>()).add(sr);
            }
            List<BookingResponse.PetInBookingSummary> pets = new ArrayList<>();
            for (Map.Entry<UUID, List<BookingResponse.BookingServiceItemResponse>> e : byPet.entrySet()) {
                List<BookingResponse.BookingServiceItemResponse> svcList = e.getValue();
                UUID pid = svcList.get(0).getPetId();
                String pname = svcList.get(0).getPetName();
                pets.add(BookingResponse.PetInBookingSummary.builder()
                        .petId(pid)
                        .petName(pname != null ? pname : "N/A")
                        .services(svcList)
                        .build());
            }

            return BookingResponse.builder()
                    .bookingId(booking.getBookingId())
                    .bookingCode(booking.getBookingCode())
                    .emrId(emrId)
                    .isReviewed(isReviewed)
                    .reviewId(isReviewed ? booking.getReview().getReviewId() : null)
                    .rating(isReviewed ? booking.getReview().getRating() : null)
                    .reviewComment(isReviewed ? booking.getReview().getComment() : null)
                    // Pet chính
                    .petId(pet.getId())
                    .petName(pet.getName())
                    .petSpecies(pet.getSpecies() != null ? pet.getSpecies().name() : null)
                    .petBreed(pet.getBreed())
                    .petAge(petAge)
                    .petPhotoUrl(pet.getImageUrl())
                    .petWeight(pet.getWeight())
                    // Owner
                    .ownerId(owner.getUserId())
                    .ownerName(owner.getFullName())
                    .ownerPhone(owner.getPhone())
                    .ownerEmail(owner.getEmail())
                    .ownerAvatarUrl(owner.getAvatar())
                    .ownerAddress(owner.getAddress())
                    // Clinic (nullable cho SOS)
                    .clinicId(clinic != null ? clinic.getClinicId() : null)
                    .clinicName(clinic != null ? clinic.getName() : null)
                    .clinicAddress(clinic != null ? clinic.getAddress() : null)
                    .clinicPhone(clinic != null ? clinic.getPhone() : null)
                    // Staff
                    .assignedStaffId(staff != null ? staff.getUserId() : null)
                    .assignedStaffName(staff != null ? staff.getFullName() : null)
                    .assignedStaffSpecialty(
                            staff != null && staff.getSpecialty() != null
                                    ? staff.getSpecialty().name()
                                    : null)
                    .assignedStaffAvatarUrl(staff != null ? staff.getAvatar() : null)
                    // Payment
                    .paymentStatus(booking.getPaymentStatus() != null
                            ? booking.getPaymentStatus().name()
                            : null)
                    .paymentMethod(booking.getPaymentMethod() != null
                            ? booking.getPaymentMethod().name()
                            : null)
                    .paymentDescription(booking.getPayment() != null
                            ? booking.getPayment().getPaymentDescription()
                            : null)
                    .qrImageUrl(buildQrImageUrl(booking.getPayment()))
                    .canShowQrPaymentButton(shouldShowQrPaymentButton(booking))
                    // Booking
                    .bookingDate(booking.getBookingDate())
                    .bookingTime(booking.getBookingTime())
                    .type(booking.getType())
                    .status(booking.getStatus())
                    .totalPrice(booking.getTotalPrice())
                    .notes(booking.getNotes())
                    .pets(pets)
                    // Home visit
                    .homeAddress(booking.getHomeAddress())
                    .homeLat(booking.getHomeLat())
                    .homeLong(booking.getHomeLong())
                    .distanceKm(booking.getDistanceKm())
                    .distanceFee(booking.getDistanceFee())
                    .sosFee(booking.getSosFee())
                    .symptoms(booking.getSymptoms())
                    .createdAt(booking.getCreatedAt())
                    .build();
        } catch (Exception e) {
            log.error("Error mapping booking {} to response: {}", booking.getBookingId(), e.getMessage(), e);
            throw new RuntimeException("Error mapping booking " + booking.getBookingCode(), e);
        }
    }

    /**
     * Map Booking entity to UpcomingBookingDTO for home screen display
     */
    public UpcomingBookingDTO mapToUpcomingDTO(Booking booking) {
        Pet pet = booking.getPet();
        User owner = booking.getPetOwner();

        String petName = pet != null ? pet.getName() : "N/A";
        String petSpecies = pet != null && pet.getSpecies() != null ? pet.getSpecies().name() : null;
        String petPhotoUrl = pet != null ? pet.getImageUrl() : null;
        String ownerName = owner != null ? owner.getFullName() : "N/A";
        String ownerPhone = owner != null ? owner.getPhone() : null;

        int totalMinutes = 30;
        String primaryService = "Dịch vụ khám";
        int servicesCount = 0;

        try {
            List<BookingServiceItem> services = booking.getBookingServices();
            if (services != null && !services.isEmpty()) {
                servicesCount = services.size();
                totalMinutes = services.stream()
                        .mapToInt(item -> {
                            if (item.getService() == null)
                                return 30;
                            Integer duration = item.getService().getDurationTime();
                            return duration != null ? duration : 30;
                        })
                        .sum();
                BookingServiceItem firstItem = services.get(0);
                if (firstItem.getService() != null && firstItem.getService().getName() != null) {
                    primaryService = firstItem.getService().getName();
                }
            }
        } catch (Exception e) {
            log.debug("Could not load booking services for booking {}, using defaults",
                    booking.getBookingId());
        }

        LocalTime endTime = booking.getBookingTime().plusMinutes(totalMinutes);

        return UpcomingBookingDTO.builder()
                .bookingId(booking.getBookingId())
                .bookingCode(booking.getBookingCode())
                .petName(petName)
                .petSpecies(petSpecies)
                .petPhotoUrl(petPhotoUrl)
                .ownerName(ownerName)
                .ownerPhone(ownerPhone)
                .bookingDate(booking.getBookingDate())
                .bookingTime(booking.getBookingTime())
                .endTime(endTime)
                .type(booking.getType())
                .status(booking.getStatus())
                .totalPrice(booking.getTotalPrice())
                .primaryServiceName(primaryService)
                .servicesCount(servicesCount)
                .homeAddress(booking.getHomeAddress())
                .build();
    }

    /**
     * Map Booking to ClinicTodayBookingResponse with isMyAssignment flag
     */
    public ClinicTodayBookingResponse mapToClinicTodayResponse(Booking booking, UUID currentStaffId) {
        try {
            Pet pet = booking.getPet();
            User owner = booking.getPetOwner();
            Clinic clinic = booking.getClinic();
            User staff = booking.getAssignedStaff();

            List<EmrRecord> emrs = emrRecordRepository
                    .findByBookingId(booking.getBookingId());
            String emrId = !emrs.isEmpty() ? emrs.get(0).getId() : null;

            String petAge = "N/A";
            if (pet != null && pet.getDateOfBirth() != null) {
                Period age = Period.between(pet.getDateOfBirth(), LocalDate.now());
                petAge = age.getYears() > 0
                        ? age.getYears() + " tuổi"
                        : age.getMonths() + " tháng";
            }

            boolean isMyAssignment = false;
            Map<UUID, LocalTime[]> schedule = BookingScheduleUtil.computeSchedule(booking);
            List<ClinicTodayBookingResponse.BookingServiceItemResponse> serviceResponses = new ArrayList<>();

            for (BookingServiceItem item : booking.getBookingServices()) {
                User itemStaff = item.getAssignedStaff();

                if (itemStaff != null && itemStaff.getUserId().equals(currentStaffId)) {
                    isMyAssignment = true;
                }

                int durationMinutes = item.getService().getDurationTime() != null
                        ? item.getService().getDurationTime()
                        : 30;
                int slotsRequired = (int) Math.ceil(durationMinutes / 30.0);
                int slotDurationMinutes = slotsRequired * 30;

                LocalTime[] range = schedule.get(item.getBookingServiceId());
                LocalTime startTime = range != null ? range[0] : booking.getBookingTime();
                LocalTime endTime = range != null ? range[1] : startTime.plusMinutes(slotDurationMinutes);

                Boolean isAddOn = item.getIsAddOn() != null ? item.getIsAddOn() : false;

                serviceResponses.add(
                        ClinicTodayBookingResponse.BookingServiceItemResponse.builder()
                                .bookingServiceId(item.getBookingServiceId())
                                .serviceId(item.getService().getServiceId())
                                .serviceName(item.getService().getName())
                                .serviceCategory(item.getService().getServiceCategory() != null
                                        ? item.getService().getServiceCategory().name()
                                        : null)
                                .price(item.getUnitPrice())
                                .slotsRequired(slotsRequired)
                                .durationMinutes(durationMinutes)
                                .basePrice(item.getBasePrice())
                                .weightPrice(item.getWeightPrice())
                                .assignedStaffId(itemStaff != null ? itemStaff.getUserId() : null)
                                .assignedStaffName(itemStaff != null ? itemStaff.getFullName() : null)
                                .assignedStaffAvatarUrl(itemStaff != null ? itemStaff.getAvatar() : null)
                                .assignedStaffSpecialty(
                                        itemStaff != null && itemStaff.getSpecialty() != null
                                                ? itemStaff.getSpecialty().name()
                                                : null)
                                .scheduledStartTime(startTime)
                                .scheduledEndTime(endTime)
                                .isAddOn(isAddOn)
                                .build());
            }

            if (staff != null && staff.getUserId().equals(currentStaffId)) {
                isMyAssignment = true;
            }

            return ClinicTodayBookingResponse.builder()
                    .bookingId(booking.getBookingId())
                    .bookingCode(booking.getBookingCode())
                    .emrId(emrId)
                    .isMyAssignment(isMyAssignment)
                    // Pet info
                    .petId(pet != null ? pet.getId() : null)
                    .petName(pet != null ? pet.getName() : "N/A")
                    .petSpecies(pet != null && pet.getSpecies() != null ? pet.getSpecies().name() : null)
                    .petBreed(pet != null ? pet.getBreed() : null)
                    .petAge(petAge)
                    .petPhotoUrl(pet != null ? pet.getImageUrl() : null)
                    .petWeight(pet != null ? pet.getWeight() : null)
                    // Owner info
                    .ownerId(owner != null ? owner.getUserId() : null)
                    .ownerName(owner != null ? owner.getFullName() : "N/A")
                    .ownerPhone(owner != null ? owner.getPhone() : null)
                    .ownerEmail(owner != null ? owner.getEmail() : null)
                    .ownerAvatarUrl(owner != null ? owner.getAvatar() : null)
                    .ownerAddress(owner != null ? owner.getAddress() : null)
                    // Clinic info
                    .clinicId(clinic != null ? clinic.getClinicId() : null)
                    .clinicName(clinic != null ? clinic.getName() : null)
                    .clinicAddress(clinic != null ? clinic.getAddress() : null)
                    .clinicPhone(clinic != null ? clinic.getPhone() : null)
                    // Staff info
                    .assignedStaffId(staff != null ? staff.getUserId() : null)
                    .assignedStaffName(staff != null ? staff.getFullName() : null)
                    .assignedStaffSpecialty(
                            staff != null && staff.getSpecialty() != null
                                    ? staff.getSpecialty().name()
                                    : null)
                    .assignedStaffAvatarUrl(staff != null ? staff.getAvatar() : null)
                    // Payment info
                    .paymentStatus(booking.getPaymentStatus() != null
                            ? booking.getPaymentStatus().name()
                            : "PENDING")
                    .paymentMethod(booking.getPaymentMethod() != null
                            ? booking.getPaymentMethod().name()
                            : null)
                    // Booking info
                    .bookingDate(booking.getBookingDate())
                    .bookingTime(booking.getBookingTime())
                    .type(booking.getType())
                    .status(booking.getStatus())
                    .totalPrice(booking.getTotalPrice())
                    .notes(booking.getNotes())
                    .services(serviceResponses)
                    // Home visit info
                    .homeAddress(booking.getHomeAddress())
                    .homeLat(booking.getHomeLat())
                    .homeLong(booking.getHomeLong())
                    .distanceKm(booking.getDistanceKm())
                    .distanceFee(booking.getDistanceFee())
                    .sosFee(booking.getSosFee())
                    .symptoms(booking.getSymptoms())
                    // Timestamps
                    .createdAt(booking.getCreatedAt())
                    .arrivedAt(booking.getArrivedAt())
                    .build();
        } catch (Exception e) {
            log.error("Error mapping booking {} to ClinicTodayResponse: {}",
                    booking.getBookingId(), e.getMessage(), e);
            throw new RuntimeException("Error mapping booking " + booking.getBookingCode(), e);
        }
    }

    /**
     * Map ClinicService entity to ClinicServiceResponse DTO
     */
    public ClinicServiceResponse mapServiceToResponse(ClinicService service) {
        return ClinicServiceResponse.builder()
                .serviceId(service.getServiceId())
                .name(service.getName())
                .description(service.getDescription())
                .basePrice(service.getBasePrice())
                .durationTime(service.getDurationTime())
                .slotsRequired(service.getSlotsRequired())
                .serviceCategory(service.getServiceCategory())
                .isHomeVisit(service.getIsHomeVisit())
                .isActive(service.getIsActive())
                .build();
    }

    private String buildQrImageUrl(Payment payment) {
        if (payment == null) return null;
        if (payment.getMethod() != PaymentMethod.QR) return null;
        if (payment.getStatus() == PaymentStatus.PAID) return null;
        String desc = payment.getPaymentDescription();
        if (desc == null || desc.isBlank()) return null;
        if (sepayQrAcc == null || sepayQrAcc.isBlank() ||
                sepayQrBank == null || sepayQrBank.isBlank()) return null;
        return String.format(
                "https://qr.sepay.vn/img?acc=%s&bank=%s&amount=%s&des=%s",
                sepayQrAcc,
                sepayQrBank,
                payment.getAmount() != null ? payment.getAmount().toBigInteger().toString() : "0",
                desc);
    }

        private boolean shouldShowQrPaymentButton(Booking booking) {
                if (booking == null || booking.getStatus() != BookingStatus.IN_PROGRESS) {
                        return false;
                }

                Payment payment = booking.getPayment();
                return payment != null
                                && payment.getMethod() == PaymentMethod.QR
                                && payment.getStatus() != PaymentStatus.PAID;
        }
}
