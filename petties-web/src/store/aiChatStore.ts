import { create } from 'zustand'
import { devtools } from 'zustand/middleware'

export interface AISessionMessage {
    id: string
    role: 'user' | 'assistant'
    content: string
    timestamp: Date
    images?: string[]
}

interface AIChatState {
    sessionId: string | null
    messages: AISessionMessage[]
    connectionStatus: 'disconnected' | 'connecting' | 'connected'
    isOpen: boolean
    
    setSessionId: (sessionId: string | null) => void
    setMessages: (messages: AISessionMessage[]) => void
    addMessage: (message: AISessionMessage) => void
    updateLastMessage: (content: string, isLoading?: boolean) => void
    setConnectionStatus: (status: 'disconnected' | 'connecting' | 'connected') => void
    setIsOpen: (isOpen: boolean) => void
    clearMessages: () => void
}

export const useAIChatStore = create<AIChatState>()(
    devtools(
        (set) => ({
            sessionId: null,
            messages: [],
            connectionStatus: 'disconnected',
            isOpen: false,

            setSessionId: (sessionId) => set({ sessionId }),
            
            setMessages: (messages) => set({ messages }),
            
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
                        content: messages[lastIndex].content + content,
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
            
            setConnectionStatus: (connectionStatus) => set({ connectionStatus }),
            
            setIsOpen: (isOpen) => set({ isOpen }),
            
            clearMessages: () => set({ messages: [] }),
        }),
        { name: 'ai-chat-store' }
    )
)
