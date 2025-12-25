/**
 * Clinic Service Types - matching backend DTOs
 */

export interface WeightPriceDto {
  minWeight: number
  maxWeight: number
  price: number
}

// NEW: Master Service Types
export interface MasterServiceResponse {
  masterServiceId: string
  name: string
  description?: string
  defaultPrice: number
  durationTime: number
  slotsRequired: number
  isHomeVisit: boolean
  defaultPricePerKm?: number
  serviceCategory?: string
  petType?: string
  icon?: string
  weightPrices?: WeightPriceDto[]
  createdAt: string
  updatedAt: string
}

export interface MasterServiceRequest {
  name: string
  description?: string
  defaultPrice: number
  durationTime: number
  slotsRequired: number
  isHomeVisit?: boolean
  serviceCategory?: string
  petType?: string
  icon?: string
  weightPrices?: WeightPriceDto[]
}

export interface MasterServiceUpdateRequest extends Partial<MasterServiceRequest> {
  // Same as create request but all fields optional
}

// Updated Clinic Service Types
export interface ClinicServiceResponse {
  serviceId: string
  clinicId: string
  masterServiceId?: string // NEW: null if custom
  isCustom: boolean // NEW: true = custom, false = inherited
  name: string
  basePrice: number
  durationTime: number
  slotsRequired: number
  isActive: boolean
  isHomeVisit: boolean
  pricePerKm?: number
  serviceCategory?: string
  petType?: string
  weightPrices?: WeightPriceDto[]
  createdAt: string
  updatedAt: string
}

export interface ClinicServiceRequest {
  name: string
  basePrice: number
  slotsRequired: number
  isActive?: boolean
  isHomeVisit?: boolean
  pricePerKm?: number
  serviceCategory?: string
  petType?: string
  weightPrices?: WeightPriceDto[]
}

export interface ClinicServiceUpdateRequest extends Partial<ClinicServiceRequest> {
  // Same as create request but all fields optional
}

// NEW: Inherit Service Request
export interface InheritServiceRequest {
  masterServiceId: string
  clinicId?: string // Optional - defaults to current user's clinic
  clinicPrice?: number // Optional - override default price
}
