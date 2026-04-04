import type { UIAction, UIComponent } from '../../../../types/chat'

interface Props {
  component: UIComponent
  onAction?: (action: UIAction, component: UIComponent) => void
  renderActions: (component: UIComponent, onAction?: (action: UIAction, component: UIComponent) => void) => React.ReactNode
}

export function ClinicTodaySummaryCard({ component, onAction, renderActions }: Props) {
  const data = component.data
  const stats = (data['stats'] as Record<string, number | string>) || {}
  const date = String(data['date'] || 'Hôm nay')
  
  return (
    <div key={component.id} className="bg-white border-2 border-stone-900 rounded-xl p-4 shadow-[4px_4px_0_#1c1917]">
      <h4 className="font-black text-stone-900 uppercase text-sm mb-1">Tổng quan phòng khám</h4>
      <p className="text-xs text-stone-600 mb-4">{date}</p>
      
      <div className="grid grid-cols-2 gap-3 mb-4">
        <div className="bg-amber-50 border-2 border-stone-900 rounded-lg p-3">
          <p className="text-[10px] font-bold text-stone-600 uppercase mb-1">Lịch khám hôm nay</p>
          <p className="text-2xl font-black text-stone-900">{stats['total_bookings'] || 0}</p>
        </div>
        <div className="bg-teal-50 border-2 border-stone-900 rounded-lg p-3">
          <p className="text-[10px] font-bold text-stone-600 uppercase mb-1">Đã hoàn thành</p>
          <p className="text-2xl font-black text-teal-700">{stats['completed_bookings'] || 0}</p>
        </div>
        <div className="bg-rose-50 border-2 border-stone-900 rounded-lg p-3">
          <p className="text-[10px] font-bold text-stone-600 uppercase mb-1">Đang chờ khám</p>
          <p className="text-2xl font-black text-rose-700">{stats['pending_bookings'] || 0}</p>
        </div>
        <div className="bg-blue-50 border-2 border-stone-900 rounded-lg p-3">
          <p className="text-[10px] font-bold text-stone-600 uppercase mb-1">Hủy/Vắng mặt</p>
          <p className="text-2xl font-black text-blue-700">{stats['cancelled_bookings'] || 0}</p>
        </div>
      </div>
      
      {data['revenue'] !== undefined && (
        <div className="flex justify-between items-center py-2 border-t-2 border-stone-900 border-dashed">
          <span className="font-bold text-stone-900 text-sm">Doanh thu dự kiến</span>
          <span className="font-black text-amber-600 text-sm">
            {Number(data['revenue']).toLocaleString('vi-VN')} đ
          </span>
        </div>
      )}
      
      {renderActions(component, onAction)}
    </div>
  )
}
