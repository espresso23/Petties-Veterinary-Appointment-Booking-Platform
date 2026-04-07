import type { UIAction, UIComponent, UISchemaV1 } from '../../../types/chat-copilot'
import {
  BookingListCard,
  BookingDetailCard,
  ClinicTodaySummaryCard,
  StaffScheduleCard,
  StaffListCard,
  ClinicServiceListCard,
  ServiceDetailCard,
  ConfirmationCard
} from './cards'

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

function pickFirst(data: Record<string, unknown>, keys: string[]): unknown {
  for (const key of keys) {
    const value = data[key]
    if (value !== undefined && value !== null && value !== '') {
      return value
    }
  }
  return undefined
}

function toNumber(value: unknown): number | undefined {
  if (typeof value === 'number' && Number.isFinite(value)) return value
  if (typeof value === 'string') {
    const parsed = Number(value)
    if (Number.isFinite(parsed)) return parsed
  }
  return undefined
}

function formatCurrency(value: unknown): string {
  const amount = toNumber(value)
  if (amount == null) return 'Chưa có'
  return `${amount.toLocaleString('vi-VN')}đ`
}

function asRecordArray(value: unknown): Array<Record<string, unknown>> {
  if (!Array.isArray(value)) return []
  return value.filter((item): item is Record<string, unknown> => !!item && typeof item === 'object')
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

function renderServiceCard(
  component: UIComponent,
  onAction?: (action: UIAction, component: UIComponent) => void,
) {
  const data = component.data
  const name = renderSimpleValue(pickFirst(data, ['name', 'service_name']))
  const description = renderSimpleValue(data['description'])
  const basePrice = pickFirst(data, ['base_price', 'basePrice'])
  const duration = pickFirst(data, ['duration_time', 'duration_minutes', 'durationTime'])
  const durationLabel = renderSimpleValue(duration)
  const slotsRequired = pickFirst(data, ['slots_required', 'slotsRequired'])
  const category = renderSimpleValue(pickFirst(data, ['service_category', 'category', 'serviceCategory']))
  const petType = renderSimpleValue(pickFirst(data, ['pet_type', 'petType']))
  const isHomeVisit = pickFirst(data, ['is_home_visit', 'isHomeVisit'])
  const weightPrices = asRecordArray(pickFirst(data, ['weight_prices', 'weightPrices']))
  const dosePrices = asRecordArray(pickFirst(data, ['dose_prices', 'dosePrices']))

  return (
    <div key={component.id} className="bg-white border-2 border-stone-900 rounded-xl p-4 shadow-[4px_4px_0_#1c1917]">
      <div className="flex items-start justify-between gap-3">
        <div className="flex-1">
          <h4 className="font-bold text-stone-900 text-sm">{name}</h4>
          {description && description !== 'Chưa có' && (
            <p className="text-xs text-stone-600 mt-1">{description}</p>
          )}
          <div className="mt-2 flex flex-wrap gap-2">
            {category && category !== 'Chưa có' && (
              <span className="px-2 py-1 bg-amber-100 border border-stone-900 rounded text-[10px] font-bold text-stone-700 uppercase">
                {category}
              </span>
            )}
            {petType && petType !== 'Chưa có' && (
              <span className="px-2 py-1 bg-teal-100 border border-stone-900 rounded text-[10px] font-bold text-stone-700 uppercase">
                {petType}
              </span>
            )}
            {typeof isHomeVisit === 'boolean' && (
              <span className="px-2 py-1 bg-blue-100 border border-stone-900 rounded text-[10px] font-bold text-stone-700 uppercase">
                {isHomeVisit ? 'Khám tại nhà' : 'Khám tại phòng khám'}
              </span>
            )}
          </div>
          <div className="mt-3 flex flex-wrap items-center gap-4 text-xs font-bold">
            {basePrice != null && <span className="text-amber-600">{formatCurrency(basePrice)}</span>}
            {duration != null && durationLabel !== 'Chưa có' && (
              <span className="text-stone-500">{durationLabel} phút</span>
            )}
            {slotsRequired != null && (
              <span className="text-stone-500">{renderSimpleValue(slotsRequired)} slot</span>
            )}
          </div>

          {weightPrices.length > 0 && (
            <div className="mt-3 border-2 border-stone-200 rounded-lg p-2 bg-stone-50">
              <p className="text-[11px] font-black uppercase text-stone-700">Giá theo cân nặng</p>
              <div className="mt-2 space-y-1">
                {weightPrices.map((item, index) => {
                  const minWeight = renderSimpleValue(item['min_weight'] ?? item['minWeight'])
                  const maxWeight = renderSimpleValue(item['max_weight'] ?? item['maxWeight'])
                  const price = formatCurrency(item['price'])
                  return (
                    <p key={`${component.id}-wp-${index}`} className="text-[11px] font-bold text-stone-700">
                      {minWeight} - {maxWeight} kg: <span className="text-amber-700">{price}</span>
                    </p>
                  )
                })}
              </div>
            </div>
          )}

          {dosePrices.length > 0 && (
            <div className="mt-3 border-2 border-stone-200 rounded-lg p-2 bg-stone-50">
              <p className="text-[11px] font-black uppercase text-stone-700">Giá theo mũi tiêm</p>
              <div className="mt-2 space-y-1">
                {dosePrices.map((item, index) => {
                  const label = renderSimpleValue(item['dose_label'] ?? item['doseLabel'] ?? item['dose_number'] ?? item['doseNumber'])
                  const price = formatCurrency(item['price'])
                  return (
                    <p key={`${component.id}-dp-${index}`} className="text-[11px] font-bold text-stone-700">
                      {label}: <span className="text-amber-700">{price}</span>
                    </p>
                  )
                })}
              </div>
            </div>
          )}
        </div>
      </div>
      <ActionButtons component={component} onAction={onAction} />
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

function renderServiceChip(
  component: UIComponent,
  onAction?: (action: UIAction, component: UIComponent) => void,
) {
  const data = component.data
  const name = renderSimpleValue(pickFirst(data, ['name', 'service_name']))
  const category = renderSimpleValue(pickFirst(data, ['service_category', 'category', 'serviceCategory']))
  const petType = renderSimpleValue(pickFirst(data, ['pet_type', 'petType']))
  const basePrice = pickFirst(data, ['base_price', 'basePrice'])
  const duration = pickFirst(data, ['duration_minutes', 'duration_time', 'durationTime'])
  const slotsRequired = pickFirst(data, ['slots_required', 'slotsRequired'])
  const isHomeVisit = pickFirst(data, ['is_home_visit', 'isHomeVisit'])
  const weightPrices = asRecordArray(pickFirst(data, ['weight_prices', 'weightPrices']))
  const dosePrices = asRecordArray(pickFirst(data, ['dose_prices', 'dosePrices']))

  return (
    <div key={component.id} className="bg-white border-2 border-stone-900 rounded-lg p-3 shadow-[3px_3px_0_#1c1917]">
      <div className="flex items-start justify-between gap-2">
        <h5 className="text-sm font-black text-stone-900">{name}</h5>
        {basePrice != null && <span className="text-xs font-black text-amber-700">{formatCurrency(basePrice)}</span>}
      </div>

      <div className="mt-2 flex flex-wrap gap-2">
        {category && category !== 'Chưa có' && (
          <span className="px-2 py-1 bg-amber-100 border border-stone-900 rounded text-[10px] font-bold uppercase text-stone-700">{category}</span>
        )}
        {petType && petType !== 'Chưa có' && (
          <span className="px-2 py-1 bg-teal-100 border border-stone-900 rounded text-[10px] font-bold uppercase text-stone-700">{petType}</span>
        )}
        {typeof isHomeVisit === 'boolean' && (
          <span className="px-2 py-1 bg-blue-100 border border-stone-900 rounded text-[10px] font-bold uppercase text-stone-700">
            {isHomeVisit ? 'Tại nhà' : 'Tại phòng khám'}
          </span>
        )}
      </div>

      <div className="mt-2 flex flex-wrap gap-3 text-[11px] font-bold text-stone-600">
        {duration != null && <span>Thời lượng: {renderSimpleValue(duration)} phút</span>}
        {slotsRequired != null && <span>Slot: {renderSimpleValue(slotsRequired)}</span>}
      </div>

      {weightPrices.length > 0 && (
        <div className="mt-2 text-[11px] font-bold text-stone-700">
          <span className="font-black uppercase text-stone-600">Giá cân nặng:</span>{' '}
          {weightPrices
            .slice(0, 2)
            .map((item) => {
              const minWeight = renderSimpleValue(item['min_weight'] ?? item['minWeight'])
              const maxWeight = renderSimpleValue(item['max_weight'] ?? item['maxWeight'])
              const price = formatCurrency(item['price'])
              return `${minWeight}-${maxWeight}kg: ${price}`
            })
            .join(' | ')}
          {weightPrices.length > 2 ? ' ...' : ''}
        </div>
      )}

      {dosePrices.length > 0 && (
        <div className="mt-2 text-[11px] font-bold text-stone-700">
          <span className="font-black uppercase text-stone-600">Giá mũi tiêm:</span>{' '}
          {dosePrices
            .slice(0, 2)
            .map((item) => {
              const label = renderSimpleValue(item['dose_label'] ?? item['doseLabel'] ?? item['dose_number'] ?? item['doseNumber'])
              const price = formatCurrency(item['price'])
              return `${label}: ${price}`
            })
            .join(' | ')}
          {dosePrices.length > 2 ? ' ...' : ''}
        </div>
      )}

      <ActionButtons component={component} onAction={onAction} />
    </div>
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

function renderButtonComponent(
  component: UIComponent,
  onAction?: (action: UIAction, component: UIComponent) => void,
) {
  const firstAction = component.actions?.[0]
  const label = renderSimpleValue(component.data['label'] ?? component.data['content'])

  return (
    <button
      key={component.id}
      type="button"
      disabled={!firstAction || !onAction}
      onClick={() => firstAction && onAction?.(firstAction, component)}
      className="w-full px-4 py-3 bg-amber-500 border-2 border-stone-900 rounded-lg text-sm font-black uppercase text-stone-900 shadow-[3px_3px_0_#1c1917] hover:-translate-y-0.5 transition-transform disabled:opacity-60"
    >
      {label}
    </button>
  )
}

function renderComponent(
  component: UIComponent,
  onAction?: (action: UIAction, component: UIComponent) => void,
) {
  switch (component.type) {
    case 'clinic_card':
      return renderClinicCard(component, onAction)
    case 'service_card':
      return renderServiceCard(component, onAction)
    case 'pet_card':
      return renderPetCard(component, onAction)
    case 'service_chip':
      return renderServiceChip(component, onAction)
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
    case 'button':
      return renderButtonComponent(component, onAction)
    case 'booking_list_card':
      return <BookingListCard key={component.id} component={component} onAction={onAction} renderActions={(comp, act) => <ActionButtons component={comp} onAction={act} />} />
    case 'booking_detail_card':
      return <BookingDetailCard key={component.id} component={component} onAction={onAction} renderActions={(comp, act) => <ActionButtons component={comp} onAction={act} />} />
    case 'clinic_today_summary':
    case 'daily_summary_card':
      return <ClinicTodaySummaryCard key={component.id} component={component} onAction={onAction} renderActions={(comp, act) => <ActionButtons component={comp} onAction={act} />} />
    case 'staff_schedule_card':
      return <StaffScheduleCard key={component.id} component={component} onAction={onAction} renderActions={(comp, act) => <ActionButtons component={comp} onAction={act} />} />
    case 'staff_list_card':
      return <StaffListCard key={component.id} component={component} onAction={onAction} renderActions={(comp, act) => <ActionButtons component={comp} onAction={act} />} />
    case 'clinic_service_list_card':
      return <ClinicServiceListCard key={component.id} component={component} onAction={onAction} renderActions={(comp, act) => <ActionButtons component={comp} onAction={act} />} />
    case 'service_detail_card':
      return <ServiceDetailCard key={component.id} component={component} onAction={onAction} renderActions={(comp, act) => <ActionButtons component={comp} onAction={act} />} />
    case 'confirmation_card':
    case 'action_confirmation_card':
      return <ConfirmationCard key={component.id} component={component} onAction={onAction} renderActions={(comp, act) => <ActionButtons component={comp} onAction={act} />} />
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
