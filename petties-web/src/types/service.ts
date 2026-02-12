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

// NEW: Vaccine Dose Price DTO
export interface VaccineDosePriceDTO {
  id?: string
  doseNumber: number  // 1, 2, 3, 4 (annual)
  doseLabel: string   // "Mũi 1", "Nhắc lại hằng năm"
  price: number
  isActive: boolean
}

// Updated Clinic Service Types
export interface ClinicServiceResponse {
  serviceId: string
  clinicId: string
  masterServiceId?: string // NEW: null if custom
  isCustom: boolean // NEW: true = custom, false = inherited
  name: string
  description?: string
  basePrice: number
  durationTime: number
  slotsRequired: number
  isActive: boolean
  isHomeVisit: boolean
  pricePerKm?: number
  serviceCategory?: string
  petType?: string
  reminderInterval?: number
  reminderUnit?: string
  weightPrices?: WeightPriceDto[]
  // NEW: Vaccine-specific fields
  vaccineTemplateId?: string
  dosePrices?: VaccineDosePriceDTO[]
  createdAt: string
  updatedAt: string
}


export interface ClinicServiceRequest {
  clinicId: string
  name: string
  description?: string
  basePrice: number
  slotsRequired: number
  isActive?: boolean
  isHomeVisit?: boolean
  pricePerKm?: number
  serviceCategory?: string
  petType?: string
  weightPrices?: WeightPriceDto[]
  vaccineTemplateId?: string
  dosePrices?: VaccineDosePriceDTO[]
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
