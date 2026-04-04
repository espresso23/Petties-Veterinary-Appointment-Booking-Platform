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
    // Use refs and careful normalization to prevent infinite loops
    useEffect(() => {
        if (user && profile && profile.userId === user.userId) {
            // Normalize values to undefined for consistent comparison
            const profileAvatar = profile.avatar || undefined
            const userAvatar = user.avatar || undefined
            const profileFullName = profile.fullName || user.fullName
            const userFullName = user.fullName

            const avatarNeedsUpdate =
                profileAvatar !== userAvatar &&
                profileAvatar !== syncedAvatarRef.current

            const fullNameNeedsUpdate =
                profileFullName !== userFullName &&
                profileFullName !== syncedFullNameRef.current

            if (avatarNeedsUpdate || fullNameNeedsUpdate) {
                // Track what we're syncing before updating store
                syncedAvatarRef.current = profileAvatar
                syncedFullNameRef.current = profileFullName

                useAuthStore.getState().setUser({
                    ...user,
                    avatar: profileAvatar,
                    fullName: profileFullName,
                })
            }
        }
    }, [user?.userId, user?.avatar, user?.fullName, profile?.userId, profile?.avatar, profile?.fullName])
}