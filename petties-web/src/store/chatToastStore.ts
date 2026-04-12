import { create } from 'zustand'
import type { ChatMessage } from '../types/chat'

export interface ChatToastMessage extends ChatMessage {
    replyContent?: string
    isSendingReply?: boolean
}

interface ChatToastState {
    toasts: ChatToastMessage[]
    addToast: (message: ChatMessage) => void
    removeToast: (id: string) => void
    updateToastReply: (id: string, content: string) => void
    setSendingReply: (id: string, isSending: boolean) => void
}

export const useChatToastStore = create<ChatToastState>((set) => ({
    toasts: [],

    addToast: (message) => set((state) => {
        // Limit to max 5 toasts, remove oldest if needed
        const currentToasts = state.toasts
        const newToast: ChatToastMessage = { ...message, replyContent: '', isSendingReply: false }

        // Avoid duplicates if same message ID comes in
        if (currentToasts.some(t => t.id === message.id)) {
            return { toasts: currentToasts }
        }

        let updatedToasts = [...currentToasts, newToast]
        if (updatedToasts.length > 5) {
            updatedToasts = updatedToasts.slice(updatedToasts.length - 5)
        }

        return { toasts: updatedToasts }
    }),

    removeToast: (id) => set((state) => ({
        toasts: state.toasts.filter(t => t.id !== id)
    })),

    updateToastReply: (id, content) => set((state) => ({
        toasts: state.toasts.map(t =>
            t.id === id ? { ...t, replyContent: content } : t
        )
    })),

    setSendingReply: (id, isSending) => set((state) => ({
        toasts: state.toasts.map(t =>
            t.id === id ? { ...t, isSendingReply: isSending } : t
        )
    })),
}))
