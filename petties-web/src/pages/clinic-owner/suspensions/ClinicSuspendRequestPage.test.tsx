import { render, screen, waitFor } from '@testing-library/react'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { MemoryRouter } from 'react-router-dom'
import ClinicSuspendRequestPage from './ClinicSuspendRequestPage'

const showToastMock = vi.fn()
const getMyClinicsMock = vi.fn()
const getMySuspendRequestsMock = vi.fn()

vi.mock('../../../store/authStore', () => ({
  useAuthStore: () => ({
    user: { fullName: 'Clinic Owner Test' },
  }),
}))

vi.mock('../../../store/clinicStore', () => ({
  useClinicStore: () => ({
    clinics: [
      {
        clinicId: 'clinic-1',
        name: 'Phong kham A',
        status: 'APPROVED',
        address: '123 Nguyen Trai',
      },
    ],
    getMyClinics: getMyClinicsMock,
    isLoading: false,
  }),
}))

vi.mock('../../../services/api/clinicService', () => ({
  clinicService: {
    getMySuspendRequests: (...args: unknown[]) => getMySuspendRequestsMock(...args),
    createSuspendRequest: vi.fn(),
  },
}))

vi.mock('../../../components/Toast', () => ({
  useToast: () => ({
    showToast: showToastMock,
  }),
}))

describe('ClinicSuspendRequestPage', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    getMyClinicsMock.mockResolvedValue(undefined)
  })

  it('khong hien toast loi khi endpoint lich su tra 404', async () => {
    getMySuspendRequestsMock.mockRejectedValueOnce({
      isAxiosError: true,
      response: { status: 404 },
    })

    render(
      <MemoryRouter>
        <ClinicSuspendRequestPage />
      </MemoryRouter>
    )

    await waitFor(() => {
      expect(
        screen.getByText(
          'Môi trường hiện tại chưa hỗ trợ xem lịch sử yêu cầu tạm ngưng. Bạn vẫn có thể gửi yêu cầu mới.'
        )
      ).toBeInTheDocument()
    })

    expect(showToastMock).not.toHaveBeenCalledWith(
      'error',
      'Không thể tải danh sách yêu cầu tạm ngưng'
    )
  })

  it('van hien toast loi cho cac loi khac 404', async () => {
    getMySuspendRequestsMock.mockRejectedValueOnce({
      isAxiosError: true,
      response: { status: 500 },
    })

    render(
      <MemoryRouter>
        <ClinicSuspendRequestPage />
      </MemoryRouter>
    )

    await waitFor(() => {
      expect(showToastMock).toHaveBeenCalledWith(
        'error',
        'Không thể tải danh sách yêu cầu tạm ngưng'
      )
    })
  })
})
