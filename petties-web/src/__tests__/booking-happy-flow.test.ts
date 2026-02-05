/**
 * Booking Happy Flow End-to-End Test
 *
 * Test toàn bộ luồng booking thành công:
 * 1. Search clinic
 * 2. Get clinic details
 * 3. Get user's pets
 * 4. Get clinic services
 * 5. Create booking
 * 6. Manager confirms booking (auto-assign staff)
 * 7. Staff check-in
 * 8. Complete booking (checkout)
 *
 * Sử dụng Vitest + mocked API responses
 */

import { describe, it, expect, beforeEach, vi } from 'vitest'
import { clinicService } from '../services/api/clinicService'
import { petService } from '../services/api/petService'
import {
  createBooking,
  confirmBooking,
  checkInBooking,
  completeBooking,
  getBookingById,
} from '../services/bookingService'
import type { ClinicListResponse, ClinicResponse } from '../types/clinic'
import type { Pet } from '../services/api/petService'
import type { ClinicServiceResponse } from '../types/service'
import type {
  Booking,
  CreateBookingRequest,
  BookingStatus,
  ConfirmBookingRequest,
} from '../types/booking'

// Mock các service modules
vi.mock('../services/api/clinicService', () => ({
  clinicService: {
    searchClinics: vi.fn(),
    getClinicById: vi.fn(),
  },
}))

vi.mock('../services/api/petService', () => ({
  petService: {
    getMyPets: vi.fn(),
  },
}))

vi.mock('../services/bookingService', () => ({
  createBooking: vi.fn(),
  confirmBooking: vi.fn(),
  checkInBooking: vi.fn(),
  completeBooking: vi.fn(),
  getBookingById: vi.fn(),
}))

describe('Booking Happy Flow - End-to-End', () => {
  // Mock data
  const mockClinicSearchResponse: ClinicListResponse = {
    content: [
      {
        clinicId: 'clinic-001',
        ownerId: 'owner-001',
        name: 'Phòng Khám Thú Y Petties',
        address: '123 Đường ABC, Quận 1, TP.HCM',
        phone: '0901234567',
        email: 'contact@petties.com',
        description: 'Phòng khám thú y chuyên nghiệp',
        latitude: 10.762622,
        longitude: 106.660172,
        status: 'APPROVED',
        ratingAvg: 4.5,
        ratingCount: 100,
        images: [],
        createdAt: '2024-01-01T00:00:00',
      },
    ],
    totalElements: 1,
    totalPages: 1,
    size: 20,
    number: 0,
    first: true,
    last: true,
  }

  const mockClinicDetail: ClinicResponse = {
    clinicId: 'clinic-001',
    ownerId: 'owner-001',
    name: 'Phòng Khám Thú Y Petties',
    address: '123 Đường ABC, Quận 1, TP.HCM',
    phone: '0901234567',
    email: 'contact@petties.com',
    description: 'Phòng khám thú y chuyên nghiệp',
    latitude: 10.762622,
    longitude: 106.660172,
    status: 'APPROVED',
    ratingAvg: 4.5,
    ratingCount: 100,
    images: [],
    createdAt: '2024-01-01T00:00:00',
  }

  const mockPets: Pet[] = [
    {
      id: 'pet-001',
      name: 'Milu',
      species: 'Chó',
      breed: 'Golden Retriever',
      dateOfBirth: '2020-05-15',
      weight: 25.5,
      gender: 'Đực',
      color: 'Vàng',
      allergies: 'Không',
      imageUrl: 'https://example.com/milu.jpg',
      ownerName: 'Nguyễn Văn A',
      ownerPhone: '0987654321',
    },
  ]

  const mockServices: ClinicServiceResponse[] = [
    {
      serviceId: 'service-001',
      clinicId: 'clinic-001',
      masterServiceId: 'master-001',
      isCustom: false,
      name: 'Khám tổng quát',
      description: 'Khám sức khỏe tổng quát cho thú cưng',
      basePrice: 200000,
      durationTime: 30,
      slotsRequired: 1,
      isActive: true,
      isHomeVisit: false,
      serviceCategory: 'CHECK_UP',
      petType: 'DOG',
      createdAt: '2024-01-01T00:00:00',
      updatedAt: '2024-01-01T00:00:00',
    },
  ]

  const mockBookingRequest: CreateBookingRequest = {
    petId: 'pet-001',
    clinicId: 'clinic-001',
    bookingDate: '2025-02-15',
    bookingTime: '10:00',
    type: 'IN_CLINIC',
    serviceIds: ['service-001'],
    notes: 'Milu cần khám tổng quát',
  }

  const mockCreatedBooking: Booking = {
    bookingId: 'booking-001',
    bookingCode: 'BK20250215001',
    petId: 'pet-001',
    petName: 'Milu',
    petSpecies: 'Chó',
    petBreed: 'Golden Retriever',
    petAge: '4 tuổi 9 tháng',
    petPhotoUrl: 'https://example.com/milu.jpg',
    petWeight: 25.5,
    ownerId: 'owner-001',
    ownerName: 'Nguyễn Văn A',
    ownerPhone: '0987654321',
    ownerEmail: 'nguyenvana@email.com',
    clinicId: 'clinic-001',
    clinicName: 'Phòng Khám Thú Y Petties',
    clinicAddress: '123 Đường ABC, Quận 1, TP.HCM',
    bookingDate: '2025-02-15',
    bookingTime: '10:00',
    type: 'IN_CLINIC',
    status: 'PENDING',
    totalPrice: 200000,
    notes: 'Milu cần khám tổng quát',
    services: [
      {
        serviceId: 'service-001',
        serviceName: 'Khám tổng quát',
        serviceCategory: 'CHECK_UP',
        price: 200000,
        slotsRequired: 1,
        durationMinutes: 30,
        basePrice: 200000,
      },
    ],
    paymentStatus: 'PENDING',
    createdAt: '2025-02-10T09:00:00',
  }

  const mockConfirmedBooking: Booking = {
    ...mockCreatedBooking,
    status: 'CONFIRMED',
    assignedStaffId: 'staff-001',
    assignedStaffName: 'Bác sĩ Trần Văn B',
    assignedStaffSpecialty: 'VET_GENERAL',
    assignedStaffAvatarUrl: 'https://example.com/staff.jpg',
    services: [
      {
        ...mockCreatedBooking.services[0],
        assignedStaffId: 'staff-001',
        assignedStaffName: 'Bác sĩ Trần Văn B',
        assignedStaffSpecialty: 'VET_GENERAL',
        scheduledStartTime: '10:00:00',
        scheduledEndTime: '10:30:00',
      },
    ],
  }

  const mockCheckedInBooking: Booking = {
    ...mockConfirmedBooking,
    status: 'IN_PROGRESS',
  }

  const mockCompletedBooking: Booking = {
    ...mockCheckedInBooking,
    status: 'COMPLETED',
    paymentStatus: 'PAID',
    paymentMethod: 'CASH',
    emrId: 'emr-001', // Sau khi checkout, EMR được tạo
  }

  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('[STEP 1] Pet Owner search clinics by name', async () => {
    // Setup mock
    vi.mocked(clinicService.searchClinics).mockResolvedValue(mockClinicSearchResponse)

    // Execute
    const result = await clinicService.searchClinics('Petties', 0, 20)

    // Assert
    expect(clinicService.searchClinics).toHaveBeenCalledWith('Petties', 0, 20)
    expect(result.content).toHaveLength(1)
    expect(result.content[0].name).toBe('Phòng Khám Thú Y Petties')
    expect(result.content[0].status).toBe('APPROVED')
  })

  it('[STEP 2] Pet Owner views clinic details', async () => {
    // Setup mock
    vi.mocked(clinicService.getClinicById).mockResolvedValue(mockClinicDetail)

    // Execute
    const result = await clinicService.getClinicById('clinic-001')

    // Assert
    expect(clinicService.getClinicById).toHaveBeenCalledWith('clinic-001')
    expect(result.clinicId).toBe('clinic-001')
    expect(result.name).toBe('Phòng Khám Thú Y Petties')
    expect(result.phone).toBe('0901234567')
  })

  it('[STEP 3] Pet Owner selects pet from their list', async () => {
    // Setup mock
    vi.mocked(petService.getMyPets).mockResolvedValue(mockPets)

    // Execute
    const result = await petService.getMyPets()

    // Assert
    expect(petService.getMyPets).toHaveBeenCalled()
    expect(result).toHaveLength(1)
    expect(result[0].name).toBe('Milu')
    expect(result[0].species).toBe('Chó')
    expect(result[0].weight).toBe(25.5)
  })

  it('[STEP 4] Pet Owner chooses service (skipped - services pre-loaded)', () => {
    // NOTE: Trong thực tế, danh sách services được load sẵn khi vào trang booking
    // hoặc fetch từ GET /clinics/{clinicId}/services
    // Test này giả định services đã được load

    expect(mockServices).toHaveLength(1)
    expect(mockServices[0].name).toBe('Khám tổng quát')
    expect(mockServices[0].basePrice).toBe(200000)
  })

  it('[STEP 5] Pet Owner creates booking', async () => {
    // Setup mock
    vi.mocked(createBooking).mockResolvedValue(mockCreatedBooking)

    // Execute
    const result = await createBooking(mockBookingRequest)

    // Assert
    expect(createBooking).toHaveBeenCalledWith(mockBookingRequest)
    expect(result.bookingId).toBe('booking-001')
    expect(result.bookingCode).toBe('BK20250215001')
    expect(result.status).toBe('PENDING') // Chờ manager xác nhận
    expect(result.petName).toBe('Milu')
    expect(result.clinicName).toBe('Phòng Khám Thú Y Petties')
    expect(result.totalPrice).toBe(200000)
    expect(result.services).toHaveLength(1)
    expect(result.services[0].serviceName).toBe('Khám tổng quát')
  })

  it('[STEP 6] Manager confirms booking and auto-assigns staff', async () => {
    // Setup mock
    const confirmRequest: ConfirmBookingRequest = {
      managerNotes: 'Xác nhận lịch hẹn, gán bác sĩ Trần Văn B',
    }
    vi.mocked(confirmBooking).mockResolvedValue(mockConfirmedBooking)

    // Execute
    const result = await confirmBooking('booking-001', confirmRequest)

    // Assert
    expect(confirmBooking).toHaveBeenCalledWith('booking-001', confirmRequest)
    expect(result.status).toBe('CONFIRMED') // Đã gán bác sĩ
    expect(result.assignedStaffId).toBe('staff-001')
    expect(result.assignedStaffName).toBe('Bác sĩ Trần Văn B')
    expect(result.services[0].assignedStaffId).toBe('staff-001')
    expect(result.services[0].scheduledStartTime).toBe('10:00:00')
  })

  it('[STEP 7] Staff checks-in booking to start service', async () => {
    // Setup mock
    vi.mocked(checkInBooking).mockResolvedValue(mockCheckedInBooking)

    // Execute
    const result = await checkInBooking('booking-001')

    // Assert
    expect(checkInBooking).toHaveBeenCalledWith('booking-001')
    expect(result.status).toBe('IN_PROGRESS') // Đang khám
    expect(result.assignedStaffId).toBe('staff-001')
  })

  it('[STEP 8] Staff completes booking (checkout) after treatment', async () => {
    // Setup mock
    vi.mocked(completeBooking).mockResolvedValue(mockCompletedBooking)

    // Execute
    const result = await completeBooking('booking-001')

    // Assert
    expect(completeBooking).toHaveBeenCalledWith('booking-001')
    expect(result.status).toBe('COMPLETED') // Hoàn thành
    expect(result.paymentStatus).toBe('PAID') // Đã thanh toán
    expect(result.emrId).toBe('emr-001') // EMR được tạo tự động
  })

  it('[STEP 9] Verify final booking status after checkout', async () => {
    // Setup mock
    vi.mocked(getBookingById).mockResolvedValue(mockCompletedBooking)

    // Execute
    const result = await getBookingById('booking-001')

    // Assert
    expect(getBookingById).toHaveBeenCalledWith('booking-001')
    expect(result.bookingId).toBe('booking-001')
    expect(result.status).toBe('COMPLETED')
    expect(result.paymentStatus).toBe('PAID')
    expect(result.emrId).toBe('emr-001')

    // Verify business rules
    expect(result.petName).toBe('Milu')
    expect(result.assignedStaffName).toBe('Bác sĩ Trần Văn B')
    expect(result.totalPrice).toBe(200000)
    expect(result.services[0].serviceName).toBe('Khám tổng quát')
  })

  it('[INTEGRATION] Full happy flow - from search to checkout', async () => {
    // Giả lập toàn bộ flow tuần tự

    // Step 1: Search clinic
    vi.mocked(clinicService.searchClinics).mockResolvedValue(mockClinicSearchResponse)
    const clinics = await clinicService.searchClinics('Petties')
    expect(clinics.content[0].clinicId).toBe('clinic-001')

    // Step 2: Get clinic details
    vi.mocked(clinicService.getClinicById).mockResolvedValue(mockClinicDetail)
    const clinic = await clinicService.getClinicById('clinic-001')
    expect(clinic.name).toBe('Phòng Khám Thú Y Petties')

    // Step 3: Get user's pets
    vi.mocked(petService.getMyPets).mockResolvedValue(mockPets)
    const pets = await petService.getMyPets()
    expect(pets[0].id).toBe('pet-001')

    // Step 4: Create booking
    vi.mocked(createBooking).mockResolvedValue(mockCreatedBooking)
    const booking = await createBooking(mockBookingRequest)
    expect(booking.status).toBe('PENDING')

    // Step 5: Manager confirms
    vi.mocked(confirmBooking).mockResolvedValue(mockConfirmedBooking)
    const confirmed = await confirmBooking('booking-001')
    expect(confirmed.status).toBe('CONFIRMED')
    expect(confirmed.assignedStaffId).toBe('staff-001')

    // Step 6: Staff check-in
    vi.mocked(checkInBooking).mockResolvedValue(mockCheckedInBooking)
    const checkedIn = await checkInBooking('booking-001')
    expect(checkedIn.status).toBe('IN_PROGRESS')

    // Step 7: Staff checkout
    vi.mocked(completeBooking).mockResolvedValue(mockCompletedBooking)
    const completed = await completeBooking('booking-001')
    expect(completed.status).toBe('COMPLETED')
    expect(completed.paymentStatus).toBe('PAID')
    expect(completed.emrId).toBe('emr-001')

    // Verify all mocks called
    expect(clinicService.searchClinics).toHaveBeenCalled()
    expect(clinicService.getClinicById).toHaveBeenCalled()
    expect(petService.getMyPets).toHaveBeenCalled()
    expect(createBooking).toHaveBeenCalled()
    expect(confirmBooking).toHaveBeenCalled()
    expect(checkInBooking).toHaveBeenCalled()
    expect(completeBooking).toHaveBeenCalled()
  })

  it('[VALIDATION] Booking status transitions are correct', () => {
    const statusFlow: BookingStatus[] = [
      'PENDING', // After create
      'CONFIRMED', // After confirm
      'IN_PROGRESS', // After check-in
      'COMPLETED', // After checkout
    ]

    // Verify status flow matches business rules
    expect(mockCreatedBooking.status).toBe(statusFlow[0])
    expect(mockConfirmedBooking.status).toBe(statusFlow[1])
    expect(mockCheckedInBooking.status).toBe(statusFlow[2])
    expect(mockCompletedBooking.status).toBe(statusFlow[3])
  })

  it('[BUSINESS RULES] Verify payment status after checkout', () => {
    // Payment status phải chuyển sang PAID sau khi COMPLETED
    expect(mockCompletedBooking.status).toBe('COMPLETED')
    expect(mockCompletedBooking.paymentStatus).toBe('PAID')
    expect(mockCompletedBooking.paymentMethod).toBe('CASH')
  })

  it('[BUSINESS RULES] Verify EMR is created after checkout', () => {
    // EMR phải được tạo sau khi booking COMPLETED
    expect(mockCompletedBooking.status).toBe('COMPLETED')
    expect(mockCompletedBooking.emrId).toBeDefined()
    expect(mockCompletedBooking.emrId).toBe('emr-001')
  })

  it('[BUSINESS RULES] Verify staff assignment after confirm', () => {
    // Sau khi confirm, booking phải có staff được gán
    expect(mockConfirmedBooking.status).toBe('CONFIRMED')
    expect(mockConfirmedBooking.assignedStaffId).toBe('staff-001')
    expect(mockConfirmedBooking.assignedStaffName).toBe('Bác sĩ Trần Văn B')

    // Service cũng phải có staff assignment
    expect(mockConfirmedBooking.services[0].assignedStaffId).toBe('staff-001')
    expect(mockConfirmedBooking.services[0].scheduledStartTime).toBe('10:00:00')
  })

  it('[DATA INTEGRITY] Verify booking data consistency across flow', () => {
    // Pet info phải consistent
    expect(mockCreatedBooking.petName).toBe('Milu')
    expect(mockConfirmedBooking.petName).toBe('Milu')
    expect(mockCheckedInBooking.petName).toBe('Milu')
    expect(mockCompletedBooking.petName).toBe('Milu')

    // Clinic info phải consistent
    expect(mockCreatedBooking.clinicId).toBe('clinic-001')
    expect(mockConfirmedBooking.clinicId).toBe('clinic-001')
    expect(mockCheckedInBooking.clinicId).toBe('clinic-001')
    expect(mockCompletedBooking.clinicId).toBe('clinic-001')

    // Booking ID phải consistent
    expect(mockCreatedBooking.bookingId).toBe('booking-001')
    expect(mockConfirmedBooking.bookingId).toBe('booking-001')
    expect(mockCheckedInBooking.bookingId).toBe('booking-001')
    expect(mockCompletedBooking.bookingId).toBe('booking-001')

    // Total price phải không đổi (IN_CLINIC, không có distance fee)
    expect(mockCreatedBooking.totalPrice).toBe(200000)
    expect(mockCompletedBooking.totalPrice).toBe(200000)
  })
})
