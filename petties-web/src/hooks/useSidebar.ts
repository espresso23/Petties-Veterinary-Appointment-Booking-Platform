import { useState, useEffect } from 'react'

export type SidebarState = 'expanded' | 'collapsed'

export const useSidebar = () => {
    // Get initial state from localStorage or default to 'expanded'
    const [state, setState] = useState<SidebarState>(() => {
        const saved = localStorage.getItem('sidebarState')
        // On mobile, we might still want it hidden by default, but let's stick to the 2 states requested
        return (saved as SidebarState) || 'expanded'
    })

    const [isMobile, setIsMobile] = useState(window.innerWidth < 1024)

    useEffect(() => {
        const handleResize = () => {
            const mobile = window.innerWidth < 1024
            setIsMobile(mobile)
        }

        window.addEventListener('resize', handleResize)
        return () => window.removeEventListener('resize', handleResize)
    }, [])

    const toggleSidebar = () => {
        const newState: SidebarState = state === 'expanded' ? 'collapsed' : 'expanded'
        setState(newState)
        if (!isMobile) {
            localStorage.setItem('sidebarState', newState)
        }
    }

    const setSidebarState = (newState: SidebarState) => {
        setState(newState)
        if (!isMobile) {
            localStorage.setItem('sidebarState', newState)
        }
    }

    return { state, toggleSidebar, setSidebarState, isMobile }
}
