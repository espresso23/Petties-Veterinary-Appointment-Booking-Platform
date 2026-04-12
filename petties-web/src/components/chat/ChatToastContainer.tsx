import { useChatToastStore } from '../../store/chatToastStore'
import { ChatToastItem } from './ChatToastItem'

export const ChatToastContainer = () => {
    const toasts = useChatToastStore((state) => state.toasts)

    if (toasts.length === 0) return null

    return (
        <div className="fixed bottom-6 right-6 z-[9999] flex flex-col gap-4 items-end pointer-events-none">
            {toasts.map((toast) => (
                <div key={toast.id} className="pointer-events-auto">
                    <ChatToastItem toast={toast} />
                </div>
            ))}
        </div>
    )
}
