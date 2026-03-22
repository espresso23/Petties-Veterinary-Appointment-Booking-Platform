package com.petties.petties.service;

import com.petties.petties.dto.ai.booking.AiBookingContextRequest;
import com.petties.petties.dto.ai.booking.AiBookingContextResponse;
import com.petties.petties.dto.ai.booking.AiBookingDraftRequest;
import com.petties.petties.dto.ai.booking.AiBookingDraftResponse;
import com.petties.petties.dto.ai.booking.AiClinicOptionsRequest;
import com.petties.petties.dto.ai.booking.AiClinicOptionsResponse;
import com.petties.petties.dto.ai.booking.AiCreateBookingRequest;
import com.petties.petties.dto.ai.booking.AiCreateBookingResponse;
import com.petties.petties.dto.ai.booking.AiPetItemRequest;
import com.petties.petties.dto.ai.booking.AiSlotOptionsRequest;
import com.petties.petties.dto.ai.booking.AiSlotOptionsResponse;
import com.petties.petties.dto.booking.AvailableSlotsResponse;
import com.petties.petties.dto.booking.BookingRequest;
import com.petties.petties.dto.booking.BookingResponse;
import com.petties.petties.dto.clinic.ClinicResponse;
import com.petties.petties.dto.clinicService.ClinicServiceResponse;
import com.petties.petties.dto.clinicService.WeightPriceDto;
import com.petties.petties.exception.BadRequestException;
import com.petties.petties.exception.ResourceNotFoundException;
import com.petties.petties.model.Clinic;
import com.petties.petties.model.Pet;
import com.petties.petties.model.ServiceWeightPrice;
import com.petties.petties.model.enums.BookingType;
import com.petties.petties.model.enums.PetSpecies;
import com.petties.petties.repository.ClinicRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.data.domain.PageRequest;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.text.Normalizer;
import java.time.LocalTime;
import java.time.format.DateTimeFormatter;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.List;
import java.util.Locale;
import java.util.Objects;
import java.util.Set;
import java.util.UUID;

@Service
@RequiredArgsConstructor
public class AiToolBookingService {

    private static final DateTimeFormatter TIME_FORMATTER = DateTimeFormatter.ofPattern("HH:mm");

    private final AiBookingContextResolver contextResolver;
    private final AiBookingDraftAssembler draftAssembler;
    private final AuthService authService;
    private final BookingService bookingService;
    private final ClinicService clinicService;
    private final ClinicServiceService clinicServiceService;
    private final ClinicRepository clinicRepository;
    private final PricingService pricingService;

    @Transactional(readOnly = true)
    public AiBookingContextResponse resolveContext(AiBookingContextRequest request) {
        return contextResolver.resolveContext(authService.getCurrentUser().getUserId(), request);
    }

    @Transactional(readOnly = true)
    public AiClinicOptionsResponse getClinicOptions(AiClinicOptionsRequest request) {
        UUID currentUserId = authService.getCurrentUser().getUserId();
        Pet resolvedPet = contextResolver.resolvePetEntity(
                currentUserId,
                request.getPetId(),
                request.getPetHint(),
                request.getTranscript(),
                request.getLatestMessage());
        PetSpecies petSpecies = request.getPetSpecies() != null
                ? request.getPetSpecies()
                : resolvedPet != null ? resolvedPet.getSpecies() : null;
        BookingType bookingType = contextResolver.resolveBookingType(
                request.getBookingType(),
                request.getTranscript(),
                request.getLatestMessage(),
                request.getAddress());

        List<ClinicResponse> clinicResponses = loadClinics(request);
        List<AiClinicOptionsResponse.ClinicOption> clinicOptions = new ArrayList<>();
        for (ClinicResponse clinicResponse : clinicResponses) {
            List<ClinicServiceResponse> candidateServices = loadCandidateServices(
                    clinicResponse.getClinicId(),
                    petSpecies,
                    bookingType);
            List<ClinicServiceResponse> matchedServices = filterServicesByHint(
                    candidateServices,
                    request.getServiceHint());

            if (request.getServiceHint() != null && !request.getServiceHint().isBlank() && matchedServices.isEmpty()) {
                continue;
            }

            BigDecimal estimatedPriceFrom = (matchedServices.isEmpty() ? candidateServices : matchedServices).stream()
                    .map(ClinicServiceResponse::getBasePrice)
                    .filter(Objects::nonNull)
                    .min(Comparator.naturalOrder())
                    .orElse(null);

            clinicOptions.add(AiClinicOptionsResponse.ClinicOption.builder()
                    .clinicId(clinicResponse.getClinicId())
                    .clinicName(clinicResponse.getName())
                    .address(clinicResponse.getAddress())
                    .distanceKm(clinicResponse.getDistance())
                    .rating(clinicResponse.getRatingAvg())
                    .totalReviews(clinicResponse.getRatingCount())
                    .supportsHomeVisit(candidateServices.stream()
                            .anyMatch(service -> Boolean.TRUE.equals(service.getIsHomeVisit())))
                    .estimatedPriceFrom(estimatedPriceFrom)
                    .hasSos(clinicResponse.getSosFee() != null)
                    .logoUrl(clinicResponse.getLogo())
                    .primaryImageUrl(resolvePrimaryImageUrl(clinicResponse))
                    .operatingHours(clinicResponse.getOperatingHours())
                    .matchMode(request.getClinicHint() != null && !request.getClinicHint().isBlank() ? "explicit_name"
                            : "nearby")
                    .matchedServices((matchedServices.isEmpty() ? candidateServices : matchedServices).stream()
                            .limit(3)
                            .map(this::toMatchedService)
                            .toList())
                    .reasonMatched(buildClinicReason(request.getServiceHint(), bookingType, clinicResponse))
                    .build());
        }

        clinicOptions.sort(Comparator.comparing(
                option -> option.getDistanceKm() != null ? option.getDistanceKm() : Double.MAX_VALUE));

        int totalFound = clinicOptions.size();
        int topK = request.getTopK() != null && request.getTopK() > 0 ? request.getTopK() : 5;
        if (clinicOptions.size() > topK) {
            clinicOptions = new ArrayList<>(clinicOptions.subList(0, topK));
        }

        return AiClinicOptionsResponse.builder()
                .queryLocation(contextResolver.resolveLocation(
                        request.getLatitude(),
                        request.getLongitude(),
                        request.getAddress()))
                .clinics(clinicOptions)
                .totalFound(totalFound)
                .build();
    }

    @Transactional(readOnly = true)
    public AiSlotOptionsResponse getSlotOptions(AiSlotOptionsRequest request) {
        if (request.getClinicId() == null) {
            throw new BadRequestException("Thiếu phòng khám để kiểm tra slot");
        }
        if (request.getBookingDate() == null) {
            throw new BadRequestException("Thiếu ngày đặt lịch");
        }

        UUID currentUserId = authService.getCurrentUser().getUserId();
        Pet resolvedPet = contextResolver.resolvePetEntity(
                currentUserId,
                request.getPetId(),
                request.getPetHint(),
                request.getTranscript(),
                request.getLatestMessage());
        PetSpecies petSpecies = request.getPetSpecies() != null
                ? request.getPetSpecies()
                : resolvedPet != null ? resolvedPet.getSpecies() : null;
        BookingType bookingType = contextResolver.resolveBookingType(
                request.getBookingType(),
                request.getTranscript(),
                request.getLatestMessage(),
                null);

        List<ClinicServiceResponse> candidateServices = loadCandidateServices(
                request.getClinicId(),
                petSpecies,
                bookingType);
        List<ClinicServiceResponse> selectedServices = resolveSelectedServices(candidateServices,
                request.getServiceIds(), request.getServiceHint());
        if (selectedServices.isEmpty()) {
            throw new BadRequestException("Không xác định được dịch vụ phù hợp để kiểm tra slot");
        }

        AvailableSlotsResponse slotResponse = bookingService.getAvailableSlots(
                request.getClinicId(),
                request.getBookingDate(),
                selectedServices.stream().map(ClinicServiceResponse::getServiceId).toList());

        // Handle null slotResponse gracefully
        List<LocalTime> rawSlots = (slotResponse == null || slotResponse.getAvailableSlots() == null)
                ? List.of()
                : slotResponse.getAvailableSlots();

        int durationMinutes = Math.max(
                selectedServices.stream()
                        .map(ClinicServiceResponse::getDurationTime)
                        .filter(Objects::nonNull)
                        .mapToInt(Integer::intValue)
                        .sum(),
                30);

        List<AiSlotOptionsResponse.SlotOption> allSlots = rawSlots.stream()
                .map(time -> toSlotOption(time, durationMinutes, request.getExactTime()))
                .toList();

        boolean exactMatch = request.getExactTime() != null
                && rawSlots.stream().anyMatch(request.getExactTime()::equals);
        List<AiSlotOptionsResponse.SlotOption> recommendedSlots = pickRecommendedSlots(allSlots,
                request.getTimePreference(), request.getLimit(), exactMatch);
        List<AiSlotOptionsResponse.SlotOption> alternatives = allSlots.stream()
                .filter(slot -> recommendedSlots.stream()
                        .noneMatch(rec -> rec.getStartTime().equals(slot.getStartTime())))
                .limit(request.getLimit() != null && request.getLimit() > 0 ? request.getLimit() : 3)
                .toList();

        String message = null;
        if (allSlots.isEmpty()) {
            message = "Không có slot trong trong ngày này. Bạn có thể chọn ngày khác hoặc để clinic manager xác nhận thời gian gần nhất.";
        } else if (recommendedSlots.isEmpty() && !allSlots.isEmpty()) {
            message = "Không tìm thấy slot phù hợp với lựa chọn của bạn. Hãy thử ngày khác.";
        }

        return AiSlotOptionsResponse.builder()
                .resolvedServiceIds(selectedServices.stream().map(ClinicServiceResponse::getServiceId).toList())
                .resolvedServiceNames(selectedServices.stream().map(ClinicServiceResponse::getName).toList())
                .recommendedSlots(recommendedSlots)
                .alternatives(alternatives)
                .exactMatch(exactMatch)
                .managerConfirmationRequired(true)
                .totalAvailable(allSlots.size())
                .message(message)
                .build();
    }

    @Transactional(readOnly = true)
    public AiBookingDraftResponse buildDraft(AiBookingDraftRequest request) {
        UUID currentUserId = authService.getCurrentUser().getUserId();
        Pet pet = contextResolver.resolvePetEntity(currentUserId, request.getPetId(), null, null, null);
        if (pet == null) {
            throw new ResourceNotFoundException("Khong tim thay thu cung cho booking draft");
        }
        Clinic clinic = clinicRepository.findById(request.getClinicId())
                .orElseThrow(() -> new ResourceNotFoundException("Khong tim thay phong kham"));

        BookingType effectiveBookingType = request.getBookingType() != null ? request.getBookingType()
                : BookingType.IN_CLINIC;
        List<ClinicServiceResponse> services = resolveServicesByIds(
                clinic.getClinicId(),
                request.getServiceIds(),
                pet.getSpecies(),
                effectiveBookingType);

        BigDecimal estimatedTotal = services.stream()
                .map(service -> pricingService.calculateServicePrice(toClinicServiceEntity(service, clinic), pet))
                .reduce(BigDecimal.ZERO, BigDecimal::add);
        estimatedTotal = estimatedTotal.add(pricingService.calculateBookingDistanceFee(
                clinic.getClinicId(),
                request.getDistanceKm(),
                effectiveBookingType));
        if (effectiveBookingType == BookingType.SOS) {
            estimatedTotal = estimatedTotal.add(pricingService.calculateSOSFee(clinic.getClinicId()));
        }

        int totalDurationMinutes = Math.max(
                services.stream()
                        .map(ClinicServiceResponse::getDurationTime)
                        .filter(Objects::nonNull)
                        .mapToInt(Integer::intValue)
                        .sum(),
                30);

        AiBookingDraftRequest normalizedRequest = AiBookingDraftRequest.builder()
                .petId(request.getPetId())
                .clinicId(request.getClinicId())
                .bookingDate(request.getBookingDate())
                .startTime(request.getStartTime())
                .serviceIds(request.getServiceIds())
                .bookingType(effectiveBookingType)
                .notes(request.getNotes())
                .homeAddress(request.getHomeAddress())
                .homeLat(request.getHomeLat())
                .homeLong(request.getHomeLong())
                .distanceKm(request.getDistanceKm())
                .build();

        return draftAssembler.buildDraftResponse(
                normalizedRequest,
                pet,
                clinic,
                services.stream().map(ClinicServiceResponse::getName).toList(),
                estimatedTotal,
                totalDurationMinutes);
    }

    @Transactional
    public AiCreateBookingResponse createBooking(AiCreateBookingRequest request) {
        if (!Boolean.TRUE.equals(request.getConfirmed())) {
            throw new BadRequestException("Can xac nhan ro rang truoc khi tao booking");
        }

        UUID currentUserId = authService.getCurrentUser().getUserId();
        BookingResponse booking = bookingService.createBooking(
                BookingRequest.builder()
                        .petId(request.getPetId())
                        .clinicId(request.getClinicId())
                        .bookingDate(request.getBookingDate())
                        .bookingTime(request.getStartTime())
                        .type(request.getBookingType() != null ? request.getBookingType() : BookingType.IN_CLINIC)
                        .serviceIds(request.getServiceIds())
                        .notes(request.getNotes())
                        .homeAddress(request.getHomeAddress())
                        .homeLat(request.getHomeLat())
                        .homeLong(request.getHomeLong())
                        .distanceKm(request.getDistanceKm())
                        .build(),
                currentUserId);

        return AiCreateBookingResponse.builder()
                .booking(AiCreateBookingResponse.BookingResult.builder()
                        .bookingId(booking.getBookingId() != null ? booking.getBookingId().toString() : null)
                        .bookingCode(booking.getBookingCode())
                        .status(booking.getStatus() != null ? booking.getStatus().name() : null)
                        .petName(booking.getPetName())
                        .clinicName(booking.getClinicName())
                        .bookingDate(booking.getBookingDate() != null ? booking.getBookingDate().toString() : null)
                        .bookingTime(booking.getBookingTime() != null ? booking.getBookingTime().format(TIME_FORMATTER)
                                : null)
                        .managerWillConfirm(true)
                        .build())
                .build();
    }

    // ========== MULTI-PET METHODS ==========

    /**
     * Build draft for multi-pet booking.
     * Each pet gets its own booking summary.
     */
    @Transactional(readOnly = true)
    public AiBookingDraftResponse buildMultiPetDraft(AiBookingDraftRequest request) {
        UUID currentUserId = authService.getCurrentUser().getUserId();
        List<AiPetItemRequest> items = request.getItems();

        if (items == null || items.isEmpty()) {
            throw new BadRequestException("Danh sach thu cung trong khong duoc de trong");
        }

        Clinic clinic = clinicRepository.findById(request.getClinicId())
                .orElseThrow(() -> new ResourceNotFoundException("Khong tim thay phong kham"));

        BookingType effectiveBookingType = request.getBookingType() != null ? request.getBookingType()
                : BookingType.IN_CLINIC;

        List<AiBookingDraftResponse.BookingSummary> summaries = new ArrayList<>();
        BigDecimal totalEstimated = BigDecimal.ZERO;
        List<String> petNames = new ArrayList<>();
        Set<String> allServiceNames = new java.util.HashSet<>();

        for (AiPetItemRequest item : items) {
            // Resolve pet from hint or use provided petId
            Pet pet;
            if (item.getPetId() != null) {
                pet = contextResolver.resolvePetEntity(currentUserId, item.getPetId(), null, null, null);
            } else if (item.getPetHint() != null && !item.getPetHint().isBlank()) {
                pet = contextResolver.resolvePetEntity(currentUserId, null, item.getPetHint(), null, null);
            } else {
                throw new BadRequestException("Can co petId hoac petHint cho moi thu cung");
            }

            if (pet == null) {
                throw new ResourceNotFoundException("Khong tim thay thu cung: "
                        + (item.getPetHint() != null ? item.getPetHint() : item.getPetId()));
            }

            // Build service IDs list (item services + common services)
            List<UUID> serviceIds = new ArrayList<>(item.getServiceIds());
            if (request.getCommonServiceIds() != null && !request.getCommonServiceIds().isEmpty()) {
                serviceIds.addAll(request.getCommonServiceIds());
            }

            // Resolve services
            List<ClinicServiceResponse> services = resolveServicesByIds(
                    clinic.getClinicId(),
                    serviceIds,
                    pet.getSpecies(),
                    effectiveBookingType);

            // Calculate prices
            BigDecimal serviceTotal = services.stream()
                    .map(service -> pricingService.calculateServicePrice(toClinicServiceEntity(service, clinic), pet))
                    .reduce(BigDecimal.ZERO, BigDecimal::add);

            BigDecimal distanceFee = pricingService.calculateBookingDistanceFee(
                    clinic.getClinicId(),
                    request.getDistanceKm(),
                    effectiveBookingType);

            BigDecimal sosFee = BigDecimal.ZERO;
            if (effectiveBookingType == BookingType.SOS) {
                sosFee = pricingService.calculateSOSFee(clinic.getClinicId());
            }

            BigDecimal estimatedTotal = serviceTotal.add(distanceFee).add(sosFee);

            int totalDuration = Math.max(
                    services.stream().map(ClinicServiceResponse::getDurationTime).filter(Objects::nonNull)
                            .mapToInt(Integer::intValue).sum(),
                    30);

            summaries.add(AiBookingDraftResponse.BookingSummary.builder()
                    .petName(pet.getName())
                    .petId(pet.getId().toString())
                    .clinicName(clinic.getName())
                    .clinicId(clinic.getClinicId().toString())
                    .services(services.stream().map(ClinicServiceResponse::getName).toList())
                    .serviceIds(services.stream().map(s -> s.getServiceId().toString()).toList())
                    .bookingDate(request.getBookingDate() != null ? request.getBookingDate().toString() : null)
                    .startTime(request.getStartTime() != null ? request.getStartTime().format(TIME_FORMATTER) : null)
                    .endTime(request.getStartTime() != null
                            ? request.getStartTime().plusMinutes(totalDuration).format(TIME_FORMATTER)
                            : null)
                    .bookingType(effectiveBookingType)
                    .estimatedTotal(estimatedTotal)
                    .serviceTotal(serviceTotal)
                    .distanceFee(distanceFee)
                    .sosFee(sosFee)
                    .homeAddress(request.getHomeAddress())
                    .managerWillConfirm(true)
                    .note(request.getNotes())
                    .build());

            totalEstimated = totalEstimated.add(estimatedTotal);
            petNames.add(pet.getName());
            allServiceNames.addAll(services.stream().map(ClinicServiceResponse::getName).toList());
        }

        // Build multi-pet summary
        AiBookingDraftResponse.MultiPetSummary multiSummary = AiBookingDraftResponse.MultiPetSummary.builder()
                .totalPets(summaries.size())
                .totalServices(allServiceNames.size())
                .petNames(String.join(", ", petNames))
                .clinicName(clinic.getName())
                .bookingDate(request.getBookingDate() != null ? request.getBookingDate().toString() : null)
                .startTime(request.getStartTime() != null ? request.getStartTime().format(TIME_FORMATTER) : null)
                .bookingType(effectiveBookingType)
                .estimatedTotal(totalEstimated)
                .serviceTotal(totalEstimated.subtract(
                        pricingService.calculateBookingDistanceFee(clinic.getClinicId(), request.getDistanceKm(),
                                effectiveBookingType)))
                .homeAddress(request.getHomeAddress())
                .managerWillConfirm(true)
                .build();

        return AiBookingDraftResponse.builder()
                .bookingSummaries(summaries)
                .multiPetSummary(multiSummary)
                .readyToConfirm(true)
                .build();
    }

    /**
     * Create multiple bookings for multi-pet request.
     * Each pet creates a separate booking.
     */
    @Transactional
    public AiCreateBookingResponse createMultiPetBookings(AiCreateBookingRequest request) {
        if (!Boolean.TRUE.equals(request.getConfirmed())) {
            throw new BadRequestException("Cần xác nhận rõ ràng trước khi tạo booking");
        }

        UUID currentUserId = authService.getCurrentUser().getUserId();
        List<AiPetItemRequest> items = request.getItems();

        if (items == null || items.isEmpty()) {
            throw new BadRequestException("Danh sách thú cưng không được để trống");
        }

        Clinic clinic = clinicRepository.findById(request.getClinicId())
                .orElseThrow(() -> new ResourceNotFoundException("Không tìm thấy phòng khám"));

        BookingType effectiveBookingType = request.getBookingType() != null ? request.getBookingType()
                : BookingType.IN_CLINIC;

        List<AiCreateBookingResponse.BookingResult> results = new ArrayList<>();
        int successCount = 0;
        int failureCount = 0;
        List<String> petNames = new ArrayList<>();

        for (AiPetItemRequest item : items) {
            try {
                // Build service IDs list (item services + common services)
                List<UUID> serviceIds = new ArrayList<>(item.getServiceIds());
                if (request.getCommonServiceIds() != null && !request.getCommonServiceIds().isEmpty()) {
                    serviceIds.addAll(request.getCommonServiceIds());
                }

                // Create booking via BookingService
                BookingResponse booking = bookingService.createBooking(
                        BookingRequest.builder()
                                .petId(item.getPetId())
                                .clinicId(request.getClinicId())
                                .bookingDate(request.getBookingDate())
                                .bookingTime(request.getStartTime())
                                .type(effectiveBookingType)
                                .serviceIds(serviceIds)
                                .notes(request.getNotes())
                                .homeAddress(request.getHomeAddress())
                                .homeLat(request.getHomeLat())
                                .homeLong(request.getHomeLong())
                                .distanceKm(request.getDistanceKm())
                                .build(),
                        currentUserId);

                results.add(AiCreateBookingResponse.BookingResult.builder()
                        .bookingId(booking.getBookingId() != null ? booking.getBookingId().toString() : null)
                        .bookingCode(booking.getBookingCode())
                        .status(booking.getStatus() != null ? booking.getStatus().name() : null)
                        .petName(booking.getPetName())
                        .clinicName(booking.getClinicName())
                        .bookingDate(booking.getBookingDate() != null ? booking.getBookingDate().toString() : null)
                        .bookingTime(booking.getBookingTime() != null ? booking.getBookingTime().format(TIME_FORMATTER)
                                : null)
                        .managerWillConfirm(true)
                        .services(booking.getPets() != null ? booking.getPets().stream()
                                .flatMap(p -> p.getServices() != null ? p.getServices().stream()
                                        : java.util.stream.Stream.empty())
                                .map(s -> s.getServiceName())
                                .toList() : List.of())
                        .build());

                successCount++;
                if (booking.getPetName() != null) {
                    petNames.add(booking.getPetName());
                }
            } catch (Exception e) {
                failureCount++;
                results.add(AiCreateBookingResponse.BookingResult.builder()
                        .petName(item.getPetHint() != null ? item.getPetHint()
                                : (item.getPetId() != null ? item.getPetId().toString() : "Unknown"))
                        .status("FAILED")
                        .build());
            }
        }

        // Build multi-pet summary
        AiCreateBookingResponse.MultiPetSummary multiSummary = AiCreateBookingResponse.MultiPetSummary.builder()
                .totalBookings(items.size())
                .successCount(successCount)
                .failureCount(failureCount)
                .petNames(String.join(", ", petNames))
                .clinicName(clinic.getName())
                .bookingDate(request.getBookingDate() != null ? request.getBookingDate().toString() : null)
                .bookingTime(request.getStartTime() != null ? request.getStartTime().format(TIME_FORMATTER) : null)
                .managerWillConfirm(true)
                .build();

        return AiCreateBookingResponse.builder()
                .bookings(results)
                .multiPetSummary(multiSummary)
                .success(failureCount == 0)
                .message(String.format("Đã tạo %d/%d yêu cầu booking. Clinic manager sẽ xác nhận sau.", successCount,
                        items.size()))
                .build();
    }

    // ========== LEGACY SINGLE-PET FALLBACK ==========

    /**
     * Create single booking (legacy single-pet mode).
     * Kept for backward compatibility.
     */
    @Transactional
    public AiCreateBookingResponse createSingleBooking(AiCreateBookingRequest request) {
        if (!Boolean.TRUE.equals(request.getConfirmed())) {
            throw new BadRequestException("Cần xác nhận rõ ràng trước khi tạo booking");
        }

        UUID currentUserId = authService.getCurrentUser().getUserId();
        BookingResponse booking = bookingService.createBooking(
                BookingRequest.builder()
                        .petId(request.getPetId())
                        .clinicId(request.getClinicId())
                        .bookingDate(request.getBookingDate())
                        .bookingTime(request.getStartTime())
                        .type(request.getBookingType() != null ? request.getBookingType() : BookingType.IN_CLINIC)
                        .serviceIds(request.getServiceIds())
                        .notes(request.getNotes())
                        .homeAddress(request.getHomeAddress())
                        .homeLat(request.getHomeLat())
                        .homeLong(request.getHomeLong())
                        .distanceKm(request.getDistanceKm())
                        .build(),
                currentUserId);

        return AiCreateBookingResponse.builder()
                .booking(AiCreateBookingResponse.BookingResult.builder()
                        .bookingId(booking.getBookingId() != null ? booking.getBookingId().toString() : null)
                        .bookingCode(booking.getBookingCode())
                        .status(booking.getStatus() != null ? booking.getStatus().name() : null)
                        .petName(booking.getPetName())
                        .clinicName(booking.getClinicName())
                        .bookingDate(booking.getBookingDate() != null ? booking.getBookingDate().toString() : null)
                        .bookingTime(booking.getBookingTime() != null ? booking.getBookingTime().format(TIME_FORMATTER)
                                : null)
                        .managerWillConfirm(true)
                        .build())
                .success(true)
                .message(String.format("Đã tạo yêu cầu booking cho %s. Clinic manager sẽ xác nhận sau.",
                        booking.getPetName()))
                .build();
    }

    private List<ClinicResponse> loadClinics(AiClinicOptionsRequest request) {
        if (request.getClinicId() != null) {
            return List.of(clinicService.getClinicById(request.getClinicId()));
        }
        int size = Math.max((request.getTopK() != null ? request.getTopK() : 5) * 2, 10);

        if (request.getClinicHint() != null && !request.getClinicHint().isBlank()) {
            return clinicService.searchClinics(
                    request.getLatitude(),
                    request.getLongitude(),
                    request.getRadiusKm(),
                    request.getClinicHint(),
                    null,
                    null,
                    null,
                    null,
                    null,
                    null,
                    false,
                    true,
                    PageRequest.of(0, size))
                    .getContent();
        }

        if (request.getLatitude() == null || request.getLongitude() == null) {
            throw new BadRequestException("Thiếu vị trí để tìm phòng khám gần bạn");
        }

        return clinicService.findNearbyClinics(
                request.getLatitude(),
                request.getLongitude(),
                request.getRadiusKm() != null ? request.getRadiusKm() : 5.0,
                PageRequest.of(0, size))
                .getContent();
    }

    private List<ClinicServiceResponse> loadCandidateServices(UUID clinicId, PetSpecies petSpecies,
            BookingType bookingType) {
        Boolean isHomeVisit = bookingType == BookingType.HOME_VISIT ? Boolean.TRUE : null;
        if (petSpecies != null || isHomeVisit != null) {
            return clinicServiceService.getCompatibleServices(clinicId, petSpecies, isHomeVisit);
        }
        return clinicServiceService.getPublicServicesByClinicId(clinicId);
    }

    private List<ClinicServiceResponse> resolveSelectedServices(
            List<ClinicServiceResponse> candidateServices,
            List<UUID> requestedServiceIds,
            String serviceHint) {
        if (requestedServiceIds != null && !requestedServiceIds.isEmpty()) {
            List<ClinicServiceResponse> selected = candidateServices.stream()
                    .filter(service -> requestedServiceIds.contains(service.getServiceId()))
                    .toList();
            if (!selected.isEmpty()) {
                return selected;
            }
        }
        return filterServicesByHint(candidateServices, serviceHint);
    }

    private List<ClinicServiceResponse> resolveServicesByIds(
            UUID clinicId,
            List<UUID> serviceIds,
            PetSpecies petSpecies,
            BookingType bookingType) {
        if (serviceIds == null || serviceIds.isEmpty()) {
            throw new BadRequestException("Thiếu danh sách dịch vụ để tạo booking");
        }
        List<ClinicServiceResponse> candidateServices = loadCandidateServices(clinicId, petSpecies, bookingType);
        List<ClinicServiceResponse> selected = candidateServices.stream()
                .filter(service -> serviceIds.contains(service.getServiceId()))
                .toList();
        if (selected.size() != serviceIds.size()) {
            throw new BadRequestException("Một số dịch vụ không thuộc phòng khám đã chọn");
        }
        return selected;
    }

    private List<ClinicServiceResponse> filterServicesByHint(List<ClinicServiceResponse> services, String serviceHint) {
        if (serviceHint == null || serviceHint.isBlank()) {
            return services.stream().limit(3).toList();
        }
        String normalizedHint = normalizeForMatch(serviceHint);
        return services.stream()
                .filter(service -> {
                    String category = service.getServiceCategory() != null ? service.getServiceCategory().name() : "";
                    String haystack = normalizeForMatch(String.join(" ",
                            valueOrEmpty(service.getName()),
                            valueOrEmpty(service.getDescription()),
                            category));
                    return haystack.contains(normalizedHint);
                })
                .toList();
    }

    private AiClinicOptionsResponse.MatchedService toMatchedService(ClinicServiceResponse service) {
        return AiClinicOptionsResponse.MatchedService.builder()
                .serviceId(service.getServiceId())
                .name(service.getName())
                .category(service.getServiceCategory() != null ? service.getServiceCategory().name() : null)
                .basePrice(service.getBasePrice())
                .durationMinutes(service.getDurationTime())
                .homeVisit(service.getIsHomeVisit())
                .build();
    }

    private String resolvePrimaryImageUrl(ClinicResponse clinicResponse) {
        if (clinicResponse.getImageDetails() != null) {
            return clinicResponse.getImageDetails().stream()
                    .filter(Objects::nonNull)
                    .sorted(Comparator.comparing(detail -> Boolean.TRUE.equals(detail.getIsPrimary()) ? 0 : 1))
                    .map(ClinicResponse.ImageInfo::getImageUrl)
                    .filter(Objects::nonNull)
                    .filter(url -> !url.isBlank())
                    .findFirst()
                    .orElse(null);
        }
        if (clinicResponse.getImages() != null) {
            return clinicResponse.getImages().stream()
                    .filter(Objects::nonNull)
                    .filter(url -> !url.isBlank())
                    .findFirst()
                    .orElse(null);
        }
        return null;
    }

    private String buildClinicReason(String serviceHint, BookingType bookingType, ClinicResponse clinic) {
        if (serviceHint != null && !serviceHint.isBlank()) {
            return "Phù hợp với nhu cầu dịch vụ bạn đang hỏi";
        }
        if (bookingType == BookingType.HOME_VISIT) {
            return "Phòng khám có dịch vụ khám tại nhà";
        }
        if (clinic.getDistance() != null) {
            return "Phòng khám gần vị trí của bạn";
        }
        return "Phòng khám phù hợp với yêu cầu hiện tại";
    }

    private AiSlotOptionsResponse.SlotOption toSlotOption(LocalTime startTime, int durationMinutes,
            LocalTime exactTime) {
        return AiSlotOptionsResponse.SlotOption.builder()
                .startTime(startTime.format(TIME_FORMATTER))
                .endTime(startTime.plusMinutes(durationMinutes).format(TIME_FORMATTER))
                .durationMinutes(durationMinutes)
                .exactRequested(exactTime != null && exactTime.equals(startTime))
                .build();
    }

    private List<AiSlotOptionsResponse.SlotOption> pickRecommendedSlots(
            List<AiSlotOptionsResponse.SlotOption> allSlots,
            String timePreference,
            Integer limit,
            boolean exactMatch) {
        int desired = limit != null && limit > 0 ? limit : 3;
        if (allSlots.isEmpty()) {
            return List.of();
        }

        if (exactMatch) {
            return allSlots.stream()
                    .sorted(Comparator.comparing(AiSlotOptionsResponse.SlotOption::isExactRequested).reversed()
                            .thenComparing(AiSlotOptionsResponse.SlotOption::getStartTime))
                    .limit(desired)
                    .toList();
        }

        String normalized = normalizeForMatch(timePreference);
        Comparator<AiSlotOptionsResponse.SlotOption> comparator = Comparator
                .comparing(AiSlotOptionsResponse.SlotOption::getStartTime);
        if (normalized.contains("sang") || normalized.contains("morning")) {
            comparator = Comparator.comparingInt(slot -> hourDistance(slot.getStartTime(), 9));
        } else if (normalized.contains("chieu") || normalized.contains("afternoon")) {
            comparator = Comparator.comparingInt(slot -> hourDistance(slot.getStartTime(), 14));
        } else if (normalized.contains("toi") || normalized.contains("evening")) {
            comparator = Comparator.comparingInt(slot -> hourDistance(slot.getStartTime(), 18));
        }

        return allSlots.stream()
                .sorted(comparator.thenComparing(AiSlotOptionsResponse.SlotOption::getStartTime))
                .limit(desired)
                .toList();
    }

    private int hourDistance(String timeValue, int preferredHour) {
        LocalTime parsed = LocalTime.parse(timeValue, TIME_FORMATTER);
        return Math.abs(parsed.getHour() - preferredHour);
    }

    private com.petties.petties.model.ClinicService toClinicServiceEntity(ClinicServiceResponse response,
            Clinic clinic) {
        com.petties.petties.model.ClinicService entity = new com.petties.petties.model.ClinicService();
        entity.setServiceId(response.getServiceId());
        entity.setClinic(clinic);
        entity.setName(response.getName());
        entity.setDescription(response.getDescription());
        entity.setBasePrice(response.getBasePrice() != null ? response.getBasePrice() : BigDecimal.ZERO);
        entity.setDurationTime(response.getDurationTime());
        entity.setSlotsRequired(response.getSlotsRequired());
        entity.setIsHomeVisit(response.getIsHomeVisit());
        entity.setServiceCategory(response.getServiceCategory());
        entity.setPetType(response.getPetType());
        entity.setWeightPrices(mapWeightPrices(response.getWeightPrices(), entity));
        return entity;
    }

    private List<ServiceWeightPrice> mapWeightPrices(List<WeightPriceDto> weightPrices,
            com.petties.petties.model.ClinicService service) {
        if (weightPrices == null || weightPrices.isEmpty()) {
            return List.of();
        }
        List<ServiceWeightPrice> mapped = new ArrayList<>();
        for (WeightPriceDto weightPrice : weightPrices) {
            if (weightPrice == null || weightPrice.getPrice() == null
                    || weightPrice.getMinWeight() == null || weightPrice.getMaxWeight() == null) {
                continue;
            }
            ServiceWeightPrice entity = new ServiceWeightPrice();
            entity.setService(service);
            entity.setMinWeight(weightPrice.getMinWeight());
            entity.setMaxWeight(weightPrice.getMaxWeight());
            entity.setPrice(weightPrice.getPrice());
            mapped.add(entity);
        }
        return mapped;
    }

    private String normalizeForMatch(String value) {
        if (value == null || value.isBlank()) {
            return "";
        }
        return Normalizer.normalize(value, Normalizer.Form.NFD)
                .replaceAll("\\p{M}+", "")
                .replace('\u0111', 'd')
                .replace('\u0110', 'D')
                .toLowerCase(Locale.ROOT)
                .trim();
    }

    private String valueOrEmpty(String value) {
        return value == null ? "" : value;
    }
}
