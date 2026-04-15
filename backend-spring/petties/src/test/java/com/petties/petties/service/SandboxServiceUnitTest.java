package com.petties.petties.service;

import com.petties.petties.dto.clinic.ClinicResponse;
import com.petties.petties.model.Clinic;
import com.petties.petties.model.User;
import com.petties.petties.model.enums.ClinicStatus;
import com.petties.petties.repository.BookingRepository;
import com.petties.petties.repository.ClinicRepository;
import com.petties.petties.repository.ClinicServiceRepository;
import com.petties.petties.repository.MasterServiceRepository;
import com.petties.petties.repository.SlotRepository;
import com.petties.petties.repository.StaffShiftRepository;
import com.petties.petties.repository.UserRepository;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.time.LocalDateTime;
import java.util.List;
import java.util.Optional;
import java.util.UUID;

import static org.junit.jupiter.api.Assertions.assertDoesNotThrow;
import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertNotNull;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.times;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
@DisplayName("SandboxService Unit Tests")
class SandboxServiceUnitTest {

    @Mock
    private ClinicRepository clinicRepository;

    @Mock
    private ClinicServiceRepository clinicServiceRepository;

    @Mock
    private MasterServiceRepository masterServiceRepository;

    @Mock
    private BookingRepository bookingRepository;

    @Mock
    private UserRepository userRepository;

    @Mock
    private StaffShiftRepository staffShiftRepository;

    @Mock
    private SlotRepository slotRepository;

    @InjectMocks
    private SandboxService sandboxService;

    @Test
    @DisplayName("enterSandboxMode - tạo sandbox clinic thành công cho feature clinic_info")
    void enterSandboxMode_clinicInfo_success() {
        UUID userId = UUID.randomUUID();

        User user = new User();
        user.setUserId(userId);
        user.setFullName("Clinic Owner A");

        when(userRepository.findById(userId)).thenReturn(Optional.of(user));
        when(clinicRepository.findFirstByIsSandboxTrueAndSandboxOwnerUserIdOrderByCreatedAtDesc(userId))
                .thenReturn(Optional.empty());
        when(clinicRepository.save(any(Clinic.class))).thenAnswer(invocation -> {
            Clinic clinic = invocation.getArgument(0);
            if (clinic.getClinicId() == null) {
                clinic.setClinicId(UUID.randomUUID());
            }
            return clinic;
        });

        ClinicResponse response = sandboxService.enterSandboxMode("clinic_info", userId);

        assertNotNull(response);
        assertNotNull(response.getClinicId());
        assertTrue(response.getName().contains("Sandbox - clinic_info"));
        verify(clinicRepository, times(1)).save(any(Clinic.class));
    }

    @Test
    @DisplayName("getCurrentSandbox - trả về sandbox hiện tại của user")
    void getCurrentSandbox_found_success() {
        UUID userId = UUID.randomUUID();
        UUID clinicId = UUID.randomUUID();

        User owner = new User();
        owner.setUserId(userId);
        owner.setFullName("Clinic Owner A");
        owner.setEmail("owner@test.com");

        Clinic clinic = new Clinic();
        clinic.setClinicId(clinicId);
        clinic.setName("Sandbox - services (Clinic Owner A)");
        clinic.setOwner(owner);
        clinic.setStatus(ClinicStatus.APPROVED);
        clinic.setCreatedAt(LocalDateTime.now());

        when(clinicRepository.findFirstByIsSandboxTrueAndSandboxOwnerUserIdOrderByCreatedAtDesc(userId))
                .thenReturn(Optional.of(clinic));

        ClinicResponse response = sandboxService.getCurrentSandbox(userId);

        assertNotNull(response);
        assertEquals(clinicId, response.getClinicId());
        assertEquals("Sandbox - services (Clinic Owner A)", response.getName());
    }

    @Test
    @DisplayName("exitSandboxMode - sandbox owner hợp lệ thì xóa thành công")
    void exitSandboxMode_validOwner_success() {
        UUID ownerId = UUID.randomUUID();
        UUID clinicId = UUID.randomUUID();

        User owner = new User();
        owner.setUserId(ownerId);

        Clinic clinic = new Clinic();
        clinic.setClinicId(clinicId);
        clinic.setIsSandbox(true);
        clinic.setSandboxOwner(owner);

        when(clinicRepository.findById(clinicId)).thenReturn(Optional.of(clinic));

        assertDoesNotThrow(() -> sandboxService.exitSandboxMode(clinicId, ownerId));
        verify(clinicRepository, times(1)).delete(clinic);
    }

    @Test
    @DisplayName("cleanupExpiredSandboxes - xóa toàn bộ sandbox hết hạn")
    void cleanupExpiredSandboxes_deleteAllExpired() {
        Clinic clinicA = new Clinic();
        clinicA.setClinicId(UUID.randomUUID());
        clinicA.setName("Sandbox A");

        Clinic clinicB = new Clinic();
        clinicB.setClinicId(UUID.randomUUID());
        clinicB.setName("Sandbox B");

        when(clinicRepository.findExpiredSandboxes(any(LocalDateTime.class))).thenReturn(List.of(clinicA, clinicB));

        sandboxService.cleanupExpiredSandboxes();

        verify(clinicRepository, times(1)).delete(clinicA);
        verify(clinicRepository, times(1)).delete(clinicB);
    }
}
