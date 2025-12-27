/**
 * ProtectedRoute - Route protection with role-based access
 * 
 * Now uses authStore directly for consistency
 * Usage:
 *   <ProtectedRoute allowedRoles={['ADMIN', 'VET']}>
 *     <AdminPage />
 *   </ProtectedRoute>
 */

import { Navigate, useLocation } from 'react-router-dom'
import { useAuthStore } from '../../store/authStore'
import { useEffect } from 'react'

interface ProtectedRouteProps {
    children: React.ReactNode
    allowedRoles?: string[]
    redirectTo?: string
}

export function ProtectedRoute({
    children,
    allowedRoles,
    redirectTo = '/auth/login'
}: ProtectedRouteProps) {
    const isAuthenticated = useAuthStore((state) => state.isAuthenticated)
    const user = useAuthStore((state) => state.user)
    const isLoading = useAuthStore((state) => state.isLoading)
    const validateTokens = useAuthStore((state) => state.validateTokens)
    const location = useLocation()

    // Validate tokens on mount
    useEffect(() => {
        validateTokens()
    }, [validateTokens])

    // Show loading while checking auth
    if (isLoading) {
        return (
            <div className="flex items-center justify-center h-screen">
                <div className="text-center">
                    <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-amber-600"></div>
                    <p className="mt-4 text-stone-600">Loading...</p>
                </div>
            </div>
        )
    }

    // Not authenticated - redirect to login
    if (!isAuthenticated) {
        return <Navigate to={redirectTo} state={{ from: location }} replace />
    }

    // Block PET_OWNER from web (mobile only)
    if (user?.role === 'PET_OWNER') {
        return <Navigate to="/auth/login?error=pet_owner_mobile_only" replace />
    }

    // Check role if specified
    if (allowedRoles && user) {
        if (!allowedRoles.includes(user.role)) {
            // User doesn't have required role - redirect to their dashboard
            const dashboardPath = getRoleDashboard(user.role)
            return <Navigate to={dashboardPath} replace />
        }
    }

    return <>{children}</>
}

/**
 * Get role-based dashboard path
 */
export function getRoleDashboard(role?: string): string {
    const dashboards: Record<string, string> = {
        'ADMIN': '/admin',
        'VET': '/vet',
        'CLINIC_MANAGER': '/clinic-manager',
        'CLINIC_OWNER': '/clinic-owner',
        // PET_OWNER blocked from web - mobile only
    }
    return dashboards[role || ''] || '/home'
}

export default ProtectedRoute
