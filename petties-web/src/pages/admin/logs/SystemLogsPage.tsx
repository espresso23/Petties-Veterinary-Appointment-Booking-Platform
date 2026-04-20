import { Fragment, useCallback, useEffect, useMemo, useState } from 'react'
import { useToast } from '../../../components/Toast'
import { backendSystemLogApi, type AuditLogItem } from '../../../services/agentService'

const PAGE_SIZE = 20
const REDACTED_IP = '[REDACTED_IP]'

const IPV4_PATTERN = /\b(?:(?:25[0-5]|2[0-4]\d|1\d\d|[1-9]?\d)\.){3}(?:25[0-5]|2[0-4]\d|1\d\d|[1-9]?\d)\b/g
const IPV6_PATTERN = /\b(?:[A-Fa-f0-9]{1,4}:){2,7}[A-Fa-f0-9]{1,4}\b/g

const isIpSensitiveKey = (key: string): boolean => {
  const normalized = key.trim().toLowerCase().replace(/[^a-z0-9]/g, '')
  if (!normalized) return false

  return [
    'ip',
    'ipaddress',
    'clientip',
    'sourceip',
    'userip',
    'proxyip',
    'forwardedfor',
    'xforwardedfor',
    'xrealip',
    'remoteaddr',
    'remoteaddress',
  ].some((keyword) => normalized.includes(keyword))
}

const redactIpInString = (value: string): string => {
  return value.replace(IPV4_PATTERN, REDACTED_IP).replace(IPV6_PATTERN, REDACTED_IP)
}

const sanitizePayload = (value: unknown): unknown => {
  if (typeof value === 'string') {
    return redactIpInString(value)
  }

  if (Array.isArray(value)) {
    return value.map((item) => sanitizePayload(item))
  }

  if (value && typeof value === 'object') {
    const source = value as Record<string, unknown>
    const sanitizedEntries = Object.entries(source).map(([key, itemValue]) => {
      if (isIpSensitiveKey(key)) {
        return [key, REDACTED_IP]
      }
      return [key, sanitizePayload(itemValue)]
    })

    return Object.fromEntries(sanitizedEntries)
  }

  return value
}

const toText = (value: unknown): string => {
  if (typeof value === 'string') return value.trim()
  if (typeof value === 'number' || typeof value === 'boolean') return String(value)
  return ''
}

const pickRecordValue = (record: Record<string, unknown>, keys: string[]): string => {
  for (const key of keys) {
    const value = toText(record[key])
    if (value) return value
  }
  return ''
}

const normalizeActorLabel = (value: string): string => {
  const label = value.trim()
  const normalized = label.toLowerCase()
  if (normalized === 'anonymous' || normalized === 'anonymus') {
    return 'System'
  }
  return label
}

const resolveActor = (item: AuditLogItem): string => {
  const actor = pickRecordValue(item.actor, ['user_id', 'userId', 'username', 'email', 'id'])
  if (!actor) return 'Không rõ'
  return normalizeActorLabel(actor)
}

const resolveRequestId = (item: AuditLogItem): string => {
  return (
    pickRecordValue(item.correlation, ['request_id', 'requestId', 'trace_id', 'traceId']) ||
    'N/A'
  )
}

const resolveStatus = (item: AuditLogItem): string => {
  const status =
    pickRecordValue(item.result, ['status', 'state', 'outcome']) ||
    pickRecordValue(item.metadata, ['status'])
  if (status) return status.toUpperCase()

  const success = item.result.success
  if (typeof success === 'boolean') {
    return success ? 'SUCCESS' : 'FAILED'
  }

  return 'UNKNOWN'
}

const formatDateTime = (value: string): string => {
  const parsed = new Date(value)
  if (Number.isNaN(parsed.getTime())) return value
  return parsed.toLocaleString('vi-VN', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false,
  })
}

const extractHttpStatusCode = (value: string): string => {
  const match = value.match(/\b[1-5]\d{2}\b/)
  return match ? match[0] : ''
}

const resolveHttpStatusCode = (item: AuditLogItem): string => {
  const candidates = [
    pickRecordValue(item.result, ['status_code', 'statusCode', 'http_status', 'httpStatus', 'code']),
    pickRecordValue(item.metadata, ['status_code', 'statusCode', 'http_status', 'httpStatus', 'code']),
    pickRecordValue(item.correlation, ['status_code', 'statusCode']),
  ]

  for (const candidate of candidates) {
    const parsed = extractHttpStatusCode(candidate)
    if (parsed) return parsed
  }

  return ''
}

const statusClassName = (status: string): string => {
  if (status === 'SUCCESS' || status === 'UP') {
    return 'bg-emerald-100 text-emerald-800 border-emerald-300'
  }
  if (status === 'FAILED' || status === 'ERROR') {
    return 'bg-red-100 text-red-800 border-red-300'
  }
  return 'bg-stone-100 text-stone-700 border-stone-300'
}

const isFailureStatus = (status: string): boolean => {
  return status === 'FAILED' || status === 'ERROR'
}

const pickFailureMessage = (record: Record<string, unknown>): string => {
  const direct = pickRecordValue(record, [
    'error_message',
    'errorMessage',
    'error',
    'message',
    'detail',
    'reason',
    'cause',
    'exception',
    'stack_trace',
    'stackTrace',
  ])
  if (direct) return direct

  const nestedError = record.error
  if (nestedError && typeof nestedError === 'object') {
    const nested = pickRecordValue(nestedError as Record<string, unknown>, [
      'message',
      'detail',
      'reason',
      'code',
      'type',
    ])
    if (nested) return nested
  }

  return ''
}

const resolveFailureReason = (item: AuditLogItem, status: string): string => {
  if (!isFailureStatus(status)) {
    return ''
  }

  const fromResult = pickFailureMessage(item.result)
  if (fromResult) return redactIpInString(fromResult)

  const fromMetadata = pickFailureMessage(item.metadata)
  if (fromMetadata) return redactIpInString(fromMetadata)

  const fromChanges = pickFailureMessage(item.changes)
  if (fromChanges) return redactIpInString(fromChanges)

  const code =
    pickRecordValue(item.result, ['status_code', 'statusCode', 'http_status', 'code']) ||
    pickRecordValue(item.metadata, ['status_code', 'statusCode', 'http_status', 'code'])
  if (code) return `Yêu cầu thất bại với mã: ${code}`

  return 'Chưa có message lỗi chi tiết trong payload log.'
}

const resolveResource = (item: AuditLogItem): string => {
  const resourceType = pickRecordValue(item.resource, ['resource_type', 'resourceType', 'type'])
  const resourceId = pickRecordValue(item.resource, ['resource_id', 'resourceId', 'id'])
  if (resourceType && resourceId) return `${resourceType} • ${resourceId}`
  if (resourceType) return resourceType
  if (resourceId) return resourceId
  return 'N/A'
}

const formatJsonBlock = (value: unknown): string => {
  try {
    const text = JSON.stringify(value, null, 2)
    if (!text) return '{}'
    return text
  } catch {
    return String(value ?? '')
  }
}

const formatPayloadDisplay = (value: unknown): string => {
  const text = formatJsonBlock(sanitizePayload(value))
  if (text === '{}') {
    return '{\n  "message": "Payload rỗng"\n}'
  }
  return text
}

const buildFullPayload = (item: AuditLogItem): Record<string, unknown> => {
  return {
    event_id: item.event_id,
    occurred_at: item.occurred_at,
    service: item.service,
    environment: item.environment,
    action: item.action,
    actor: item.actor,
    resource: item.resource,
    result: item.result,
    correlation: item.correlation,
    metadata: item.metadata,
    changes: item.changes,
  }
}

export default function SystemLogsPage() {
  const { showToast } = useToast()

  const [items, setItems] = useState<AuditLogItem[]>([])
  const [loading, setLoading] = useState(true)
  const [reloading, setReloading] = useState(false)

  const [page, setPage] = useState(1)
  const [total, setTotal] = useState(0)
  const [serviceName, setServiceName] = useState('')
  const [fetchedAt, setFetchedAt] = useState('')

  const [statusFilter, setStatusFilter] = useState('ALL')
  const [actionInput, setActionInput] = useState('')
  const [userInput, setUserInput] = useState('')
  const [requestInput, setRequestInput] = useState('')
  const [statusCodeInput, setStatusCodeInput] = useState('')
  const [expandedRowKey, setExpandedRowKey] = useState<string | null>(null)

  const [appliedAction, setAppliedAction] = useState('')
  const [appliedUser, setAppliedUser] = useState('')
  const [appliedRequest, setAppliedRequest] = useState('')
  const [appliedStatusCode, setAppliedStatusCode] = useState('')

  const totalPages = useMemo(() => {
    const pages = Math.ceil(total / PAGE_SIZE)
    return pages > 0 ? pages : 1
  }, [total])

  const httpStatusCodeOptions = useMemo(() => {
    const commonCodes = ['200', '201', '204', '400', '401', '403', '404', '409', '422', '429', '500', '502', '503']
    const discoveredCodes = items
      .map((item) => resolveHttpStatusCode(item))
      .filter((code) => code.length > 0)
    return Array.from(new Set([...commonCodes, ...discoveredCodes])).sort(
      (a, b) => Number(a) - Number(b),
    )
  }, [items])

  const filteredItems = useMemo(() => {
    const codeFilter = appliedStatusCode.trim()
    if (!codeFilter) return items
    return items.filter((item) => resolveHttpStatusCode(item) === codeFilter)
  }, [appliedStatusCode, items])

  const pageStats = useMemo(() => {
    return filteredItems.reduce(
      (acc, item) => {
        const status = resolveStatus(item)
        if (status === 'SUCCESS' || status === 'UP') {
          acc.success += 1
        } else {
          acc.failed += 1
        }
        return acc
      },
      { success: 0, failed: 0 },
    )
  }, [filteredItems])

  const loadLogs = useCallback(
    async (silent = false) => {
      if (silent) {
        setReloading(true)
      } else {
        setLoading(true)
      }

      try {
        const response = await backendSystemLogApi.listAuditLogs({
          page,
          page_size: PAGE_SIZE,
          status: statusFilter === 'ALL' ? undefined : statusFilter,
          action: appliedAction || undefined,
          userId: appliedUser || undefined,
          requestId: appliedRequest || undefined,
        })
        setItems(response.items ?? [])
        setTotal(response.total ?? 0)
        setServiceName(response.service ?? '')
        setFetchedAt(response.fetchedAt ?? '')
      } catch {
        showToast('error', 'Không thể tải nhật ký hệ thống')
      } finally {
        setLoading(false)
        setReloading(false)
      }
    },
    [appliedAction, appliedRequest, appliedUser, page, showToast, statusFilter],
  )

  useEffect(() => {
    void loadLogs()
  }, [loadLogs])

  useEffect(() => {
    setExpandedRowKey(null)
  }, [page, statusFilter, appliedAction, appliedUser, appliedRequest, appliedStatusCode])

  const applyTextFilters = () => {
    setPage(1)
    setAppliedAction(actionInput.trim())
    setAppliedUser(userInput.trim())
    setAppliedRequest(requestInput.trim())
    setAppliedStatusCode(statusCodeInput.trim())
  }

  const resetFilters = () => {
    setStatusFilter('ALL')
    setActionInput('')
    setUserInput('')
    setRequestInput('')
    setStatusCodeInput('')
    setAppliedAction('')
    setAppliedUser('')
    setAppliedRequest('')
    setAppliedStatusCode('')
    setPage(1)
  }

  const copyPayloadText = useCallback(
    async (payloadText: string) => {
      try {
        if (!navigator?.clipboard?.writeText) {
          throw new Error('Clipboard API unavailable')
        }
        await navigator.clipboard.writeText(payloadText)
        showToast('success', 'Đã sao chép payload')
      } catch {
        showToast('error', 'Không thể sao chép payload')
      }
    },
    [showToast],
  )

  return (
    <div className="min-h-screen bg-stone-50 p-6">
      <div className="mx-auto max-w-[1400px] space-y-4">
        <div className="rounded-xl border-2 border-stone-900 bg-white p-6 shadow-[4px_4px_0_#1c1917]">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
            <div>
              <h1 className="text-2xl font-bold text-stone-900">Nhật ký hệ thống</h1>
              <p className="mt-2 text-sm text-stone-700">
                Theo dõi nhật ký backend theo thời gian thực để kiểm tra luồng hành động và tình trạng xử lý.
              </p>
              <div className="mt-3 flex flex-wrap items-center gap-2 text-xs font-semibold text-stone-600">
                <span className="rounded border border-stone-300 bg-stone-100 px-2 py-1">
                  Tổng bản ghi: {total}
                </span>
                <span className="rounded border border-stone-300 bg-stone-100 px-2 py-1">
                  Dịch vụ: {serviceName || 'N/A'}
                </span>
                <span className="rounded border border-stone-300 bg-stone-100 px-2 py-1">
                  Cập nhật: {fetchedAt ? formatDateTime(fetchedAt) : 'N/A'}
                </span>
              </div>
            </div>

            <button
              type="button"
              onClick={() => void loadLogs(true)}
              disabled={loading || reloading}
              className="inline-flex items-center justify-center border-2 border-stone-900 bg-amber-400 px-4 py-2 text-sm font-bold uppercase text-stone-900 shadow-[3px_3px_0_#1c1917] disabled:cursor-not-allowed disabled:opacity-60"
            >
              {reloading ? 'Đang tải...' : 'Làm mới'}
            </button>
          </div>
        </div>

        <div className="rounded-xl border-2 border-stone-900 bg-white p-4 shadow-[4px_4px_0_#1c1917]">
          <div className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-7">
            <div>
              <label className="mb-1 block text-xs font-bold uppercase text-stone-600">Trạng thái</label>
              <select
                value={statusFilter}
                onChange={(event) => {
                  setStatusFilter(event.target.value)
                  setPage(1)
                }}
                aria-label="Lọc trạng thái"
                title="Lọc trạng thái"
                className="w-full border-2 border-stone-900 px-3 py-2 text-sm font-semibold"
              >
                <option value="ALL">Tất cả</option>
                <option value="SUCCESS">SUCCESS</option>
                <option value="FAILED">FAILED</option>
                <option value="ERROR">ERROR</option>
              </select>
            </div>

            <div>
              <label className="mb-1 block text-xs font-bold uppercase text-stone-600">Action</label>
              <input
                value={actionInput}
                onChange={(event) => setActionInput(event.target.value)}
                placeholder="Ví dụ: CREATE_BOOKING"
                className="w-full border-2 border-stone-900 px-3 py-2 text-sm font-medium"
              />
            </div>

            <div>
              <label className="mb-1 block text-xs font-bold uppercase text-stone-600">User ID</label>
              <input
                value={userInput}
                onChange={(event) => setUserInput(event.target.value)}
                placeholder="ID người dùng"
                className="w-full border-2 border-stone-900 px-3 py-2 text-sm font-medium"
              />
            </div>

            <div>
              <label className="mb-1 block text-xs font-bold uppercase text-stone-600">Request ID</label>
              <input
                value={requestInput}
                onChange={(event) => setRequestInput(event.target.value)}
                placeholder="Trace/Request ID"
                className="w-full border-2 border-stone-900 px-3 py-2 text-sm font-medium"
              />
            </div>

            <div>
              <label className="mb-1 block text-xs font-bold uppercase text-stone-600">Mã HTTP</label>
              <select
                value={statusCodeInput}
                onChange={(event) => setStatusCodeInput(event.target.value)}
                aria-label="Lọc mã HTTP"
                title="Lọc mã HTTP"
                className="w-full border-2 border-stone-900 px-3 py-2 text-sm font-semibold"
              >
                <option value="">Tất cả mã</option>
                {httpStatusCodeOptions.map((code) => (
                  <option key={code} value={code}>
                    {code}
                  </option>
                ))}
              </select>
            </div>

            <div className="flex items-end gap-2 md:col-span-2 xl:col-span-2">
              <button
                type="button"
                onClick={applyTextFilters}
                className="flex-1 border-2 border-stone-900 bg-blue-200 px-3 py-2 text-sm font-bold uppercase text-stone-900 shadow-[3px_3px_0_#1c1917]"
              >
                Áp dụng lọc
              </button>
              <button
                type="button"
                onClick={resetFilters}
                className="flex-1 border-2 border-stone-900 bg-stone-200 px-3 py-2 text-sm font-bold uppercase text-stone-900 shadow-[3px_3px_0_#1c1917]"
              >
                Đặt lại
              </button>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
          <div className="rounded-xl border-2 border-stone-900 bg-emerald-50 p-4 shadow-[3px_3px_0_#1c1917]">
            <p className="text-xs font-bold uppercase text-emerald-800">Success (trang hiện tại)</p>
            <p className="mt-1 text-2xl font-black text-emerald-900">{pageStats.success}</p>
          </div>
          <div className="rounded-xl border-2 border-stone-900 bg-red-50 p-4 shadow-[3px_3px_0_#1c1917]">
            <p className="text-xs font-bold uppercase text-red-800">Fail/Error (trang hiện tại)</p>
            <p className="mt-1 text-2xl font-black text-red-900">{pageStats.failed}</p>
          </div>
        </div>

        <div className="overflow-hidden rounded-xl border-2 border-stone-900 bg-white shadow-[4px_4px_0_#1c1917]">
          <div className="overflow-x-auto">
            <table className="w-full table-fixed divide-y divide-stone-300">
              <thead className="bg-stone-100">
                <tr>
                  <th className="w-[176px] px-3 py-2 text-left text-xs font-bold uppercase text-stone-700">Thời gian</th>
                  <th className="w-[92px] px-3 py-2 text-left text-xs font-bold uppercase text-stone-700">Action</th>
                  <th className="w-[124px] px-3 py-2 text-left text-xs font-bold uppercase text-stone-700">Trạng thái</th>
                  <th className="w-[320px] px-3 py-2 text-left text-xs font-bold uppercase text-stone-700">User</th>
                  <th className="w-[120px] px-3 py-2 text-left text-xs font-bold uppercase text-stone-700">Request ID</th>
                  <th className="w-[96px] px-3 py-2 text-left text-xs font-bold uppercase text-stone-700">Mã HTTP</th>
                  <th className="px-3 py-2 text-left text-xs font-bold uppercase text-stone-700">Event ID</th>
                  <th className="sticky right-0 z-10 w-[96px] border-l-2 border-stone-300 bg-stone-100 px-2 py-2 text-right text-xs font-bold uppercase text-stone-700">Chi tiết</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-stone-200 bg-white">
                {loading ? (
                  <tr>
                    <td colSpan={8} className="px-4 py-8 text-center text-sm font-medium text-stone-600">
                      Đang tải nhật ký hệ thống...
                    </td>
                  </tr>
                ) : filteredItems.length === 0 ? (
                  <tr>
                    <td colSpan={8} className="px-4 py-8 text-center text-sm font-medium text-stone-600">
                      Không có bản ghi phù hợp bộ lọc hiện tại.
                    </td>
                  </tr>
                ) : (
                  filteredItems.map((item, index) => {
                    const status = resolveStatus(item)
                    const statusCode = resolveHttpStatusCode(item)
                    const rowKey = `${item.event_id || 'event'}-${index}`
                    const expanded = expandedRowKey === rowKey
                    const failureReason = resolveFailureReason(item, status)
                    const fullPayloadText = formatPayloadDisplay(buildFullPayload(item))
                    return (
                      <Fragment key={rowKey}>
                        <tr className="align-top hover:bg-stone-50">
                          <td className="truncate px-3 py-3 text-xs text-stone-700">{formatDateTime(item.occurred_at)}</td>
                          <td className="truncate px-3 py-3 text-xs font-semibold text-stone-900">{item.action || 'N/A'}</td>
                          <td className="px-3 py-3 text-xs">
                            <span
                              className={`inline-flex rounded border px-2 py-0.5 text-[11px] font-bold ${statusClassName(status)}`}
                            >
                              {status}
                            </span>
                          </td>
                          <td className="truncate px-3 py-3 text-xs text-stone-700">{resolveActor(item)}</td>
                          <td className="truncate px-3 py-3 text-xs text-stone-700">{resolveRequestId(item)}</td>
                          <td className="truncate px-3 py-3 text-xs font-semibold text-stone-700">{statusCode || 'N/A'}</td>
                          <td className="truncate px-3 py-3 text-xs text-stone-600">{item.event_id || 'N/A'}</td>
                          <td className="sticky right-0 z-10 w-[96px] border-l border-stone-200 bg-white px-2 py-3 text-right text-xs">
                            <button
                              type="button"
                              onClick={() =>
                                setExpandedRowKey((prev) => (prev === rowKey ? null : rowKey))
                              }
                              className="border-2 border-stone-900 bg-blue-100 px-2 py-1 text-[11px] font-bold uppercase text-stone-900 shadow-[2px_2px_0_#1c1917]"
                            >
                              {expanded ? 'Ẩn' : 'Xem'}
                            </button>
                          </td>
                        </tr>

                        {expanded ? (
                          <tr className="bg-stone-50">
                            <td colSpan={8} className="px-3 py-3">
                              <div className="rounded-xl border-2 border-stone-900 bg-white p-4 shadow-[3px_3px_0_#1c1917]">
                                <div className="grid grid-cols-1 gap-3 lg:grid-cols-4">
                                  <div className="rounded border border-stone-300 bg-stone-50 p-2">
                                    <p className="text-[10px] font-bold uppercase text-stone-500">Action</p>
                                    <p className="mt-1 text-xs font-semibold text-stone-900 break-words">{item.action || 'N/A'}</p>
                                  </div>
                                  <div className="rounded border border-stone-300 bg-stone-50 p-2">
                                    <p className="text-[10px] font-bold uppercase text-stone-500">Resource</p>
                                    <p className="mt-1 text-xs font-semibold text-stone-900 break-words">{resolveResource(item)}</p>
                                  </div>
                                  <div className="rounded border border-stone-300 bg-stone-50 p-2">
                                    <p className="text-[10px] font-bold uppercase text-stone-500">Request ID</p>
                                    <p className="mt-1 text-xs font-semibold text-stone-900 break-words">{resolveRequestId(item)}</p>
                                  </div>
                                  <div className="rounded border border-stone-300 bg-stone-50 p-2">
                                    <p className="text-[10px] font-bold uppercase text-stone-500">Event ID</p>
                                    <p className="mt-1 text-xs font-semibold text-stone-900 break-words">{item.event_id || 'N/A'}</p>
                                  </div>
                                </div>

                                {isFailureStatus(status) ? (
                                  <div className="mt-3 rounded border-2 border-red-300 bg-red-50 p-3">
                                    <p className="text-xs font-bold uppercase text-red-700">Lý do fail</p>
                                    <p className="mt-1 text-sm font-semibold text-red-900 break-words">{failureReason}</p>
                                  </div>
                                ) : (
                                  <div className="mt-3 rounded border border-emerald-300 bg-emerald-50 p-3">
                                    <p className="text-xs font-bold uppercase text-emerald-700">Kết quả xử lý</p>
                                    <p className="mt-1 text-sm font-semibold text-emerald-900">
                                      Bản ghi này không có trạng thái thất bại.
                                    </p>
                                  </div>
                                )}

                                <div className="mt-3 flex flex-wrap gap-2">
                                  <button
                                    type="button"
                                    onClick={() => void copyPayloadText(fullPayloadText)}
                                    className="border-2 border-stone-900 bg-amber-100 px-2 py-1 text-[11px] font-bold uppercase text-stone-900 shadow-[2px_2px_0_#1c1917]"
                                  >
                                    Copy full payload
                                  </button>
                                </div>

                                <div className="mt-3">
                                  <p className="mb-1 text-[10px] font-bold uppercase text-stone-600">
                                    Payload đầy đủ (toàn bộ bản ghi)
                                  </p>
                                  <pre className="max-h-[520px] min-h-[120px] overflow-auto whitespace-pre-wrap break-words rounded border-2 border-stone-900 bg-stone-100 p-3 text-[11px] font-medium text-stone-900">
                                    {fullPayloadText}
                                  </pre>
                                </div>

                                <div className="mt-3 grid grid-cols-1 gap-3 xl:grid-cols-2">
                                  <div>
                                    <p className="mb-1 text-[10px] font-bold uppercase text-stone-600">Result payload</p>
                                    <pre className="max-h-52 min-h-[96px] overflow-auto whitespace-pre-wrap break-words rounded border-2 border-stone-900 bg-stone-100 p-3 text-[11px] font-medium text-stone-900">
                                      {formatPayloadDisplay(item.result)}
                                    </pre>
                                  </div>
                                  <div>
                                    <p className="mb-1 text-[10px] font-bold uppercase text-stone-600">Metadata payload</p>
                                    <pre className="max-h-52 min-h-[96px] overflow-auto whitespace-pre-wrap break-words rounded border-2 border-stone-900 bg-stone-100 p-3 text-[11px] font-medium text-stone-900">
                                      {formatPayloadDisplay(item.metadata)}
                                    </pre>
                                  </div>
                                  <div>
                                    <p className="mb-1 text-[10px] font-bold uppercase text-stone-600">Correlation payload</p>
                                    <pre className="max-h-52 min-h-[96px] overflow-auto whitespace-pre-wrap break-words rounded border-2 border-stone-900 bg-stone-100 p-3 text-[11px] font-medium text-stone-900">
                                      {formatPayloadDisplay(item.correlation)}
                                    </pre>
                                  </div>
                                  <div>
                                    <p className="mb-1 text-[10px] font-bold uppercase text-stone-600">Resource payload</p>
                                    <pre className="max-h-52 min-h-[96px] overflow-auto whitespace-pre-wrap break-words rounded border-2 border-stone-900 bg-stone-100 p-3 text-[11px] font-medium text-stone-900">
                                      {formatPayloadDisplay(item.resource)}
                                    </pre>
                                  </div>
                                </div>
                              </div>
                            </td>
                          </tr>
                        ) : null}
                      </Fragment>
                    )
                  })
                )}
              </tbody>
            </table>
          </div>

          <div className="flex flex-col gap-2 border-t-2 border-stone-900 bg-stone-50 px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
            <p className="text-xs font-semibold text-stone-700">
              Trang {page}/{totalPages} • Hiển thị {filteredItems.length} bản ghi
            </p>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => setPage((prev) => Math.max(1, prev - 1))}
                disabled={page <= 1 || loading || reloading}
                className="border-2 border-stone-900 bg-white px-3 py-1.5 text-xs font-bold uppercase text-stone-900 shadow-[2px_2px_0_#1c1917] disabled:cursor-not-allowed disabled:opacity-50"
              >
                Trang trước
              </button>
              <button
                type="button"
                onClick={() => setPage((prev) => Math.min(totalPages, prev + 1))}
                disabled={page >= totalPages || loading || reloading}
                className="border-2 border-stone-900 bg-white px-3 py-1.5 text-xs font-bold uppercase text-stone-900 shadow-[2px_2px_0_#1c1917] disabled:cursor-not-allowed disabled:opacity-50"
              >
                Trang sau
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
