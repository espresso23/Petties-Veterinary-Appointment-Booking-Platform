import { describe, it, expect, vi, beforeEach, type Mock } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { BrowserRouter } from 'react-router-dom';
import VetSchedulePage from '../VetSchedulePage';
import { vetShiftService } from '../../../services/api/vetShiftService';
import { useAuthStore } from '../../../store/authStore';
import { useToast } from '../../../components/Toast';

// Mock dependencies
vi.mock('../../../services/api/vetShiftService');
vi.mock('../../../store/authStore');
vi.mock('../../../components/Toast');

const mockShowToast = vi.fn();

// Mock shift data
const mockShift = {
    shiftId: 'shift-1',
    vetId: 'vet-1',
    vetName: 'BS. Nguyễn Văn A',
    vetAvatar: null,
    workDate: new Date().toISOString().split('T')[0], // Today
    startTime: '08:00:00',
    endTime: '12:00:00',
    breakStart: null,
    breakEnd: null,
    isOvernight: false,
    isContinuation: false,
    displayDate: null,
    totalSlots: 8,
    availableSlots: 5,
    bookedSlots: 3,
    blockedSlots: 0,
    slots: [
        {
            slotId: 'slot-1',
            startTime: '08:00:00',
            endTime: '08:30:00',
            status: 'AVAILABLE',
            petName: null,
            petOwnerName: null,
            bookingId: null,
            serviceName: null,
        },
        {
            slotId: 'slot-2',
            startTime: '08:30:00',
            endTime: '09:00:00',
            status: 'BOOKED',
            petName: 'Milo',
            petOwnerName: 'Nguyễn Văn B',
            bookingId: 'booking-1',
            serviceName: 'Khám tổng quát',
        },
        {
            slotId: 'slot-3',
            startTime: '09:00:00',
            endTime: '09:30:00',
            status: 'BOOKED',
            petName: 'Milo',
            petOwnerName: 'Nguyễn Văn B',
            bookingId: 'booking-1',
            serviceName: 'Khám tổng quát',
        },
        {
            slotId: 'slot-4',
            startTime: '09:30:00',
            endTime: '10:00:00',
            status: 'BLOCKED',
            petName: null,
            petOwnerName: null,
            bookingId: null,
            serviceName: null,
        },
    ],
};

describe('VetSchedulePage', () => {
    beforeEach(() => {
        vi.clearAllMocks();

        // Mock auth store
        (useAuthStore as unknown as Mock).mockReturnValue({
            user: {
                userId: 'vet-1',
                fullName: 'BS. Nguyễn Văn A',
                workingClinicId: 'clinic-1',
                workingClinicName: 'Phòng Khám ABC',
                role: 'VET',
                avatar: null,
            }
        });

        // Mock toast
        (useToast as unknown as Mock).mockReturnValue({
            showToast: mockShowToast
        });

        // Mock vet shift service
        (vetShiftService.getMyShifts as Mock).mockResolvedValue([mockShift]);
        (vetShiftService.getShiftDetail as Mock).mockResolvedValue(mockShift);
    });

    const renderComponent = () => {
        return render(
            <BrowserRouter>
                <VetSchedulePage />
            </BrowserRouter>
        );
    };

    describe('Page Rendering', () => {
        it('should render page header with title', async () => {
            renderComponent();

            await waitFor(() => {
                expect(screen.getByText('LỊCH LÀM VIỆC')).toBeInTheDocument();
            });
        });

        it('should display clinic name in header', async () => {
            renderComponent();

            await waitFor(() => {
                expect(screen.getByText('Phòng Khám ABC')).toBeInTheDocument();
            });
        });

        it('should display vet name', async () => {
            renderComponent();

            await waitFor(() => {
                expect(screen.getByText('BS. Nguyễn Văn A')).toBeInTheDocument();
            });
        });

        it('should render view mode toggle buttons', async () => {
            renderComponent();

            await waitFor(() => {
                expect(screen.getByText('Tuần')).toBeInTheDocument();
                expect(screen.getByText('Ngày')).toBeInTheDocument();
                expect(screen.getByText('Tháng')).toBeInTheDocument();
            });
        });
    });

    describe('Week View', () => {
        it('should display week days header', async () => {
            renderComponent();

            await waitFor(() => {
                expect(screen.getByText('Thứ 2')).toBeInTheDocument();
                expect(screen.getByText('Thứ 3')).toBeInTheDocument();
                expect(screen.getByText('CN')).toBeInTheDocument();
            });
        });

        it('should show loading state while fetching shifts', async () => {
            (vetShiftService.getMyShifts as Mock).mockImplementation(() =>
                new Promise(resolve => setTimeout(() => resolve([mockShift]), 100))
            );

            renderComponent();

            expect(screen.getByText('Đang tải lịch...')).toBeInTheDocument();

            await waitFor(() => {
                expect(screen.queryByText('Đang tải lịch...')).not.toBeInTheDocument();
            });
        });

        it('should display shift time when shift exists for a day', async () => {
            renderComponent();

            await waitFor(() => {
                expect(screen.getByText('08:00 - 12:00')).toBeInTheDocument();
            });
        });

        it('should show available/total slots count', async () => {
            renderComponent();

            await waitFor(() => {
                expect(screen.getByText('5/8')).toBeInTheDocument();
            });
        });
    });

    describe('Shift Selection', () => {
        it('should open shift detail sidebar when clicking on a shift', async () => {
            renderComponent();

            await waitFor(() => {
                expect(screen.getByText('08:00 - 12:00')).toBeInTheDocument();
            });

            // Click on the shift
            const shiftCard = screen.getByText('08:00 - 12:00').closest('div[class*="cursor-pointer"]');
            if (shiftCard) {
                fireEvent.click(shiftCard);
            }

            await waitFor(() => {
                // Check if detail sidebar is shown
                expect(screen.getByText('Chi tiết ca làm')).toBeInTheDocument();
            });
        });

        it('should display slot statuses in detail view', async () => {
            renderComponent();

            await waitFor(() => {
                expect(screen.getByText('08:00 - 12:00')).toBeInTheDocument();
            });

            // Click on the shift
            const shiftCard = screen.getByText('08:00 - 12:00').closest('div[class*="cursor-pointer"]');
            if (shiftCard) {
                fireEvent.click(shiftCard);
            }

            await waitFor(() => {
                // Should show slot statuses
                expect(screen.getByText('Sẵn sàng')).toBeInTheDocument();
            });
        });
    });

    describe('View Mode Switching', () => {
        it('should switch to Day view when clicking "Ngày" button', async () => {
            renderComponent();

            await waitFor(() => {
                expect(screen.getByText('Ngày')).toBeInTheDocument();
            });

            fireEvent.click(screen.getByText('Ngày'));

            // Day view should show the "Bạn không có lịch làm việc" message or day navigation
            await waitFor(() => {
                // Either shows no schedule message or the date navigation
                const hasNoSchedule = screen.queryByText(/Bạn không có lịch làm việc/i);
                const hasNavigation = screen.queryAllByText('←').length > 0;
                expect(hasNoSchedule || hasNavigation).toBeTruthy();
            });
        });

        it('should switch to Month view when clicking "Tháng" button', async () => {
            renderComponent();

            await waitFor(() => {
                expect(screen.getByText('Tháng')).toBeInTheDocument();
            });

            fireEvent.click(screen.getByText('Tháng'));

            // Month view should show month/year header
            await waitFor(() => {
                const now = new Date();
                expect(screen.getByText(`Tháng ${now.getMonth() + 1}/${now.getFullYear()}`)).toBeInTheDocument();
            });
        });
    });

    describe('Navigation', () => {
        it('should navigate to previous week when clicking left arrow', async () => {
            renderComponent();

            await waitFor(() => {
                expect(screen.getByText('Tuần')).toBeInTheDocument();
            });

            // Find and click left navigation button
            const leftButton = screen.getAllByText('←')[0];
            fireEvent.click(leftButton);

            // Service should be called again for new week
            await waitFor(() => {
                expect(vetShiftService.getMyShifts).toHaveBeenCalledTimes(2);
            });
        });

        it('should navigate to next week when clicking right arrow', async () => {
            renderComponent();

            await waitFor(() => {
                expect(screen.getByText('Tuần')).toBeInTheDocument();
            });

            // Find and click right navigation button
            const rightButton = screen.getAllByText('→')[0];
            fireEvent.click(rightButton);

            // Service should be called again for new week
            await waitFor(() => {
                expect(vetShiftService.getMyShifts).toHaveBeenCalledTimes(2);
            });
        });
    });

    describe('Error Handling', () => {
        it('should show error toast when fetch fails', async () => {
            (vetShiftService.getMyShifts as Mock).mockRejectedValue(new Error('Network error'));

            renderComponent();

            await waitFor(() => {
                expect(mockShowToast).toHaveBeenCalledWith('error', expect.any(String));
            });
        });
    });
});
