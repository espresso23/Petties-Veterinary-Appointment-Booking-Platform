import { describe, it, expect, vi, beforeEach, type Mock } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { BrowserRouter } from 'react-router-dom';
import BookingDashboardPage from '../BookingDashboardPage';
import * as bookingService from '../../../../services/bookingService';
import { useAuthStore } from '../../../../store/authStore';
import { useToast } from '../../../../components/Toast';

// Mock dependencies
vi.mock('../../../../services/bookingService');
vi.mock('../../../../store/authStore');
vi.mock('../../../../components/Toast');

const mockShowToast = vi.fn();

// Mock booking data - PENDING booking
const mockPendingBooking = {
    id: 'booking-1',
    bookingId: 'booking-1',
    bookingCode: 'BK-001',
    status: 'PENDING',
    type: 'IN_CLINIC',
    petName: 'Milo',
    petWeight: 5,
    ownerName: 'John Doe',
    bookingDate: '2026-01-20',
    bookingTime: '09:00:00',
    totalPrice: 150000,
    distanceFee: 0,
    distanceKm: 0,
    paymentStatus: 'PENDING',
    services: [
        {
            bookingServiceId: 'bsi-1',
            serviceId: 'srv-1',
            serviceName: 'Khám tổng quát',
            serviceCategory: 'EXAMINATION',
            price: 150000,
            basePrice: 100000,
            weightPrice: 150000,
            durationMinutes: 30,
            slotsRequired: 1,
            assignedVetName: null,
        }
    ]
};

// Mock booking data - CONFIRMED booking for display tests
const mockConfirmedBooking = {
    ...mockPendingBooking,
    id: 'booking-2',
    bookingId: 'booking-2',
    bookingCode: 'BK-002',
    status: 'CONFIRMED',
    type: 'HOME_VISIT',
    distanceFee: 50000,
    distanceKm: 5,
    homeAddress: '123 Đường ABC, Quận 1, TP.HCM',
};

describe('BookingDashboardPage', () => {
    beforeEach(() => {
        vi.clearAllMocks();

        // Mock auth store
        (useAuthStore as unknown as Mock).mockReturnValue({
            user: {
                id: 'user-1',
                workingClinicId: 'clinic-1',
                role: 'CLINIC_MANAGER'
            }
        });

        // Mock toast
        (useToast as unknown as Mock).mockReturnValue({
            showToast: mockShowToast
        });

        // Mock booking service - default to PENDING bookings
        (bookingService.getBookingsByClinic as Mock).mockResolvedValue({
            content: [mockPendingBooking],
            totalPages: 1,
            totalElements: 1
        });

        // Mock getAvailableVetsForConfirm
        (bookingService.getAvailableVetsForConfirm as Mock).mockResolvedValue([
            {
                vetId: 'vet-1',
                fullName: 'BS. Nguyễn Văn A',
                avatarUrl: null,
                specialty: 'VET_GENERAL',
                specialtyLabel: 'Bác sĩ thú y tổng quát',
                isSuggested: true,
                hasAvailableSlots: true,
                bookingCount: 0,
                unavailableReason: null
            }
        ]);
    });

    const renderComponent = () => {
        return render(
            <BrowserRouter>
                <BookingDashboardPage />
            </BrowserRouter>
        );
    };

    describe('Page Rendering', () => {
        it('should render page title correctly', async () => {
            renderComponent();

            await waitFor(() => {
                expect(screen.getByText('QUẢN LÝ ĐẶT LỊCH')).toBeInTheDocument();
            });
        });

        it('should render booking list with data', async () => {
            renderComponent();

            await waitFor(() => {
                expect(screen.getByText('BK-001')).toBeInTheDocument();
            });
        });

        it('should render filter tabs', async () => {
            renderComponent();

            await waitFor(() => {
                expect(screen.getByText('Chờ xác nhận')).toBeInTheDocument();
                expect(screen.getByText('Đã xác nhận')).toBeInTheDocument();
                expect(screen.getByText('Lịch sử')).toBeInTheDocument();
                expect(screen.getByText('Tất cả')).toBeInTheDocument();
            });
        });

        it('should show pending count badge', async () => {
            renderComponent();

            await waitFor(() => {
                // The badge shows count "1" for pending
                const badge = screen.getByText('1');
                expect(badge).toBeInTheDocument();
            });
        });
    });

    describe('Tab Switching', () => {
        it('should switch to Đã xác nhận tab', async () => {
            // Mock CONFIRMED bookings for this tab
            (bookingService.getBookingsByClinic as Mock).mockResolvedValue({
                content: [mockConfirmedBooking],
                totalPages: 1,
                totalElements: 1
            });

            renderComponent();

            // Click on "Đã xác nhận" tab
            const confirmedTab = await screen.findByText('Đã xác nhận');
            fireEvent.click(confirmedTab);

            await waitFor(() => {
                expect(screen.getByText('BK-002')).toBeInTheDocument();
            });
        });

        it('should show HOME_VISIT booking type label', async () => {
            (bookingService.getBookingsByClinic as Mock).mockResolvedValue({
                content: [mockConfirmedBooking],
                totalPages: 1,
                totalElements: 1
            });

            renderComponent();

            const confirmedTab = await screen.findByText('Đã xác nhận');
            fireEvent.click(confirmedTab);

            await waitFor(() => {
                expect(screen.getByText('Khám tại nhà')).toBeInTheDocument();
            });
        });
    });

    describe('Type Filter', () => {
        it('should have type filter dropdown', async () => {
            renderComponent();

            await waitFor(() => {
                expect(screen.getByText('Lọc loại:')).toBeInTheDocument();
            });
        });
    });

    describe('Empty State', () => {
        it('should show empty message when no bookings', async () => {
            (bookingService.getBookingsByClinic as Mock).mockResolvedValue({
                content: [],
                totalPages: 0,
                totalElements: 0
            });

            renderComponent();

            await waitFor(() => {
                expect(screen.getByText(/Không có đơn đặt lịch/i)).toBeInTheDocument();
            });
        });
    });
});
