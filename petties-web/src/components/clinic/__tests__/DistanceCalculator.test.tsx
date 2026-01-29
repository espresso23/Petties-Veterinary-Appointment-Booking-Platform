import { render, screen, waitFor } from '@testing-library/react'
import { vi, describe, it, expect, beforeEach, afterEach } from 'vitest'
import { DistanceCalculator } from '../DistanceCalculator'
import { clinicService } from '../../../services/api/clinicService'

// Mock clinicService
vi.mock('../../../services/api/clinicService', () => ({
    clinicService: {
        calculateDistance: vi.fn(),
    },
}))

describe('DistanceCalculator', () => {
    const mockDistanceResponse = {
        distance: 5.5,
        unit: 'km',
        distanceText: '5.5 km',
        duration: 15,
        durationUnit: 'minutes',
        durationText: '15 minutes',
    }

    const mockGeolocation = {
        getCurrentPosition: vi.fn(),
        watchPosition: vi.fn(),
        clearWatch: vi.fn(),
    }

    beforeEach(() => {
        // Setup navigator.geolocation mock
        Object.defineProperty(globalThis.navigator, 'geolocation', {
            value: mockGeolocation,
            writable: true,
        })

        // Reset mocks
        vi.clearAllMocks()
        mockGeolocation.getCurrentPosition.mockClear()
        vi.mocked(clinicService.calculateDistance).mockReset()
    })

    afterEach(() => {
        vi.restoreAllMocks()
    })

    it('renders loading state initially when calculating', async () => {
        // Setup mock to delay a bit
        vi.mocked(clinicService.calculateDistance).mockImplementation(
            () => new Promise(resolve => setTimeout(() => resolve(mockDistanceResponse), 100))
        )

        // Trigger calculation by providing props
        render(<DistanceCalculator clinicId="clinic-123" userLatitude={10.0} userLongitude={106.0} />)

        // Use findByText to wait for the loading state to appear after useEffect
        expect(await screen.findByText('Đang tính khoảng cách...')).toBeInTheDocument()

        await waitFor(() => {
            expect(screen.queryByText('Đang tính khoảng cách...')).not.toBeInTheDocument()
        })
    })

    it('calculates distance using provided props', async () => {
        vi.mocked(clinicService.calculateDistance).mockResolvedValue(mockDistanceResponse)

        render(<DistanceCalculator clinicId="clinic-123" userLatitude={10.123} userLongitude={106.456} />)

        await waitFor(() => {
            expect(clinicService.calculateDistance).toHaveBeenCalledWith('clinic-123', 10.123, 106.456)
        })

        expect(await screen.findByText('5.5 km')).toBeInTheDocument()
        expect(screen.getByText(/Thời gian dự kiến: 15 minutes/)).toBeInTheDocument()
    })

    it('uses browser geolocation when user location is not provided', async () => {
        vi.mocked(clinicService.calculateDistance).mockResolvedValue(mockDistanceResponse)

        // Mock geolocation success
        mockGeolocation.getCurrentPosition.mockImplementation((success) =>
            success({
                coords: {
                    latitude: 10.999,
                    longitude: 106.999,
                    accuracy: 10,
                    altitude: null,
                    altitudeAccuracy: null,
                    heading: null,
                    speed: null,
                },
                timestamp: Date.now()
            })
        )

        render(<DistanceCalculator clinicId="clinic-123" />)

        await waitFor(() => {
            expect(mockGeolocation.getCurrentPosition).toHaveBeenCalled()
        })

        await waitFor(() => {
            expect(clinicService.calculateDistance).toHaveBeenCalledWith('clinic-123', 10.999, 106.999)
        })

        expect(await screen.findByText('5.5 km')).toBeInTheDocument()
    })

    it('handles geolocation error', async () => {
        // Mock geolocation error
        mockGeolocation.getCurrentPosition.mockImplementation((_, error) =>
            error && error({
                code: 1,
                message: 'User denied Geolocation',
                PERMISSION_DENIED: 1,
                POSITION_UNAVAILABLE: 2,
                TIMEOUT: 3,
            })
        )

        render(<DistanceCalculator clinicId="clinic-123" />)

        expect(await screen.findByText('Lỗi')).toBeInTheDocument()
        expect(screen.getByText('Không thể lấy vị trí hiện tại của bạn')).toBeInTheDocument()
    })

    it('handles API error', async () => {
        vi.mocked(clinicService.calculateDistance).mockRejectedValue(new Error('Network Error'))

        render(<DistanceCalculator clinicId="clinic-123" userLatitude={10.0} userLongitude={106.0} />)

        expect(await screen.findByText('Network Error')).toBeInTheDocument()
    })
})
