import { SparklesIcon, XMarkIcon } from '@heroicons/react/24/outline'

interface MascotLauncherProps {
  isOpen: boolean
  onToggle: () => void
}

export const MascotLauncher = ({ isOpen, onToggle }: MascotLauncherProps) => {
  return (
    <div className="fixed bottom-6 right-6 z-40 flex flex-col items-end gap-2">
      {!isOpen && (
        <div className="rounded-lg border-2 border-stone-900 bg-white px-3 py-2 text-xs font-bold text-stone-700 shadow-[3px_3px_0_#1c1917]">
          Trợ lý Petties
        </div>
      )}

      <button
        type="button"
        onClick={onToggle}
        className="group flex h-14 w-14 items-center justify-center rounded-full border-2 border-stone-900 bg-amber-500 text-white shadow-[4px_4px_0_#1c1917] transition-all hover:-translate-y-0.5 hover:bg-amber-600 hover:shadow-[5px_5px_0_#1c1917]"
        aria-label={isOpen ? 'Đóng trợ lý Petties' : 'Mở trợ lý Petties'}
        title={isOpen ? 'Đóng trợ lý Petties' : 'Mở trợ lý Petties'}
      >
        {isOpen ? (
          <XMarkIcon className="h-6 w-6" />
        ) : (
          <SparklesIcon className="h-6 w-6 transition-transform group-hover:scale-110" />
        )}
      </button>
    </div>
  )
}

export default MascotLauncher
