import type { UIAction, UIComponent } from '../../../../types/chat'

interface Props {
  component: UIComponent
  onAction?: (action: UIAction, component: UIComponent) => void
  renderActions: (component: UIComponent, onAction?: (action: UIAction, component: UIComponent) => void) => React.ReactNode
}

export function ClinicServiceListCard({ component, onAction, renderActions }: Props) {
  const data = component.data
  const services = Array.isArray(data['services']) ? data['services'] : []
  const title = String(data['title'] || 'Danh sách dịch vụ')

  return (
    <div key={component.id} className="bg-white border-2 border-stone-900 rounded-xl p-4 shadow-[4px_4px_0_#1c1917]">
      <h4 className="font-black text-stone-900 uppercase text-sm mb-3">{title}</h4>
      
      {services.length === 0 ? (
        <p className="text-sm text-stone-600 border-t-2 border-stone-200 pt-2">Không có dịch vụ nào.</p>
      ) : (
        <div className="flex flex-col gap-3">
          {services.map((service: { name?: string, category?: string, pet_type?: string, base_price?: number, duration_time?: number }, index: number) => (
            <div key={index} className="border-b-2 border-stone-200 pb-3 last:border-0 last:pb-0">
              <div className="flex justify-between items-start">
                <div>
                  <p className="font-bold text-stone-900 text-sm">{service.name || 'Tên dịch vụ'}</p>
                  <div className="flex gap-2 items-center mt-1">
                    {service.category && (
                      <span className="text-[10px] bg-stone-100 border border-stone-900 px-1.5 rounded uppercase font-bold text-stone-700">
                        {service.category}
                      </span>
                    )}
                    {service.pet_type && (
                      <span className="text-[10px] bg-amber-50 border border-stone-900 px-1.5 rounded uppercase font-bold text-amber-700">
                        {service.pet_type}
                      </span>
                    )}
                  </div>
                </div>
                <div className="text-right">
                  <p className="font-black text-amber-600 text-sm">{Number(service.base_price || 0).toLocaleString('vi-VN')} đ</p>
                  {service.duration_time && (
                    <p className="text-[10px] text-stone-500 font-bold mt-1 uppercase">{service.duration_time} phút</p>
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
