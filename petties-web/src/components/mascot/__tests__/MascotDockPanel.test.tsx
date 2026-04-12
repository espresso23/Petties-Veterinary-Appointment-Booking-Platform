import { fireEvent, render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'

import { MascotDockPanel } from '../MascotDockPanel'
import type { UIAction } from '../../../types/chat-copilot'
import { ToastProvider } from '../../Toast'

vi.mock('../../chat/renderers/UISchemaRenderer', () => ({
  UISchemaRenderer: ({
    onAction,
  }: {
    onAction: (action: UIAction) => void
  }) => (
    <div>
      <button
        type="button"
        onClick={() =>
          onAction({
            type: 'open_native_confirm',
            label: 'Mở xác nhận',
            payload: {
              title: 'Xác nhận thao tác',
              message: 'Bạn có chắc muốn tiếp tục?',
              confirm_label: 'Đồng ý',
              cancel_label: 'Hủy',
              confirm_action: {
                type: 'confirm_service_update',
                label: 'Xác nhận cập nhật',
                payload: {
                  service_id: 'svc-1',
                  display_message: 'Xác nhận cập nhật dịch vụ',
                },
              },
            },
          })
        }
      >
        trigger-confirm-update
      </button>
      <button
        type="button"
        onClick={() =>
          onAction({
            type: 'open_native_confirm',
            label: 'Mở xác nhận create',
            payload: {
              title: 'Xác nhận tạo mới',
              confirm_action: {
                type: 'confirm_service_create',
                label: 'Xác nhận tạo dịch vụ',
                payload: {
                  service_name: 'Tiêm phòng tổng quát',
                  display_message: 'Xác nhận tạo dịch vụ',
                },
              },
            },
          })
        }
      >
        trigger-confirm-create
      </button>
      <button
        type="button"
        onClick={() =>
          onAction({
            type: 'open_native_confirm',
            label: 'Mở xác nhận batch',
            payload: {
              title: 'Xác nhận tạo hàng loạt',
              confirm_action: {
                type: 'confirm_service_batch_create',
                label: 'Xác nhận tạo nhiều dịch vụ',
                payload: {
                  services: [{ service_name: 'Khám tai mũi họng' }],
                  display_message: 'Xác nhận tạo nhiều dịch vụ',
                },
              },
            },
          })
        }
      >
        trigger-confirm-batch
      </button>
    </div>
  ),
}))

vi.mock('../../ConfirmModal', () => ({
  ConfirmModal: ({
    isOpen,
    title,
    message,
    onConfirm,
    onCancel,
    confirmLabel,
    cancelLabel,
  }: {
    isOpen: boolean
    title: string
    message: string
    onConfirm: () => void
    onCancel: () => void
    confirmLabel: string
    cancelLabel: string
  }) =>
    isOpen ? (
      <div>
        <p>{title}</p>
        <p>{message}</p>
        <button onClick={onConfirm}>{confirmLabel}</button>
        <button onClick={onCancel}>{cancelLabel}</button>
      </div>
    ) : null,
}))

describe('MascotDockPanel', () => {
  const baseProps = {
    isOpen: true,
    onClose: vi.fn(),
    onSendMessage: vi.fn(async () => ({})),
    onSendUiAction: vi.fn(async () => {}),
    messages: [
      {
        id: 'm1',
        role: 'assistant' as const,
        content: '',
        timestamp: new Date(),
        uiSchema: { version: '1.0' as const, layout: 'list' as const, components: [] },
      },
    ],
    connectionStatus: 'connected' as const,
    routePath: '/clinic-owner/services',
  }

  it('gửi action confirm_service_update sau khi xác nhận', async () => {
    const onSendUiAction = vi.fn(async () => {})
    render(<ToastProvider><MascotDockPanel {...baseProps} onSendUiAction={onSendUiAction} /></ToastProvider>)

    fireEvent.click(screen.getByText('trigger-confirm-update'))
    fireEvent.click(screen.getByText('Đồng ý'))

    expect(onSendUiAction).toHaveBeenCalledTimes(1)
    const calls = onSendUiAction.mock.calls as unknown as Array<[UIAction, string?]>
    const calledAction = calls[0]?.[0]
    const calledDisplayMessage = calls[0]?.[1]
    expect(calledAction?.type).toBe('confirm_service_update')
    expect(calledDisplayMessage).toBe('Xác nhận cập nhật dịch vụ')
  })

  it('gửi action confirm_service_create sau khi xác nhận', async () => {
    const onSendUiAction = vi.fn(async () => {})
    render(<ToastProvider><MascotDockPanel {...baseProps} onSendUiAction={onSendUiAction} /></ToastProvider>)

    fireEvent.click(screen.getByText('trigger-confirm-create'))
    fireEvent.click(screen.getByText('Xác nhận'))

    expect(onSendUiAction).toHaveBeenCalledTimes(1)
    const calls = onSendUiAction.mock.calls as unknown as Array<[UIAction, string?]>
    const calledAction = calls[0]?.[0]
    const calledDisplayMessage = calls[0]?.[1]
    expect(calledAction?.type).toBe('confirm_service_create')
    expect(calledDisplayMessage).toBe('Xác nhận tạo dịch vụ')
  })

  it('gửi action confirm_service_batch_create sau khi xác nhận', async () => {
    const onSendUiAction = vi.fn(async () => {})
    render(<ToastProvider><MascotDockPanel {...baseProps} onSendUiAction={onSendUiAction} /></ToastProvider>)

    fireEvent.click(screen.getByText('trigger-confirm-batch'))
    fireEvent.click(screen.getByText('Xác nhận'))

    expect(onSendUiAction).toHaveBeenCalledTimes(1)
    const calls = onSendUiAction.mock.calls as unknown as Array<[UIAction, string?]>
    const calledAction = calls[0]?.[0]
    const calledDisplayMessage = calls[0]?.[1]
    expect(calledAction?.type).toBe('confirm_service_batch_create')
    expect(calledDisplayMessage).toBe('Xác nhận tạo nhiều dịch vụ')
  })
})
