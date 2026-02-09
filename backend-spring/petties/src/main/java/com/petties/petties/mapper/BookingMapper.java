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
import com.petties.petties.model.Pet;
import com.petties.petties.model.User;
import com.petties.petties.repository.EmrRecordRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Component;

import java.time.LocalDate;
import java.time.LocalTime;
import java.time.Period;
import java.util.ArrayList;
import java.util.List;
import java.util.UUID;

/**
 * BookingMapper - Component for mapping Booking entities to DTOs.
 * Extracted from BookingService to follow Single Responsibility Principle.
 */
@Component
@RequiredArgsConstructor
@Slf4j
public class BookingMapper {

        private final EmrRecordRepository emrRecordRepository;

        /**
         * Map Booking entity to BookingResponse DTO
         */
        public BookingResponse mapToResponse(Booking booking) {
                try {
                        Pet pet = booking.getPet();
                        User owner = booking.getPetOwner();
                        Clinic clinic = booking.getClinic();
                        User staff = booking.getAssignedStaff();

                        // Check if EMR already exists for this booking
                        List<EmrRecord> emrs = emrRecordRepository
                                        .findByBookingId(booking.getBookingId());
                        String emrId = !emrs.isEmpty() ? emrs.get(0).getId() : null;

                        // Check if review exists using OneToOne mapping
                        boolean isReviewed = booking.getReview() != null;
                        if (isReviewed) {
                                log.info("Booking {} is reviewed (id: {})", booking.getBookingCode(),
                                                booking.getReview().getReviewId());
                        } else {
                                log.info("Booking {} is NOT reviewed", booking.getBookingCode());
                        }

                        // Calculate pet age
                        String petAge = "N/A";
                        if (pet.getDateOfBirth() != null) {
                                Period age = Period.between(pet.getDateOfBirth(), LocalDate.now());
                                petAge = age.getYears() > 0
                                                ? age.getYears() + " tuổi"
                                                : age.getMonths() + " tháng";
                        }

                        // Map services with assigned staff info and calculate scheduled times
                        LocalTime currentTime = booking.getBookingTime();
                        List<BookingResponse.BookingServiceItemResponse> serviceResponses = new ArrayList<>();

                        for (BookingServiceItem item : booking.getBookingServices()) {
                                User itemStaff = item.getAssignedStaff();
                                int durationMinutes = item.getService().getDurationTime() != null
                                                ? item.getService().getDurationTime()
                                                : 30;

                                int slotsRequired = (int) Math.ceil(durationMinutes / 30.0);
                                int slotDurationMinutes = slotsRequired * 30;

                                LocalTime startTime = currentTime;
                                LocalTime endTime = currentTime.plusMinutes(slotDurationMinutes);

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
                                                .assignedStaffAvatarUrl(
                                                                itemStaff != null ? itemStaff.getAvatar() : null)
                                                .assignedStaffSpecialty(
                                                                itemStaff != null && itemStaff.getSpecialty() != null
                                                                                ? itemStaff.getSpecialty().name()
                                                                                : null)
                                                .scheduledStartTime(startTime)
                                                .scheduledEndTime(endTime)
                                                .isAddOn(isAddOn)
                                                .build());

                                currentTime = endTime;
                        }

                        return BookingResponse.builder()
                                        .bookingId(booking.getBookingId())
                                        .bookingCode(booking.getBookingCode())
                                        .emrId(emrId)
                                        .isReviewed(isReviewed)
                                        .reviewId(isReviewed ? booking.getReview().getReviewId() : null)
                                        .rating(isReviewed ? booking.getReview().getRating() : null)
                                        .reviewComment(isReviewed ? booking.getReview().getComment() : null)
                                        // Pet info
                                        .petId(pet.getId())
                                        .petName(pet.getName())
                                        .petSpecies(pet.getSpecies())
                                        .petBreed(pet.getBreed())
                                        .petAge(petAge)
                                        .petPhotoUrl(pet.getImageUrl())
                                        .petWeight(pet.getWeight())
                                        // Owner info
                                        .ownerId(owner.getUserId())
                                        .ownerName(owner.getFullName())
                                        .ownerPhone(owner.getPhone())
                                        .ownerEmail(owner.getEmail())
                                        .ownerAvatarUrl(owner.getAvatar())
                                        .ownerAddress(owner.getAddress())
                                        // Clinic info
                                        .clinicId(clinic.getClinicId())
                                        .clinicName(clinic.getName())
                                        .clinicLogo(clinic.getLogo())
                                        .clinicAddress(clinic.getAddress())
                                        .clinicPhone(clinic.getPhone())
                                        // Staff info
                                        .assignedStaffId(staff != null ? staff.getUserId() : null)
                                        .assignedStaffName(staff != null ? staff.getFullName() : null)
                                        .assignedStaffSpecialty(
                                                        staff != null && staff.getSpecialty() != null
                                                                        ? staff.getSpecialty().name()
                                                                        : null)
                                        .assignedStaffAvatarUrl(staff != null ? staff.getAvatar() : null)
                                        // Payment info
                                        .paymentStatus(booking.getPayment() != null
                                                        ? booking.getPayment().getStatus().name()
                                                        : "PENDING")
                                        .paymentMethod(booking.getPayment() != null
                                                        && booking.getPayment().getMethod() != null
                                                                        ? booking.getPayment().getMethod().name()
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
                                        // Timestamps
                                        .createdAt(booking.getCreatedAt())
                                        .build();
                } catch (Exception e) {
                        log.error("Error mapping booking {} to response: {}", booking.getBookingId(), e.getMessage(),
                                        e);
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
                String petSpecies = pet != null ? pet.getSpecies() : null;
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
                        List<ClinicTodayBookingResponse.BookingServiceItemResponse> serviceResponses = new ArrayList<>();
                        LocalTime currentTime = booking.getBookingTime();

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

                                LocalTime startTime = currentTime;
                                LocalTime endTime = currentTime.plusMinutes(slotDurationMinutes);

                                Boolean isAddOn = item.getIsAddOn() != null ? item.getIsAddOn() : false;

                                serviceResponses.add(
                                                ClinicTodayBookingResponse.BookingServiceItemResponse.builder()
                                                                .bookingServiceId(item.getBookingServiceId())
                                                                .serviceId(item.getService().getServiceId())
                                                                .serviceName(item.getService().getName())
                                                                .serviceCategory(item.getService()
                                                                                .getServiceCategory() != null
                                                                                                ? item.getService()
                                                                                                                .getServiceCategory()
                                                                                                                .name()
                                                                                                : null)
                                                                .price(item.getUnitPrice())
                                                                .slotsRequired(slotsRequired)
                                                                .durationMinutes(durationMinutes)
                                                                .basePrice(item.getBasePrice())
                                                                .weightPrice(item.getWeightPrice())
                                                                .assignedStaffId(itemStaff != null
                                                                                ? itemStaff.getUserId()
                                                                                : null)
                                                                .assignedStaffName(itemStaff != null
                                                                                ? itemStaff.getFullName()
                                                                                : null)
                                                                .assignedStaffAvatarUrl(itemStaff != null
                                                                                ? itemStaff.getAvatar()
                                                                                : null)
                                                                .assignedStaffSpecialty(
                                                                                itemStaff != null && itemStaff
                                                                                                .getSpecialty() != null
                                                                                                                ? itemStaff.getSpecialty()
                                                                                                                                .name()
                                                                                                                : null)
                                                                .scheduledStartTime(startTime)
                                                                .scheduledEndTime(endTime)
                                                                .isAddOn(isAddOn)
                                                                .build());

                                currentTime = endTime;
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
                                        .petSpecies(pet != null ? pet.getSpecies() : null)
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
                                        .paymentStatus(booking.getPayment() != null
                                                        ? booking.getPayment().getStatus().name()
                                                        : "PENDING")
                                        .paymentMethod(booking.getPayment() != null
                                                        && booking.getPayment().getMethod() != null
                                                                        ? booking.getPayment().getMethod().name()
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
                                        // Timestamps
                                        .createdAt(booking.getCreatedAt())
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
}
