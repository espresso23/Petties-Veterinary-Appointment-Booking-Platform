import { useState, useCallback } from 'react'

export interface MascotPanelState {
    isOpen: boolean
    context: Record<string, unknown> | null
}

export const useMascotPanel = () => {
    const [state, setState] = useState<MascotPanelState>({
        isOpen: false,
        context: null
    })

    const open = useCallback((context?: Record<string, unknown>) => {
        setState({
            isOpen: true,
            context: context || null
        })
    }, [])

    const close = useCallback(() => {
        setState(prev => ({
            ...prev,
            isOpen: false
        }))
    }, [])

    const toggle = useCallback((context?: Record<string, unknown>) => {
        setState(prev => {
            if (prev.isOpen) {
                return { ...prev, isOpen: false }
            }
            return {
                isOpen: true,
                context: context || null
            }
        })
    }, [])

    const setContext = useCallback((context: Record<string, unknown>) => {
        setState(prev => ({ ...prev, context }))
    }, [])

    return {
        isOpen: state.isOpen,
        context: state.context,
        open,
        close,
        toggle,
        setContext
    }
}

export default useMascotPanel
