import type { UIAction, UIComponent } from '../../../../types/chat'

interface Props {
  component: UIComponent
  onAction?: (action: UIAction, component: UIComponent) => void
  renderActions: (component: UIComponent, onAction?: (action: UIAction, component: UIComponent) => void) => React.ReactNode
}

export function StaffScheduleCard({ component, onAction, renderActions }: Props) {
  const data = component.data
  const staffName = String(data['staff_name'] || data['name'] || 'Nhân viên')
  const date = String(data['date'] || 'Hôm nay')
  const shifts = Array.isArray(data['shifts']) ? data['shifts'] : []

  return (
    <div key={component.id} className="bg-white border-2 border-stone-900 rounded-xl p-4 shadow-[4px_4px_0_#1c1917]">
      <h4 className="font-black text-stone-900 uppercase text-sm mb-1">Lịch làm việc nhân viên</h4>
      <p className="text-xs font-bold text-amber-700 mb-1">{staffName}</p>
      <p className="text-[10px] text-stone-500 mb-3">{date}</p>

      {shifts.length === 0 ? (
        <p className="text-sm text-stone-600 border-t-2 border-stone-200 pt-2">Không có ca làm việc.</p>
      ) : (
        <div className="flex flex-col gap-2 mt-2">
          {shifts.map((shift: { shift_name?: string, name?: string, start_time?: string, end_time?: string, status?: string }, index: number) => (
            <div key={index} className="flex justify-between items-center p-2 border-2 border-stone-900 rounded-lg bg-stone-50">
              <div>
                <p className="font-bold text-stone-900 text-xs">Ca {shift.shift_name || shift.name || index + 1}</p>
                <p className="text-[10px] text-stone-600 mt-0.5">{shift.start_time} - {shift.end_time}</p>
              </div>
              <span className={`px-2 py-1 border border-stone-900 rounded text-[10px] font-bold uppercase ${shift.status === 'ACTIVE' || shift.status === 'WORKING' ? 'bg-teal-100 text-stone-700' : 'bg-stone-200 text-stone-700'}`}>
                {shift.status || 'SCHEDULED'}
              </span>
            </div>
          ))}
        </div>
      )}

      {renderActions(component, onAction)}
    </div>
  )
}
