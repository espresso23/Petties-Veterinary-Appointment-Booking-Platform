import { create } from 'zustand'
import { devtools } from 'zustand/middleware'
import type { EmrAiDraft, EmrAiSoapField } from '../utils/emrAiDraftBridge'
import type { ChatStage, UISchemaV1 } from '../types/chat-copilot'

export interface AISessionMessage {
    id: string
    role: 'user' | 'assistant'
    content: string
    timestamp: Date
    images?: string[]
    isLoading?: boolean
    thinkingProcess?: string[]
    toolCalls?: Array<{ tool: string; input: unknown; output?: unknown }>
    uiSchema?: UISchemaV1
    stage?: ChatStage
}

interface AIChatState {
    sessionId: string | null
    messages: AISessionMessage[]
    connectionStatus: 'disconnected' | 'connecting' | 'connected'
    isOpen: boolean
    emrDraft: EmrAiDraft | null
    
    setSessionId: (sessionId: string | null) => void
    setMessages: (messages: AISessionMessage[] | ((prev: AISessionMessage[]) => AISessionMessage[])) => void
    addMessage: (message: AISessionMessage) => void
    updateLastMessage: (content: string, isLoading?: boolean) => void
    appendThinkingToLastMessage: (content: string) => void
    appendToolCallToLastMessage: (tool: string, input: unknown) => void
    attachToolResultToLastMessage: (tool: string | undefined, output: unknown) => void
    setConnectionStatus: (status: 'disconnected' | 'connecting' | 'connected') => void
    setIsOpen: (isOpen: boolean) => void
    setEmrDraft: (draft: EmrAiDraft | null) => void
    updateEmrDraftField: (field: EmrAiSoapField, value: string) => void
    clearMessages: () => void
}

export const useAIChatStore = create<AIChatState>()(
    devtools(
        (set) => ({
            sessionId: null,
            messages: [],
            connectionStatus: 'disconnected',
            isOpen: false,
            emrDraft: null,

            setSessionId: (sessionId) => set({ sessionId }),
            
            setMessages: (messages) => set((state) => ({
                messages: typeof messages === 'function' ? messages(state.messages) : messages
            })),
            
            addMessage: (message) => set((state) => ({
                messages: [...state.messages, message]
            })),
            
            updateLastMessage: (content, isLoading = false) => set((state) => {
                const messages = [...state.messages]
                const lastIndex = messages.length - 1
                
                // If last message is from assistant, update it
                if (lastIndex >= 0 && messages[lastIndex].role === 'assistant') {
                    messages[lastIndex] = {
                        ...messages[lastIndex],
                        content: content, // Replace content, not append
                        isLoading
                    } as AISessionMessage & { isLoading?: boolean }
                } else {
                    // No assistant message yet, add new one
                    messages.push({
                        id: `ai-${Date.now()}`,
                        role: 'assistant',
                        content,
                        timestamp: new Date(),
                        isLoading
                    })
                }
                
                return { messages }
            }),

            appendThinkingToLastMessage: (content) => set((state) => {
                if (!content.trim()) return state
                const messages = [...state.messages]
                const lastIndex = messages.length - 1
                if (lastIndex < 0 || messages[lastIndex].role !== 'assistant') {
                    return state
                }

                const lastMessage = messages[lastIndex]
                messages[lastIndex] = {
                    ...lastMessage,
                    thinkingProcess: [...(lastMessage.thinkingProcess || []), content],
                    isLoading: true,
                }
                return { messages }
            }),

            appendToolCallToLastMessage: (tool, input) => set((state) => {
                const messages = [...state.messages]
                const lastIndex = messages.length - 1
                if (lastIndex < 0 || messages[lastIndex].role !== 'assistant') {
                    return state
                }

                const lastMessage = messages[lastIndex]
                messages[lastIndex] = {
                    ...lastMessage,
                    toolCalls: [...(lastMessage.toolCalls || []), { tool, input, output: undefined }],
                    isLoading: true,
                }
                return { messages }
            }),

            attachToolResultToLastMessage: (tool, output) => set((state) => {
                const messages = [...state.messages]
                const lastIndex = messages.length - 1
                if (lastIndex < 0 || messages[lastIndex].role !== 'assistant') {
                    return state
                }

                const lastMessage = messages[lastIndex]
                const toolCalls = [...(lastMessage.toolCalls || [])]
                for (let i = toolCalls.length - 1; i >= 0; i -= 1) {
                    if (!tool || toolCalls[i].tool === tool) {
                        toolCalls[i] = { ...toolCalls[i], output }
                        break
                    }
                }

                messages[lastIndex] = {
                    ...lastMessage,
                    toolCalls,
                    isLoading: true,
                }
                return { messages }
            }),
            
            setConnectionStatus: (connectionStatus) => set({ connectionStatus }),
            
            setIsOpen: (isOpen) => set({ isOpen }),

            setEmrDraft: (emrDraft) => set({ emrDraft }),

            updateEmrDraftField: (field, value) => set((state) => {
                if (!state.emrDraft) return state
                return {
                    emrDraft: {
                        ...state.emrDraft,
                        [field]: value,
                        updated_at: new Date().toISOString(),
                    }
                }
            }),
            
            clearMessages: () => set({ messages: [] }),
        }),
        { name: 'ai-chat-store' }
    )
)
