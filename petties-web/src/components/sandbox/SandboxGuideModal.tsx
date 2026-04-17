interface SandboxGuideModalProps {
  isOpen: boolean
  featureName: string
  onConfirm: () => void
  onCancel: () => void
  isLoading?: boolean
}

/**
 * SandboxGuideModal Component
 * Modal dialog asking user if they want to enter sandbox mode for a specific feature
 *
 * Styling: Soft Neobrutalism (amber-50 background, 2px black border, offset shadows)
 */
export function SandboxGuideModal({
  isOpen,
  featureName,
  onConfirm,
  onCancel,
  isLoading = false,
}: SandboxGuideModalProps) {
  if (!isOpen) return null

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50" data-sandbox-modal="true">
      <div className="border-2 border-stone-900 rounded-xl p-8 bg-amber-50 shadow-[4px_4px_0_#1c1917] max-w-md">
        <h2 className="font-bold text-2xl mb-4 uppercase">Muốn vào chế độ dùng thử?</h2>

        <p className="mb-6 text-base">
          Bạn muốn vào chế độ sandbox để tập làm quen với tính năng <strong>{featureName}</strong> này không?
        </p>

        <div className="bg-blue-50 border-2 border-blue-200 rounded-lg p-4 mb-6">
          <p className="text-sm text-stone-700">
            <strong>Ở chế độ này:</strong> Tất cả dữ liệu bạn nhập sẽ không hiển thị với khách hàng thực. 
            Bạn có thể tập luyện thoải mái với dữ liệu giả!
          </p>
        </div>

        <div className="flex gap-3">
          <button
            onClick={onConfirm}
            disabled={isLoading}
            className="flex-1 bg-amber-600 text-white font-bold uppercase px-4 py-3 border-2 border-stone-900 rounded-lg shadow-[3px_3px_0_#1c1917] hover:shadow-[5px_5px_0_#1c1917] hover:-translate-y-0.5 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {isLoading ? 'Đang tải...' : 'Vào chế độ dùng thử'}
          </button>
          <button
            onClick={onCancel}
            disabled={isLoading}
            className="flex-1 bg-white text-stone-900 font-bold uppercase px-4 py-3 border-2 border-stone-900 rounded-lg shadow-[3px_3px_0_#1c1917] hover:shadow-[5px_5px_0_#1c1917] hover:-translate-y-0.5 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
          >
            Hủy
          </button>
        </div>
      </div>
    </div>
  )
}
