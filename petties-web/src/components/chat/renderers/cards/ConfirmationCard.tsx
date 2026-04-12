import type { UIAction, UIComponent } from '../../../../types/chat-copilot'

interface Props {
  component: UIComponent
  onAction?: (action: UIAction, component: UIComponent) => void
  renderActions: (component: UIComponent, onAction?: (action: UIAction, component: UIComponent) => void) => React.ReactNode
}

export function ConfirmationCard({ component, onAction, renderActions }: Props) {
  const data = component.data
  const title = String(data['title'] || 'Xác nhận hành động')
  const message = String(data['message'] || 'Bạn có chắc chắn muốn thực hiện hành động này không?')

  return (
    <div key={component.id} className="bg-amber-50 border-2 border-amber-900 rounded-xl p-4 shadow-[4px_4px_0_#78350f]">
      <h4 className="font-black text-amber-900 uppercase text-sm mb-2 flex items-center gap-2">
        <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
          <path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
        </svg>
        {title}
      </h4>
      <p className="text-sm text-stone-800 mb-4">{message}</p>
      
      {/* If there are no specific actions mapped, render a fallback, but renderActions is preferred */}
      {component.actions && component.actions.length > 0 ? (
        renderActions(component, onAction)
      ) : (
        <div className="text-xs text-stone-500 italic mt-2">
          (Cần phản hồi từ người dùng để tiếp tục)
        </div>
      )}
    </div>
  )
}
