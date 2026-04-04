import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import AIChatPage from '../AIChatPage'

const { chatApiMock, feedbackApiMock, createChatWebSocketMock, mockShowToast } = vi.hoisted(() => ({
  chatApiMock: {
    listSessions: vi.fn(),
    createSession: vi.fn(),
    getSession: vi.fn(),
    deleteSession: vi.fn(),
  },
  feedbackApiMock: {
    submitFeedback: vi.fn(),
  },
  createChatWebSocketMock: vi.fn(),
  mockShowToast: vi.fn(),
}))

vi.mock('../../../components/Toast', () => ({
  useToast: () => ({ showToast: mockShowToast }),
}))

vi.mock('../../../services/agentService', () => ({
  chatApi: chatApiMock,
  feedbackApi: feedbackApiMock,
  createChatWebSocket: createChatWebSocketMock,
}))

vi.mock('../../../components/admin/ChatMessage', () => ({
  ChatMessage: ({ content, role, onFeedback }: { content: string; role: 'user' | 'assistant'; onFeedback?: (feedback: 'good' | 'bad') => void }) => (
    <div>
      {content ? <span>{content}</span> : null}
      {role === 'assistant' && onFeedback ? (
        <button type="button" onClick={() => onFeedback('good')}>
          Phản hồi tốt
        </button>
      ) : null}
    </div>
  ),
}))

function renderPage() {
  return render(
    <MemoryRouter>
      <AIChatPage />
    </MemoryRouter>,
  )
}

describe('ClinicOwnerAIChatPage', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    chatApiMock.listSessions.mockResolvedValue({ total: 0, sessions: [] })
    chatApiMock.createSession.mockResolvedValue({
      success: true,
      session_id: 'session-1',
      context_type: 'BUSINESS_CHAT',
      user_role: 'CLINIC_OWNER',
      clinic_id: 'clinic-1',
      created_at: '2026-04-03T08:00:00.000Z',
    })
    createChatWebSocketMock.mockReturnValue({
      readyState: 1,
      send: vi.fn(),
      close: vi.fn(),
      onopen: null,
      onclose: null,
      onerror: null,
      onmessage: null,
    })
  })

  it('TC-UNIT-005-001: renders clinic owner AI copilot entry state', async () => {
    renderPage()

    expect((await screen.findAllByText('AI Copilot')).length).toBeGreaterThan(0)
    expect(screen.getByText('Trợ lý thông minh cho quản lý phòng khám')).toBeInTheDocument()
    await waitFor(() => {
      expect(chatApiMock.createSession).toHaveBeenCalledTimes(1)
    })
  })

  it('TC-UNIT-005-002: auto creates BUSINESS_CHAT session for clinic owner', async () => {
    renderPage()

    await waitFor(() => {
      expect(chatApiMock.createSession).toHaveBeenCalledWith({
        title: expect.stringContaining('Copilot'),
        context_type: 'BUSINESS_CHAT',
      })
    })
  })

  it('TC-UNIT-005-003: submits feedback with session context', async () => {
    chatApiMock.listSessions.mockResolvedValue({
      total: 1,
      sessions: [
        {
          session_id: 'session-1',
          title: 'Copilot sáng',
          created_at: '2026-04-03T08:00:00.000Z',
        },
      ],
    })
    chatApiMock.getSession.mockResolvedValue({
      session_id: 'session-1',
      context_type: 'BUSINESS_CHAT',
      created_at: '2026-04-03T08:00:00.000Z',
      user_role: 'CLINIC_OWNER',
      clinic_id: 'clinic-1',
      messages: [
        {
          message_id: 'assistant-1',
          role: 'assistant',
          content: 'Xin chào từ AI',
          timestamp: '2026-04-03T08:05:00.000Z',
          metadata: {},
        },
      ],
    })

    renderPage()

    await screen.findByText('Copilot sáng')
    fireEvent.click(screen.getByText('Copilot sáng'))

    expect(await screen.findByText('Xin chào từ AI')).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: 'Phản hồi tốt' }))

    await waitFor(() => {
      expect(feedbackApiMock.submitFeedback).toHaveBeenCalledWith({
        message_id: 'assistant-1',
        session_id: 'session-1',
        feedback_type: 'thumbs_up',
      })
    })
  })

  it('TC-UNIT-005-004: does not append optimistic user message when socket is not connected', async () => {
    renderPage()

    await waitFor(() => {
      expect(chatApiMock.createSession).toHaveBeenCalledTimes(1)
    })

    const input = await screen.findByPlaceholderText('Nhập yêu cầu cho AI Copilot...')
    fireEvent.change(input, { target: { value: 'Tạo dịch vụ mới' } })

    const buttons = screen.getAllByRole('button')
    expect(buttons[buttons.length - 1]).toBeDisabled()
    expect(screen.queryByText('Tạo dịch vụ mới')).not.toBeInTheDocument()
  })
})
