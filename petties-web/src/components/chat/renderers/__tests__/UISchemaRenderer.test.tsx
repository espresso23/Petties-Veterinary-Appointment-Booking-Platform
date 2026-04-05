import { fireEvent, render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'

import { UISchemaRenderer } from '../UISchemaRenderer'
import type { UISchemaV1 } from '../../../../types/chat-copilot'

describe('UISchemaRenderer', () => {
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
})
