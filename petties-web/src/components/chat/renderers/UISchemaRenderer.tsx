import { useEffect, useState } from 'react'
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
import { createService } from '../../../services/endpoints/service'
import ReactApexChart from 'react-apexcharts'
import type { ApexOptions } from 'apexcharts'
import { useToast } from '../../Toast'

interface UISchemaRendererProps {
  schema: UISchemaV1
  onAction?: (action: UIAction, component: UIComponent) => void
  selectedClinicId?: string
}

function ActionButtons({
  component,
  onAction,
  loading,
  loadingLabel,
}: {
  component: UIComponent
  onAction?: (action: UIAction, component: UIComponent) => void
  loading?: boolean
  loadingLabel?: string
}) {
  if (!component.actions?.length || !onAction) return null

  return (
    <div className="mt-3 flex flex-wrap gap-2">
      {component.actions.map((action) => (
        <button
          key={`${component.id}-${action.type}-${action.label}`}
          type="button"
          onClick={() => onAction(action, component)}
          disabled={loading}
          className={`px-3 py-2 border-2 rounded-lg text-xs font-bold uppercase shadow-[2px_2px_0_#1c1917] transition-transform hover:-translate-y-0.5 disabled:cursor-not-allowed disabled:opacity-60 ${
            loading
              ? 'bg-stone-200 border-stone-400 text-stone-500'
              : 'bg-white border-stone-900 text-stone-900'
          }`}
        >
          {loading && loadingLabel ? loadingLabel : action.label}
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

function getStringFromRecord(record: Record<string, unknown>, keys: string[]): string | undefined {
  for (const key of keys) {
    const value = record[key]
    if (typeof value === 'string' && value.trim()) {
      return value.trim()
    }
  }
  return undefined
}

function resolveClinicIdFromAction(action: UIAction): string | undefined {
  const payload = asRecord(action.payload)
  if (!payload) return undefined
  return getStringFromRecord(payload, ['clinic_id', 'clinicId'])
}

function resolveClinicIdFromComponent(component: UIComponent): string | undefined {
  return getStringFromRecord(component.data, ['clinic_id', 'clinicId', 'id'])
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

function asRecord(value: unknown): Record<string, unknown> | undefined {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    return undefined
  }
  return value as Record<string, unknown>
}

function sanitizeDigits(value: string): string {
  return value.replace(/\D+/g, '')
}

function parseNonNegativeInteger(value: string): number | undefined {
  const trimmed = value.trim()
  if (!trimmed || !/^\d+$/.test(trimmed)) {
    return undefined
  }
  const parsed = Number(trimmed)
  if (!Number.isFinite(parsed) || parsed < 0) {
    return undefined
  }
  return Math.trunc(parsed)
}

function toEditablePriceString(value: unknown): string {
  const parsed = toNumber(value)
  if (parsed == null || parsed < 0) {
    return ''
  }
  return String(Math.trunc(parsed))
}

function hasCreateServiceConfirmAction(action: UIAction): boolean {
  if (action.type !== 'open_native_confirm') {
    return false
  }

  const actionPayload = asRecord(action.payload)
  if (!actionPayload) {
    return false
  }

  const confirmAction = asRecord(actionPayload['confirm_action'])
  return confirmAction?.['type'] === 'confirm_service_create'
}

function cloneActionWithEditedPricing({
  action,
  fallbackBasePrice,
  fallbackWeightPrices,
  fallbackDosePrices,
  basePriceInput,
  weightPriceInputs,
  dosePriceInputs,
}: {
  action: UIAction
  fallbackBasePrice: unknown
  fallbackWeightPrices: Array<Record<string, unknown>>
  fallbackDosePrices: Array<Record<string, unknown>>
  basePriceInput: string
  weightPriceInputs: string[]
  dosePriceInputs: string[]
}): UIAction {
  const actionPayload = asRecord(action.payload)
  if (!actionPayload) {
    return action
  }

  const confirmAction = asRecord(actionPayload['confirm_action'])
  if (!confirmAction || confirmAction['type'] !== 'confirm_service_create') {
    return action
  }

  const confirmPayload = asRecord(confirmAction['payload']) ?? {}
  const nextConfirmPayload: Record<string, unknown> = { ...confirmPayload }

  const editedBasePrice = parseNonNegativeInteger(basePriceInput)
  const fallbackBasePriceNumber = toNumber(fallbackBasePrice)
  if (editedBasePrice != null) {
    nextConfirmPayload['base_price'] = editedBasePrice
  } else if (confirmPayload['base_price'] == null && fallbackBasePriceNumber != null) {
    nextConfirmPayload['base_price'] = fallbackBasePriceNumber
  }

  const confirmWeightPrices = asRecordArray(confirmPayload['weight_prices'])
  const sourceWeightPrices =
    confirmWeightPrices.length > 0 ? confirmWeightPrices : fallbackWeightPrices
  if (sourceWeightPrices.length > 0) {
    nextConfirmPayload['weight_prices'] = sourceWeightPrices.map((item, index) => {
      const editedValue = parseNonNegativeInteger(weightPriceInputs[index] ?? '')
      if (editedValue == null) {
        return { ...item }
      }
      return {
        ...item,
        price: editedValue,
      }
    })
  }

  const confirmDosePrices = asRecordArray(confirmPayload['dose_prices'])
  const sourceDosePrices = confirmDosePrices.length > 0 ? confirmDosePrices : fallbackDosePrices
  if (sourceDosePrices.length > 0) {
    nextConfirmPayload['dose_prices'] = sourceDosePrices.map((item, index) => {
      const editedValue = parseNonNegativeInteger(dosePriceInputs[index] ?? '')
      if (editedValue == null) {
        return { ...item }
      }
      return {
        ...item,
        price: editedValue,
      }
    })
  }

  const nextConfirmAction: Record<string, unknown> = {
    ...confirmAction,
    payload: nextConfirmPayload,
  }

  return {
    ...action,
    payload: {
      ...actionPayload,
      confirm_action: nextConfirmAction,
    },
  }
}

function renderClinicCard(
  component: UIComponent,
  onAction?: (action: UIAction, component: UIComponent) => void,
  selectedClinicId?: string,
) {
  const clinic = component.data
  const logo = typeof clinic['logo'] === 'string' ? clinic['logo'] : undefined
  const componentClinicId = resolveClinicIdFromComponent(component)
  const isSelectedClinic = Boolean(selectedClinicId && componentClinicId === selectedClinicId)

  return (
    <div
      key={component.id}
      className={`rounded-xl border-2 p-4 shadow-[4px_4px_0_#1c1917] transition-colors ${
        isSelectedClinic
          ? 'bg-amber-50 border-amber-700'
          : 'bg-white border-stone-900'
      }`}
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
          {isSelectedClinic && (
            <div className="mt-1 inline-flex items-center border-2 border-stone-900 bg-amber-300 px-2 py-1 text-[10px] font-black uppercase text-stone-900 shadow-[2px_2px_0_#1c1917]">
              Đang chọn
            </div>
          )}
          <p className="text-xs text-stone-600 mt-1">{renderSimpleValue(clinic['address'])}</p>
          <div className="mt-2 flex flex-wrap gap-2 text-[11px] font-bold text-stone-700">
            {clinic['distance'] != null && <span>Cách đây {renderSimpleValue(clinic['distance'])}</span>}
            {clinic['rating'] != null && <span>Đánh giá {renderSimpleValue(clinic['rating'])}</span>}
          </div>
          {!!component.actions?.length && onAction && (
            <div className="mt-3 flex flex-wrap gap-2">
              {component.actions.map((action) => {
                const actionClinicId = resolveClinicIdFromAction(action) || componentClinicId
                const isSelectedAction = Boolean(
                  selectedClinicId &&
                  action.type === 'select_item' &&
                  actionClinicId === selectedClinicId,
                )

                return (
                  <button
                    key={`${component.id}-${action.type}-${action.label}`}
                    type="button"
                    onClick={() => onAction(action, component)}
                    disabled={isSelectedAction}
                    className={`cursor-pointer px-3 py-2 rounded-lg border-2 text-xs font-bold uppercase shadow-[2px_2px_0_#1c1917] transition-transform hover:-translate-y-0.5 disabled:cursor-not-allowed disabled:opacity-70 ${
                      isSelectedAction
                        ? 'bg-amber-500 border-amber-700 text-stone-900'
                        : 'bg-white border-stone-900 text-stone-900'
                    }`}
                  >
                    {isSelectedAction ? 'Đã chọn' : action.label}
                  </button>
                )
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

function renderServiceCard(
  component: UIComponent,
  onAction?: (action: UIAction, component: UIComponent) => void,
) {
  return <ServiceCard key={component.id} component={component} onAction={onAction} />
}

function ServiceCard({
  component,
  onAction,
}: {
  component: UIComponent
  onAction?: (action: UIAction, component: UIComponent) => void
}) {
  const { showToast } = useToast()
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

  const hasCreateAction = (component.actions ?? []).some((action) =>
    hasCreateServiceConfirmAction(action),
  )
  const canQuickEdit = Boolean(onAction) && hasCreateAction

  const [basePriceInput, setBasePriceInput] = useState<string>(() =>
    toEditablePriceString(basePrice),
  )
  const [weightPriceInputs, setWeightPriceInputs] = useState<string[]>(() =>
    weightPrices.map((item) => toEditablePriceString(item['price'])),
  )
  const [dosePriceInputs, setDosePriceInputs] = useState<string[]>(() =>
    dosePrices.map((item) => toEditablePriceString(item['price'])),
  )
  const [isSaving, setIsSaving] = useState(false)
  const [isSaved, setIsSaved] = useState(false)

  useEffect(() => {
    setBasePriceInput(toEditablePriceString(basePrice))
    setWeightPriceInputs(weightPrices.map((item) => toEditablePriceString(item['price'])))
    setDosePriceInputs(dosePrices.map((item) => toEditablePriceString(item['price'])))
  }, [component.id])

  const previewBasePrice = parseNonNegativeInteger(basePriceInput) ?? toNumber(basePrice)

  const handleInlineSave = async () => {
    if (!onAction || isSaving || isSaved) return

    const createAction = component.actions?.find((action) => hasCreateServiceConfirmAction(action))
    if (!createAction) {
      onAction(component.actions![0], component)
      return
    }

    const actionPayload = asRecord(createAction.payload)
    const confirmAction = asRecord(actionPayload?.['confirm_action'])
    const confirmPayload = asRecord(confirmAction?.['payload']) ?? {}

    const editedBasePrice = parseNonNegativeInteger(basePriceInput) ?? toNumber(basePrice)
    if (editedBasePrice == null || editedBasePrice <= 0) {
      console.warn('[ServiceCard] Invalid base price')
      return
    }

    const clinicId = confirmPayload['clinic_id'] ?? confirmPayload['clinicId'] ?? component.data['clinic_id'] ?? component.data['clinicId']
    if (!clinicId) {
      console.warn('[ServiceCard] Missing clinicId')
      return
    }

    setIsSaving(true)
    try {
      const payload: Record<string, unknown> = {
        clinicId,
        name,
        description: description !== 'Chưa có' ? description : undefined,
        basePrice: editedBasePrice,
        durationTime: toNumber(duration) ?? 30,
        slotsRequired: toNumber(slotsRequired) ?? 1,
        serviceCategory: category !== 'Chưa có' ? category : undefined,
        petType: petType !== 'Chưa có' ? petType : undefined,
        isHomeVisit: typeof isHomeVisit === 'boolean' ? isHomeVisit : false,
        isActive: true,
      }

      const confirmWeightPrices = asRecordArray(confirmPayload['weight_prices'])
      const sourceWeightPrices = confirmWeightPrices.length > 0 ? confirmWeightPrices : weightPrices
      if (sourceWeightPrices.length > 0) {
        payload['weightPrices'] = sourceWeightPrices.map((item, index) => {
          const editedValue = parseNonNegativeInteger(weightPriceInputs[index] ?? '')
          return {
            minWeight: item['min_weight'] ?? item['minWeight'],
            maxWeight: item['max_weight'] ?? item['maxWeight'],
            price: editedValue ?? toNumber(item['price']),
          }
        })
      }

      const confirmDosePrices = asRecordArray(confirmPayload['dose_prices'])
      const sourceDosePrices = confirmDosePrices.length > 0 ? confirmDosePrices : dosePrices
      if (sourceDosePrices.length > 0) {
        payload['dosePrices'] = sourceDosePrices.map((item, index) => {
          const editedValue = parseNonNegativeInteger(dosePriceInputs[index] ?? '')
          return {
            doseLabel: item['dose_label'] ?? item['doseLabel'] ?? item['dose_number'] ?? item['doseNumber'],
            price: editedValue ?? toNumber(item['price']),
          }
        })
      }

      await createService(payload as any)
      setIsSaved(true)
      showToast('success', `Đã lưu dịch vụ "${name}" thành công`)
    } catch (error: unknown) {
      console.error('[ServiceCard] Failed to save service:', error)
      showToast('error', 'Không thể lưu dịch vụ. Vui lòng thử lại.')
    } finally {
      setIsSaving(false)
    }
  }

  const handleServiceCardAction = (action: UIAction, currentComponent: UIComponent) => {
    if (!onAction) {
      return
    }

    // For create service actions, use inline save instead of WebSocket
    if (hasCreateServiceConfirmAction(action)) {
      handleInlineSave()
      return
    }

    if (!canQuickEdit) {
      onAction(action, currentComponent)
      return
    }

    const updatedAction = cloneActionWithEditedPricing({
      action,
      fallbackBasePrice: basePrice,
      fallbackWeightPrices: weightPrices,
      fallbackDosePrices: dosePrices,
      basePriceInput,
      weightPriceInputs,
      dosePriceInputs,
    })
    onAction(updatedAction, currentComponent)
  }

  return (
    <div className="bg-white border-2 border-stone-900 rounded-xl p-4 shadow-[4px_4px_0_#1c1917]">
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
            {previewBasePrice != null && <span className="text-amber-600">{formatCurrency(previewBasePrice)}</span>}
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

          {canQuickEdit && !isSaved && (
            <div className="mt-3 border-2 border-amber-200 rounded-lg p-3 bg-amber-50 space-y-3">
              <p className="text-[11px] font-black uppercase text-amber-700">Chỉnh giá nhanh trước khi lưu</p>
              <div className="space-y-1">
                <label htmlFor={`${component.id}-base-price`} className="text-[11px] font-bold text-stone-700">
                  Giá cơ bản (đ)
                </label>
                <input
                  id={`${component.id}-base-price`}
                  aria-label="Giá cơ bản chỉnh nhanh"
                  type="text"
                  inputMode="numeric"
                  value={basePriceInput}
                  onChange={(event) => setBasePriceInput(sanitizeDigits(event.target.value))}
                  className="w-full border-2 border-stone-900 rounded-lg bg-white px-2 py-1 text-sm font-bold text-stone-900"
                />
              </div>

              {weightPrices.length > 0 && (
                <div className="space-y-2">
                  <p className="text-[11px] font-bold text-stone-700">Giá theo cân nặng (đ)</p>
                  {weightPrices.map((item, index) => {
                    const minWeight = renderSimpleValue(item['min_weight'] ?? item['minWeight'])
                    const maxWeight = renderSimpleValue(item['max_weight'] ?? item['maxWeight'])
                    return (
                      <div key={`${component.id}-weight-edit-${index}`} className="space-y-1">
                        <label
                          htmlFor={`${component.id}-weight-price-${index}`}
                          className="text-[11px] font-bold text-stone-600"
                        >
                          {minWeight} - {maxWeight} kg
                        </label>
                        <input
                          id={`${component.id}-weight-price-${index}`}
                          aria-label={`Giá cân nặng ${index + 1}`}
                          type="text"
                          inputMode="numeric"
                          value={weightPriceInputs[index] ?? ''}
                          onChange={(event) => {
                            const sanitizedValue = sanitizeDigits(event.target.value)
                            setWeightPriceInputs((prev) => {
                              const next = [...prev]
                              next[index] = sanitizedValue
                              return next
                            })
                          }}
                          className="w-full border-2 border-stone-900 rounded-lg bg-white px-2 py-1 text-sm font-bold text-stone-900"
                        />
                      </div>
                    )
                  })}
                </div>
              )}

              {dosePrices.length > 0 && (
                <div className="space-y-2">
                  <p className="text-[11px] font-bold text-stone-700">Giá theo mũi tiêm (đ)</p>
                  {dosePrices.map((item, index) => {
                    const label = renderSimpleValue(item['dose_label'] ?? item['doseLabel'] ?? item['dose_number'] ?? item['doseNumber'])
                    return (
                      <div key={`${component.id}-dose-edit-${index}`} className="space-y-1">
                        <label
                          htmlFor={`${component.id}-dose-price-${index}`}
                          className="text-[11px] font-bold text-stone-600"
                        >
                          {label}
                        </label>
                        <input
                          id={`${component.id}-dose-price-${index}`}
                          aria-label={`Giá mũi tiêm ${index + 1}`}
                          type="text"
                          inputMode="numeric"
                          value={dosePriceInputs[index] ?? ''}
                          onChange={(event) => {
                            const sanitizedValue = sanitizeDigits(event.target.value)
                            setDosePriceInputs((prev) => {
                              const next = [...prev]
                              next[index] = sanitizedValue
                              return next
                            })
                          }}
                          className="w-full border-2 border-stone-900 rounded-lg bg-white px-2 py-1 text-sm font-bold text-stone-900"
                        />
                      </div>
                    )
                  })}
                </div>
              )}
            </div>
          )}
        </div>
      </div>
      {isSaved ? (
        <div className="mt-3 flex items-center gap-2">
          <span className="inline-flex items-center border-2 border-stone-900 bg-green-300 px-3 py-1.5 text-[11px] font-black uppercase text-stone-900 shadow-[2px_2px_0_#1c1917]">
            ✅ Đã lưu
          </span>
        </div>
      ) : (
        <ActionButtons
          component={component}
          onAction={handleServiceCardAction}
          loading={isSaving}
          loadingLabel="Đang lưu..."
        />
      )}
    </div>
  )
}

function renderRevenueChart(component: UIComponent) {
  const data = component.data
  const totalRevenue = toNumber(data['total_revenue']) ?? 0
  const period = renderSimpleValue(data['period'])
  const clinicName = renderSimpleValue(data['clinic_name'])
  const items = asRecordArray(data['items'])
  const breakdown = asRecord(data['breakdown']) ?? {}

  const chartData = items.map((item: Record<string, unknown>) => ({
    x: String(item['date'] ?? item['label'] ?? ''),
    y: toNumber(item['totalRevenue'] ?? item['revenue'] ?? item['value'] ?? 0) ?? 0,
  }))

  const options: ApexOptions = {
    chart: { type: 'area', height: 220, toolbar: { show: false }, zoom: { enabled: false } },
    stroke: { curve: 'smooth', width: 2 },
    fill: { type: 'gradient', gradient: { opacityFrom: 0.4, opacityTo: 0.05 } },
    colors: ['#d97706'],
    xaxis: {
      labels: { style: { fontSize: '10px' } },
      tickAmount: Math.min(chartData.length, 7),
    },
    yaxis: {
      labels: {
        formatter: (val: number) => `${(val / 1000).toFixed(0)}k`,
        style: { fontSize: '10px' },
      },
    },
    tooltip: {
      y: { formatter: (val: number) => `${val.toLocaleString('vi-VN')} đ` },
    },
    grid: { borderColor: '#e7e5e4' },
    dataLabels: { enabled: false },
  }

  const series = [{ name: 'Doanh thu', data: chartData }]

  return (
    <div key={component.id} className="bg-white border-2 border-stone-900 rounded-xl p-4 shadow-[4px_4px_0_#1c1917]">
      <div className="flex items-center justify-between mb-2">
        <h4 className="font-bold text-stone-900 text-sm">📈 Doanh thu {period}</h4>
        {clinicName && clinicName !== 'Chưa có' && (
          <span className="text-[10px] font-bold text-stone-500">{clinicName}</span>
        )}
      </div>
      <p className="text-lg font-black text-amber-600 mb-3">{formatCurrency(totalRevenue)}</p>
      {chartData.length > 0 ? (
        <ReactApexChart options={options} series={series} type="area" height={220} />
      ) : (
        <p className="text-xs text-stone-500 text-center py-4">Chưa có dữ liệu doanh thu</p>
      )}
      {breakdown && Object.keys(breakdown).length > 0 && (
        <div className="mt-3 grid grid-cols-3 gap-2 text-center">
          {breakdown['qr_revenue'] != null && (
            <div className="bg-blue-50 border border-stone-900 rounded-lg p-2">
              <p className="text-[10px] font-black uppercase text-stone-600">QR</p>
              <p className="text-xs font-bold text-stone-900">{formatCurrency(toNumber(breakdown['qr_revenue']) ?? 0)}</p>
            </div>
          )}
          {breakdown['cash_revenue'] != null && (
            <div className="bg-green-50 border border-stone-900 rounded-lg p-2">
              <p className="text-[10px] font-black uppercase text-stone-600">Tiền mặt</p>
              <p className="text-xs font-bold text-stone-900">{formatCurrency(toNumber(breakdown['cash_revenue']) ?? 0)}</p>
            </div>
          )}
          {breakdown['withdrawable'] != null && (
            <div className="bg-amber-50 border border-stone-900 rounded-lg p-2">
              <p className="text-[10px] font-black uppercase text-stone-600">Rút được</p>
              <p className="text-xs font-bold text-stone-900">{formatCurrency(toNumber(breakdown['withdrawable']) ?? 0)}</p>
            </div>
          )}
        </div>
      )}
    </div>
  )
}

function renderClinicMetrics(component: UIComponent) {
  const data = component.data
  const totalBookings = toNumber(data['total_bookings_this_month'] ?? data['total_bookings']) ?? 0
  const totalRevenue = toNumber(data['total_revenue_this_month'] ?? data['total_revenue']) ?? 0
  const topServices = asRecordArray(data['top_services'])

  const series = topServices.length > 0
    ? [{
        name: 'Số lượng',
        data: topServices.map((s: Record<string, unknown>) => toNumber(s['count'] ?? s['total'] ?? 0) ?? 0),
      }]
    : []

  const categories = topServices.map((s: Record<string, unknown>) =>
    renderSimpleValue(s['name'] ?? s['service_name'] ?? s['service'])
  )

  const options: ApexOptions = {
    chart: { type: 'bar', height: 200, toolbar: { show: false } },
    plotOptions: { bar: { horizontal: false, borderRadius: 4 } },
    colors: ['#d97706'],
    xaxis: {
      categories,
      labels: { rotate: -45, style: { fontSize: '10px' } },
    },
    yaxis: { labels: { style: { fontSize: '10px' } } },
    grid: { borderColor: '#e7e5e4' },
    dataLabels: { enabled: false },
  }

  return (
    <div key={component.id} className="bg-white border-2 border-stone-900 rounded-xl p-4 shadow-[4px_4px_0_#1c1917]">
      <h4 className="font-bold text-stone-900 text-sm mb-3">📊 Chỉ số phòng khám</h4>
      <div className="grid grid-cols-2 gap-3 mb-4">
        <div className="bg-amber-50 border-2 border-stone-900 rounded-lg p-3 text-center">
          <p className="text-[10px] font-black uppercase text-stone-600">Lịch tháng này</p>
          <p className="text-xl font-black text-amber-600">{totalBookings}</p>
        </div>
        <div className="bg-green-50 border-2 border-stone-900 rounded-lg p-3 text-center">
          <p className="text-[10px] font-black uppercase text-stone-600">Doanh thu</p>
          <p className="text-sm font-black text-green-600">{formatCurrency(totalRevenue)}</p>
        </div>
      </div>
      {topServices.length > 0 && (
        <div>
          <p className="text-[10px] font-black uppercase text-stone-600 mb-2">Dịch vụ phổ biến</p>
          <ReactApexChart options={options} series={series} type="bar" height={200} />
        </div>
      )}
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
  selectedClinicId?: string,
) {
  switch (component.type) {
    case 'clinic_card':
      return renderClinicCard(component, onAction, selectedClinicId)
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
    case 'revenue_chart':
      return renderRevenueChart(component)
    case 'clinic_metrics':
      return renderClinicMetrics(component)
    default:
      return (
        <pre key={component.id} className="text-xs whitespace-pre-wrap break-words bg-stone-100 border-2 border-stone-900 rounded-xl p-3">
          {JSON.stringify(component.data, null, 2)}
        </pre>
      )
  }
}

export function UISchemaRenderer({ schema, onAction, selectedClinicId }: UISchemaRendererProps) {
  const layoutClass =
    schema.layout === 'grid'
      ? 'grid grid-cols-1 gap-3'
      : schema.layout === 'slot_grid'
        ? 'flex flex-wrap gap-2'
        : 'flex flex-col gap-3'

  return (
    <div className={layoutClass}>
      {schema.components.map((component) => renderComponent(component, onAction, selectedClinicId))}
    </div>
  )
}
