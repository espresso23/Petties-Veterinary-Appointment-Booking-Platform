import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { vi, describe, it, expect, beforeEach } from 'vitest'
import { StaffBookingsPage } from './StaffBookingsPage'
import * as bookingService from '../../services/bookingService'
import { useAuthStore } from '../../store/authStore'
import type { Booking } from '../../types/booking'

// Mock react-router-dom
vi.mock('react-router-dom', () => ({
    useNavigate: () => vi.fn(),
    useLocation: () => ({ state: null })
}))

// Mock Toast
vi.mock('../../components/Toast', () => ({
    useToast: () => ({ showToast: vi.fn() })
}))

// Mock Auth Store
vi.mock('../../store/authStore', () => ({
    useAuthStore: vi.fn()
}))

// Mock SSE Notification Hook
vi.mock('../../hooks/useSseNotification', () => ({
    useSseNotification: () => ({})
}))

// Mock booking service
vi.mock('../../services/bookingService', () => ({
    getBookingsByStaff: vi.fn(),
    getBookingById: vi.fn(),
    checkInBooking: vi.fn(),
    addServiceToBooking: vi.fn(),
    getAvailableServicesForAddOn: vi.fn()
}))

describe('StaffBookingsPage - Add Service Feature', () => {
    const mockStaffUser = {
        userId: 'staff-001',
        role: 'STAFF',
        workingClinicId: 'clinic-001'
    }

    const createMockBooking = (overrides: Partial<Booking> = {}): Booking => ({
        bookingId: 'booking-001',
        bookingCode: 'BK-2025-001',
        bookingDate: '2025-02-03',
        bookingTime: '09:00:00',
        status: 'IN_PROGRESS',
        type: 'IN_CLINIC',
        petId: 'pet-001',
        petName: 'Mimi',
        petSpecies: 'CAT',
        petBreed: 'Persian',
        petAge: 'N/A',
        petPhotoUrl: '',
        ownerId: 'owner-001',
        ownerName: 'Nguyễn Văn A',
        ownerPhone: '0909123456',
        ownerEmail: 'owner@example.com',
        clinicId: 'clinic-001',
        clinicName: 'Petties Clinic',
        services: [
            {
                serviceId: 'svc-001',
                serviceName: 'Khám tổng quát',
                price: 200000,
                durationMinutes: 30,
                assignedStaffId: 'staff-001',
                serviceCategory: 'CHECK_UP',
                slotsRequired: 1
            }
        ],
        totalPrice: 200000,
        createdAt: '2025-02-03T09:00:00',
        ...overrides
    })

    const mockAvailableServices = [
        {
            serviceId: 'svc-002',
            name: 'Tắm vệ sinh',
            basePrice: 150000,
            durationTime: 30,
            slotsRequired: 1,
            serviceCategory: 'GROOMING'
        },
        {
            serviceId: 'svc-003',
            name: 'Cắt tỉa lông',
            basePrice: 200000,
            durationTime: 45,
            slotsRequired: 2,
            serviceCategory: 'GROOMING'
        }
    ]

    beforeEach(() => {
        vi.clearAllMocks()

        // Mock auth store
        vi.mocked(useAuthStore).mockReturnValue({
            user: mockStaffUser
        } as any)

        // Default mock for getBookingsByStaff
        vi.mocked(bookingService.getBookingsByStaff).mockResolvedValue({
            content: [],
            totalPages: 0,
            totalElements: 0,
            number: 0,
            size: 10
        } as any)
    })

    describe('Add Service Button Visibility', () => {
        it('should show "THÊM DỊCH VỤ" button when booking status is IN_PROGRESS', async () => {
            const inProgressBooking = createMockBooking({ status: 'IN_PROGRESS' })

            vi.mocked(bookingService.getBookingsByStaff).mockResolvedValue({
                content: [inProgressBooking],
                totalPages: 1,
                totalElements: 1,
                number: 0,
                size: 10
            } as any)

            vi.mocked(bookingService.getBookingById).mockResolvedValue(inProgressBooking)

            render(<StaffBookingsPage />)

            // Wait for bookings to load
            await waitFor(() => {
                expect(screen.getByText('#BK-2025-001')).toBeInTheDocument()
            })

            // Click on booking to open detail modal
            const bookingCard = screen.getByText('#BK-2025-001').closest('div[class*="cursor-pointer"]')
            fireEvent.click(bookingCard!)

            // Wait for detail modal to open and verify "THÊM DỊCH VỤ" button is visible
            await waitFor(() => {
                expect(screen.getByText('THÊM DỊCH VỤ')).toBeInTheDocument()
            })
        })

        it('should NOT show "THÊM DỊCH VỤ" button when booking status is COMPLETED', async () => {
            const completedBooking = createMockBooking({ status: 'COMPLETED' })

            vi.mocked(bookingService.getBookingsByStaff).mockResolvedValue({
                content: [completedBooking],
                totalPages: 1,
                totalElements: 1,
                number: 0,
                size: 10
            } as any)

            vi.mocked(bookingService.getBookingById).mockResolvedValue(completedBooking)

            render(<StaffBookingsPage />)

            // Wait for bookings to load
            await waitFor(() => {
                expect(screen.getByText('#BK-2025-001')).toBeInTheDocument()
            })

            // Click on booking to open detail modal
            const bookingCard = screen.getByText('#BK-2025-001').closest('div[class*="cursor-pointer"]')
            fireEvent.click(bookingCard!)

            // Wait for detail modal to open
            await waitFor(() => {
                expect(screen.getByText('Chi tiết lịch hẹn')).toBeInTheDocument()
            })

            // Verify "THÊM DỊCH VỤ" button is NOT visible for completed booking
            expect(screen.queryByText('THÊM DỊCH VỤ')).not.toBeInTheDocument()
        })

        it('should NOT show "THÊM DỊCH VỤ" button when booking status is CONFIRMED', async () => {
            const confirmedBooking = createMockBooking({ status: 'CONFIRMED' })

            vi.mocked(bookingService.getBookingsByStaff).mockResolvedValue({
                content: [confirmedBooking],
                totalPages: 1,
                totalElements: 1,
                number: 0,
                size: 10
            } as any)

            vi.mocked(bookingService.getBookingById).mockResolvedValue(confirmedBooking)

            render(<StaffBookingsPage />)

            await waitFor(() => {
                expect(screen.getByText('#BK-2025-001')).toBeInTheDocument()
            })

            const bookingCard = screen.getByText('#BK-2025-001').closest('div[class*="cursor-pointer"]')
            fireEvent.click(bookingCard!)

            await waitFor(() => {
                expect(screen.getByText('Chi tiết lịch hẹn')).toBeInTheDocument()
            })

            // Should show "BẮT ĐẦU KHÁM" instead of "THÊM DỊCH VỤ"
            expect(screen.queryByText('THÊM DỊCH VỤ')).not.toBeInTheDocument()
        })

        it('should NOT show "THÊM DỊCH VỤ" button when booking status is CANCELLED', async () => {
            const cancelledBooking = createMockBooking({ status: 'CANCELLED' })

            vi.mocked(bookingService.getBookingsByStaff).mockResolvedValue({
                content: [cancelledBooking],
                totalPages: 1,
                totalElements: 1,
                number: 0,
                size: 10
            } as any)

            vi.mocked(bookingService.getBookingById).mockResolvedValue(cancelledBooking)

            render(<StaffBookingsPage />)

            await waitFor(() => {
                expect(screen.getByText('#BK-2025-001')).toBeInTheDocument()
            })

            const bookingCard = screen.getByText('#BK-2025-001').closest('div[class*="cursor-pointer"]')
            fireEvent.click(bookingCard!)

            await waitFor(() => {
                expect(screen.getByText('Chi tiết lịch hẹn')).toBeInTheDocument()
            })

            expect(screen.queryByText('THÊM DỊCH VỤ')).not.toBeInTheDocument()
        })
    })

    describe('Add Service Modal', () => {
        it('should open modal with available services when clicking "THÊM DỊCH VỤ"', async () => {
            const inProgressBooking = createMockBooking({ status: 'IN_PROGRESS' })

            vi.mocked(bookingService.getBookingsByStaff).mockResolvedValue({
                content: [inProgressBooking],
                totalPages: 1,
                totalElements: 1,
                number: 0,
                size: 10
            } as any)

            vi.mocked(bookingService.getBookingById).mockResolvedValue(inProgressBooking)
            vi.mocked(bookingService.getAvailableServicesForAddOn).mockResolvedValue(mockAvailableServices as any)

            render(<StaffBookingsPage />)

            // Open booking detail
            await waitFor(() => {
                expect(screen.getByText('#BK-2025-001')).toBeInTheDocument()
            })

            const bookingCard = screen.getByText('#BK-2025-001').closest('div[class*="cursor-pointer"]')
            fireEvent.click(bookingCard!)

            await waitFor(() => {
                expect(screen.getByText('THÊM DỊCH VỤ')).toBeInTheDocument()
            })

            // Click "THÊM DỊCH VỤ" button
            fireEvent.click(screen.getByText('THÊM DỊCH VỤ'))

            // Verify modal opens with available services
            await waitFor(() => {
                expect(screen.getByText('Thêm dịch vụ phát sinh')).toBeInTheDocument()
                expect(screen.getByText('Tắm vệ sinh')).toBeInTheDocument()
                expect(screen.getByText('Cắt tỉa lông')).toBeInTheDocument()
            })
        })

        it('should show empty state when no services are available', async () => {
            const inProgressBooking = createMockBooking({ status: 'IN_PROGRESS' })

            vi.mocked(bookingService.getBookingsByStaff).mockResolvedValue({
                content: [inProgressBooking],
                totalPages: 1,
                totalElements: 1,
                number: 0,
                size: 10
            } as any)

            vi.mocked(bookingService.getBookingById).mockResolvedValue(inProgressBooking)
            vi.mocked(bookingService.getAvailableServicesForAddOn).mockResolvedValue([])

            render(<StaffBookingsPage />)

            await waitFor(() => {
                expect(screen.getByText('#BK-2025-001')).toBeInTheDocument()
            })

            const bookingCard = screen.getByText('#BK-2025-001').closest('div[class*="cursor-pointer"]')
            fireEvent.click(bookingCard!)

            await waitFor(() => {
                expect(screen.getByText('THÊM DỊCH VỤ')).toBeInTheDocument()
            })

            fireEvent.click(screen.getByText('THÊM DỊCH VỤ'))

            await waitFor(() => {
                expect(screen.getByText('Không còn dịch vụ nào khả dụng để thêm')).toBeInTheDocument()
            })
        })

        it('should close modal when clicking "HỦY"', async () => {
            const inProgressBooking = createMockBooking({ status: 'IN_PROGRESS' })

            vi.mocked(bookingService.getBookingsByStaff).mockResolvedValue({
                content: [inProgressBooking],
                totalPages: 1,
                totalElements: 1,
                number: 0,
                size: 10
            } as any)

            vi.mocked(bookingService.getBookingById).mockResolvedValue(inProgressBooking)
            vi.mocked(bookingService.getAvailableServicesForAddOn).mockResolvedValue(mockAvailableServices as any)

            render(<StaffBookingsPage />)

            await waitFor(() => {
                expect(screen.getByText('#BK-2025-001')).toBeInTheDocument()
            })

            const bookingCard = screen.getByText('#BK-2025-001').closest('div[class*="cursor-pointer"]')
            fireEvent.click(bookingCard!)

            await waitFor(() => {
                expect(screen.getByText('THÊM DỊCH VỤ')).toBeInTheDocument()
            })

            fireEvent.click(screen.getByText('THÊM DỊCH VỤ'))

            await waitFor(() => {
                expect(screen.getByText('Thêm dịch vụ phát sinh')).toBeInTheDocument()
            })

            // Click "HỦY" button
            fireEvent.click(screen.getByText('HỦY'))

            // Modal should close
            await waitFor(() => {
                expect(screen.queryByText('Thêm dịch vụ phát sinh')).not.toBeInTheDocument()
            })
        })

        it('should call addServiceToBooking when confirming service addition', async () => {
            const inProgressBooking = createMockBooking({ status: 'IN_PROGRESS' })
            const updatedBooking = {
                ...inProgressBooking,
                services: [
                    ...inProgressBooking.services!,
                    { serviceId: 'svc-002', serviceName: 'Tắm vệ sinh', price: 150000, assignedStaffId: 'staff-001' }
                ],
                totalPrice: 350000
            }

            vi.mocked(bookingService.getBookingsByStaff).mockResolvedValue({
                content: [inProgressBooking],
                totalPages: 1,
                totalElements: 1,
                number: 0,
                size: 10
            } as any)

            vi.mocked(bookingService.getBookingById).mockResolvedValue(inProgressBooking)
            vi.mocked(bookingService.getAvailableServicesForAddOn).mockResolvedValue(mockAvailableServices as any)
            vi.mocked(bookingService.addServiceToBooking).mockResolvedValue(updatedBooking as any)

            render(<StaffBookingsPage />)

            await waitFor(() => {
                expect(screen.getByText('#BK-2025-001')).toBeInTheDocument()
            })

            const bookingCard = screen.getByText('#BK-2025-001').closest('div[class*="cursor-pointer"]')
            fireEvent.click(bookingCard!)

            await waitFor(() => {
                expect(screen.getByText('THÊM DỊCH VỤ')).toBeInTheDocument()
            })

            fireEvent.click(screen.getByText('THÊM DỊCH VỤ'))

            await waitFor(() => {
                expect(screen.getByText('Tắm vệ sinh')).toBeInTheDocument()
            })

            // Select the first service
            const serviceCard = screen.getByText('Tắm vệ sinh').closest('div[class*="cursor-pointer"]')
            fireEvent.click(serviceCard!)

            // Click confirm button
            fireEvent.click(screen.getByText('XÁC NHẬN THÊM'))

            // Verify API was called
            await waitFor(() => {
                expect(bookingService.addServiceToBooking).toHaveBeenCalledWith('booking-001', 'svc-002')
            })
        })
    })
})
