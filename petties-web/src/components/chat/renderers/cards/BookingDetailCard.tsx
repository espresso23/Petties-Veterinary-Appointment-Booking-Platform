import type { UIAction, UIComponent } from '../../../../types/chat-copilot'

interface Props {
  component: UIComponent
  onAction?: (action: UIAction, component: UIComponent) => void
  renderActions: (component: UIComponent, onAction?: (action: UIAction, component: UIComponent) => void) => React.ReactNode
}

export function BookingDetailCard({ component, onAction, renderActions }: Props) {
  const data = component.data
  
  return (
    <div key={component.id} className="bg-white border-2 border-stone-900 rounded-xl p-4 shadow-[4px_4px_0_#1c1917]">
      <div className="flex justify-between items-start mb-3 border-b-2 border-stone-900 pb-3">
        <h4 className="font-black text-stone-900 uppercase text-sm">Chi tiết đặt lịch</h4>
        <span className={`inline-block px-2 py-1 border border-stone-900 rounded text-[10px] font-bold uppercase ${data['status'] === 'CONFIRMED' ? 'bg-teal-100 text-stone-700' : 'bg-amber-100 text-stone-700'}`}>
          {String(data['status'] || 'PENDING')}
        </span>
      </div>
      
      <div className="flex flex-col gap-2 text-sm">
        <div className="grid grid-cols-3 gap-2">
          <span className="font-bold text-stone-600 col-span-1">Khách hàng:</span>
          <span className="text-stone-900 col-span-2">{String(data['owner_name'] || 'Chưa có')}</span>
        </div>
        <div className="grid grid-cols-3 gap-2">
          <span className="font-bold text-stone-600 col-span-1">Thú cưng:</span>
          <span className="text-stone-900 col-span-2">{String(data['pet_name'] || 'Chưa có')}</span>
        </div>
        <div className="grid grid-cols-3 gap-2">
          <span className="font-bold text-stone-600 col-span-1">Thời gian:</span>
          <span className="text-stone-900 col-span-2">{String(data['date'] || data['booking_date'] || '')} {String(data['time'] || data['start_time'] || '')}</span>
        </div>
        <div className="grid grid-cols-3 gap-2">
          <span className="font-bold text-stone-600 col-span-1">Dịch vụ:</span>
          <span className="text-stone-900 col-span-2">
            {Array.isArray(data['services']) ? data['services'].join(', ') : String(data['services'] || 'Chưa có')}
          </span>
        </div>
        {Boolean(data['staff_name']) && (
          <div className="grid grid-cols-3 gap-2">
            <span className="font-bold text-stone-600 col-span-1">Nhân viên:</span>
            <span className="text-stone-900 col-span-2">{String(data['staff_name'])}</span>
          </div>
        )}
        {Boolean(data['note']) && (
          <div className="grid grid-cols-3 gap-2">
            <span className="font-bold text-stone-600 col-span-1">Ghi chú:</span>
            <span className="text-stone-900 col-span-2">{String(data['note'])}</span>
          </div>
        )}
      </div>
      
      {renderActions(component, onAction)}
    </div>
  )
}
