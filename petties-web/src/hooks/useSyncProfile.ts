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
    const fetchProfile = useUserStore((state) => state.fetchProfile)
    const clearProfile = useUserStore((state) => state.clearProfile)
    const profile = useUserStore((state) => state.profile)

    // Track previous user ID to detect user changes
    const prevUserIdRef = useRef<string | null>(null)

    // Track synced values to prevent infinite loops
    const syncedAvatarRef = useRef<string | undefined>(undefined)
    const syncedFullNameRef = useRef<string | undefined>(undefined)

    // Clear profile and fetch new one when user changes (logout/login different account)
    useEffect(() => {
        const currentUserId = user?.userId || null
        const prevUserId = prevUserIdRef.current

        // User changed (logged out, or logged in as different user)
        if (prevUserId !== null && prevUserId !== currentUserId) {
            clearProfile()
            // Reset sync tracking
            syncedAvatarRef.current = undefined
            syncedFullNameRef.current = undefined
        }

        // Fetch profile for new user
        if (user && (!profile || profile.userId !== user.userId)) {
            fetchProfile()
        }

        prevUserIdRef.current = currentUserId
    }, [user?.userId, profile?.userId, fetchProfile, clearProfile])

    // Sync profile data to authStore when profile is loaded
    // Use refs to prevent infinite loops
    useEffect(() => {
        if (user && profile && profile.userId === user.userId) {
            const avatarNeedsUpdate =
                profile.avatar !== user.avatar &&
                profile.avatar !== syncedAvatarRef.current

            const fullNameNeedsUpdate =
                profile.fullName !== user.fullName &&
                profile.fullName !== syncedFullNameRef.current

            if (avatarNeedsUpdate || fullNameNeedsUpdate) {
                const newAvatar = profile.avatar || undefined
                const newFullName = profile.fullName || user.fullName

                // Track what we're syncing to prevent re-syncing
                syncedAvatarRef.current = newAvatar
                syncedFullNameRef.current = newFullName

                useAuthStore.getState().setUser({
                    ...user,
                    avatar: newAvatar,
                    fullName: newFullName,
                })
            }
        }
    }, [user?.userId, user?.avatar, user?.fullName, profile?.userId, profile?.avatar, profile?.fullName])
}

