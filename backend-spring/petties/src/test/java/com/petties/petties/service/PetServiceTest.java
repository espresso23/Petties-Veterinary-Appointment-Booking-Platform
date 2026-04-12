package com.petties.petties.service;

import com.petties.petties.dto.pet.PetResponse;
import com.petties.petties.exception.ForbiddenException;
import com.petties.petties.exception.ResourceNotFoundException;
import com.petties.petties.model.Pet;
import com.petties.petties.model.User;
import com.petties.petties.model.enums.Role;
import com.petties.petties.repository.PetRepository;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.util.Optional;
import java.util.UUID;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.Mockito.*;

@ExtendWith(MockitoExtension.class)
@DisplayName("PetService Unit Tests - View Pet Profile")
class PetServiceTest {

    @Mock
    private PetRepository petRepository;

    @Mock
    private AuthService authService;

    @InjectMocks
    private PetService petService;

    private User owner;
    private User otherUser;
    private User staff;
    private Pet myPet;
    private UUID petId;

    @BeforeEach
    void setUp() {
        petId = UUID.randomUUID();

        owner = new User();
        owner.setUserId(UUID.randomUUID());
        owner.setRole(Role.PET_OWNER);
        owner.setFullName("Pet Owner");

        otherUser = new User();
        otherUser.setUserId(UUID.randomUUID());
        otherUser.setRole(Role.PET_OWNER);

        staff = new User();
        staff.setUserId(UUID.randomUUID());
        staff.setRole(Role.STAFF);

        myPet = new Pet();
        myPet.setId(petId);
        myPet.setName("Milu");
        myPet.setUser(owner);
    }

    @Test
    @DisplayName("TC-UNIT-PET-SERVICE-001: Get Pet - Owner Access - Success")
    void getPet_ownerAccess_success() {
        // Arrange
        when(petRepository.findById(petId)).thenReturn(Optional.of(myPet));
        when(authService.getCurrentUser()).thenReturn(owner);

        // Act
        PetResponse response = petService.getPet(petId);

        // Assert
        assertNotNull(response);
        assertEquals("Milu", response.getName());
        verify(petRepository).findById(petId);
    }

    @Test
    @DisplayName("TC-UNIT-PET-SERVICE-002: Get Pet - Other Owner Access - Forbidden")
    void getPet_otherOwnerAccess_forbidden() {
        // Arrange
        when(petRepository.findById(petId)).thenReturn(Optional.of(myPet));
        when(authService.getCurrentUser()).thenReturn(otherUser);

        // Act & Assert
        assertThrows(ForbiddenException.class, () -> petService.getPet(petId));
    }

    @Test
    @DisplayName("TC-UNIT-PET-SERVICE-003: Get Pet - Staff Access - Success (Bypass Ownership)")
    void getPet_staffAccess_success() {
        // Arrange
        when(petRepository.findById(petId)).thenReturn(Optional.of(myPet));
        when(authService.getCurrentUser()).thenReturn(staff);

        // Act
        PetResponse response = petService.getPet(petId);

        // Assert
        assertNotNull(response);
        assertEquals("Milu", response.getName());
    }

    @Test
    @DisplayName("TC-UNIT-PET-SERVICE-005: Get Pet - Admin Access - Success")
    void getPet_adminAccess_success() {
        User admin = new User();
        admin.setRole(Role.ADMIN);
        when(petRepository.findById(petId)).thenReturn(Optional.of(myPet));
        when(authService.getCurrentUser()).thenReturn(admin);

        PetResponse response = petService.getPet(petId);
        assertNotNull(response);
    }

    @Test
    @DisplayName("TC-UNIT-PET-SERVICE-006: Get Pet - Weight Boundary (0.0) - Success")
    void getPet_weightZero_success() {
        myPet.setWeight(0.0);
        when(petRepository.findById(petId)).thenReturn(Optional.of(myPet));
        when(authService.getCurrentUser()).thenReturn(owner);

        PetResponse response = petService.getPet(petId);
        assertEquals(0.0, response.getWeight());
    }

    @Test
    @DisplayName("TC-UNIT-PET-SERVICE-004: Get Pet - Not Found - Exception")
    void getPet_notFound_throwsException() {
        // Arrange
        when(petRepository.findById(petId)).thenReturn(Optional.empty());

        // Act & Assert
        assertThrows(ResourceNotFoundException.class, () -> petService.getPet(petId));
    }
}
