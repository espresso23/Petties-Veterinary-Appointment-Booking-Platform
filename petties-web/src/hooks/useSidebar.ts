import { useState, useEffect } from 'react'

export type SidebarState = 'expanded' | 'collapsed'

const MOBILE_SIDEBAR_BREAKPOINT = 640

const getIsMobileViewport = () => window.innerWidth < MOBILE_SIDEBAR_BREAKPOINT

export const useSidebar = () => {
    // Get initial state from localStorage or default to 'expanded'
    const [state, setState] = useState<SidebarState>(() => {
        const saved = localStorage.getItem('sidebarState')
        if (getIsMobileViewport()) {
            return 'collapsed'
        }
        return (saved as SidebarState) || 'expanded'
    })

    const [isMobile, setIsMobile] = useState(getIsMobileViewport())

    useEffect(() => {
        const handleResize = () => {
            const mobile = getIsMobileViewport()
            setIsMobile(mobile)

            // Auto-collapse when entering narrow viewports so the backdrop never traps the page.
            if (mobile) {
                setState('collapsed')
                return
            }

            const saved = localStorage.getItem('sidebarState')
            if (saved === 'expanded' || saved === 'collapsed') {
                setState(saved)
            }
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
