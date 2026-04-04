package com.petties.petties.service;

import com.petties.petties.dto.ai.booking.AiBookingContextRequest;
import com.petties.petties.dto.ai.booking.AiBookingContextResponse;
import com.petties.petties.dto.clinic.GeocodeResponse;
import com.petties.petties.model.Pet;
import com.petties.petties.model.User;
import com.petties.petties.model.enums.BookingType;
import com.petties.petties.model.enums.PetSpecies;
import com.petties.petties.repository.PetRepository;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.List;
import java.util.UUID;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertNotNull;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
@DisplayName("AiBookingContextResolver Unit Tests")
class AiBookingContextResolverUnitTest {

    @Mock
    private PetRepository petRepository;

    @Mock
    private LocationService locationService;

    @InjectMocks
    private AiBookingContextResolver resolver;

    @Test
    @DisplayName("Resolve context - should detect pet from transcript and prefer GPS location")
    void resolveContext_shouldDetectPetFromTranscriptAndGps() {
        UUID userId = UUID.randomUUID();

        User owner = new User();
        owner.setUserId(userId);

        Pet rocky = new Pet();
        rocky.setId(UUID.randomUUID());
        rocky.setName("Rocky");
        rocky.setSpecies(PetSpecies.DOG);
        rocky.setDateOfBirth(LocalDate.now().minusYears(4));
        rocky.setWeight(12.0);
        rocky.setUser(owner);

        Pet hadine = new Pet();
        hadine.setId(UUID.randomUUID());
        hadine.setName("Hadine");
        hadine.setSpecies(PetSpecies.DOG);
        hadine.setDateOfBirth(LocalDate.now().minusYears(2));
        hadine.setWeight(8.5);
        hadine.setUser(owner);

        when(petRepository.findByUser_UserId(userId)).thenReturn(List.of(rocky, hadine));

        AiBookingContextResponse response = resolver.resolveContext(
                userId,
                AiBookingContextRequest.builder()
                        .transcript("Toi da noi truoc do la dat lich cho Hadine roi")
                        .latestMessage("Cho Hadine, toi o Ngu Hanh Son Da Nang")
                        .latitude(new BigDecimal("15.9575"))
                        .longitude(new BigDecimal("108.2575"))
                        .serviceHint("kham benh")
                        .build());

        assertNotNull(response.getResolvedPet());
        assertEquals("Hadine", response.getResolvedPet().getName());
        assertEquals(BookingType.IN_CLINIC, response.getResolvedBookingType());
        assertNotNull(response.getResolvedLocation());
        assertTrue(response.isReadyForClinicSearch());
    }

    @Test
    @DisplayName("Resolve booking type - should recognize home visit from transcript")
    void resolveBookingType_shouldRecognizeHomeVisit() {
        BookingType result = resolver.resolveBookingType(
                null,
                "Toi muon dat lich kham tai nha cho be Lu",
                null,
                "123 Nguyen Van Linh");

        assertEquals(BookingType.HOME_VISIT, result);
    }

    @Test
    @DisplayName("Resolve context - should geocode text address when GPS is missing")
    void resolveContext_shouldGeocodeTextAddress() {
        UUID userId = UUID.randomUUID();

        User owner = new User();
        owner.setUserId(userId);

        Pet hadine = new Pet();
        hadine.setId(UUID.randomUUID());
        hadine.setName("Hadine");
        hadine.setSpecies(PetSpecies.DOG);
        hadine.setDateOfBirth(LocalDate.now().minusYears(2));
        hadine.setWeight(8.5);
        hadine.setUser(owner);

        when(petRepository.findByUser_UserId(userId)).thenReturn(List.of(hadine));
        when(locationService.geocode("Ngu Hanh Son Da Nang")).thenReturn(
                GeocodeResponse.builder()
                        .latitude(new BigDecimal("15.97500000"))
                        .longitude(new BigDecimal("108.25000000"))
                        .formattedAddress("Ngu Hanh Son, Da Nang")
                        .build());

        AiBookingContextResponse response = resolver.resolveContext(
                userId,
                AiBookingContextRequest.builder()
                        .latestMessage("Dat lich cho Hadine tai Ngu Hanh Son Da Nang")
                        .address("Ngu Hanh Son Da Nang")
                        .serviceHint("kham benh")
                        .build());

        assertNotNull(response.getResolvedLocation());
        assertEquals(new BigDecimal("15.97500000"), response.getResolvedLocation().getLatitude());
        assertEquals(new BigDecimal("108.25000000"), response.getResolvedLocation().getLongitude());
        assertEquals("Ngu Hanh Son, Da Nang", response.getResolvedLocation().getAddress());
        assertTrue(response.isReadyForClinicSearch());
    }
}
