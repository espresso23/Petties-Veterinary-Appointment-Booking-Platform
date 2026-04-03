import type { UIAction, UIComponent, UISchemaV1 } from '../../../types/chat'

interface UISchemaRendererProps {
  schema: UISchemaV1
  onAction?: (action: UIAction, component: UIComponent) => void
}

function ActionButtons({
  component,
  onAction,
}: {
  component: UIComponent
  onAction?: (action: UIAction, component: UIComponent) => void
}) {
  if (!component.actions?.length || !onAction) return null

  return (
    <div className="mt-3 flex flex-wrap gap-2">
      {component.actions.map((action) => (
        <button
          key={`${component.id}-${action.type}-${action.label}`}
          type="button"
          onClick={() => onAction(action, component)}
          className="px-3 py-2 bg-white border-2 border-stone-900 rounded-lg text-xs font-bold uppercase shadow-[2px_2px_0_#1c1917] hover:-translate-y-0.5 transition-transform"
        >
          {action.label}
        </button>
      ))}
    </div>
  )
}

function renderSimpleValue(value: unknown): string {
  if (value == null || value === '') return 'Chưa có'
  if (Array.isArray(value)) return value.map((item) => renderSimpleValue(item)).join(', ')
  if (typeof value === 'object') return JSON.stringify(value)
  return String(value)
}

function renderClinicCard(
  component: UIComponent,
  onAction?: (action: UIAction, component: UIComponent) => void,
) {
  const clinic = component.data
  const logo = typeof clinic['logo'] === 'string' ? clinic['logo'] : undefined

  return (
    <div
      key={component.id}
      className="bg-white border-2 border-stone-900 rounded-xl p-4 shadow-[4px_4px_0_#1c1917]"
    >
      <div className="flex gap-4">
        <div className="w-16 h-16 rounded-lg bg-amber-100 border-2 border-stone-900 flex items-center justify-center overflow-hidden">
          {logo ? (
            <img
              src={logo}
              alt={renderSimpleValue(clinic['name'])}
              className="w-full h-full object-cover"
            />
          ) : (
            <span className="text-xs font-black text-amber-700">PK</span>
          )}
        </div>
        <div className="flex-1">
          <h4 className="font-bold text-stone-900 text-sm">{renderSimpleValue(clinic['name'])}</h4>
          <p className="text-xs text-stone-600 mt-1">{renderSimpleValue(clinic['address'])}</p>
          <div className="mt-2 flex flex-wrap gap-2 text-[11px] font-bold text-stone-700">
            {clinic['distance'] != null && <span>Cách đây {renderSimpleValue(clinic['distance'])}</span>}
            {clinic['rating'] != null && <span>Đánh giá {renderSimpleValue(clinic['rating'])}</span>}
          </div>
          <ActionButtons component={component} onAction={onAction} />
        </div>
      </div>
    </div>
  )
}

function renderPetCard(
  component: UIComponent,
  onAction?: (action: UIAction, component: UIComponent) => void,
) {
  const pet = component.data
  const breed = pet['breed']

  return (
    <div key={component.id} className="bg-white border-2 border-stone-900 rounded-xl p-4 shadow-[4px_4px_0_#1c1917]">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h4 className="font-bold text-sm text-stone-900">{renderSimpleValue(pet['name'])}</h4>
          <p className="text-xs text-stone-600 mt-1">
            {renderSimpleValue(pet['species'])}
            {breed ? ` • ${renderSimpleValue(breed)}` : ''}
          </p>
          <p className="text-xs text-stone-600 mt-1">Cân nặng: {renderSimpleValue(pet['weight_kg'])} kg</p>
        </div>
      </div>
      <ActionButtons component={component} onAction={onAction} />
    </div>
  )
}

function renderChoiceChip(
  component: UIComponent,
  onAction?: (action: UIAction, component: UIComponent) => void,
) {
  const firstAction = component.actions?.[0]
  const data = component.data
  const label = renderSimpleValue(
    data['name'] ?? data['label'] ?? data['startTime'] ?? data['start_time'],
  )

  return (
    <button
      key={component.id}
      type="button"
      disabled={!firstAction || !onAction}
      onClick={() => firstAction && onAction?.(firstAction, component)}
      className="px-3 py-2 bg-white border-2 border-stone-900 rounded-lg text-sm font-bold text-stone-900 shadow-[2px_2px_0_#1c1917] hover:-translate-y-0.5 transition-transform disabled:opacity-60"
    >
      {label}
    </button>
  )
}

function renderBookingSummary(
  component: UIComponent,
  onAction?: (action: UIAction, component: UIComponent) => void,
) {
  const data = component.data
  const services = Array.isArray(data['services']) ? data['services'] : []
  const bookings = Array.isArray(data['bookings']) ? data['bookings'] : []
  const multiPetSummary =
    data['multi_pet_summary'] && typeof data['multi_pet_summary'] === 'object'
      ? (data['multi_pet_summary'] as Record<string, unknown>)
      : null

  return (
    <div key={component.id} className="bg-white border-2 border-stone-900 rounded-xl p-4 shadow-[4px_4px_0_#1c1917]">
      <h4 className="text-sm font-black text-stone-900 uppercase">Tóm tắt đặt lịch</h4>
      {data['message'] ? <p className="mt-2 text-sm text-stone-700">{String(renderSimpleValue(data['message']))}</p> : null}
      <div className="mt-3 grid grid-cols-1 sm:grid-cols-2 gap-2 text-sm">
        <div><span className="font-bold">Phòng khám:</span> {String(renderSimpleValue(data['clinic_name']))}</div>
        <div><span className="font-bold">Thú cưng:</span> {String(renderSimpleValue(data['pet_name']))}</div>
        <div><span className="font-bold">Ngày:</span> {String(renderSimpleValue(data['booking_date'] ?? data['date']))}</div>
        <div><span className="font-bold">Giờ:</span> {String(renderSimpleValue(data['start_time'] ?? data['time']))}</div>
      </div>
      {services.length > 0 && (
        <div className="mt-3 text-sm">
          <span className="font-bold">Dịch vụ:</span> {renderSimpleValue(services)}
        </div>
      )}
      {bookings.length > 0 && (
        <div className="mt-3 text-sm">
          <span className="font-bold">Số booking:</span> {bookings.length}
        </div>
      )}
      {multiPetSummary && (
        <div className="mt-3 text-sm">
          <span className="font-bold">Nhiều thú cưng:</span> {renderSimpleValue(multiPetSummary['pet_names'])}
        </div>
      )}
      <ActionButtons component={component} onAction={onAction} />
    </div>
  )
}

function renderInfoCard(component: UIComponent, title: string) {
  return (
    <div key={component.id} className="bg-white border-2 border-stone-900 rounded-xl p-4 shadow-[4px_4px_0_#1c1917]">
      <h4 className="text-sm font-black text-stone-900 uppercase">{title}</h4>
      <pre className="mt-3 text-xs text-stone-700 whitespace-pre-wrap break-words">
        {JSON.stringify(component.data, null, 2)}
      </pre>
    </div>
  )
}

function renderErrorCard(
  component: UIComponent,
  onAction?: (action: UIAction, component: UIComponent) => void,
) {
  const data = component.data

  return (
    <div key={component.id} className="bg-red-50 border-2 border-stone-900 rounded-xl p-4 shadow-[4px_4px_0_#1c1917]">
      <h4 className="text-xs font-black uppercase text-red-600">Hệ thống gặp lỗi</h4>
      <p className="mt-2 text-sm text-stone-800">{String(renderSimpleValue(data['message']))}</p>
      {data['error_code'] ? (
        <p className="mt-2 text-[11px] text-stone-500 font-mono">Mã lỗi: {String(renderSimpleValue(data['error_code']))}</p>
      ) : null}
      <ActionButtons component={component} onAction={onAction} />
    </div>
  )
}

function renderEmptyState(component: UIComponent) {
  const data = component.data
  return (
    <div key={component.id} className="bg-stone-100 border-2 border-stone-900 rounded-xl p-4 shadow-[4px_4px_0_#1c1917]">
      <h4 className="text-sm font-black text-stone-900">{String(renderSimpleValue(data['title']))}</h4>
      <p className="mt-2 text-sm text-stone-700">{String(renderSimpleValue(data['message']))}</p>
    </div>
  )
}

function renderText(component: UIComponent) {
  return (
    <p key={component.id} className="text-sm font-bold text-stone-800 whitespace-pre-wrap">
      {renderSimpleValue(component.data['content'])}
    </p>
  )
}

function renderBadge(component: UIComponent) {
  return (
    <div
      key={component.id}
      className="mt-3 px-3 py-2 bg-amber-50 border-2 border-stone-900 rounded-lg text-xs text-stone-700"
    >
      {renderSimpleValue(component.data['content'])}
    </div>
  )
}

function renderComponent(
  component: UIComponent,
  onAction?: (action: UIAction, component: UIComponent) => void,
) {
  switch (component.type) {
    case 'clinic_card':
      return renderClinicCard(component, onAction)
    case 'pet_card':
      return renderPetCard(component, onAction)
    case 'service_chip':
    case 'slot_button':
      return renderChoiceChip(component, onAction)
    case 'booking_summary':
      return renderBookingSummary(component, onAction)
    case 'vaccination_card':
      return renderInfoCard(component, 'Lịch tiêm chủng')
    case 'emr_summary':
      return renderInfoCard(component, 'Tóm tắt hồ sơ bệnh án')
    case 'error_card':
      return renderErrorCard(component, onAction)
    case 'empty_state':
      return renderEmptyState(component)
    case 'text':
      return renderText(component)
    case 'badge':
      return renderBadge(component)
    default:
      return (
        <pre key={component.id} className="text-xs whitespace-pre-wrap break-words bg-stone-100 border-2 border-stone-900 rounded-xl p-3">
          {JSON.stringify(component.data, null, 2)}
        </pre>
      )
  }
}

export function UISchemaRenderer({ schema, onAction }: UISchemaRendererProps) {
  const layoutClass =
    schema.layout === 'grid'
      ? 'grid grid-cols-1 gap-3'
      : schema.layout === 'slot_grid'
        ? 'flex flex-wrap gap-2'
        : 'flex flex-col gap-3'

  return (
    <div className={layoutClass}>
      {schema.components.map((component) => renderComponent(component, onAction))}
    </div>
  )
}
