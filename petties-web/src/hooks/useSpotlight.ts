import { useState, useCallback } from 'react'

export interface SpotlightState {
    isOpen: boolean
    position: { x: number; y: number } | null
    context: Record<string, unknown> | null
}

export const useSpotlight = () => {
    const [state, setState] = useState<SpotlightState>({
        isOpen: false,
        position: null,
        context: null
    })

    const open = useCallback((position?: { x: number; y: number }, context?: Record<string, unknown>) => {
        setState({
            isOpen: true,
            position: position || { x: window.innerWidth / 2, y: 150 },
            context: context || null
        })
    }, [])

    const close = useCallback(() => {
        setState(prev => ({
            ...prev,
            isOpen: false
        }))
    }, [])

    const toggle = useCallback((position?: { x: number; y: number }, context?: Record<string, unknown>) => {
        setState(prev => {
            if (prev.isOpen) {
                return { ...prev, isOpen: false }
            }
            return {
                isOpen: true,
                position: position || { x: window.innerWidth / 2, y: 150 },
                context: context || null
            }
        })
    }, [])

    const setContext = useCallback((context: Record<string, unknown>) => {
        setState(prev => ({ ...prev, context }))
    }, [])

    return {
        isOpen: state.isOpen,
        position: state.position,
        context: state.context,
        open,
        close,
        toggle,
        setContext
    }
}

export default useSpotlight
