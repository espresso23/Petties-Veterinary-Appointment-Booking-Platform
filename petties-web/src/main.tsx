import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.tsx'

// Error Fallback component
// eslint-disable-next-line react-refresh/only-export-components
function ErrorFallback() {
  return (
    <div className="flex flex-col items-center justify-center min-h-screen bg-stone-50">
      <div className="bg-white border-4 border-black p-8 shadow-[8px_8px_0px_0px_rgba(0,0,0,1)] text-center">
        <h1 className="text-2xl font-black text-red-600 mb-4 uppercase">Đã xảy ra lỗi</h1>
        <p className="text-stone-600 mb-6">
          Hệ thống đã ghi nhận sự cố. Vui lòng tải lại trang để tiếp tục.
        </p>
        <button
          onClick={() => window.location.reload()}
          className="px-6 py-3 bg-amber-400 text-black font-bold border-4 border-black shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] hover:shadow-none hover:translate-x-1 hover:translate-y-1 transition-all cursor-pointer"
        >
          Tải lại trang
        </button>
      </div>
    </div>
  )
}

async function bootstrap() {
  let app = <App />

  if (import.meta.env.PROD) {
    try {
      const { initSentry, SentryErrorBoundary } = await import('./lib/sentry')
      initSentry()
      app = <SentryErrorBoundary fallback={<ErrorFallback />}>{app}</SentryErrorBoundary>
    } catch (error) {
      console.error('Failed to initialize Sentry', error)
    }
  }

  createRoot(document.getElementById('root')!).render(
    <StrictMode>{app}</StrictMode>,
  )
}

void bootstrap()
