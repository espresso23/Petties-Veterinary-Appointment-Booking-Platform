import { useEffect, useState } from 'react'
import { ExclamationTriangleIcon } from '@heroicons/react/24/solid'

interface SandboxHeaderProps {
  clinicName?: string
  onExit: () => void | Promise<void>
}

/**
 * SandboxHeader Component
 * Banner displayed at the top of the page when user is in sandbox mode
 *
 * Visual cues:
 * - Orange/Amber background to clearly distinguish from production
 * - Warning icon with clear text
 * - Exit button to leave sandbox mode
 *
 * Styling: Soft Neobrutalism with amber-500 accent
 */
export function SandboxHeader({ clinicName, onExit }: SandboxHeaderProps) {
  const [isExiting, setIsExiting] = useState(false)

  const handleExit = async () => {
    if (isExiting) {
      return
    }

    try {
      setIsExiting(true)
      await onExit()
    } finally {
      setIsExiting(false)
    }
  }

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key !== 'Escape') {
        return
      }

      event.preventDefault()
      void handleExit()
    }

    window.addEventListener('keydown', onKeyDown)
    return () => {
      window.removeEventListener('keydown', onKeyDown)
    }
  }, [isExiting])

  return (
    <>
      <div className="sticky top-0 z-50 w-full bg-amber-500 border-b-2 border-stone-900 px-6 py-4 shadow-md" data-sandbox-header="true">
      <div className="max-w-7xl mx-auto flex items-center gap-4">
        {/* Warning Icon */}
        <ExclamationTriangleIcon className="h-6 w-6 text-stone-900 flex-shrink-0" />

        {/* Main Text */}
        <div className="flex-1">
          <div className="font-bold text-lg uppercase text-stone-900">Bạn đang ở chế độ dùng thử</div>
          <div className="text-sm text-stone-800 mt-1">
            Dữ liệu ở đây sẽ không hiển thị với khách hàng
            {clinicName ? (
              <>
                {' '}
                • <strong>{clinicName}</strong>
              </>
            ) : null}
          </div>
        </div>

        {/* Exit Button */}
        <button
          onClick={() => {
            void handleExit()
          }}
          disabled={isExiting}
          data-sandbox-exit="true"
          className="flex-shrink-0 bg-white text-stone-900 border-2 border-stone-900 px-4 py-2 font-bold text-sm uppercase rounded-lg shadow-[2px_2px_0_#1c1917] hover:shadow-[4px_4px_0_#1c1917] hover:-translate-y-0.5 transition-all"
        >
          {isExiting ? 'Đang thoát...' : 'Thoát'}
        </button>
      </div>
      </div>

      <button
        onClick={() => {
          void handleExit()
        }}
        disabled={isExiting}
        data-sandbox-exit="true"
        className="fixed bottom-5 right-5 z-[60] bg-amber-500 text-stone-900 border-2 border-stone-900 px-4 py-3 font-bold text-xs uppercase rounded-lg shadow-[3px_3px_0_#1c1917] hover:shadow-[5px_5px_0_#1c1917] hover:-translate-y-0.5 transition-all"
      >
        {isExiting ? 'Đang thoát...' : 'Thoát sandbox'}
      </button>
    </>
  )
}
