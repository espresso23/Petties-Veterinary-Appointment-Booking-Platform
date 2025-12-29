import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.tsx'

// Initialize Sentry BEFORE rendering
import { initSentry, SentryErrorBoundary } from './lib/sentry'
initSentry()

// Error Fallback component
function ErrorFallback() {
  return (
    <div className="flex flex-col items-center justify-center min-h-screen bg-stone-50">
      <div className="bg-white border-4 border-black p-8 shadow-[8px_8px_0px_0px_rgba(0,0,0,1)] text-center">
        <h1 className="text-2xl font-black text-red-600 mb-4 uppercase">
          Oops! Something went wrong
        </h1>
        <p className="text-stone-600 mb-6">
          We've been notified and are working on it.
        </p>
        <button
          onClick={() => window.location.reload()}
          className="px-6 py-3 bg-amber-400 text-black font-bold border-4 border-black shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] hover:shadow-none hover:translate-x-1 hover:translate-y-1 transition-all cursor-pointer"
        >
          Reload Page
        </button>
      </div>
    </div>
  )
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <SentryErrorBoundary fallback={<ErrorFallback />}>
      <App />
    </SentryErrorBoundary>
  </StrictMode>,
)
