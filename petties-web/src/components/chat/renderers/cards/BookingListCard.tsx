import type { UIAction, UIComponent } from '../../../../types/chat'

interface Props {
  component: UIComponent
  onAction?: (action: UIAction, component: UIComponent) => void
  renderActions: (component: UIComponent, onAction?: (action: UIAction, component: UIComponent) => void) => React.ReactNode
}

export function BookingListCard({ component, onAction, renderActions }: Props) {
  const data = component.data
  const bookings = Array.isArray(data['bookings']) ? data['bookings'] : []
  const title = String(data['title'] || 'Danh sách đặt lịch')

  return (
    <div key={component.id} className="bg-white border-2 border-stone-900 rounded-xl p-4 shadow-[4px_4px_0_#1c1917]">
      <h4 className="font-black text-stone-900 uppercase text-sm mb-3">{title}</h4>
      
      {bookings.length === 0 ? (
        <p className="text-sm text-stone-600">Không có lịch hẹn nào.</p>
      ) : (
        <div className="flex flex-col gap-3">
          {bookings.map((b: { pet_name?: string, owner_name?: string, date?: string, booking_date?: string, time?: string, start_time?: string, services?: string | string[], status?: string }, index: number) => (
            <div key={index} className="border-b-2 border-stone-200 pb-3 last:border-0 last:pb-0 flex justify-between items-start gap-2">
              <div>
                <p className="font-bold text-stone-900 text-sm">{b.pet_name || 'Thú cưng'} • {b.owner_name || 'Chủ nuôi'}</p>
                <p className="text-xs text-stone-600 mt-1">{b.date || b.booking_date} lúc {b.time || b.start_time}</p>
                {b.services && (
                  <p className="text-xs text-stone-600 mt-1">
                    Dịch vụ: {Array.isArray(b.services) ? b.services.join(', ') : b.services}
                  </p>
                )}
              </div>
              <div className="text-right">
                <span className={`inline-block px-2 py-1 border border-stone-900 rounded text-[10px] font-bold uppercase ${b.status === 'CONFIRMED' ? 'bg-teal-100 text-stone-700' : 'bg-amber-100 text-stone-700'}`}>
                  {b.status || 'PENDING'}
                </span>
              </div>
            </div>
          ))}
        </div>
      )}
      
      {renderActions(component, onAction)}
    </div>
  )
}
