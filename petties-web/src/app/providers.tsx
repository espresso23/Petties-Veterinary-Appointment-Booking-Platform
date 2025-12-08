import type { PropsWithChildren, ReactNode } from 'react'

type AppProvidersProps = PropsWithChildren<{
  fallback?: ReactNode
}>

/**
 * Global providers should be registered here so App.tsx stays lean.
 * Example: React Query, Theme, i18n, Analytics, etc.
 */
export function AppProviders({ children, fallback = null }: AppProvidersProps) {
  return <>{children ?? fallback}</>
}

