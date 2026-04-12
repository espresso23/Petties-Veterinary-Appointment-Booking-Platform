import { useEffect, useCallback } from 'react'

interface UseHotkeyOptions {
    enabled?: boolean
    onTrigger: () => void
}

export const useGlobalHotkey = ({ enabled = true, onTrigger }: UseHotkeyOptions) => {
    const handleKeyDown = useCallback((event: KeyboardEvent) => {
        // Ctrl + Shift + K (Command + Shift + K on Mac)
        if ((event.ctrlKey || event.metaKey) && event.shiftKey && event.code === 'KeyK') {
            event.preventDefault()
            if (enabled) {
                onTrigger()
            }
        }
    }, [enabled, onTrigger])

    useEffect(() => {
        window.addEventListener('keydown', handleKeyDown)
        return () => {
            window.removeEventListener('keydown', handleKeyDown)
        }
    }, [handleKeyDown])
}

export default useGlobalHotkey
