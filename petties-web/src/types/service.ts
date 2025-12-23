/**
 * Clinic Service Types - matching backend DTOs
 */

export interface WeightPriceDto {
  minWeight: number
  maxWeight: number
  price: number
}

export interface ClinicServiceResponse {
  serviceId: string
  clinicId: string
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
