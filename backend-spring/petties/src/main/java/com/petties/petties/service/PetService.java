package com.petties.petties.service;

import com.petties.petties.dto.file.UploadResponse;
import com.petties.petties.dto.pet.PetRequest;
import com.petties.petties.dto.pet.PetResponse;
import com.petties.petties.dto.pet.StaffPatientDTO;
import com.petties.petties.exception.ForbiddenException;
import com.petties.petties.exception.ResourceNotFoundException;
import com.petties.petties.model.Booking;
import com.petties.petties.model.Clinic;
import com.petties.petties.model.EmrRecord;
import com.petties.petties.model.Pet;
import com.petties.petties.model.User;
import com.petties.petties.model.enums.BookingStatus;
import com.petties.petties.model.enums.Role;
import com.petties.petties.repository.BookingRepository;
import com.petties.petties.repository.EmrRecordRepository;
import com.petties.petties.repository.PetRepository;
import jakarta.persistence.criteria.Predicate;
import jakarta.persistence.criteria.Root;
import jakarta.persistence.criteria.Subquery;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.domain.Specification;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.multipart.MultipartFile;

import java.time.LocalDate;
import java.time.LocalDateTime;
import java.time.Period;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.HashSet;
import java.util.List;
import java.util.Map;
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
    private final BookingRepository bookingRepository;

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
        // Usually verify owner or if Staff has access. For now, strictly owner for
        // simple
        // management.
        User currentUser = authService.getCurrentUser();
        // If not owner and not Staff (logic to be added later if needed), throw error.
        // For now, let's strictly enforce ownership for safety.
        // If not owner and not Staff (logic to be added later if needed), throw error.
        // For now, let's strictly enforce ownership for safety.
        if (currentUser.getRole() == Role.PET_OWNER &&
                !pet.getUser().getUserId().equals(currentUser.getUserId())) {
            validateOwnership(pet, currentUser);
        }

        return mapToResponse(pet);
    }

    @Transactional(readOnly = true)
    public Page<PetResponse> getPets(
            String species,
            String breed,
            Pageable pageable) {

        User currentUser = authService.getCurrentUser();

        Specification<Pet> spec = (root, query, cb) -> {
            List<Predicate> predicates = new ArrayList<>();

            // Filter logic based on Role
            if (currentUser.getRole() == Role.PET_OWNER) {
                // Owner: Only see their own pets
                predicates.add(cb.equal(root.get("user").get("userId"), currentUser.getUserId()));
            } else if (currentUser.getRole() == Role.STAFF ||
                    currentUser.getRole() == Role.CLINIC_MANAGER) {
                // Staff/Manager: See pets that have at least one EMR OR Booking at their clinic
                if (currentUser.getWorkingClinic() != null) {
                    UUID workingClinicId = currentUser.getWorkingClinic().getClinicId();

                    // 1. Get pet IDs from EMRs at this clinic (efficiently)
                    List<UUID> petIdsFromEmr = emrRecordRepository.findByClinicId(workingClinicId)
                            .stream()
                            .map(EmrRecord::getPetId)
                            .distinct()
                            .collect(Collectors.toList());

                    // 2. Subquery for pet IDs from Bookings at this clinic
                    Subquery<UUID> bookingSubquery = query.subquery(UUID.class);
                    Root<Booking> subBooking = bookingSubquery.from(Booking.class);
                    bookingSubquery.select(subBooking.get("pet").get("id"));
                    bookingSubquery.where(cb.equal(subBooking.get("clinic").get("clinicId"), workingClinicId));

                    // Combine: (pet.id IN emrPetIds) OR (pet.id IN (SELECT pet_id FROM bookings
                    // WHERE clinic_id = ...))
                    Predicate hasEmr = petIdsFromEmr.isEmpty() ? cb.disjunction() : root.get("id").in(petIdsFromEmr);
                    Predicate hasBooking = root.get("id").in(bookingSubquery);

                    predicates.add(cb.or(hasEmr, hasBooking));
                } else {
                    // If Staff/Manager has no clinic assigned, return empty list for safety
                    predicates.add(cb.disjunction());
                }
            } else if (currentUser.getRole() == Role.CLINIC_OWNER) {
                // Clinic Owner: See pets that have bookings at ANY of their owned clinics
                // TODO: Implement for multiple clinics if needed. For now treating similar to
                // Manager if they switch context,
                // but roughly checking all owned clinics.
                // Detailed implementation depends on if Owner has "workingClinic" context or
                // "ownedClinics" list.
                // Assuming Owner might need to see all pets across all their clinics.

                List<Clinic> ownedClinics = currentUser.getOwnedClinics();
                if (ownedClinics != null && !ownedClinics.isEmpty()) {
                    List<UUID> ownedClinicIds = ownedClinics.stream().map(Clinic::getClinicId)
                            .collect(Collectors.toList());

                    Subquery<UUID> subquery = query.subquery(UUID.class);
                    Root<Booking> subBooking = subquery.from(Booking.class);

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

            return cb.and(predicates.toArray(new Predicate[0]));
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
     * Staff can update only the allergies field of a pet
     * No ownership check - Staff has access to update medical info
     */
    @Transactional
    public PetResponse updateAllergies(UUID petId, String allergies) {
        User currentUser = authService.getCurrentUser();

        // Only VET, CLINIC_MANAGER, or ADMIN can update allergies
        if (currentUser.getRole() != Role.STAFF &&
                currentUser.getRole() != Role.CLINIC_MANAGER &&
                currentUser.getRole() != Role.ADMIN) {
            throw new ForbiddenException("Chỉ nhân viên y tế mới có thể cập nhật thông tin dị ứng");
        }

        Pet pet = petRepository.findById(petId)
                .orElseThrow(() -> new ResourceNotFoundException("Không tìm thấy thú cưng với ID: " + petId));

        pet.setAllergies(allergies);
        Pet updatedPet = petRepository.save(pet);

        log.info("Staff {} updated allergies for pet {}", currentUser.getUsername(), petId);
        return mapToResponse(updatedPet);
    }

    /**
     * Staff can update pet weight
     * No ownership check - Staff has access to update medical info
     */
    @Transactional
    public PetResponse updateWeight(UUID petId, Double weight) {
        User currentUser = authService.getCurrentUser();

        // Only VET, CLINIC_MANAGER, or ADMIN can update weight
        if (currentUser.getRole() != Role.STAFF &&
                currentUser.getRole() != Role.CLINIC_MANAGER &&
                currentUser.getRole() != Role.ADMIN) {
            throw new ForbiddenException("Chỉ nhân viên y tế mới có thể cập nhật cân nặng");
        }

        Pet pet = petRepository.findById(petId)
                .orElseThrow(() -> new ResourceNotFoundException("Không tìm thấy thú cưng với ID: " + petId));

        pet.setWeight(weight);
        Pet updatedPet = petRepository.save(pet);

        log.info("Staff {} updated weight for pet {} to {} kg", currentUser.getUsername(), petId, weight);
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

    @Transactional(readOnly = true)
    public List<StaffPatientDTO> getPatientsForStaff(UUID clinicId, UUID staffId) {
        log.info("Getting patients for staff {} at clinic {}", staffId, clinicId);

        // 1. Identify ALL clinic patients (those who ever had an EMR or Booking at this
        // clinic)
        List<UUID> petIdsFromEmr = emrRecordRepository.findByClinicId(clinicId)
                .stream()
                .map(EmrRecord::getPetId)
                .distinct()
                .collect(Collectors.toList());
        List<UUID> petIdsFromBooking = bookingRepository.findPetIdsByClinicId(clinicId);

        Set<UUID> allClinicPetIds = new HashSet<>();
        allClinicPetIds.addAll(petIdsFromEmr);
        allClinicPetIds.addAll(petIdsFromBooking);

        log.info("Found {} unique pets from EMR and {} from Booking, total unique: {}",
                petIdsFromEmr.size(), petIdsFromBooking.size(), allClinicPetIds.size());

        if (allClinicPetIds.isEmpty()) {
            return new ArrayList<>();
        }

        // Fetch all these pets
        List<Pet> allPets = petRepository.findAllById(allClinicPetIds);
        Map<UUID, StaffPatientDTO> patientMap = new HashMap<>();

        // Initialize map with all clinic pets
        for (Pet pet : allPets) {
            patientMap.put(pet.getId(), mapToStaffDto(pet));
        }

        // 2. Fetch today's bookings to overlay active status and assignments
        LocalDate today = LocalDate.now();
        List<Booking> clinicBookingsToday = bookingRepository.findByClinicIdAndDateWithDetails(clinicId, today);

        log.info("Found {} bookings today for clinic {}", clinicBookingsToday.size(), clinicId);

        // Filter active statuses for status badge priority
        List<BookingStatus> activeStatuses = List.of(
                BookingStatus.CONFIRMED,
                BookingStatus.ARRIVED,
                BookingStatus.IN_PROGRESS,
                BookingStatus.ON_THE_WAY);

        for (Booking b : clinicBookingsToday) {
            Pet pet = b.getPet();
            if (pet == null)
                continue;

            StaffPatientDTO dto = patientMap.get(pet.getId());
            if (dto == null)
                continue; // Should already be in map if clinic matches

            log.debug("Processing booking {} for pet {} with status {}", b.getBookingId(), pet.getName(), b.getStatus());

            // Handle assignments correctly
            boolean isAssignedToThisStaff = b.getBookingServices() != null && b.getBookingServices().stream()
                    .anyMatch(bs -> bs.getAssignedStaff() != null && bs.getAssignedStaff().getUserId().equals(staffId));

            if (isAssignedToThisStaff) {
                dto.setAssignedToMe(true);
            }

            // Status Priority logic: Only update if new status is higher priority
            if (activeStatuses.contains(b.getStatus())) {
                String currentStatusStr = dto.getBookingStatus();
                log.debug("Pet {} has active status {}, current DTO status: {}", pet.getName(), b.getStatus(), currentStatusStr);
                if (shouldUpdateStatus(currentStatusStr, b.getStatus())) {
                    updateDtoWithBooking(dto, b);
                    log.debug("Updated DTO with booking status: {}", b.getStatus());
                } else if (currentStatusStr != null && currentStatusStr.equals(b.getStatus().name())) {
                    // Same status, keep earlier time
                    LocalDateTime newTime = LocalDateTime.of(b.getBookingDate(), b.getBookingTime());
                    if (dto.getNextAppointment() == null || newTime.isBefore(dto.getNextAppointment())) {
                        updateDtoWithBooking(dto, b);
                    }
                }
            }
        }

        // 3. Sort final results
        List<StaffPatientDTO> sortedList = new ArrayList<>(patientMap.values());
        sortedList.sort((p1, p2) -> {
            // Priority 1: Booking Status (Active first)
            int priority1 = getStatusPriority(p1.getBookingStatus());
            int priority2 = getStatusPriority(p2.getBookingStatus());
            if (priority1 != priority2) {
                return Integer.compare(priority2, priority1);
            }

            // Priority 2: Assigned to Me
            if (p1.isAssignedToMe() != p2.isAssignedToMe()) {
                return p1.isAssignedToMe() ? -1 : 1;
            }

            // Priority 3: Appointment Time
            if (p1.getNextAppointment() != null && p2.getNextAppointment() != null) {
                return p1.getNextAppointment().compareTo(p2.getNextAppointment());
            }

            // Priority 4: Name
            return p1.getPetName().compareToIgnoreCase(p2.getPetName());
        });

        log.info("Returning {} patients, first 3 statuses: {}",
                sortedList.size(),
                sortedList.stream().limit(3).map(StaffPatientDTO::getBookingStatus).collect(Collectors.toList()));

        return sortedList;
    }

    /**
     * Check if we should update the current status with a new status
     * Higher priority status wins
     */
    private boolean shouldUpdateStatus(String currentStatus, BookingStatus newStatus) {
        if (currentStatus == null)
            return true;
        int currentPriority = getStatusPriority(currentStatus);
        int newPriority = getStatusPriority(newStatus.name());
        return newPriority > currentPriority;
    }

    /**
     * Get priority order for booking status (higher = more important)
     */
    private int getStatusPriority(String status) {
        if (status == null)
            return 0;
        switch (status) {
            case "IN_PROGRESS":
                return 4;
            case "ARRIVED":
                return 3;
            case "ON_THE_WAY":
                return 2;
            case "CONFIRMED":
                return 1;
            default:
                return 0;
        }
    }

    private void updateDtoWithBooking(StaffPatientDTO dto, Booking b) {
        dto.setBookingStatus(b.getStatus().name());
        dto.setBookingId(b.getBookingId());
        dto.setBookingCode(b.getBookingCode());
        dto.setNextAppointment(LocalDateTime.of(b.getBookingDate(), b.getBookingTime()));
        log.info("Set DTO bookingStatus={}, bookingCode={} for pet {}", b.getStatus().name(), b.getBookingCode(), dto.getPetName());
    }

    private StaffPatientDTO mapToStaffDto(Pet pet) {
        // Calculate age
        int ageYears = 0;
        int ageMonths = 0;
        if (pet.getDateOfBirth() != null) {
            Period period = Period.between(pet.getDateOfBirth(), LocalDate.now());
            ageYears = period.getYears();
            ageMonths = period.getMonths();
        }

        return StaffPatientDTO.builder()
                .petId(pet.getId())
                .petName(pet.getName())
                .species(pet.getSpecies())
                .breed(pet.getBreed())
                .gender(pet.getGender())
                .ageYears(ageYears)
                .ageMonths(ageMonths)
                .dob(pet.getDateOfBirth())
                .weight(pet.getWeight())
                .color(pet.getColor())
                .imageUrl(pet.getImageUrl())
                .allergies(pet.getAllergies())
                .ownerName(pet.getUser() != null ? pet.getUser().getFullName() : "Unknown")
                .ownerPhone(pet.getUser() != null ? pet.getUser().getPhone() : "Unknown")
                .build();
    }
}
