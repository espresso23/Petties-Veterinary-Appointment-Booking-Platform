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

import java.time.LocalDate;
import java.time.LocalDateTime;
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
    private final com.petties.petties.repository.BookingRepository bookingRepository;

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
                // Staff/Manager: Only see pets that have at least one EMR at their clinic
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
                    // If Staff/Manager has no clinic assigned, return empty list for safety
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
     * Staff can update only the allergies field of a pet
     * No ownership check - Staff has access to update medical info
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
        if (currentUser.getRole() != com.petties.petties.model.enums.Role.STAFF &&
                currentUser.getRole() != com.petties.petties.model.enums.Role.CLINIC_MANAGER &&
                currentUser.getRole() != com.petties.petties.model.enums.Role.ADMIN) {
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
    public List<com.petties.petties.dto.pet.StaffPatientDTO> getPatientsForStaff(UUID clinicId, UUID staffId) {
        // 1. Get MY assigned patients (Active bookings Today or Future)
        LocalDate today = java.time.LocalDate.now();
        List<com.petties.petties.model.enums.BookingStatus> activeStatuses = List.of(
                com.petties.petties.model.enums.BookingStatus.CONFIRMED,
                com.petties.petties.model.enums.BookingStatus.ASSIGNED,
                com.petties.petties.model.enums.BookingStatus.ARRIVED,
                com.petties.petties.model.enums.BookingStatus.IN_PROGRESS,
                com.petties.petties.model.enums.BookingStatus.COMPLETED);

        // Fetch bookings assigned to this Staff (Today onwards)
        List<com.petties.petties.model.Booking> myBookings = bookingRepository
                .findByAssignedStaffIdAndBookingDateBetweenAndStatusIn(
                        staffId, today, today.plusYears(1), activeStatuses);

        java.util.Map<UUID, com.petties.petties.dto.pet.StaffPatientDTO> patientMap = new java.util.HashMap<>();

        // Process "My Patients"
        for (com.petties.petties.model.Booking b : myBookings) {
            Pet pet = b.getPet();
            if (pet == null)
                continue;

            com.petties.petties.dto.pet.StaffPatientDTO dto = patientMap.getOrDefault(pet.getId(), mapToStaffDto(pet));
            dto.setAssignedToMe(true);

            LocalDateTime bookingDateTime = LocalDateTime.of(b.getBookingDate(), b.getBookingTime());
            if (dto.getNextAppointment() == null || bookingDateTime.isBefore(dto.getNextAppointment())) {
                dto.setNextAppointment(bookingDateTime);
                dto.setBookingStatus(b.getStatus().name());
                dto.setBookingId(b.getBookingId());
                dto.setBookingCode(b.getBookingCode());
            }
            patientMap.put(pet.getId(), dto);
        }

        // 2. Get Clinic-wide active bookings for TODAY (to show status for all
        // patients)
        // Filter out PENDING bookings - staff should only see confirmed/assigned
        // bookings
        List<com.petties.petties.model.Booking> clinicBookingsToday = bookingRepository.findByClinicIdAndDate(clinicId,
                today).stream()
                .filter(b -> b.getStatus() != com.petties.petties.model.enums.BookingStatus.PENDING)
                .filter(b -> b.getAssignedStaff() != null && b.getAssignedStaff().getUserId().equals(staffId)) // Strict
                                                                                                               // check:
                                                                                                               // Only
                                                                                                               // show
                                                                                                               // status
                                                                                                               // if
                                                                                                               // assigned
                                                                                                               // to ME
                .collect(java.util.stream.Collectors.toList());
        for (com.petties.petties.model.Booking b : clinicBookingsToday) {
            Pet pet = b.getPet();
            if (pet == null)
                continue;

            com.petties.petties.dto.pet.StaffPatientDTO dto = patientMap.get(pet.getId());
            if (dto == null) {
                // If not in map yet (not my booking), we will add it below via EMRs,
                // but let's check if we should add it now if it's currently at the clinic.
                // However, for consistency with original logic, we only add if they had a visit
                // (EMR)
                // OR it's my booking. Let's stick to showing status for those in list.
                continue;
            }

            // Status priority: If we already have a status (from my booking), only
            // overwrite if this one is more "advanced"
            // or if my booking was in the past/future and this one is today.
            String currentStatusStr = dto.getBookingStatus();
            if (currentStatusStr == null) {
                dto.setBookingStatus(b.getStatus().name());
                dto.setBookingId(b.getBookingId());
                dto.setBookingCode(b.getBookingCode());
                // If it's today's clinic booking but wasn't assigned to me, we should still
                // show it as "Next" if relevant
                if (dto.getNextAppointment() == null) {
                    dto.setNextAppointment(LocalDateTime.of(b.getBookingDate(), b.getBookingTime()));
                }
            } else {
                // Keep the most active status for today
                try {
                    com.petties.petties.model.enums.BookingStatus s1 = com.petties.petties.model.enums.BookingStatus
                            .valueOf(currentStatusStr);
                    com.petties.petties.model.enums.BookingStatus s2 = b.getStatus();
                    if (s2.ordinal() > s1.ordinal()
                            && s2.ordinal() <= com.petties.petties.model.enums.BookingStatus.IN_PROGRESS.ordinal()) {
                        dto.setBookingStatus(s2.name());
                    }
                } catch (Exception e) {
                    /* ignore */ }
            }
        }

        // 3. Get Clinic Patients (via EMRs or other Bookings)
        // Using EMRs is good to find patients who have VISITED.
        List<EmrRecord> clinicEmrs = emrRecordRepository.findByClinicIdOrderByExaminationDateDesc(clinicId);

        for (EmrRecord emr : clinicEmrs) {
            if (!patientMap.containsKey(emr.getPetId())) {
                petRepository.findById(emr.getPetId()).ifPresent(pet -> {
                    com.petties.petties.dto.pet.StaffPatientDTO dto = mapToStaffDto(pet);
                    dto.setAssignedToMe(false);
                    dto.setLastVisitDate(emr.getExaminationDate());

                    // Check if they have an active clinic booking for status
                    clinicBookingsToday.stream()
                            .filter(bk -> bk.getPet().getId().equals(pet.getId()))
                            .findFirst()
                            .ifPresent(bk -> {
                                dto.setBookingStatus(bk.getStatus().name());
                                dto.setBookingId(bk.getBookingId());
                                dto.setBookingCode(bk.getBookingCode());
                                dto.setNextAppointment(LocalDateTime.of(bk.getBookingDate(), bk.getBookingTime()));
                            });

                    patientMap.put(pet.getId(), dto);
                });
            } else {
                // Update last visit if needed
                com.petties.petties.dto.pet.StaffPatientDTO dto = patientMap.get(emr.getPetId());
                if (dto.getLastVisitDate() == null || (emr.getExaminationDate() != null
                        && emr.getExaminationDate().isAfter(dto.getLastVisitDate()))) {
                    dto.setLastVisitDate(emr.getExaminationDate());
                }
            }
        }

        // 3. Convert to List and Sort
        List<com.petties.petties.dto.pet.StaffPatientDTO> sortedList = new java.util.ArrayList<>(patientMap.values());

        sortedList.sort((p1, p2) -> {
            // Priority 1: Assigned to Me
            if (p1.isAssignedToMe() != p2.isAssignedToMe()) {
                return p1.isAssignedToMe() ? -1 : 1;
            }
            // Priority 2: Next Appointment (Nearest first)
            if (p1.getNextAppointment() != null && p2.getNextAppointment() != null) {
                return p1.getNextAppointment().compareTo(p2.getNextAppointment());
            }
            if (p1.getNextAppointment() != null)
                return -1;
            if (p2.getNextAppointment() != null)
                return 1;

            // Priority 3: Last Visit (Recent first)
            if (p1.getLastVisitDate() != null && p2.getLastVisitDate() != null) {
                return p2.getLastVisitDate().compareTo(p1.getLastVisitDate()); // Descending
            }

            return p1.getPetName().compareToIgnoreCase(p2.getPetName());
        });

        return sortedList;
    }

    private com.petties.petties.dto.pet.StaffPatientDTO mapToStaffDto(Pet pet) {
        // Calculate age
        int ageYears = 0;
        int ageMonths = 0;
        if (pet.getDateOfBirth() != null) {
            java.time.Period period = java.time.Period.between(pet.getDateOfBirth(), java.time.LocalDate.now());
            ageYears = period.getYears();
            ageMonths = period.getMonths();
        }

        return com.petties.petties.dto.pet.StaffPatientDTO.builder()
                .petId(pet.getId())
                .petName(pet.getName())
                .species(pet.getSpecies())
                .breed(pet.getBreed())
                .gender(pet.getGender())
                .ageYears(ageYears)
                .ageMonths(ageMonths)
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
