package com.petties.petties.service;

import com.petties.petties.dto.file.UploadResponse;
import com.petties.petties.dto.pet.PetRequest;
import com.petties.petties.dto.pet.PetResponse;
import com.petties.petties.exception.ForbiddenException;
import com.petties.petties.exception.ResourceNotFoundException;
import com.petties.petties.model.Pet;
import com.petties.petties.model.User;
import com.petties.petties.repository.PetRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.multipart.MultipartFile;

import java.util.List;
import java.util.UUID;
import java.util.stream.Collectors;

@Slf4j
@Service
@RequiredArgsConstructor
public class PetService {

    private final PetRepository petRepository;
    private final AuthService authService;
    private final CloudinaryService cloudinaryService;

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
        if (!pet.getUser().getUserId().equals(currentUser.getUserId())) {
            // throw new ForbiddenException("Bạn không có quyền truy cập thông tin thú cưng
            // này");
            // Relaxing this: Vets might need to see it.
            // But 'getMyPets' implies CRUD is for owner.
            // For strict CRUD:
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

            // Filter by Owner
            predicates.add(cb.equal(root.get("user").get("userId"), currentUser.getUserId()));

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
        return response;
    }
}
