import type { UIAction, UIComponent } from '../../../../types/chat-copilot'

interface Props {
  component: UIComponent
  onAction?: (action: UIAction, component: UIComponent) => void
  renderActions: (component: UIComponent, onAction?: (action: UIAction, component: UIComponent) => void) => React.ReactNode
}

export function StaffListCard({ component, onAction, renderActions }: Props) {
  const data = component.data
  const staffList = Array.isArray(data['staff']) ? data['staff'] : []
  const title = String(data['title'] || 'Danh sách nhân viên')

  return (
    <div key={component.id} className="bg-white border-2 border-stone-900 rounded-xl p-4 shadow-[4px_4px_0_#1c1917]">
      <h4 className="font-black text-stone-900 uppercase text-sm mb-3">{title}</h4>
      
      {staffList.length === 0 ? (
        <p className="text-sm text-stone-600 border-t-2 border-stone-200 pt-2">Không có nhân viên nào.</p>
      ) : (
        <div className="flex flex-col gap-3">
          {staffList.map((staff: { name?: string, avatar?: string, role?: string, specialty?: string }, index: number) => (
            <div key={index} className="flex gap-3 items-center border-b-2 border-stone-200 pb-3 last:border-0 last:pb-0">
              <div className="w-10 h-10 rounded-full bg-amber-100 border-2 border-stone-900 flex items-center justify-center overflow-hidden shrink-0">
                {staff.avatar ? (
                  <img src={staff.avatar} alt={staff.name} className="w-full h-full object-cover" />
                ) : (
                  <span className="text-xs font-black text-amber-700">{staff.name?.substring(0, 2).toUpperCase() || 'NV'}</span>
                )}
              </div>
              <div className="flex-1">
                <p className="font-bold text-stone-900 text-sm">{staff.name || 'Tên nhân viên'}</p>
                <div className="flex flex-wrap gap-2 mt-1">
                  {staff.role && (
                    <span className="text-[10px] bg-stone-100 border border-stone-900 px-1.5 rounded uppercase font-bold text-stone-700">
                      {staff.role}
                    </span>
                  )}
                  {staff.specialty && (
                    <span className="text-[10px] bg-teal-50 border border-stone-900 px-1.5 rounded uppercase font-bold text-teal-700">
                      {staff.specialty}
                    </span>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
      
      {renderActions(component, onAction)}
    </div>
  )
}
