import { Navigate, Outlet, useLocation } from 'react-router-dom'
import { useAuthStore } from '../../store/authStore'
import type { UserRole } from '../../types'

interface RoleGuardProps {
    allowedRoles: UserRole[]
}

/**
 * RoleGuard component that protects routes based on user role.
 * Redirects unauthorized users to their appropriate dashboard.
 */
export const RoleGuard = ({ allowedRoles }: RoleGuardProps) => {
    const { isAuthenticated, user } = useAuthStore()
    const location = useLocation()

    // If not authenticated, redirect to login
    if (!isAuthenticated || !user) {
        return <Navigate to="/auth/login" state={{ from: location }} replace />
    }

    const userRole = user.role as UserRole

    // If user role is not allowed, redirect to their appropriate dashboard
    if (!allowedRoles.includes(userRole)) {
        const redirectPath = getRoleBasedPath(userRole)
        return <Navigate to={redirectPath} replace />
    }

    // User is authenticated and authorized
    return <Outlet />
}

/**
 * Get the appropriate dashboard path for a given role
 */
export const getRoleBasedPath = (role: UserRole): string => {
    switch (role) {
        case 'VET':
            return '/vet'
        case 'CLINIC_MANAGER':
            return '/clinic-manager'
        case 'CLINIC_OWNER':
            return '/clinic-owner'
        case 'ADMIN':
            return '/admin'
        case 'PET_OWNER':
            // PET_OWNER should not use web, redirect to login with message
            return '/auth/login?error=pet_owner_mobile_only'
        default:
            return '/auth/login'
    }
}

export default RoleGuard
