import { Navigate } from 'react-router-dom'
import { useAuthStore } from '../../store/authStore'
import { getRoleBasedPath } from './RoleGuard'
import type { UserRole } from '../../types'

/**
 * RoleBasedRedirect component that redirects authenticated users
 * to their appropriate dashboard based on their role.
 */
export const RoleBasedRedirect = () => {
    const { isAuthenticated, user } = useAuthStore()

    // If not authenticated, redirect to login
    if (!isAuthenticated || !user) {
        return <Navigate to="/auth/login" replace />
    }

    // Redirect to role-specific dashboard
    const redirectPath = getRoleBasedPath(user.role as UserRole)
    return <Navigate to={redirectPath} replace />
}

export default RoleBasedRedirect
