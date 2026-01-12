import { useEffect, useRef } from 'react'
import { useAuthStore } from '../store/authStore'
import { useUserStore } from '../store/userStore'

/**
 * Hook to auto-sync user profile from API to authStore
 * This ensures Sidebar displays the latest avatar and fullName
 * 
 * Call this hook in layout components to auto-fetch profile on app load
 */
export const useSyncProfile = () => {
    const user = useAuthStore((state) => state.user)
    const setUser = useAuthStore((state) => state.setUser)
    const fetchProfile = useUserStore((state) => state.fetchProfile)
    const clearProfile = useUserStore((state) => state.clearProfile)
    const profile = useUserStore((state) => state.profile)

    // Track previous user ID to detect user changes
    const prevUserIdRef = useRef<string | null>(null)

    // Clear profile and fetch new one when user changes (logout/login different account)
    useEffect(() => {
        const currentUserId = user?.userId || null
        const prevUserId = prevUserIdRef.current

        // User changed (logged out, or logged in as different user)
        if (prevUserId !== null && prevUserId !== currentUserId) {
            clearProfile()
        }

        // Fetch profile for new user
        if (user && (!profile || profile.userId !== user.userId)) {
            fetchProfile()
        }

        prevUserIdRef.current = currentUserId
    }, [user, profile, fetchProfile, clearProfile])

    // Sync profile data to authStore when profile is loaded
    useEffect(() => {
        if (user && profile && profile.userId === user.userId) {
            const needsUpdate =
                profile.avatar !== user.avatar ||
                profile.fullName !== user.fullName

            if (needsUpdate) {
                setUser({
                    ...user,
                    avatar: profile.avatar || undefined,
                    fullName: profile.fullName || user.fullName,
                })
            }
        }
    }, [user, profile, setUser])
}

