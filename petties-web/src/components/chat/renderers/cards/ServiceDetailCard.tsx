import type { UIAction, UIComponent } from '../../../../types/chat-copilot'

interface Props {
  component: UIComponent
  onAction?: (action: UIAction, component: UIComponent) => void
  renderActions: (component: UIComponent, onAction?: (action: UIAction, component: UIComponent) => void) => React.ReactNode
}

export function ServiceDetailCard({ component, onAction, renderActions }: Props) {
  const data = component.data
  const title = String(data['title'] || data['name'] || 'Chi tiết dịch vụ')

  return (
    <div key={component.id} className="bg-white border-2 border-stone-900 rounded-xl p-4 shadow-[4px_4px_0_#1c1917]">
      <h4 className="font-black text-stone-900 uppercase text-sm mb-3">{title}</h4>
      
      <div className="flex flex-col gap-2 text-sm">
        {Boolean(data['category']) && (
          <div className="grid grid-cols-3 gap-2">
            <span className="font-bold text-stone-600 col-span-1">Danh mục:</span>
            <span className="text-stone-900 col-span-2">{String(data['category'])}</span>
          </div>
        )}
        {Boolean(data['pet_type']) && (
          <div className="grid grid-cols-3 gap-2">
            <span className="font-bold text-stone-600 col-span-1">Loại thú cưng:</span>
            <span className="text-stone-900 col-span-2">{String(data['pet_type'])}</span>
          </div>
        )}
        {Boolean(data['base_price']) && (
          <div className="grid grid-cols-3 gap-2">
            <span className="font-bold text-stone-600 col-span-1">Giá:</span>
            <span className="font-black text-amber-600 col-span-2">{Number(data['base_price']).toLocaleString('vi-VN')} đ</span>
          </div>
        )}
        {Boolean(data['duration_time']) && (
          <div className="grid grid-cols-3 gap-2">
            <span className="font-bold text-stone-600 col-span-1">Thời lượng:</span>
            <span className="text-stone-900 col-span-2">{String(data['duration_time'])} phút</span>
          </div>
        )}
        {Boolean(data['description']) && (
          <div className="grid grid-cols-3 gap-2">
            <span className="font-bold text-stone-600 col-span-1">Mô tả:</span>
            <span className="text-stone-900 col-span-2">{String(data['description'])}</span>
          </div>
        )}
      </div>
      
      {renderActions(component, onAction)}
    </div>
  )
}
