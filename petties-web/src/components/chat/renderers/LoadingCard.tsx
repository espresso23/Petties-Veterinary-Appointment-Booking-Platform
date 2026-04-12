export function LoadingCard() {
  return (
    <div className="bg-stone-100 border-2 border-stone-900 p-4 rounded-xl shadow-[4px_4px_0_#1c1917] flex items-center gap-4">
      <div className="w-10 h-10 border-4 border-amber-500 border-t-transparent rounded-full animate-spin"></div>
      <div className="flex flex-col gap-1">
        <span className="text-xs font-bold uppercase text-stone-500">Hệ thống đang xử lý...</span>
        <p className="text-sm font-medium text-stone-700">Vui lòng đợi trong giây lát</p>
      </div>
    </div>
  )
}
