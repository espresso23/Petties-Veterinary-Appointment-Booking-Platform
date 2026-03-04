import { render, screen, fireEvent, waitFor, within } from '@testing-library/react'
import { vi, describe, it, expect, beforeEach } from 'vitest'
import { StaffBookingsPage } from './StaffBookingsPage'
import * as bookingService from '../../services/bookingService'
import { useAuthStore } from '../../store/authStore'
import type { Booking } from '../../types/booking'

// Spring Page response type for mocks
interface PageResponse<T> {
    content: T[];
    totalElements: number;
    totalPages: number;
    size: number;
    number: number;
}

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
            serviceId: 'svc-001',
            name: 'Cắt móng',
            basePrice: 50000,
            durationTime: 30,
            slotsRequired: 1,
            serviceCategory: 'GROOMING',
            clinicId: 'clinic-001',
            isCustom: false,
            isActive: true,
            isHomeVisit: false,
            imageUrl: '',
            description: 'Cắt móng cho thú cưng',
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString()
        },
        {
            serviceId: 'svc-002',
            name: 'Tắm vệ sinh',
            basePrice: 150000,
            durationTime: 60,
            slotsRequired: 2,
            serviceCategory: 'GROOMING',
            clinicId: 'clinic-001',
            isCustom: false,
            isActive: true,
            isHomeVisit: false,
            imageUrl: '',
            description: 'Tắm và vệ sinh thú cưng',
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString()
        }
    ]

    beforeEach(() => {
        vi.clearAllMocks()

        // Mock auth store
        vi.mocked(useAuthStore).mockReturnValue({
            user: mockStaffUser,
            accessToken: null,
            refreshToken: null,
            setTokens: vi.fn(),
            clearAuth: vi.fn(),
            isAuthenticated: true,
        })

        // Default mock for getBookingsByStaff
        vi.mocked(bookingService.getBookingsByStaff).mockResolvedValue({
            content: [],
            totalPages: 0,
            totalElements: 0,
            number: 0,
            size: 10
        })
    })

    describe('Add Service Button Visibility', () => {
        it('should show "THÊM DỊCH VỤ PHÁT SINH" button when booking status is IN_PROGRESS', async () => {
            const inProgressBooking = createMockBooking({ status: 'IN_PROGRESS' })

            vi.mocked(bookingService.getBookingsByStaff).mockResolvedValue({
                content: [inProgressBooking],
                totalPages: 1,
                totalElements: 1,
                number: 0,
                size: 10
            })

            vi.mocked(bookingService.getBookingById).mockResolvedValue(inProgressBooking)

            render(<StaffBookingsPage />)

            // Wait for bookings to load
            await waitFor(() => {
                expect(screen.getByText('#BK-2025-001')).toBeInTheDocument()
            })

            // Click on booking to open detail modal
            const bookingCard = screen.getByText('#BK-2025-001').closest('div[class*="cursor-pointer"]')
            fireEvent.click(bookingCard!)

            // Wait for detail modal to open and verify "THÊM DỊCH VỤ PHÁT SINH" button is visible
            await waitFor(() => {
                expect(screen.getAllByRole('button', { name: /thêm dịch vụ phát sinh/i })[0]).toBeInTheDocument()
            })
        })

        it('should NOT show "THÊM DỊCH VỤ PHÁT SINH" button when booking status is COMPLETED', async () => {
            const completedBooking = createMockBooking({ status: 'COMPLETED' })

            vi.mocked(bookingService.getBookingsByStaff).mockResolvedValue({
                content: [completedBooking],
                totalPages: 1,
                totalElements: 1,
                number: 0,
                size: 10
            })

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

            // Verify "THÊM DỊCH VỤ PHÁT SINH" button is NOT visible for completed booking
            expect(screen.queryByRole('button', { name: /thêm dịch vụ phát sinh/i })).not.toBeInTheDocument()
        })

        it('should NOT show "THÊM DỊCH VỤ PHÁT SINH" button when booking status is CONFIRMED', async () => {
            const confirmedBooking = createMockBooking({ status: 'CONFIRMED' })

            vi.mocked(bookingService.getBookingsByStaff).mockResolvedValue({
                content: [confirmedBooking],
                totalPages: 1,
                totalElements: 1,
                number: 0,
                size: 10
            } as PageResponse<Booking>)

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

            // Should show "BẮT ĐẦU THỰC HIỆN DỊCH VỤ" instead of "THÊM DỊCH VỤ PHÁT SINH"
            expect(screen.queryByRole('button', { name: /thêm dịch vụ phát sinh/i })).not.toBeInTheDocument()
        })

        it('should NOT show "THÊM DỊCH VỤ PHÁT SINH" button when booking status is CANCELLED', async () => {
            const cancelledBooking = createMockBooking({ status: 'CANCELLED' })

            vi.mocked(bookingService.getBookingsByStaff).mockResolvedValue({
                content: [cancelledBooking],
                totalPages: 1,
                totalElements: 1,
                number: 0,
                size: 10
            } as PageResponse<Booking>)

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

            expect(screen.queryByRole('button', { name: /thêm dịch vụ phát sinh/i })).not.toBeInTheDocument()
        })

        it('should show "BẮT ĐẦU THỰC HIỆN DỊCH VỤ" when booking status is CONFIRMED and staff is assigned', async () => {
            const confirmedBooking = createMockBooking({ status: 'CONFIRMED' })

            vi.mocked(bookingService.getBookingsByStaff).mockResolvedValue({
                content: [confirmedBooking],
                totalPages: 1,
                totalElements: 1,
                number: 0,
                size: 10
            } as PageResponse<Booking>)

            vi.mocked(bookingService.getBookingById).mockResolvedValue(confirmedBooking)

            render(<StaffBookingsPage />)

            await waitFor(() => {
                expect(screen.getByText('#BK-2025-001')).toBeInTheDocument()
            })

            const bookingCard = screen.getByText('#BK-2025-001').closest('div[class*="cursor-pointer"]')
            fireEvent.click(bookingCard!)

            await waitFor(() => {
                expect(screen.getByText('Chi tiết lịch hẹn')).toBeInTheDocument()
                expect(screen.getByRole('button', { name: /bắt đầu thực hiện dịch vụ/i })).toBeInTheDocument()
            })
        })

        it('should show action buttons when API returns only pets[].services (no flat services)', async () => {
            const bookingWithPetsOnly = createMockBooking({
                status: 'IN_PROGRESS',
                services: undefined,
                pets: [
                    {
                        petId: 'pet-001',
                        petName: 'Mimi',
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
                        ]
                    }
                ]
            } as Partial<Booking>)

            vi.mocked(bookingService.getBookingsByStaff).mockResolvedValue({
                content: [bookingWithPetsOnly],
                totalPages: 1,
                totalElements: 1,
                number: 0,
                size: 10
            })

            vi.mocked(bookingService.getBookingById).mockResolvedValue(bookingWithPetsOnly)

            render(<StaffBookingsPage />)

            await waitFor(() => {
                expect(screen.getByText('#BK-2025-001')).toBeInTheDocument()
            })

            const bookingCard = screen.getByText('#BK-2025-001').closest('div[class*="cursor-pointer"]')
            fireEvent.click(bookingCard!)

            await waitFor(() => {
                expect(screen.getByText('Chi tiết lịch hẹn')).toBeInTheDocument()
                expect(screen.getAllByRole('button', { name: /thêm dịch vụ phát sinh/i })[0]).toBeInTheDocument()
            })
        })
    })

    describe('Add Service Modal', () => {
        it('should open modal with available services when clicking "THÊM DỊCH VỤ PHÁT SINH"', async () => {
            const inProgressBooking = createMockBooking({ status: 'IN_PROGRESS' })

            vi.mocked(bookingService.getBookingsByStaff).mockResolvedValue({
                content: [inProgressBooking],
                totalPages: 1,
                totalElements: 1,
                number: 0,
                size: 10
            })

            vi.mocked(bookingService.getBookingById).mockResolvedValue(inProgressBooking)
            vi.mocked(bookingService.getAvailableServicesForAddOn).mockResolvedValue(mockAvailableServices)

            render(<StaffBookingsPage />)

            // Open booking detail
            await waitFor(() => {
                expect(screen.getByText('#BK-2025-001')).toBeInTheDocument()
            })

            const bookingCard = screen.getByText('#BK-2025-001').closest('div[class*="cursor-pointer"]')
            fireEvent.click(bookingCard!)

            await waitFor(() => {
                expect(screen.getAllByRole('button', { name: /thêm dịch vụ phát sinh/i })[0]).toBeInTheDocument()
            })

            // Click "THÊM DỊCH VỤ PHÁT SINH" button
            fireEvent.click(screen.getAllByRole('button', { name: /thêm dịch vụ phát sinh/i })[0])

            // Verify modal opens with available services
            await waitFor(() => {
                expect(screen.getByRole('heading', { name: /thêm dịch vụ phát sinh/i })).toBeInTheDocument()
                expect(screen.getByText(/Tắm vệ sinh/i)).toBeInTheDocument()
                expect(screen.getByText(/Cắt móng/i)).toBeInTheDocument()
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
            })

            vi.mocked(bookingService.getBookingById).mockResolvedValue(inProgressBooking)
            vi.mocked(bookingService.getAvailableServicesForAddOn).mockResolvedValue([])

            render(<StaffBookingsPage />)

            await waitFor(() => {
                expect(screen.getByText('#BK-2025-001')).toBeInTheDocument()
            })

            const bookingCard = screen.getByText('#BK-2025-001').closest('div[class*="cursor-pointer"]')
            fireEvent.click(bookingCard!)

            await waitFor(() => {
                expect(screen.getAllByRole('button', { name: /thêm dịch vụ phát sinh/i })[0]).toBeInTheDocument()
            })

            // Click "THÊM DỊCH VỤ PHÁT SINH" button
            fireEvent.click(screen.getAllByRole('button', { name: /thêm dịch vụ phát sinh/i })[0])

            await waitFor(() => {
                expect(screen.getByText('Không còn dịch vụ khả dụng')).toBeInTheDocument()
            })
        })

        it('should close the "Add Service" modal when clicking "HỦY"', async () => {
            const inProgressBooking = createMockBooking({ status: 'IN_PROGRESS' })

            vi.mocked(bookingService.getBookingsByStaff).mockResolvedValue({
                content: [inProgressBooking],
                totalPages: 1,
                totalElements: 1,
                number: 0,
                size: 10
            })

            vi.mocked(bookingService.getBookingById).mockResolvedValue(inProgressBooking)
            vi.mocked(bookingService.getAvailableServicesForAddOn).mockResolvedValue(mockAvailableServices)

            render(<StaffBookingsPage />)

            await waitFor(() => {
                expect(screen.getByText('#BK-2025-001')).toBeInTheDocument()
            })

            const bookingCard = screen.getByText('#BK-2025-001').closest('div[class*="cursor-pointer"]')
            fireEvent.click(bookingCard!)

            await waitFor(() => {
                expect(screen.getAllByRole('button', { name: /thêm dịch vụ phát sinh/i })[0]).toBeInTheDocument()
            })

            // Click "THÊM DỊCH VỤ PHÁT SINH" button
            fireEvent.click(screen.getAllByRole('button', { name: /thêm dịch vụ phát sinh/i })[0])

            await waitFor(() => {
                expect(screen.getByRole('heading', { name: /thêm dịch vụ phát sinh/i })).toBeInTheDocument()
            })

            // Click "Hủy" button inside modal
            const modal = screen.getByRole('dialog')
            fireEvent.click(within(modal).getByRole('button', { name: /hủy/i }))

            // Modal should close
            await waitFor(() => {
                expect(screen.queryByRole('heading', { name: /thêm dịch vụ phát sinh/i })).not.toBeInTheDocument()
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
            })

            vi.mocked(bookingService.getBookingById).mockResolvedValue(inProgressBooking)
            vi.mocked(bookingService.getAvailableServicesForAddOn).mockResolvedValue(mockAvailableServices)
            vi.mocked(bookingService.addServiceToBooking).mockResolvedValue(updatedBooking as Booking)

            render(<StaffBookingsPage />)

            await waitFor(() => {
                expect(screen.getByText('#BK-2025-001')).toBeInTheDocument()
            })

            const bookingCard = screen.getByText('#BK-2025-001').closest('div[class*="cursor-pointer"]')
            fireEvent.click(bookingCard!)

            await waitFor(() => {
                expect(screen.getAllByRole('button', { name: /thêm dịch vụ phát sinh/i })[0]).toBeInTheDocument()
            })

            // Click "THÊM DỊCH VỤ PHÁT SINH" button
            fireEvent.click(screen.getAllByRole('button', { name: /thêm dịch vụ phát sinh/i })[0])

            await waitFor(() => {
                expect(screen.getByText(/Tắm vệ sinh/i)).toBeInTheDocument()
            })

            // Select the first service
            const serviceCard = screen.getByText(/Tắm vệ sinh/i).closest('div[class*="cursor-pointer"]')
            fireEvent.click(serviceCard!)

            // Click confirm button inside modal
            const modal = screen.getByRole('dialog')
            fireEvent.click(within(modal).getByRole('button', { name: /xác nhận thêm/i }))

            // Verify API was called
            await waitFor(() => {
                expect(bookingService.addServiceToBooking).toHaveBeenCalledWith('booking-001', 'svc-002')
            })
        })
    })
})
