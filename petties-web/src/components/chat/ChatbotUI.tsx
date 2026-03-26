import { useState, useRef, useEffect, useCallback, type ReactNode } from 'react'
import { PaperAirplaneIcon, XMarkIcon, SparklesIcon, PhotoIcon, BoltIcon, PaperClipIcon, ArrowPathIcon } from '@heroicons/react/24/outline'
import { useToast } from '../../components/Toast'

export interface ChatMessage {
    id: string
    role: 'user' | 'assistant'
    content: string
    timestamp: Date
    isLoading?: boolean
    images?: string[]
    processingStatus?: string
    thinkingProcess?: string[]
    toolCalls?: Array<{ tool: string; input: unknown; output?: unknown }>
}

interface ImageUpload {
    file: File
    preview: string
    base64: string
    progress: number
    uploading: boolean
}

interface QuickAction {
    label: string
    icon: React.ComponentType<{ className?: string }>
    prompt: string
}

interface ChatbotUIProps {
    title?: string
    placeholder?: string
    onSendMessage?: (message: string, images?: string[]) => Promise<{ processingStatus?: string }>
    initialMessages?: ChatMessage[]
    onClose?: () => void
    quickActions?: QuickAction[]
    suggestedPrompts?: string[]
    onQuickAction?: (prompt: string) => void
    showHeader?: boolean
    contextPanel?: ReactNode
}

const MAX_IMAGES = 3

export const ChatbotUI = ({
    title = 'Petties AI Assistant',
    placeholder = 'Nhập tin nhắn của bạn...',
    onSendMessage,
    initialMessages = [],
    onClose,
    quickActions = [],
    suggestedPrompts = [],
    onQuickAction,
    showHeader = true,
    contextPanel,
}: ChatbotUIProps) => {
    const [messages, setMessages] = useState<ChatMessage[]>(initialMessages)
    const [inputValue, setInputValue] = useState('')
    const [isLoading, setIsLoading] = useState(false)
    const [selectedImages, setSelectedImages] = useState<ImageUpload[]>([])
    const [processingStatus, setProcessingStatus] = useState<string | null>(null)
    const fileInputRef = useRef<HTMLInputElement>(null)
    const attachInputRef = useRef<HTMLInputElement>(null)
    const messagesEndRef = useRef<HTMLDivElement>(null)
    const { showToast } = useToast()

    // Sync messages when initialMessages changes (for external updates like from store)
    useEffect(() => {
        if (initialMessages && initialMessages.length > 0) {
            setMessages(initialMessages)
        }
    }, [initialMessages])

    const scrollToBottom = () => {
        messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
    }

    useEffect(() => {
        scrollToBottom()
    }, [messages])

    const simulateUploadProgress = useCallback((index: number) => {
        let progress = 0
        const interval = setInterval(() => {
            progress += Math.random() * 30
            if (progress >= 100) {
                progress = 100
                clearInterval(interval)
                setSelectedImages(prev => prev.map((img, i) => 
                    i === index ? { ...img, progress: 100, uploading: false } : img
                ))
            } else {
                setSelectedImages(prev => prev.map((img, i) => 
                    i === index ? { ...img, progress } : img
                ))
            }
        }, 200)
        return interval
    }, [])

    const handleImageSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const files = e.target.files
        if (!files || files.length === 0) return

        const newImages: ImageUpload[] = []

        for (let i = 0; i < Math.min(files.length, MAX_IMAGES - selectedImages.length); i++) {
            const file = files[i]
            if (file.size > 5 * 1024 * 1024) {
                showToast('error', `Ảnh ${file.name} quá lớn (tối đa 5MB)`)
                continue
            }
            if (!file.type.startsWith('image/')) {
                showToast('error', `${file.name} không phải file ảnh`)
                continue
            }

            const reader = new FileReader()
            const base64 = await new Promise<string>((resolve) => {
                reader.onload = () => resolve(reader.result as string)
                reader.readAsDataURL(file)
            })

            const imageIndex = selectedImages.length + newImages.length
            newImages.push({
                file,
                preview: URL.createObjectURL(file),
                base64: base64.split(',')[1],
                progress: 0,
                uploading: true
            })

            setTimeout(() => {
                simulateUploadProgress(imageIndex)
            }, 100)
        }

        if (newImages.length > 0) {
            setSelectedImages(prev => [...prev, ...newImages].slice(0, MAX_IMAGES))
        }

        if (fileInputRef.current) {
            fileInputRef.current.value = ''
        }
    }

    const handleAttachSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const files = e.target.files
        if (!files || files.length === 0) return

        const newImages: ImageUpload[] = []

        for (let i = 0; i < Math.min(files.length, MAX_IMAGES - selectedImages.length); i++) {
            const file = files[i]
            
            const reader = new FileReader()
            const base64 = await new Promise<string>((resolve) => {
                reader.onload = () => resolve(reader.result as string)
                reader.readAsDataURL(file)
            })

            const imageIndex = selectedImages.length + newImages.length
            newImages.push({
                file,
                preview: URL.createObjectURL(file),
                base64: base64.split(',')[1],
                progress: 0,
                uploading: true
            })

            setTimeout(() => {
                simulateUploadProgress(imageIndex)
            }, 100)
        }

        if (newImages.length > 0) {
            setSelectedImages(prev => [...prev, ...newImages].slice(0, MAX_IMAGES))
        }

        if (attachInputRef.current) {
            attachInputRef.current.value = ''
        }
    }

    const removeImage = (index: number) => {
        setSelectedImages(prev => {
            const newImages = [...prev]
            URL.revokeObjectURL(newImages[index].preview)
            newImages.splice(index, 1)
            return newImages
        })
    }

    const handleSend = async () => {
        if (!inputValue.trim() && selectedImages.length === 0) return
        if (isLoading) return

        const hasImages = selectedImages.length > 0
        const userImages = selectedImages.map(img => img.base64)
        
        const userMessage: ChatMessage = {
            id: Date.now().toString(),
            role: 'user',
            content: inputValue.trim() || (hasImages ? '[Đã gửi ảnh]' : ''),
            timestamp: new Date(),
            images: userImages
        }

        setMessages(prev => [...prev, userMessage])
        setInputValue('')
        setSelectedImages([])
        setIsLoading(true)

        if (hasImages) {
            setProcessingStatus('Đang phân tích ảnh...')
            showToast('info', 'Đang phân tích ảnh...', 5000)
        }

        const loadingMessage: ChatMessage = {
            id: (Date.now() + 1).toString(),
            role: 'assistant',
            content: '',
            timestamp: new Date(),
            isLoading: true,
            processingStatus: hasImages ? 'Đang phân tích ảnh...' : undefined
        }
        setMessages(prev => [...prev, loadingMessage])

        try {
            if (onSendMessage) {
                const result = await onSendMessage(userMessage.content, userImages)
                if (result.processingStatus) {
                    setProcessingStatus(result.processingStatus)
                    showToast('info', result.processingStatus, 3000)
                }
            }
        } catch (error) {
            console.error('Error sending message:', error)
            setMessages(prev => prev.map(msg => 
                msg.id === loadingMessage.id 
                    ? { ...msg, content: 'Xin lỗi, đã xảy ra lỗi. Vui lòng thử lại.', isLoading: false }
                    : msg
            ))
            showToast('error', 'Đã xảy ra lỗi khi gửi tin nhắn')
        } finally {
            setIsLoading(false)
            setProcessingStatus(null)
        }
    }

    const handleKeyPress = (e: React.KeyboardEvent) => {
        if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault()
            handleSend()
        }
    }

    const handleQuickActionClick = (prompt: string) => {
        if (onQuickAction) {
            onQuickAction(prompt)
        } else {
            setInputValue(prompt)
        }
    }

    const isAllUploadsComplete = selectedImages.every(img => img.progress >= 100)

    return (
        <div className="flex h-full min-h-0 flex-col bg-white">
            {/* Header */}
            {showHeader && (
                <div className="flex items-center justify-between px-4 py-3 border-b-2 border-stone-900 bg-amber-500">
                    <div className="flex items-center gap-2">
                        <SparklesIcon className="w-5 h-5 text-white" />
                        <h2 className="text-lg font-black text-white uppercase tracking-wide">
                            {title}
                        </h2>
                    </div>
                    {onClose && (
                        <button 
                            onClick={onClose}
                            className="p-1 hover:bg-white/20 rounded-full transition-colors"
                        >
                            <XMarkIcon className="w-5 h-5 text-white" />
                        </button>
                    )}
                </div>
            )}

            {/* Processing Status */}
            {processingStatus && (
                <div className="px-4 py-2 bg-amber-100 border-b border-amber-200 flex items-center gap-2">
                    <ArrowPathIcon className="w-4 h-4 text-amber-600 animate-spin" />
                    <span className="text-sm font-medium text-amber-700">{processingStatus}</span>
                </div>
            )}

            {/* Messages Area */}
            <div className="min-h-0 flex-1 overflow-y-auto bg-stone-50 p-4 space-y-4">
                {contextPanel}

                {messages.length === 0 && (quickActions.length > 0 || suggestedPrompts.length > 0) ? (
                    <div className="flex flex-col">
                        {/* Welcome Message */}
                        <div className="text-center mb-6">
                            <div className="w-16 h-16 bg-amber-100 rounded-full flex items-center justify-center mx-auto mb-3">
                                <SparklesIcon className="w-8 h-8 text-amber-600" />
                            </div>
                            <h3 className="text-lg font-black text-stone-800">Xin chào!</h3>
                            <p className="text-stone-600 text-sm mt-1">
                                Tôi là trợ lý AI của Petties. Hãy hỏi tôi về thú cưng, dịch vụ, hoặc gửi ảnh để chẩn đoán bệnh nhé!
                            </p>
                        </div>

                        {/* Quick Actions */}
                        {quickActions.length > 0 && (
                            <div className="mb-4">
                                <p className="text-xs font-bold text-stone-500 uppercase mb-2">Thao tác nhanh</p>
                                <div className="grid grid-cols-2 gap-2">
                                    {quickActions.map((action, idx) => (
                                        <button
                                            key={idx}
                                            onClick={() => handleQuickActionClick(action.prompt)}
                                            className="flex items-center gap-2 rounded-xl border border-stone-200 bg-white px-3 py-2.5 text-left shadow-sm transition-all hover:bg-orange-50 hover:border-orange-200 hover:shadow-md"
                                        >
                                            <action.icon className="w-4 h-4 text-amber-600" />
                                            <span className="text-xs font-bold text-stone-700">{action.label}</span>
                                        </button>
                                    ))}
                                </div>
                            </div>
                        )}

                        {/* Suggested Prompts */}
                        {suggestedPrompts.length > 0 && (
                            <div>
                                <p className="text-xs font-bold text-stone-500 uppercase mb-2">Gợi ý câu hỏi</p>
                                <div className="flex flex-col gap-2">
                                    {suggestedPrompts.map((prompt, idx) => (
                                        <button
                                            key={idx}
                                            onClick={() => handleQuickActionClick(prompt)}
                                            className="flex items-center gap-2 rounded-xl border border-stone-200 bg-white px-3 py-2.5 text-left shadow-sm transition-all hover:bg-orange-50 hover:border-orange-200 hover:shadow-md"
                                        >
                                            <BoltIcon className="w-4 h-4 text-amber-500" />
                                            <span className="text-sm text-stone-600">{prompt}</span>
                                        </button>
                                    ))}
                                </div>
                            </div>
                        )}
                    </div>
                ) : messages.length === 0 ? (
                    <div className="flex min-h-[220px] flex-col items-center justify-center text-center space-y-3">
                        <div className="w-16 h-16 bg-amber-100 rounded-full flex items-center justify-center">
                            <SparklesIcon className="w-8 h-8 text-amber-600" />
                        </div>
                        <p className="text-stone-600 font-medium">
                            Xin chào! Tôi là trợ lý AI của Petties.
                        </p>
                        <p className="text-stone-400 text-sm">
                            Hãy hỏi tôi về thú cưng, dịch vụ, hoặc gửi ảnh để chẩn đoán bệnh nhé!
                        </p>
                    </div>
                ) : null}

                {messages.map((message) => (
                    <div 
                        key={message.id}
                        className={`flex ${message.role === 'user' ? 'justify-end' : 'justify-start'}`}
                    >
                        <div 
                            className={`max-w-[85%] rounded-2xl border-2 border-stone-900 shadow-[2px_2px_0_#1c1917] ${
                                message.role === 'user'
                                    ? 'bg-amber-500 text-white'
                                    : 'bg-white text-stone-800'
                            }`}
                        >
                            {/* Processing Status */}
                            {message.processingStatus && (
                                <div className="px-4 py-2 border-b border-stone-200 bg-amber-50 rounded-t-lg">
                                    <div className="flex items-center gap-2">
                                        <ArrowPathIcon className="w-4 h-4 text-amber-600 animate-spin" />
                                        <span className="text-xs font-medium text-amber-700">{message.processingStatus}</span>
                                    </div>
                                </div>
                            )}

                            {/* Images */}
                            {message.images && message.images.length > 0 && (
                                <div className="flex flex-wrap gap-2 p-2">
                                    {message.images.map((img, idx) => (
                                        <div key={idx} className="relative">
                                            <img 
                                                src={`data:image/jpeg;base64,${img}`} 
                                                alt={`Ảnh ${idx + 1}`}
                                                className="w-20 h-20 object-cover rounded-lg border border-stone-300"
                                            />
                                        </div>
                                    ))}
                                </div>
                            )}
                            
                            {/* Content */}
                            {message.isLoading ? (
                                <div className="flex items-center gap-2 px-4 py-3">
                                    <div className="flex gap-1">
                                        <span className="w-2 h-2 bg-amber-600 rounded-full animate-bounce" style={{ animationDelay: '0ms' }}></span>
                                        <span className="w-2 h-2 bg-amber-600 rounded-full animate-bounce" style={{ animationDelay: '150ms' }}></span>
                                        <span className="w-2 h-2 bg-amber-600 rounded-full animate-bounce" style={{ animationDelay: '300ms' }}></span>
                                    </div>
                                    <span className="text-sm text-amber-600 font-medium">AI đang suy nghĩ...</span>
                                </div>
                            ) : (
                                <p className="text-sm whitespace-pre-wrap px-4 py-3">{message.content}</p>
                            )}

                            {!message.isLoading && message.role === 'assistant' && ((message.thinkingProcess?.length || 0) > 0 || (message.toolCalls?.length || 0) > 0) && (
                                <div className="border-t border-stone-200 px-4 py-3 space-y-3">
                                    {(message.thinkingProcess?.length || 0) > 0 && (
                                        <div className="rounded-xl border border-cyan-200 bg-cyan-50 p-3">
                                            <p className="text-[11px] font-bold uppercase tracking-wide text-cyan-800">Đang phân tích</p>
                                            <div className="mt-2 space-y-1">
                                                {message.thinkingProcess?.map((step, index) => (
                                                    <p key={`${message.id}-thinking-${index}`} className="text-xs text-cyan-900">
                                                        {step}
                                                    </p>
                                                ))}
                                            </div>
                                        </div>
                                    )}

                                    {(message.toolCalls?.length || 0) > 0 && (
                                        <div className="space-y-2">
                                            {message.toolCalls?.map((call, index) => (
                                                <div key={`${message.id}-tool-${index}`} className="rounded-xl border border-stone-200 bg-stone-50 p-3">
                                                    <p className="text-[11px] font-bold uppercase tracking-wide text-stone-700">
                                                        Tool: {call.tool}
                                                    </p>
                                                    <pre className="mt-2 overflow-x-auto whitespace-pre-wrap text-[11px] text-stone-600">
                                                        {JSON.stringify(call.input ?? {}, null, 2)}
                                                    </pre>
                                                    {typeof call.output !== 'undefined' && (
                                                        <pre className="mt-2 overflow-x-auto whitespace-pre-wrap rounded-lg bg-white p-2 text-[11px] text-stone-700">
                                                            {JSON.stringify(call.output, null, 2)}
                                                        </pre>
                                                    )}
                                                </div>
                                            ))}
                                        </div>
                                    )}
                                </div>
                            )}
                        </div>
                    </div>
                ))}
                <div ref={messagesEndRef} />
            </div>

            {/* Selected Images Preview with Progress */}
            {selectedImages.length > 0 && (
                <div className="shrink-0 border-t border-stone-200 bg-stone-50 px-3 py-2">
                    <div className="flex flex-wrap gap-2">
                        {selectedImages.map((img, idx) => (
                            <div key={idx} className="relative group">
                                <img 
                                    src={img.preview} 
                                    alt={`Preview ${idx + 1}`}
                                    className="w-16 h-16 object-cover rounded-lg border border-stone-300"
                                />
                                {/* Progress bar overlay */}
                                {img.uploading && (
                                    <div className="absolute inset-0 bg-black/50 rounded-lg flex items-center justify-center">
                                        <div className="w-12 bg-stone-700 rounded-full h-1.5 overflow-hidden">
                                            <div 
                                                className="h-full bg-amber-500 transition-all duration-200"
                                                style={{ width: `${img.progress}%` }}
                                            />
                                        </div>
                                    </div>
                                )}
                                {/* Checkmark when complete */}
                                {!img.uploading && img.progress >= 100 && (
                                    <div className="absolute -top-1 -right-1 w-4 h-4 bg-green-500 rounded-full flex items-center justify-center">
                                        <svg className="w-3 h-3 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                                        </svg>
                                    </div>
                                )}
                                <button
                                    onClick={() => removeImage(idx)}
                                    className="absolute -top-2 -right-2 w-5 h-5 bg-red-500 text-white rounded-full flex items-center justify-center text-xs font-bold hover:bg-red-600 opacity-0 group-hover:opacity-100 transition-opacity"
                                >
                                    ×
                                </button>
                            </div>
                        ))}
                    </div>
                </div>
            )}

            {/* Input Area */}
            <div className="shrink-0 border-t-2 border-stone-900 bg-white p-3">
                <div className="flex gap-2 items-center">
                    {/* Photo Upload Button - Primary */}
                    <input
                        type="file"
                        ref={fileInputRef}
                        onChange={handleImageSelect}
                        accept="image/*"
                        multiple
                        className="hidden"
                    />
                    <button
                        onClick={() => fileInputRef.current?.click()}
                        disabled={isLoading || selectedImages.length >= MAX_IMAGES}
                        className="flex items-center gap-1.5 rounded-xl bg-orange-600 px-3 py-2.5 text-sm font-bold text-white shadow-lg shadow-orange-100 transition-all hover:bg-orange-700 active:scale-95 disabled:cursor-not-allowed disabled:opacity-50"
                        title={`Gửi ảnh (tối đa ${MAX_IMAGES} ảnh)`}
                    >
                        <PhotoIcon className="w-5 h-5" />
                        <span className="text-sm">Ảnh</span>
                    </button>
                    
                    {/* Attach Button */}
                    <input
                        type="file"
                        ref={attachInputRef}
                        onChange={handleAttachSelect}
                        accept="*"
                        multiple
                        className="hidden"
                    />
                    <button
                        onClick={() => attachInputRef.current?.click()}
                        disabled={isLoading}
                        className="rounded-xl border border-stone-200 bg-stone-50 p-2.5 shadow-sm transition-all hover:bg-stone-100 hover:shadow-md disabled:cursor-not-allowed disabled:opacity-50"
                        title="Đính kèm file"
                    >
                        <PaperClipIcon className="w-5 h-5 text-stone-700" />
                    </button>
                    
                    {/* Text Input */}
                    <input
                        type="text"
                        value={inputValue}
                        onChange={(e) => setInputValue(e.target.value)}
                        onKeyPress={handleKeyPress}
                        placeholder={placeholder}
                        disabled={isLoading}
                        className="flex-1 rounded-xl border border-stone-200 bg-white px-4 py-2.5 text-sm text-stone-700 shadow-sm transition-all focus:border-amber-500 focus:outline-none focus:ring-4 focus:ring-amber-500/10 disabled:cursor-not-allowed disabled:bg-stone-100"
                    />
                    
                    {/* Send Button */}
                    <button
                        onClick={handleSend}
                        disabled={(!inputValue.trim() && selectedImages.length === 0) || isLoading || !isAllUploadsComplete}
                        className="rounded-xl bg-emerald-500 px-4 py-2.5 font-bold text-white shadow-lg shadow-emerald-100 transition-all hover:bg-emerald-600 active:scale-95 disabled:cursor-not-allowed disabled:opacity-50"
                    >
                        <PaperAirplaneIcon className="w-5 h-5" />
                    </button>
                </div>
            </div>
        </div>
    )
}

export default ChatbotUI
