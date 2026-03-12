package com.petties.petties.service;

import com.petties.petties.dto.clinicService.ClinicServiceRequest;
import com.petties.petties.dto.clinicService.ClinicServiceResponse;
import com.petties.petties.dto.clinicService.ClinicServiceUpdateRequest;
import com.petties.petties.dto.clinicService.VaccineDosePriceDTO;
import com.petties.petties.dto.clinicService.WeightPriceDto;
import com.petties.petties.exception.ForbiddenException;
import com.petties.petties.model.Clinic;
import com.petties.petties.model.ClinicService;
import com.petties.petties.model.ServiceWeightPrice;
import com.petties.petties.model.User;
import com.petties.petties.model.VaccineDosePrice;
import com.petties.petties.model.VaccineTemplate;
import com.petties.petties.model.enums.PetSpecies;
import com.petties.petties.model.enums.Role;
import com.petties.petties.model.enums.ServiceCategory;
import com.petties.petties.model.enums.TargetSpecies;
import com.petties.petties.repository.ClinicRepository;
import com.petties.petties.repository.ClinicServiceRepository;
import com.petties.petties.repository.MasterServiceRepository;
import com.petties.petties.repository.VaccineTemplateRepository;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.math.BigDecimal;
import java.util.List;
import java.util.Optional;
import java.util.UUID;

import static org.junit.jupiter.api.Assertions.assertDoesNotThrow;
import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertNotNull;
import static org.junit.jupiter.api.Assertions.assertSame;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.doNothing;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.verifyNoInteractions;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
@DisplayName("ClinicServiceService Unit Tests")
class ClinicServiceServiceUnitTest {

    @Mock
    private ClinicServiceRepository clinicServiceRepository;

    @Mock
    private ClinicRepository clinicRepository;

    @Mock
    private AuthService authService;

    @Mock
    private MasterServiceRepository masterServiceRepository;

    @Mock
    private VaccineTemplateRepository vaccineTemplateRepository;

    @InjectMocks
    private ClinicServiceService clinicServiceService;

    @Test
    @DisplayName("Create service - should map duration, template, weight prices and dose prices")
    void createService_shouldMapAllNestedFields() {
        UUID clinicId = UUID.randomUUID();
        UUID ownerId = UUID.randomUUID();
        UUID templateId = UUID.randomUUID();

        User owner = new User();
        owner.setUserId(ownerId);
        owner.setRole(Role.CLINIC_OWNER);

        Clinic clinic = new Clinic();
        clinic.setClinicId(clinicId);
        clinic.setOwner(owner);

        VaccineTemplate template = new VaccineTemplate();
        template.setId(templateId);
        template.setTargetSpecies(TargetSpecies.DOG);

        ClinicServiceRequest request = new ClinicServiceRequest();
        request.setClinicId(clinicId);
        request.setName("Tiêm phòng 7 bệnh");
        request.setDescription("Gói tiêm cho chó");
        request.setBasePrice(new BigDecimal("250000"));
        request.setSlotsRequired(2);
        request.setIsActive(true);
        request.setIsHomeVisit(false);
        request.setServiceCategory(ServiceCategory.VACCINATION);
        request.setPetType("Chó");
        request.setVaccineTemplateId(templateId);
        request.setWeightPrices(List.of(
                WeightPriceDto.builder()
                        .minWeight(new BigDecimal("0"))
                        .maxWeight(new BigDecimal("5"))
                        .price(new BigDecimal("50000"))
                        .build()));
        request.setDosePrices(List.of(
                new VaccineDosePriceDTO(null, 1, "Mũi 1", new BigDecimal("250000"), true),
                new VaccineDosePriceDTO(null, 2, "Mũi 2", new BigDecimal("230000"), true)));

        when(authService.getCurrentUser()).thenReturn(owner);
        when(clinicRepository.findById(clinicId)).thenReturn(Optional.of(clinic));
        when(vaccineTemplateRepository.findById(templateId)).thenReturn(Optional.of(template));
        when(clinicServiceRepository.save(any(ClinicService.class))).thenAnswer(invocation -> {
            ClinicService service = invocation.getArgument(0);
            service.setServiceId(UUID.randomUUID());
            return service;
        });

        ClinicServiceResponse response = clinicServiceService.createService(request);

        ArgumentCaptor<ClinicService> captor = ArgumentCaptor.forClass(ClinicService.class);
        verify(clinicServiceRepository).save(captor.capture());
        ClinicService savedService = captor.getValue();

        assertEquals(2, savedService.getSlotsRequired());
        assertEquals(60, savedService.getDurationTime());
        assertSame(template, savedService.getVaccineTemplate());
        assertEquals(1, savedService.getWeightPrices().size());
        assertEquals(2, savedService.getDosePrices().size());
        assertSame(savedService, savedService.getWeightPrices().get(0).getService());
        assertSame(savedService, savedService.getDosePrices().get(0).getService());
        assertEquals(templateId, response.getVaccineTemplateId());
        assertEquals(1, response.getWeightPrices().size());
        assertEquals(2, response.getDosePrices().size());
    }

    @Test
    @DisplayName("Update service - should replace old weight and dose prices with new ones")
    void updateService_shouldReplaceNestedPricingCollections() {
        UUID serviceId = UUID.randomUUID();
        UUID ownerId = UUID.randomUUID();
        UUID oldTemplateId = UUID.randomUUID();
        UUID newTemplateId = UUID.randomUUID();

        User owner = new User();
        owner.setUserId(ownerId);
        owner.setRole(Role.CLINIC_OWNER);

        Clinic clinic = new Clinic();
        clinic.setClinicId(UUID.randomUUID());
        clinic.setOwner(owner);

        VaccineTemplate oldTemplate = new VaccineTemplate();
        oldTemplate.setId(oldTemplateId);
        oldTemplate.setTargetSpecies(TargetSpecies.DOG);

        VaccineTemplate newTemplate = new VaccineTemplate();
        newTemplate.setId(newTemplateId);
        newTemplate.setTargetSpecies(TargetSpecies.BOTH);

        ClinicService existingService = new ClinicService();
        existingService.setServiceId(serviceId);
        existingService.setClinic(clinic);
        existingService.setName("Dịch vụ cũ");
        existingService.setBasePrice(new BigDecimal("100000"));
        existingService.setSlotsRequired(1);
        existingService.setDurationTime(30);
        existingService.setVaccineTemplate(oldTemplate);
        existingService.getWeightPrices().add(createWeightPrice(existingService, "0", "3", "10000"));
        existingService.getDosePrices().add(createDosePrice(existingService, 1, "Mũi cũ", "100000"));

        ClinicServiceUpdateRequest request = new ClinicServiceUpdateRequest();
        request.setBasePrice(new BigDecimal("300000"));
        request.setSlotsRequired(3);
        request.setWeightPrices(List.of(
                WeightPriceDto.builder()
                        .minWeight(new BigDecimal("3"))
                        .maxWeight(new BigDecimal("8"))
                        .price(new BigDecimal("60000"))
                        .build()));
        request.setDosePrices(List.of(
                new VaccineDosePriceDTO(null, 2, "Mũi 2", new BigDecimal("280000"), true)));
        request.setVaccineTemplateId(newTemplateId);

        when(clinicServiceRepository.findById(serviceId)).thenReturn(Optional.of(existingService));
        when(authService.getCurrentUser()).thenReturn(owner);
        when(vaccineTemplateRepository.findById(newTemplateId)).thenReturn(Optional.of(newTemplate));
        when(clinicServiceRepository.save(existingService)).thenReturn(existingService);

        ClinicServiceResponse response = clinicServiceService.updateService(serviceId, request);

        assertEquals(new BigDecimal("300000"), existingService.getBasePrice());
        assertEquals(3, existingService.getSlotsRequired());
        assertEquals(90, existingService.getDurationTime());
        assertEquals(1, existingService.getWeightPrices().size());
        assertEquals(new BigDecimal("3"), existingService.getWeightPrices().get(0).getMinWeight());
        assertEquals(1, existingService.getDosePrices().size());
        assertEquals(2, existingService.getDosePrices().get(0).getDoseNumber());
        assertSame(newTemplate, existingService.getVaccineTemplate());
        assertEquals(newTemplateId, response.getVaccineTemplateId());
        assertEquals(1, response.getDosePrices().size());
    }

    @Test
    @DisplayName("Get compatible services - should filter by home visit and vaccine species")
    void getCompatibleServices_shouldFilterByHomeVisitAndSpecies() {
        UUID clinicId = UUID.randomUUID();

        when(clinicRepository.existsById(clinicId)).thenReturn(true);
        when(clinicServiceRepository.findByClinicClinicIdAndIsActiveTrue(clinicId)).thenReturn(List.of(
                createService("Khám tại nhà cho chó", true, createTemplate(TargetSpecies.DOG)),
                createService("Tiêm cho mèo", true, createTemplate(TargetSpecies.CAT)),
                createService("Tiêm cả chó mèo", true, createTemplate(TargetSpecies.BOTH)),
                createService("Khám tại phòng khám", false, null)));

        List<ClinicServiceResponse> responses = clinicServiceService.getCompatibleServices(
                clinicId,
                PetSpecies.DOG,
                true);

        assertEquals(2, responses.size());
        assertEquals(List.of("Khám tại nhà cho chó", "Tiêm cả chó mèo"),
                responses.stream().map(ClinicServiceResponse::getName).toList());
    }

    @Test
    @DisplayName("Create service - should throw ForbiddenException when user is not owner or manager")
    void createService_shouldThrowForbidden_whenUserHasNoPermission() {
        UUID clinicId = UUID.randomUUID();

        User otherUser = new User();
        otherUser.setUserId(UUID.randomUUID());
        otherUser.setRole(Role.STAFF);

        User clinicOwner = new User();
        clinicOwner.setUserId(UUID.randomUUID());

        Clinic clinic = new Clinic();
        clinic.setClinicId(clinicId);
        clinic.setOwner(clinicOwner);

        ClinicServiceRequest request = new ClinicServiceRequest();
        request.setClinicId(clinicId);
        request.setName("Dịch vụ không hợp lệ");
        request.setBasePrice(new BigDecimal("100000"));
        request.setSlotsRequired(1);

        when(authService.getCurrentUser()).thenReturn(otherUser);
        when(clinicRepository.findById(clinicId)).thenReturn(Optional.of(clinic));

        assertThrows(ForbiddenException.class, () -> clinicServiceService.createService(request));
        verifyNoInteractions(vaccineTemplateRepository, clinicServiceRepository);
    }

    @Test
    @DisplayName("Update service - manager of same clinic should be allowed")
    void updateService_managerSameClinic_shouldSucceed() {
        UUID serviceId = UUID.randomUUID();
        UUID clinicId = UUID.randomUUID();

        Clinic clinic = new Clinic();
        clinic.setClinicId(clinicId);

        User manager = new User();
        manager.setUserId(UUID.randomUUID());
        manager.setRole(Role.CLINIC_MANAGER);
        manager.setWorkingClinic(clinic);

        ClinicService service = new ClinicService();
        service.setServiceId(serviceId);
        service.setClinic(clinic);
        service.setName("Khám tổng quát");
        service.setBasePrice(new BigDecimal("120000"));
        service.setSlotsRequired(1);
        service.setDurationTime(30);
        service.setIsActive(true);
        service.setIsHomeVisit(false);

        ClinicServiceUpdateRequest request = new ClinicServiceUpdateRequest();
        request.setIsActive(false);

        when(clinicServiceRepository.findById(serviceId)).thenReturn(Optional.of(service));
        when(authService.getCurrentUser()).thenReturn(manager);
        when(clinicServiceRepository.save(service)).thenReturn(service);

        assertDoesNotThrow(() -> clinicServiceService.updateService(serviceId, request));
        assertFalse(service.getIsActive());
    }

    @Test
    @DisplayName("Get compatible services - null species and null homeVisit should return all active services")
    void getCompatibleServices_withoutFilters_shouldReturnAllActive() {
        UUID clinicId = UUID.randomUUID();

        when(clinicRepository.existsById(clinicId)).thenReturn(true);
        when(clinicServiceRepository.findByClinicClinicIdAndIsActiveTrue(clinicId)).thenReturn(List.of(
                createService("Khám chó", true, createTemplate(TargetSpecies.DOG)),
                createService("Khám mèo", false, createTemplate(TargetSpecies.CAT)),
                createService("Dịch vụ chung", false, null)));

        List<ClinicServiceResponse> responses = clinicServiceService.getCompatibleServices(clinicId, null, null);

        assertEquals(3, responses.size());
    }

    @Test
    @DisplayName("Get services by clinic id - should throw when user has no permission")
    void getServicesByClinicId_shouldThrowForbidden_whenUserNotInClinic() {
        UUID clinicId = UUID.randomUUID();

        Clinic clinic = new Clinic();
        clinic.setClinicId(clinicId);

        User outsider = new User();
        outsider.setUserId(UUID.randomUUID());
        outsider.setRole(Role.STAFF);

        when(clinicRepository.findById(clinicId)).thenReturn(Optional.of(clinic));
        when(authService.getCurrentUser()).thenReturn(outsider);

        assertThrows(ForbiddenException.class, () -> clinicServiceService.getServicesByClinicId(clinicId));
    }

    @Test
    @DisplayName("Update service status - owner should update successfully")
    void updateServiceStatus_owner_shouldSucceed() {
        UUID serviceId = UUID.randomUUID();

        User owner = new User();
        owner.setUserId(UUID.randomUUID());
        owner.setRole(Role.CLINIC_OWNER);

        Clinic clinic = new Clinic();
        clinic.setClinicId(UUID.randomUUID());
        clinic.setOwner(owner);

        ClinicService service = new ClinicService();
        service.setServiceId(serviceId);
        service.setClinic(clinic);
        service.setName("Khám tổng quát");
        service.setBasePrice(new BigDecimal("100000"));
        service.setDurationTime(30);
        service.setSlotsRequired(1);
        service.setIsActive(true);
        service.setIsHomeVisit(false);

        when(clinicServiceRepository.findById(serviceId)).thenReturn(Optional.of(service));
        when(authService.getCurrentUser()).thenReturn(owner);
        when(clinicServiceRepository.save(service)).thenReturn(service);

        ClinicServiceResponse response = clinicServiceService.updateServiceStatus(serviceId, false);

        assertFalse(response.getIsActive());
        assertFalse(service.getIsActive());
    }

    @Test
    @DisplayName("Update home visit status - manager same clinic should update successfully")
    void updateHomeVisitStatus_manager_shouldSucceed() {
        UUID serviceId = UUID.randomUUID();
        UUID clinicId = UUID.randomUUID();

        Clinic clinic = new Clinic();
        clinic.setClinicId(clinicId);

        User manager = new User();
        manager.setUserId(UUID.randomUUID());
        manager.setRole(Role.CLINIC_MANAGER);
        manager.setWorkingClinic(clinic);

        ClinicService service = new ClinicService();
        service.setServiceId(serviceId);
        service.setClinic(clinic);
        service.setName("Khám tại nhà");
        service.setBasePrice(new BigDecimal("140000"));
        service.setDurationTime(30);
        service.setSlotsRequired(1);
        service.setIsActive(true);
        service.setIsHomeVisit(false);

        when(clinicServiceRepository.findById(serviceId)).thenReturn(Optional.of(service));
        when(authService.getCurrentUser()).thenReturn(manager);
        when(clinicServiceRepository.save(service)).thenReturn(service);

        ClinicServiceResponse response = clinicServiceService.updateHomeVisitStatus(serviceId, true);

        assertEquals(true, response.getIsHomeVisit());
        assertEquals(true, service.getIsHomeVisit());
    }

    @Test
    @DisplayName("Delete service - owner same clinic should delete successfully")
    void deleteService_ownerSameClinic_shouldDelete() {
        UUID serviceId = UUID.randomUUID();

        User owner = new User();
        owner.setUserId(UUID.randomUUID());
        owner.setRole(Role.CLINIC_OWNER);

        Clinic clinic = new Clinic();
        clinic.setClinicId(UUID.randomUUID());
        clinic.setOwner(owner);

        ClinicService service = new ClinicService();
        service.setServiceId(serviceId);
        service.setClinic(clinic);

        when(authService.getCurrentUser()).thenReturn(owner);
        when(clinicRepository.findFirstByOwnerUserId(owner.getUserId())).thenReturn(Optional.of(clinic));
        when(clinicServiceRepository.findByServiceIdAndClinic(serviceId, clinic)).thenReturn(Optional.of(service));
        doNothing().when(clinicServiceRepository).delete(service);

        assertDoesNotThrow(() -> clinicServiceService.deleteService(serviceId));
        verify(clinicServiceRepository).delete(service);
    }

    private ClinicService createService(String name, boolean isHomeVisit, VaccineTemplate template) {
        Clinic clinic = new Clinic();
        clinic.setClinicId(UUID.randomUUID());

        ClinicService service = new ClinicService();
        service.setServiceId(UUID.randomUUID());
        service.setClinic(clinic);
        service.setName(name);
        service.setBasePrice(new BigDecimal("100000"));
        service.setDurationTime(30);
        service.setSlotsRequired(1);
        service.setIsActive(true);
        service.setIsHomeVisit(isHomeVisit);
        service.setVaccineTemplate(template);
        service.setServiceCategory(template == null ? ServiceCategory.CHECK_UP : ServiceCategory.VACCINATION);
        return service;
    }

    private VaccineTemplate createTemplate(TargetSpecies targetSpecies) {
        VaccineTemplate template = new VaccineTemplate();
        template.setId(UUID.randomUUID());
        template.setTargetSpecies(targetSpecies);
        return template;
    }

    private ServiceWeightPrice createWeightPrice(ClinicService service, String minWeight, String maxWeight, String price) {
        ServiceWeightPrice weightPrice = new ServiceWeightPrice();
        weightPrice.setService(service);
        weightPrice.setMinWeight(new BigDecimal(minWeight));
        weightPrice.setMaxWeight(new BigDecimal(maxWeight));
        weightPrice.setPrice(new BigDecimal(price));
        return weightPrice;
    }

    private VaccineDosePrice createDosePrice(ClinicService service, int doseNumber, String doseLabel, String price) {
        VaccineDosePrice dosePrice = new VaccineDosePrice();
        dosePrice.setService(service);
        dosePrice.setDoseNumber(doseNumber);
        dosePrice.setDoseLabel(doseLabel);
        dosePrice.setPrice(new BigDecimal(price));
        dosePrice.setIsActive(true);
        return dosePrice;
    }
}
