/**
 * ProtectedRoute - Route protection with role-based access
 * 
 * Usage:
 *   <ProtectedRoute allowedRoles={['ADMIN', 'VET']}>
 *     <AdminPage />
 *   </ProtectedRoute>
 */

import { Navigate, useLocation } from 'react-router-dom'
import { useAuth } from '../hooks/useAuth'

interface ProtectedRouteProps {
    children: React.ReactNode
    allowedRoles?: string[]
    redirectTo?: string
}

export function ProtectedRoute({
    children,
    allowedRoles,
    redirectTo = '/login'
}: ProtectedRouteProps) {
    const { isAuthenticated, user, isLoading } = useAuth()
    const location = useLocation()

    // Show loading while checking auth
    if (isLoading) {
        return (
            <div style={{
                display: 'flex',
                justifyContent: 'center',
                alignItems: 'center',
                height: '100vh'
            }}>
                Loading...
            </div>
        )
    }

    // Not authenticated - redirect to login
    if (!isAuthenticated) {
        return <Navigate to={redirectTo} state={{ from: location }} replace />
    }

    // Check role if specified
    if (allowedRoles && user) {
        if (!allowedRoles.includes(user.role)) {
            // User doesn't have required role - redirect to their dashboard
            const roleRedirects: Record<string, string> = {
                'ADMIN': '/admin',
                'VET': '/vet',
                'CLINIC_MANAGER': '/clinic-manager',
                'CLINIC_OWNER': '/clinic-owner',
                'PET_OWNER': '/home',
            }
            return <Navigate to={roleRedirects[user.role] || '/home'} replace />
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
        'VET': '/vet/dashboard',
        'CLINIC_MANAGER': '/clinic-manager/dashboard',
        'CLINIC_OWNER': '/clinic-owner/dashboard',
        'PET_OWNER': '/home',
    }
    return dashboards[role || ''] || '/home'
}

export default ProtectedRoute
