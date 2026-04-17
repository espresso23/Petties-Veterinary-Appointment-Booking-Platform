interface ErrorCardProps {
  data: {
    message: string
    code?: string
    recoverable?: boolean
  }
  onRetry?: () => void
}

export function ErrorCard({ data, onRetry }: ErrorCardProps) {
  return (
    <div className="bg-red-50 border-2 border-stone-900 p-4 rounded-xl shadow-[4px_4px_0_#1c1917] flex flex-col gap-3">
      <div className="flex items-center gap-2 text-red-600 font-bold uppercase text-xs">
        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
        </svg>
        Hệ thống gặp lỗi
      </div>

      <p className="text-sm text-stone-700 leading-relaxed font-medium">
        {data.message || 'Rất tiếc, đã có lỗi xảy ra trong quá trình xử lý yêu cầu của bạn.'}
      </p>

      {data.code && (
        <span className="text-[10px] text-stone-400 font-mono">
          Mã lỗi: {data.code}
        </span>
      )}

      {data.recoverable && (
        <button
          type="button"
          onClick={onRetry}
          disabled={!onRetry}
          className="mt-1 w-full py-2 bg-white border-2 border-stone-900 rounded-lg text-xs font-bold uppercase shadow-[2px_2px_0_#1c1917] hover:-translate-y-0.5 transition-transform disabled:opacity-60"
        >
          Thử lại
        </button>
      )}
    </div>
  )
}
