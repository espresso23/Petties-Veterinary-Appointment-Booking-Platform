export type ClinicStatus = 'PENDING' | 'APPROVED' | 'REJECTED' | 'SUSPENDED'

export interface OperatingHours {
  openTime?: string // HH:mm format
  closeTime?: string // HH:mm format
  isClosed: boolean
}

export interface Clinic {
  clinicId: string
  ownerId: string
  owner?: {
    userId: string
    username: string
    fullName?: string
    email?: string
  }
  name: string
  description?: string
  address: string
  district?: string // Quận/huyện
  province?: string // Tỉnh/thành phố
  specificLocation?: string // Vị trí chính xác (khu phố, tầng lầu, số nhà, etc.)
  phone: string
  email?: string
  latitude?: number
  longitude?: number
  logo?: string // URL to clinic logo
  operatingHours?: Record<string, OperatingHours> // Key: MONDAY, TUESDAY, etc.
  status: ClinicStatus
  rejectionReason?: string
  ratingAvg: number
  ratingCount: number
  approvedAt?: string
  createdAt: string
  updatedAt?: string
  images?: ClinicImage[] | string[]
  imageDetails?: ClinicImage[]
  services?: ClinicService[]
}

export interface ClinicImage {
  imageId: string
  clinicId: string
  imageUrl: string
  caption?: string
  displayOrder: number
  isPrimary: boolean
}

export interface ClinicService {
  serviceId: string
  clinicId: string
  name: string
  description?: string
  price: number
  duration: number // minutes
}

export interface ClinicRequest {
  name: string
  description?: string
  address: string
  district?: string // Quận/huyện
  province?: string // Tỉnh/thành phố
  specificLocation?: string // Vị trí chính xác
  phone: string
  email?: string
  operatingHours?: Record<string, OperatingHours>
  latitude?: number
  longitude?: number
  logo?: string // URL to clinic logo
}

export interface ClinicResponse {
  clinicId: string
  ownerId: string
  owner?: {
    userId: string
    username: string
    fullName?: string
    email?: string
  }
  name: string
  description?: string
  address: string
  district?: string // Quận/huyện
  province?: string // Tỉnh/thành phố
  specificLocation?: string // Vị trí chính xác
  phone: string
  email?: string
  latitude?: number
  longitude?: number
  logo?: string // URL to clinic logo
  operatingHours?: Record<string, OperatingHours>
  status: ClinicStatus
  rejectionReason?: string
  ratingAvg: number
  ratingCount: number
  approvedAt?: string
  createdAt: string
  updatedAt?: string
  images?: ClinicImage[] | string[]
  imageDetails?: ClinicImage[]
  services?: ClinicService[]
}

export interface ClinicListResponse {
  content: ClinicResponse[]
  totalElements: number
  totalPages: number
  number: number
  size: number
  first: boolean
  last: boolean
}

export interface GeocodeResponse {
  latitude: number
  longitude: number
  formattedAddress: string
}

export interface DistanceResponse {
  distance: number // kilometers
  duration: number // minutes
  distanceText: string
  durationText: string
}

export interface ClinicFilters {
  status?: ClinicStatus
  name?: string
  page?: number
  size?: number
}

export interface NearbyClinicsParams {
  latitude: number
  longitude: number
  radius?: number // kilometers, default 10
  page?: number
  size?: number
}

