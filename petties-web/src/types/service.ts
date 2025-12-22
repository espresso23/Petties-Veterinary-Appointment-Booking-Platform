/**
 * Service Types - matching backend DTOs
 */

export interface WeightPriceDto {
  minWeight: string
  maxWeight: string
  price: string
}

export interface ServiceResponse {
  serviceId: string
  name: string
  basePrice: string
  durationTime: number
  slotsRequired: number
  isActive: boolean
  isHomeVisit: boolean
  pricePerKm?: string
  serviceCategory?: string
  petType?: string
  weightPrices?: WeightPriceDto[]
  createdAt: string
  updatedAt: string
}

export interface ServiceRequest {
  name: string
  basePrice: string
  durationTime: number
  slotsRequired: number
  isActive?: boolean
  isHomeVisit?: boolean
  pricePerKm?: string
  serviceCategory?: string
  petType?: string
  weightPrices?: WeightPriceDto[]
}

export interface ServiceUpdateRequest extends ServiceRequest {
  // Same as create request
}
