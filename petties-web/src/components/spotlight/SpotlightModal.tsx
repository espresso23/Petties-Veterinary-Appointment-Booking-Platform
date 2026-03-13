import { useState, useEffect, useRef } from 'react'
import {
    SparklesIcon,
    PaperAirplaneIcon,
    XMarkIcon,
    DocumentTextIcon,
    PencilIcon,
    UserGroupIcon,
    ChatBubbleLeftRightIcon,
    ArrowPathIcon,
    CheckCircleIcon,
    ExclamationCircleIcon
} from '@heroicons/react/24/outline'

export interface SpotlightMessage {
    id: string
    role: 'user' | 'assistant'
    content: string
    timestamp: Date
    isLoading?: boolean
    actions?: AIAction[]
    suggestions?: string[]
}

export interface AIAction {
    type: 'emr_create' | 'emr_edit' | 'diagnosis' | 'prescription' | 'patient_info' | 'chat'
    data: Record<string, unknown>
    preview?: string
}

interface SpotlightModalProps {
    isOpen: boolean
    onClose: () => void
    position?: { x: number; y: number }
    onSendMessage?: (message: string, context?: Record<string, unknown>) => Promise<{ response: string; actions?: AIAction[]; suggestions?: string[] }>
    initialContext?: Record<string, unknown>
    messages?: SpotlightMessage[]
    connectionStatus?: 'disconnected' | 'connecting' | 'connected'
}

export const SpotlightModal = ({
    isOpen,
    onClose,
    position,
    onSendMessage,
    initialContext,
    messages: externalMessages,
    connectionStatus
}: SpotlightModalProps) => {
    const [internalMessages, setInternalMessages] = useState<SpotlightMessage[]>([])
    const [inputValue, setInputValue] = useState('')
    const [isLoading, setIsLoading] = useState(false)
    const [showPreview, setShowPreview] = useState(false)
    const [pendingAction, setPendingAction] = useState<AIAction | null>(null)
    const [cursorPosition, setCursorPosition] = useState<{ x: number; y: number } | null>(null)

    // Use external messages if provided, otherwise use internal
    const messages = externalMessages !== undefined 
        ? externalMessages.map(m => ({ ...m, isLoading: false }))
        : internalMessages

    const inputRef = useRef<HTMLInputElement>(null)
    const messagesEndRef = useRef<HTMLDivElement>(null)

    // Get cursor position or use provided position
    useEffect(() => {
        if (isOpen) {
            if (position) {
                setCursorPosition(position)
            } else {
                // Get cursor position
                const updateCursorPos = () => {
                    setCursorPosition({ x: window.innerWidth / 2, y: 150 })
                }
                updateCursorPos()
            }
            setInputValue('')
            if (externalMessages === undefined) {
                setInternalMessages([])
            }
            setTimeout(() => inputRef.current?.focus(), 100)
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [isOpen, position])

    const scrollToBottom = () => {
        messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
    }

    useEffect(() => {
        scrollToBottom()
    }, [messages])

    const handleSend = async () => {
        if (!inputValue.trim() || isLoading) return

        // If using external messages, don't add user message here - let parent handle it
        if (externalMessages === undefined) {
            const userMessage: SpotlightMessage = {
                id: Date.now().toString(),
                role: 'user',
                content: inputValue.trim(),
                timestamp: new Date()
            }
            setInternalMessages(prev => [...prev, userMessage])
        }

        setInputValue('')
        
        // Only show loading if not using external messages
        if (externalMessages === undefined) {
            setIsLoading(true)
            const loadingMessage: SpotlightMessage = {
                id: (Date.now() + 1).toString(),
                role: 'assistant',
                content: '',
                timestamp: new Date(),
                isLoading: true
            }
            setInternalMessages(prev => [...prev, loadingMessage])
        }

        try {
            if (onSendMessage) {
                console.log('[SpotlightModal] Sending message to AI...')
                const result = await onSendMessage(inputValue.trim(), initialContext)
                console.log('[SpotlightModal] Received result:', result)

                // Only update internal messages if not using external
                if (externalMessages === undefined) {
                    setInternalMessages(prev => prev.map(msg =>
                        msg.isLoading
                            ? {
                                ...msg,
                                content: result.response || 'Không có phản hồi từ AI',
                                isLoading: false,
                                actions: result.actions,
                                suggestions: result.suggestions
                            }
                            : msg
                    ))

                    // If there are actions that need confirmation, show preview
                    if (result.actions && result.actions.length > 0) {
                        setPendingAction(result.actions[0])
                        setShowPreview(true)
                    }
                }
            }
        } catch (error) {
            console.error('[SpotlightModal] Error:', error)
            if (externalMessages === undefined) {
                setInternalMessages(prev => prev.map(msg =>
                    msg.isLoading
                        ? { ...msg, content: 'Xin lỗi, đã xảy ra lỗi. Vui lòng thử lại.', isLoading: false }
                        : msg
                ))
            }
        } finally {
            if (externalMessages === undefined) {
                setIsLoading(false)
            }
        }
    }

    const handleConfirmAction = () => {
        // Emit event for the parent to handle the action
        if (pendingAction) {
            window.dispatchEvent(new CustomEvent('spotlight-action-confirm', {
                detail: pendingAction
            }))
        }
        setShowPreview(false)
        setPendingAction(null)
        onClose()
    }

    const handleRejectAction = () => {
        setShowPreview(false)
        setPendingAction(null)
    }

    const handleKeyPress = (e: React.KeyboardEvent) => {
        if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault()
            handleSend()
        }
        if (e.key === 'Escape') {
            onClose()
        }
    }

    const getActionIcon = (type: string) => {
        switch (type) {
            case 'emr_create':
            case 'emr_edit':
                return <DocumentTextIcon className="w-5 h-5" />
            case 'diagnosis':
                return <PencilIcon className="w-5 h-5" />
            case 'patient_info':
                return <UserGroupIcon className="w-5 h-5" />
            default:
                return <ChatBubbleLeftRightIcon className="w-5 h-5" />
        }
    }

    const getActionLabel = (type: string) => {
        switch (type) {
            case 'emr_create':
                return 'Tạo EMR mới'
            case 'emr_edit':
                return 'Chỉnh sửa EMR'
            case 'diagnosis':
                return 'Chẩn đoán bệnh'
            case 'prescription':
                return 'Kê đơn thuốc'
            case 'patient_info':
                return 'Thông tin bệnh nhân'
            default:
                return 'Hành động'
        }
    }

    if (!isOpen) return null

    // Calculate position - center horizontally, fixed Y from top
    const modalX = cursorPosition ? cursorPosition.x : window.innerWidth / 2
    const modalY = cursorPosition ? cursorPosition.y : 150

    return (
        <>
            {/* Backdrop with fade animation */}
            <div
                className="fixed inset-0 bg-black/60 z-40 animate-fadeIn"
                onClick={onClose}
                style={{
                    animation: 'fadeIn 0.15s ease-out forwards'
                }}
            />

            {/* Modal Container with scale animation */}
            <div
                className="fixed z-50 w-[600px] max-w-[90vw]"
                style={{
                    left: modalX,
                    top: modalY,
                    transform: 'translate(-50%, 0)',
                    animation: 'scaleIn 0.2s ease-out forwards'
                }}
            >
                {/* Spotlight Search Bar */}
                <div className="bg-white rounded-xl border-2 border-stone-900 shadow-[8px_8px_0_#1c1917] overflow-hidden">
                    {/* Header with icon */}
                    <div className="flex items-center gap-3 px-4 py-3 bg-gradient-to-r from-amber-500 to-amber-600 border-b-2 border-stone-900">
                        <div className="relative">
                            <SparklesIcon className="w-6 h-6 text-white animate-pulse" />
                            <div className="absolute -inset-1 bg-amber-400/50 rounded-full animate-ping" />
                        </div>
                        {/* Connection status indicator */}
                        {connectionStatus && connectionStatus === 'connected' && (
                            <span className="w-2.5 h-2.5 rounded-full bg-green-400 animate-pulse" />
                        )}
                        <input
                            ref={inputRef}
                            type="text"
                            value={inputValue}
                            onChange={(e) => setInputValue(e.target.value)}
                            onKeyDown={handleKeyPress}
                            placeholder="Hỏi AI, tạo EMR, chẩn đoán bệnh..."
                            disabled={isLoading || connectionStatus === 'disconnected' || connectionStatus === 'connecting'}
                            className="flex-1 bg-transparent text-white placeholder-white/70 text-lg font-medium focus:outline-none"
                        />
                        <kbd className="hidden sm:inline-flex items-center gap-1 px-2 py-1 bg-white/20 rounded text-xs text-white/80 font-mono">
                            Esc
                        </kbd>
                        <button
                            onClick={onClose}
                            className="p-1.5 hover:bg-white/20 rounded-lg transition-all hover:rotate-90"
                        >
                            <XMarkIcon className="w-5 h-5 text-white" />
                        </button>
                    </div>

                    {/* Messages / Results */}
                    <div className="max-h-[400px] overflow-y-auto bg-stone-50">
                        {messages.length === 0 ? (
                            <div className="p-6 text-center">
                                <div className="flex flex-col items-center gap-3">
                                    <div className="w-16 h-16 bg-amber-100 rounded-full flex items-center justify-center">
                                        <SparklesIcon className="w-8 h-8 text-amber-600" />
                                    </div>
                                    <div>
                                        <p className="text-stone-600 font-medium">
                                            Petties AI Assistant
                                        </p>
                                        <p className="text-stone-400 text-sm mt-1">
                                            Nhập yêu cầu của bạn...
                                        </p>
                                    </div>
                                    <div className="flex flex-wrap justify-center gap-2 mt-3">
                                        <button
                                            onClick={() => {
                                                setInputValue('Tạo EMR cho bé mèo')
                                                inputRef.current?.focus()
                                            }}
                                            className="px-3 py-1 bg-white border border-stone-300 rounded-full text-xs text-stone-600 hover:bg-amber-50 hover:border-amber-300 transition-colors"
                                        >
                                            "Tạo EMR cho bé mèo"
                                        </button>
                                        <button
                                            onClick={() => {
                                                setInputValue('Chẩn đoán bệnh')
                                                inputRef.current?.focus()
                                            }}
                                            className="px-3 py-1 bg-white border border-stone-300 rounded-full text-xs text-stone-600 hover:bg-amber-50 hover:border-amber-300 transition-colors"
                                        >
                                            "Chẩn đoán bệnh"
                                        </button>
                                        <button
                                            onClick={() => {
                                                setInputValue('Xem bệnh nhân')
                                                inputRef.current?.focus()
                                            }}
                                            className="px-3 py-1 bg-white border border-stone-300 rounded-full text-xs text-stone-600 hover:bg-amber-50 hover:border-amber-300 transition-colors"
                                        >
                                            "Xem bệnh nhân"
                                        </button>
                                    </div>
                                </div>
                            </div>
                        ) : (
                            <div className="p-4 space-y-3">
                                {messages.map((message) => (
                                    <div key={message.id}>
                                        {/* User Message */}
                                        {message.role === 'user' && (
                                            <div className="flex justify-end">
                                                <div className="max-w-[80%] px-4 py-2 bg-amber-500 text-white rounded-lg border border-stone-900 shadow-[2px_2px_0_#1c1917]">
                                                    <p className="text-sm">{message.content}</p>
                                                </div>
                                            </div>
                                        )}

                                        {/* Assistant Response */}
                                        {message.role === 'assistant' && (
                                            <div className="flex justify-start">
                                                <div className="max-w-[85%] px-4 py-3 bg-white rounded-lg border border-stone-900 shadow-[2px_2px_0_#1c1917]">
                                                    {message.isLoading ? (
                                                        <div className="flex items-center gap-2">
                                                            <ArrowPathIcon className="w-4 h-4 text-stone-400 animate-spin" />
                                                            <span className="text-sm text-stone-500">AI đang xử lý...</span>
                                                        </div>
                                                    ) : (
                                                        <>
                                                            <p className="text-sm text-stone-700 whitespace-pre-wrap">{message.content}</p>

                                                            {/* Suggested Actions */}
                                                            {message.actions && message.actions.length > 0 && (
                                                                <div className="mt-3 pt-3 border-t border-stone-200">
                                                                    <p className="text-xs font-bold text-stone-500 uppercase mb-2">
                                                                        Hành động được đề xuất:
                                                                    </p>
                                                                    <div className="space-y-2">
                                                                        {message.actions.map((action, idx) => (
                                                                            <button
                                                                                key={idx}
                                                                                onClick={() => {
                                                                                    setPendingAction(action)
                                                                                    setShowPreview(true)
                                                                                }}
                                                                                className="w-full flex items-center gap-2 px-3 py-2 bg-amber-50 border border-stone-300 rounded-lg hover:bg-amber-100 transition-colors text-left"
                                                                            >
                                                                                {getActionIcon(action.type)}
                                                                                <span className="text-sm font-medium text-stone-700">
                                                                                    {getActionLabel(action.type)}
                                                                                </span>
                                                                            </button>
                                                                        ))}
                                                                    </div>
                                                                </div>
                                                            )}

                                                            {/* Suggestions */}
                                                            {message.suggestions && message.suggestions.length > 0 && (
                                                                <div className="mt-3 pt-3 border-t border-stone-200">
                                                                    <p className="text-xs font-bold text-stone-500 uppercase mb-2">
                                                                        Gợi ý:
                                                                    </p>
                                                                    <div className="flex flex-wrap gap-2">
                                                                        {message.suggestions.map((suggestion, idx) => (
                                                                            <button
                                                                                key={idx}
                                                                                onClick={() => setInputValue(suggestion)}
                                                                                className="px-3 py-1 bg-stone-100 border border-stone-300 rounded-full text-xs text-stone-600 hover:bg-stone-200 transition-colors"
                                                                            >
                                                                                {suggestion}
                                                                            </button>
                                                                        ))}
                                                                    </div>
                                                                </div>
                                                            )}
                                                        </>
                                                    )}
                                                </div>
                                            </div>
                                        )}
                                    </div>
                                ))}
                                <div ref={messagesEndRef} />
                            </div>
                        )}
                    </div>

                    {/* Footer */}
                    <div className="flex items-center justify-between px-4 py-2 bg-stone-100 border-t border-stone-200">
                        <div className="flex items-center gap-2 text-xs text-stone-500">
                            <span className="px-2 py-0.5 bg-stone-200 rounded">Crtl</span>
                            <span>+</span>
                            <span className="px-2 py-0.5 bg-stone-200 rounded">Shift</span>
                            <span>+</span>
                            <span className="px-2 py-0.5 bg-stone-200 rounded">K</span>
                            <span>để mở/đóng</span>
                        </div>
                        <button
                            onClick={handleSend}
                            disabled={!inputValue.trim() || isLoading}
                            className="flex items-center gap-2 px-4 py-2 bg-amber-500 text-white font-bold rounded-lg border border-stone-900 shadow-[2px_2px_0_#1c1917] hover:bg-amber-600 hover:shadow-[3px_3px_0_#1c1917] hover:-translate-y-0.5 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                            <PaperAirplaneIcon className="w-4 h-4" />
                            <span className="text-sm">Gửi</span>
                        </button>
                    </div>
                </div>
            </div>

            {/* Preview Modal */}
            {showPreview && pendingAction && (
                <div className="fixed inset-0 z-50 flex items-center justify-center">
                    <div
                        className="absolute inset-0 bg-black/60 animate-fadeIn"
                        onClick={handleRejectAction}
                    />
                    <div className="relative bg-white rounded-xl border-2 border-stone-900 shadow-[8px_8px_0_#1c1917] w-[500px] max-w-[90vw] max-h-[80vh] overflow-hidden animate-scaleIn">
                        {/* Header */}
                        <div className="flex items-center gap-3 px-4 py-3 bg-gradient-to-r from-amber-500 to-amber-600 border-b-2 border-stone-900">
                            <ExclamationCircleIcon className="w-6 h-6 text-white" />
                            <h3 className="text-lg font-black text-white uppercase">
                                Xác nhận hành động
                            </h3>
                        </div>

                        {/* Content */}
                        <div className="p-4 max-h-[400px] overflow-y-auto">
                            <div className="flex items-center gap-2 mb-4">
                                {getActionIcon(pendingAction.type)}
                                <span className="font-bold text-stone-800">
                                    {getActionLabel(pendingAction.type)}
                                </span>
                            </div>

                            <div className="bg-stone-50 rounded-lg border border-stone-300 p-4">
                                <pre className="text-sm text-stone-700 whitespace-pre-wrap">
                                    {JSON.stringify(pendingAction.data, null, 2)}
                                </pre>
                            </div>
                        </div>

                        {/* Actions */}
                        <div className="flex justify-end gap-3 px-4 py-3 bg-stone-100 border-t border-stone-200">
                            <button
                                onClick={handleRejectAction}
                                className="px-4 py-2 bg-white text-stone-800 font-bold rounded-lg border-2 border-stone-900 shadow-[2px_2px_0_#1c1917] hover:bg-stone-50 hover:shadow-[3px_3px_0_#1c1917] hover:-translate-y-0.5 transition-all"
                            >
                                Hủy
                            </button>
                            <button
                                onClick={handleConfirmAction}
                                className="flex items-center gap-2 px-4 py-2 bg-green-500 text-white font-bold rounded-lg border-2 border-stone-900 shadow-[2px_2px_0_#1c1917] hover:bg-green-600 hover:shadow-[3px_3px_0_#1c1917] hover:-translate-y-0.5 transition-all"
                            >
                                <CheckCircleIcon className="w-5 h-5" />
                                Xác nhận
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </>
    )
}

export default SpotlightModal
