/**
 * Sentry Error Tracking Configuration
 * Auto-reports errors to Slack via Sentry integration
 */
import * as Sentry from '@sentry/react'

/**
 * Initialize Sentry SDK
 * Call this in main.tsx BEFORE rendering the app
 */
export const initSentry = () => {
    // Only enable in production
    if (!import.meta.env.PROD) {
        console.log('⚠️ Sentry disabled in development mode')
        return
    }

    const dsn = import.meta.env.VITE_SENTRY_DSN
    if (!dsn) {
        console.log('⚠️ Sentry DSN not configured, error tracking disabled')
        return
    }

    Sentry.init({
        dsn,

        // Performance monitoring
        integrations: [
            Sentry.browserTracingIntegration(),
            Sentry.replayIntegration({
                // Capture 10% of sessions, 100% of sessions with errors
                maskAllText: false,
                blockAllMedia: false,
            }),
        ],

        // Sample rates for production
        tracesSampleRate: 0.1, // 10% of requests
        replaysSessionSampleRate: 0.1, // 10% of sessions
        replaysOnErrorSampleRate: 1.0, // 100% of sessions with errors

        // Environment
        environment: import.meta.env.MODE,

        // Release version
        release: `petties-web@${import.meta.env.VITE_APP_VERSION || '1.0.0'}`,

        // Filter sensitive data before sending
        beforeSend(event) {
            // Remove sensitive data from request
            if (event.request?.data) {
                const data = event.request.data
                if (typeof data === 'string') {
                    event.request.data = data.replace(
                        /"(password|token|apiKey|accessToken|refreshToken)":\s*"[^"]*"/g,
                        '"$1":"[REDACTED]"'
                    )
                }
            }

            // Remove sensitive headers
            if (event.request?.headers) {
                const sensitiveHeaders = ['authorization', 'cookie', 'x-api-key']
                sensitiveHeaders.forEach(header => {
                    if (event.request?.headers?.[header]) {
                        event.request.headers[header] = '[REDACTED]'
                    }
                })
            }

            return event
        },
    })

    console.log('✅ Sentry initialized')
}

/**
 * Set user context for error tracking
 * Call this after successful login
 */
export const setSentryUser = (user: {
    id: string
    email?: string
    role?: string
}) => {
    Sentry.setUser({
        id: user.id,
        email: user.email,
        role: user.role,
    })
}

/**
 * Clear user context
 * Call this on logout
 */
export const clearSentryUser = () => {
    Sentry.setUser(null)
}

/**
 * Manually capture exception
 * Use for caught errors that should be reported
 */
export const captureError = (
    error: Error,
    context?: Record<string, unknown>
) => {
    Sentry.captureException(error, {
        extra: context,
    })
}

/**
 * Manually capture message
 * Use for important events that aren't errors
 */
export const captureMessage = (
    message: string,
    level: 'info' | 'warning' | 'error' = 'info',
    context?: Record<string, unknown>
) => {
    Sentry.captureMessage(message, {
        level,
        extra: context,
    })
}

/**
 * Add breadcrumb for debugging
 * Creates a trail of events leading up to an error
 */
export const addBreadcrumb = (
    message: string,
    category: string = 'info',
    data?: Record<string, unknown>
) => {
    Sentry.addBreadcrumb({
        message,
        category,
        data,
        level: 'info',
    })
}

// Re-export ErrorBoundary for use in components
export const SentryErrorBoundary = Sentry.ErrorBoundary
