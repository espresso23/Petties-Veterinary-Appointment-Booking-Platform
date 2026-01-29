package com.petties.petties.service;

import com.petties.petties.dto.file.UploadResponse;
import com.petties.petties.dto.pet.PetRequest;
import com.petties.petties.dto.pet.PetResponse;
import com.petties.petties.exception.ForbiddenException;
import com.petties.petties.exception.ResourceNotFoundException;
import com.petties.petties.model.EmrRecord;
import com.petties.petties.model.Pet;
import com.petties.petties.model.User;
import com.petties.petties.repository.EmrRecordRepository;
import com.petties.petties.repository.PetRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.multipart.MultipartFile;

import java.util.List;
import java.util.Set;
import java.util.UUID;
import java.util.stream.Collectors;

@Slf4j
@Service
@RequiredArgsConstructor
public class PetService {

    private final PetRepository petRepository;
    private final AuthService authService;
    private final CloudinaryService cloudinaryService;
    private final EmrRecordRepository emrRecordRepository;

    @Transactional
    public PetResponse createPet(PetRequest request, MultipartFile image) {
        User currentUser = authService.getCurrentUser();

        Pet pet = new Pet();
        pet.setName(request.getName());
        pet.setSpecies(request.getSpecies());
        pet.setBreed(request.getBreed());
        pet.setDateOfBirth(request.getDateOfBirth());
        pet.setWeight(request.getWeight());
        pet.setGender(request.getGender());
        pet.setColor(request.getColor());
        pet.setAllergies(request.getAllergies());
        pet.setUser(currentUser);

        if (image != null && !image.isEmpty()) {
            UploadResponse uploadResponse = cloudinaryService.uploadFile(image, "pets");
            pet.setImageUrl(uploadResponse.getUrl());
            pet.setImagePublicId(uploadResponse.getPublicId());
        }

        Pet savedPet = petRepository.save(pet);
        log.info("Created pet {} for user {}", savedPet.getId(), currentUser.getUsername());

        return mapToResponse(savedPet);
    }

    @Transactional(readOnly = true)
    public List<PetResponse> getMyPets() {
        User currentUser = authService.getCurrentUser();
        List<Pet> pets = petRepository.findByUser_UserId(currentUser.getUserId());
        return pets.stream().map(this::mapToResponse).collect(Collectors.toList());
    }

    @Transactional(readOnly = true)
    public PetResponse getPet(UUID id) {
        Pet pet = petRepository.findById(id)
                .orElseThrow(() -> new ResourceNotFoundException("Không tìm thấy thú cưng với ID: " + id));

        // Optional: Check ownership? Assuming public/shared access or strictly owner?
        // Usually verify owner or if Vet has access. For now, strictly owner for simple
        // management.
        User currentUser = authService.getCurrentUser();
        // If not owner and not Vet (logic to be added later if needed), throw error.
        // For now, let's strictly enforce ownership for safety.
        // If not owner and not Vet (logic to be added later if needed), throw error.
        // For now, let's strictly enforce ownership for safety.
        if (currentUser.getRole() == com.petties.petties.model.enums.Role.PET_OWNER &&
                !pet.getUser().getUserId().equals(currentUser.getUserId())) {
            validateOwnership(pet, currentUser);
        }

        return mapToResponse(pet);
    }

    @Transactional(readOnly = true)
    public org.springframework.data.domain.Page<PetResponse> getPets(
            String species,
            String breed,
            org.springframework.data.domain.Pageable pageable) {

        User currentUser = authService.getCurrentUser();

        org.springframework.data.jpa.domain.Specification<Pet> spec = (root, query, cb) -> {
            java.util.List<jakarta.persistence.criteria.Predicate> predicates = new java.util.ArrayList<>();

            // Filter logic based on Role
            if (currentUser.getRole() == com.petties.petties.model.enums.Role.PET_OWNER) {
                // Owner: Only see their own pets
                predicates.add(cb.equal(root.get("user").get("userId"), currentUser.getUserId()));
            } else if (currentUser.getRole() == com.petties.petties.model.enums.Role.STAFF ||
                    currentUser.getRole() == com.petties.petties.model.enums.Role.CLINIC_MANAGER) {
                // Vet/Manager: Only see pets that have at least one EMR at their clinic
                if (currentUser.getWorkingClinic() != null) {
                    // Query MongoDB for pet IDs with EMRs at this clinic
                    List<EmrRecord> clinicEmrs = emrRecordRepository.findByClinicIdOrderByExaminationDateDesc(
                            currentUser.getWorkingClinic().getClinicId());

                    // Extract unique pet IDs from EMRs
                    Set<UUID> petIdsWithEmr = clinicEmrs.stream()
                            .map(EmrRecord::getPetId)
                            .collect(Collectors.toSet());

                    if (!petIdsWithEmr.isEmpty()) {
                        // Filter: WHERE pet.id IN (petIds from EMRs)
                        predicates.add(root.get("id").in(petIdsWithEmr));
                    } else {
                        // No EMRs at this clinic -> empty list
                        predicates.add(cb.disjunction());
                    }
                } else {
                    // If Vet/Manager has no clinic assigned, return empty list for safety
                    predicates.add(cb.disjunction());
                }
            } else if (currentUser.getRole() == com.petties.petties.model.enums.Role.CLINIC_OWNER) {
                // Clinic Owner: See pets that have bookings at ANY of their owned clinics
                // TODO: Implement for multiple clinics if needed. For now treating similar to
                // Manager if they switch context,
                // but roughly checking all owned clinics.
                // Detailed implementation depends on if Owner has "workingClinic" context or
                // "ownedClinics" list.
                // Assuming Owner might need to see all pets across all their clinics.

                List<com.petties.petties.model.Clinic> ownedClinics = currentUser.getOwnedClinics();
                if (ownedClinics != null && !ownedClinics.isEmpty()) {
                    List<UUID> ownedClinicIds = ownedClinics.stream().map(com.petties.petties.model.Clinic::getClinicId)
                            .collect(Collectors.toList());

                    jakarta.persistence.criteria.Subquery<UUID> subquery = query.subquery(UUID.class);
                    jakarta.persistence.criteria.Root<com.petties.petties.model.Booking> subBooking = subquery
                            .from(com.petties.petties.model.Booking.class);

                    subquery.select(subBooking.get("pet").get("id"));
                    subquery.where(subBooking.get("clinic").get("clinicId").in(ownedClinicIds));

                    predicates.add(root.get("id").in(subquery));
                } else {
                    predicates.add(cb.disjunction());
                }
            }
            // ADMIN: no filter, sees all

            if (species != null && !species.isEmpty()) {
                predicates.add(cb.like(cb.lower(root.get("species")), "%" + species.toLowerCase() + "%"));
            }
            if (breed != null && !breed.isEmpty()) {
                predicates.add(cb.like(cb.lower(root.get("breed")), "%" + breed.toLowerCase() + "%"));
            }

            return cb.and(predicates.toArray(new jakarta.persistence.criteria.Predicate[0]));
        };

        return petRepository.findAll(spec, pageable).map(this::mapToResponse);
    }

    @Transactional
    public PetResponse updatePet(UUID id, PetRequest request, MultipartFile image) {
        User currentUser = authService.getCurrentUser();
        Pet pet = petRepository.findById(id)
                .orElseThrow(() -> new ResourceNotFoundException("Không tìm thấy thú cưng với ID: " + id));

        validateOwnership(pet, currentUser);

        pet.setName(request.getName());
        pet.setSpecies(request.getSpecies());
        pet.setBreed(request.getBreed());
        pet.setDateOfBirth(request.getDateOfBirth());
        pet.setWeight(request.getWeight());
        pet.setGender(request.getGender());
        pet.setColor(request.getColor());
        pet.setAllergies(request.getAllergies());

        if (image != null && !image.isEmpty()) {
            // Delete old image if exists
            if (pet.getImagePublicId() != null) {
                cloudinaryService.deleteFile(pet.getImagePublicId());
            }
            UploadResponse uploadResponse = cloudinaryService.uploadFile(image, "pets");
            pet.setImageUrl(uploadResponse.getUrl());
            pet.setImagePublicId(uploadResponse.getPublicId());
        }

        Pet updatedPet = petRepository.save(pet);
        log.info("Updated pet {} for user {}", updatedPet.getId(), currentUser.getUsername());
        return mapToResponse(updatedPet);
    }

    /**
     * VET can update only the allergies field of a pet
     * No ownership check - VET has access to update medical info
     */
    @Transactional
    public PetResponse updateAllergies(UUID petId, String allergies) {
        User currentUser = authService.getCurrentUser();

        // Only VET, CLINIC_MANAGER, or ADMIN can update allergies
        if (currentUser.getRole() != com.petties.petties.model.enums.Role.STAFF &&
                currentUser.getRole() != com.petties.petties.model.enums.Role.CLINIC_MANAGER &&
                currentUser.getRole() != com.petties.petties.model.enums.Role.ADMIN) {
            throw new ForbiddenException("Chỉ nhân viên y tế mới có thể cập nhật thông tin dị ứng");
        }

        Pet pet = petRepository.findById(petId)
                .orElseThrow(() -> new ResourceNotFoundException("Không tìm thấy thú cưng với ID: " + petId));

        pet.setAllergies(allergies);
        Pet updatedPet = petRepository.save(pet);

        log.info("VET {} updated allergies for pet {}", currentUser.getUsername(), petId);
        return mapToResponse(updatedPet);
    }

    /**
     * VET can update pet weight
     * No ownership check - VET has access to update medical info
     */
    @Transactional
    public PetResponse updateWeight(UUID petId, Double weight) {
        User currentUser = authService.getCurrentUser();

        // Only VET, CLINIC_MANAGER, or ADMIN can update weight
        if (currentUser.getRole() != com.petties.petties.model.enums.Role.STAFF &&
                currentUser.getRole() != com.petties.petties.model.enums.Role.CLINIC_MANAGER &&
                currentUser.getRole() != com.petties.petties.model.enums.Role.ADMIN) {
            throw new ForbiddenException("Chỉ nhân viên y tế mới có thể cập nhật cân nặng");
        }

        Pet pet = petRepository.findById(petId)
                .orElseThrow(() -> new ResourceNotFoundException("Không tìm thấy thú cưng với ID: " + petId));

        pet.setWeight(weight);
        Pet updatedPet = petRepository.save(pet);

        log.info("VET {} updated weight for pet {} to {} kg", currentUser.getUsername(), petId, weight);
        return mapToResponse(updatedPet);
    }

    @Transactional
    public void deletePet(UUID id) {
        User currentUser = authService.getCurrentUser();
        Pet pet = petRepository.findById(id)
                .orElseThrow(() -> new ResourceNotFoundException("Không tìm thấy thú cưng với ID: " + id));

        validateOwnership(pet, currentUser);

        if (pet.getImagePublicId() != null) {
            cloudinaryService.deleteFile(pet.getImagePublicId());
        }

        petRepository.delete(pet);
        log.info("Deleted pet {} for user {}", id, currentUser.getUsername());
    }

    private void validateOwnership(Pet pet, User user) {
        if (!pet.getUser().getUserId().equals(user.getUserId())) {
            throw new ForbiddenException("Bạn không có quyền thực hiện thao tác này trên thú cưng này");
        }
    }

    private PetResponse mapToResponse(Pet pet) {
        PetResponse response = new PetResponse();
        response.setId(pet.getId());
        response.setName(pet.getName());
        response.setSpecies(pet.getSpecies());
        response.setBreed(pet.getBreed());
        response.setDateOfBirth(pet.getDateOfBirth());
        response.setWeight(pet.getWeight());
        response.setGender(pet.getGender());
        response.setColor(pet.getColor());
        response.setAllergies(pet.getAllergies());
        response.setImageUrl(pet.getImageUrl());
        if (pet.getUser() != null) {
            response.setOwnerName(pet.getUser().getFullName());
            response.setOwnerPhone(pet.getUser().getPhone());
        }
        return response;
    }
}
