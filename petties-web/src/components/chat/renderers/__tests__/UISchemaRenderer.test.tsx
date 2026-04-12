import { fireEvent, render, screen } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import { UISchemaRenderer } from '../UISchemaRenderer'
import type { UISchemaV1 } from '../../../../types/chat-copilot'
import * as serviceApi from '../../../../services/endpoints/service'

vi.mock('../../../../services/endpoints/service', () => ({
  createService: vi.fn().mockResolvedValue({ serviceId: 'new-svc-id' }),
}))

describe('UISchemaRenderer', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('TC-UNIT-010-001: renders service_card with formatted fields and action', () => {
    const onAction = vi.fn()
    const schema: UISchemaV1 = {
      version: '1.0',
      layout: 'grid',
      components: [
        {
          type: 'service_card',
          id: 'svc-1',
          data: {
            name: 'Khám tổng quát',
            description: 'Khám sức khỏe định kỳ',
            base_price: 150000,
            duration_time: 30,
            service_category: 'HEALTHCARE',
            pet_type: 'DOG',
            selected: false,
          },
          actions: [
            {
              type: 'open_native_confirm',
              label: 'Lưu dịch vụ',
              payload: { title: 'Lưu dịch vụ' },
            },
          ],
        },
      ],
    }

    render(<UISchemaRenderer schema={schema} onAction={onAction} />)

    expect(screen.getByText('Khám tổng quát')).toBeInTheDocument()
    expect(screen.getByText('Khám sức khỏe định kỳ')).toBeInTheDocument()
    expect(screen.getByText('150.000đ')).toBeInTheDocument()
    expect(screen.getByText('30 phút')).toBeInTheDocument()

    fireEvent.click(screen.getByRole('button', { name: 'Lưu dịch vụ' }))
    expect(onAction).toHaveBeenCalledTimes(1)
    expect(onAction.mock.calls[0][0].type).toBe('open_native_confirm')
  })

  it('TC-UNIT-010-002: renders button component and dispatches first action', () => {
    const onAction = vi.fn()
    const schema: UISchemaV1 = {
      version: '1.0',
      layout: 'grid',
      components: [
        {
          type: 'button',
          id: 'batch-save',
          data: {
            label: 'Lưu tất cả (2)',
          },
          actions: [
            {
              type: 'open_native_confirm',
              label: 'Lưu tất cả (2)',
              payload: { title: 'Lưu toàn bộ dịch vụ gợi ý' },
            },
          ],
        },
      ],
    }

    render(<UISchemaRenderer schema={schema} onAction={onAction} />)

    fireEvent.click(screen.getByRole('button', { name: 'Lưu tất cả (2)' }))
    expect(onAction).toHaveBeenCalledTimes(1)
    expect(onAction.mock.calls[0][0].type).toBe('open_native_confirm')
  })

  it('TC-UNIT-010-003: applies edited pricing fields for confirm_service_create action', () => {
    const onAction = vi.fn()
    const schema: UISchemaV1 = {
      version: '1.0',
      layout: 'grid',
      components: [
        {
          type: 'service_card',
          id: 'svc-edit-price',
          data: {
            name: 'Tiêm phòng tổng quát',
            base_price: 150000,
            duration_time: 30,
            service_category: 'VACCINATION',
            pet_type: 'DOG',
            weight_prices: [
              {
                min_weight: 0,
                max_weight: 5,
                price: 120000,
              },
            ],
            dose_prices: [
              {
                dose_label: 'Mũi 1',
                price: 140000,
              },
            ],
          },
          actions: [
            {
              type: 'open_native_confirm',
              label: 'Lưu dịch vụ',
              payload: {
                title: 'Lưu dịch vụ',
                clinic_id: 'test-clinic-id',
                confirm_action: {
                  type: 'confirm_service_create',
                  label: 'Xác nhận lưu',
                  payload: {
                    clinic_id: 'test-clinic-id',
                    name: 'Tiêm phòng tổng quát',
                    base_price: 150000,
                    slots_required: 1,
                    weight_prices: [
                      {
                        min_weight: 0,
                        max_weight: 5,
                        price: 120000,
                      },
                    ],
                    dose_prices: [
                      {
                        dose_label: 'Mũi 1',
                        price: 140000,
                      },
                    ],
                  },
                },
              },
            },
          ],
        },
      ],
    }

    render(<UISchemaRenderer schema={schema} onAction={onAction} />)

    expect(screen.getByText('Chỉnh giá nhanh trước khi lưu')).toBeInTheDocument()

    fireEvent.change(screen.getByLabelText('Giá cơ bản chỉnh nhanh'), {
      target: { value: '200000' },
    })
    fireEvent.change(screen.getByLabelText('Giá cân nặng 1'), {
      target: { value: '250000' },
    })
    fireEvent.change(screen.getByLabelText('Giá mũi tiêm 1'), {
      target: { value: '180000' },
    })

    fireEvent.click(screen.getByRole('button', { name: 'Lưu dịch vụ' }))

    expect(serviceApi.createService).toHaveBeenCalledTimes(1)
    const payload = (serviceApi.createService as ReturnType<typeof vi.fn>).mock.calls[0][0]

    expect(payload.clinicId).toBe('test-clinic-id')
    expect(payload.basePrice).toBe(200000)
    expect(payload.weightPrices?.[0]?.price).toBe(250000)
    expect(payload.dosePrices?.[0]?.price).toBe(180000)
  })

  it('TC-UNIT-010-004: hides quick pricing editor when action is not confirm_service_create', () => {
    const onAction = vi.fn()
    const schema: UISchemaV1 = {
      version: '1.0',
      layout: 'grid',
      components: [
        {
          type: 'service_card',
          id: 'svc-no-edit',
          data: {
            name: 'Khám cơ bản',
            base_price: 100000,
          },
          actions: [
            {
              type: 'open_native_confirm',
              label: 'Lưu dịch vụ',
              payload: {
                title: 'Xác nhận thao tác',
              },
            },
          ],
        },
      ],
    }

    render(<UISchemaRenderer schema={schema} onAction={onAction} />)

    expect(screen.queryByText('Chỉnh giá nhanh trước khi lưu')).not.toBeInTheDocument()

    fireEvent.click(screen.getByRole('button', { name: 'Lưu dịch vụ' }))
    expect(onAction).toHaveBeenCalledTimes(1)
    expect(onAction.mock.calls[0][0].payload).toEqual({
      title: 'Xác nhận thao tác',
    })
  })
})
