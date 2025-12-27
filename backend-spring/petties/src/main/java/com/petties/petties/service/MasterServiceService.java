package com.petties.petties.service;

import com.petties.petties.dto.masterService.MasterServiceRequest;
import com.petties.petties.dto.masterService.MasterServiceResponse;
import com.petties.petties.dto.masterService.MasterServiceUpdateRequest;

import java.util.List;
import java.util.UUID;

public interface MasterServiceService {
    
    /**
     * Create a new master service
     */
    MasterServiceResponse createMasterService(MasterServiceRequest request);
    
    /**
     * Get all master services
     */
    List<MasterServiceResponse> getAllMasterServices();
    
    /**
     * Get master service by ID
     */
    MasterServiceResponse getMasterServiceById(UUID masterServiceId);
    
    /**
     * Update master service
     */
    MasterServiceResponse updateMasterService(UUID masterServiceId, MasterServiceUpdateRequest request);
    
    /**
     * Delete master service
     */
    void deleteMasterService(UUID masterServiceId);
    
    /**
     * Search master services by name
     */
    List<MasterServiceResponse> searchMasterServicesByName(String name);
    
    /**
     * Get master services by category
     */
    List<MasterServiceResponse> getMasterServicesByCategory(String category);
    
    /**
     * Get master services by pet type
     */
    List<MasterServiceResponse> getMasterServicesByPetType(String petType);
}
