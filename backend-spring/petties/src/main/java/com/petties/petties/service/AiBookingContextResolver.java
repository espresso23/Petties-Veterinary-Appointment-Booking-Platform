package com.petties.petties.service;

import com.petties.petties.dto.ai.booking.AiBookingContextRequest;
import com.petties.petties.dto.ai.booking.AiBookingContextResponse;
import com.petties.petties.exception.ForbiddenException;
import com.petties.petties.exception.ResourceNotFoundException;
import com.petties.petties.model.Pet;
import com.petties.petties.model.enums.BookingType;
import com.petties.petties.repository.PetRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.text.Normalizer;
import java.time.LocalDate;
import java.time.Period;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.List;
import java.util.Locale;
import java.util.Optional;
import java.util.UUID;

@Service
@RequiredArgsConstructor
public class AiBookingContextResolver {

    private final PetRepository petRepository;
    private final LocationService locationService;

    @Transactional(readOnly = true)
    public AiBookingContextResponse resolveContext(UUID currentUserId, AiBookingContextRequest request) {
        Pet resolvedPet = resolvePetEntity(
                currentUserId,
                request.getPetId(),
                request.getPetHint(),
                request.getTranscript(),
                request.getLatestMessage());

        BookingType bookingType = resolveBookingType(
                request.getBookingTypeHint(),
                request.getTranscript(),
                request.getLatestMessage(),
                request.getAddress());

        AiBookingContextResponse.ResolvedLocation location = resolveLocation(
                request.getLatitude(),
                request.getLongitude(),
                request.getAddress());

        String resolvedClinicHint = blankToNull(request.getClinicHint());

        List<String> missingFields = new ArrayList<>();
        if (resolvedPet == null && petRepository.findByUser_UserId(currentUserId).size() > 1) {
            missingFields.add("pet");
        }
        if (location == null && resolvedClinicHint == null) {
            missingFields.add("location");
        }
        if (request.getServiceHint() == null || request.getServiceHint().isBlank()) {
            missingFields.add("service");
        }

        return AiBookingContextResponse.builder()
                .resolvedPet(toResolvedPet(resolvedPet))
                .resolvedBookingType(bookingType)
                .resolvedLocation(location)
                .resolvedServiceHint(blankToNull(request.getServiceHint()))
                .resolvedClinicHint(resolvedClinicHint)
                .resolvedDateHint(blankToNull(request.getDateHint()))
                .resolvedTimeHint(blankToNull(request.getTimeHint()))
                .missingFields(missingFields)
                .readyForClinicSearch(location != null || resolvedClinicHint != null)
                .build();
    }

    @Transactional(readOnly = true)
    public Pet resolvePetEntity(
            UUID currentUserId,
            UUID petId,
            String petHint,
            String transcript,
            String latestMessage) {
        List<Pet> pets = petRepository.findByUser_UserId(currentUserId);
        if (pets.isEmpty()) {
            return null;
        }

        if (petId != null) {
            Pet pet = petRepository.findById(petId)
                    .orElseThrow(() -> new ResourceNotFoundException("Không tìm thấy thú cưng"));
            if (!pet.getUser().getUserId().equals(currentUserId)) {
                throw new ForbiddenException("Thú cưng không thuộc quyền sở hữu của bạn");
            }
            return pet;
        }

        String combined = normalizeForMatch(String.join(" ", List.of(
                blankToEmpty(petHint),
                blankToEmpty(latestMessage),
                blankToEmpty(transcript))));

        if (!combined.isBlank()) {
            Optional<Pet> matched = pets.stream()
                    .sorted(Comparator.comparingInt((Pet pet) -> pet.getName() != null ? pet.getName().length() : 0).reversed())
                    .filter(pet -> combined.contains(normalizeForMatch(pet.getName())))
                    .findFirst();
            if (matched.isPresent()) {
                return matched.get();
            }
        }

        return pets.size() == 1 ? pets.get(0) : null;
    }

    public BookingType resolveBookingType(
            BookingType hint,
            String transcript,
            String latestMessage,
            String address) {
        if (hint != null) {
            return hint;
        }

        String combined = normalizeForMatch(String.join(" ", List.of(
                blankToEmpty(latestMessage),
                blankToEmpty(transcript),
                blankToEmpty(address))));

        if (combined.contains("sos") || combined.contains("cap cuu")) {
            return BookingType.SOS;
        }
        if (combined.contains("tai nha") || combined.contains("den nha") || combined.contains("home visit")) {
            return BookingType.HOME_VISIT;
        }
        return BookingType.IN_CLINIC;
    }

    public AiBookingContextResponse.ResolvedLocation resolveLocation(
            BigDecimal latitude,
            BigDecimal longitude,
            String address) {
        if (latitude != null && longitude != null) {
            return AiBookingContextResponse.ResolvedLocation.builder()
                    .latitude(latitude)
                    .longitude(longitude)
                    .address(blankToNull(address))
                    .build();
        }

        String normalizedAddress = blankToNull(address);
        if (normalizedAddress == null) {
            return null;
        }

        try {
            var geocode = locationService.geocode(normalizedAddress);
            return AiBookingContextResponse.ResolvedLocation.builder()
                    .latitude(geocode.getLatitude())
                    .longitude(geocode.getLongitude())
                    .address(blankToNull(geocode.getFormattedAddress()) != null
                            ? geocode.getFormattedAddress().trim()
                            : normalizedAddress)
                    .build();
        } catch (RuntimeException ex) {
            return null;
        }
    }

    private AiBookingContextResponse.ResolvedPet toResolvedPet(Pet pet) {
        if (pet == null) {
            return null;
        }
        return AiBookingContextResponse.ResolvedPet.builder()
                .petId(pet.getId())
                .name(pet.getName())
                .species(pet.getSpecies())
                .weightKg(pet.getWeight())
                .ageYears(calculateAgeYears(pet.getDateOfBirth()))
                .build();
    }

    private Integer calculateAgeYears(LocalDate dateOfBirth) {
        if (dateOfBirth == null) {
            return null;
        }
        return Period.between(dateOfBirth, LocalDate.now()).getYears();
    }

    private String normalizeForMatch(String value) {
        if (value == null || value.isBlank()) {
            return "";
        }
        String normalized = Normalizer.normalize(value, Normalizer.Form.NFD)
                .replaceAll("\\p{M}+", "")
                .replace('đ', 'd')
                .replace('Đ', 'D');
        return normalized.toLowerCase(Locale.ROOT).trim();
    }

    private String blankToNull(String value) {
        return value == null || value.isBlank() ? null : value.trim();
    }

    private String blankToEmpty(String value) {
        return value == null ? "" : value.trim();
    }
}
