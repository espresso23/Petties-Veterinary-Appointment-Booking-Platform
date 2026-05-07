import { Fragment, useCallback, useEffect, useMemo, useState } from 'react'
import { ConfirmDialog } from '../../../components/common/ConfirmDialog'
import { useToast } from '../../../components/Toast'
import { env } from '../../../config/env'
import { backendSystemLogApi, type AuditLogItem } from '../../../services/agentService'

const PAGE_SIZE = 20
// Admin logs page: show full client IP for incident response / spam tracing.
// If you ever need to re-enable redaction, change this flag to true.
const SHOULD_REDACT_IP = false
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
  if (!SHOULD_REDACT_IP) return value
  return value.replace(IPV4_PATTERN, REDACTED_IP).replace(IPV6_PATTERN, REDACTED_IP)
}

const sanitizePayload = (value: unknown): unknown => {
  if (!SHOULD_REDACT_IP) return value
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

type MonitoringTab = 'HEALTH' | 'LOAD' | 'SECURITY' | 'RAW_LOGS'
type SourceScope = 'ALL' | 'BACKEND' | 'AI'

type DeleteDialogState =
  | {
      mode: 'selected'
      source: SourceScope
      eventIds: string[]
    }
  | {
      mode: 'time-range'
      source: SourceScope
      fromTime: string
      toTime: string
    }

interface ServiceHealth {
  status: 'checking' | 'healthy' | 'error'
  message: string
  version?: string
}

interface PrometheusSample {
  name: string
  labels: Record<string, string>
  value: number
}

interface LoadMetricsSnapshot {
  source: 'prometheus' | 'logs'
  backendRequestTotal: number | null
  backendErrorRate: number | null
  backendP95Ms: number | null
  aiRequestTotal: number | null
  aiErrorRate: number | null
  aiP95Ms: number | null
  aiInFlight: number | null
  warning: string
  updatedAt: string
}

const MONITORING_TABS: Array<{ key: MonitoringTab; label: string }> = [
  { key: 'HEALTH', label: 'Sức khỏe' },
  { key: 'LOAD', label: 'Quá tải' },
  { key: 'SECURITY', label: 'An toàn' },
  { key: 'RAW_LOGS', label: 'Log thô' },
]

const trimTrailingSlash = (value: string): string => value.replace(/\/+$/, '')

const isTunnelHostname = (hostname: string): boolean => {
  const value = hostname.trim().toLowerCase()
  if (!value) return false
  return value.includes('ngrok') || value.endsWith('.loca.lt') || value.endsWith('.trycloudflare.com')
}

const resolveObservabilityUrl = (
  envKey: 'VITE_GRAFANA_URL' | 'VITE_PROMETHEUS_URL',
  fallbackPort: number,
): string => {
  const configured = String(import.meta.env[envKey] ?? '').trim()
  if (configured) {
    return trimTrailingSlash(configured)
  }

  if (typeof window !== 'undefined') {
    const host = window.location.hostname
    const protocol = window.location.protocol

    if (host === 'localhost' || host === '127.0.0.1') {
      return `${protocol}//${host}:${fallbackPort}`
    }

    // Tunnel hosts typically expose only the tunneled upstream port.
    // Use localhost for direct observability tools unless explicit env URL is provided.
    if (isTunnelHostname(host)) {
      return `http://localhost:${fallbackPort}`
    }

    // Production logic: Use the unified gateway domain with subpaths
    const subpath = envKey === 'VITE_GRAFANA_URL' ? '/grafana' : '/prometheus'
    
    // api.petties.world is our primary gateway for monitoring
    const gatewayHost = 'api.petties.world'
    return `${protocol}//${gatewayHost}${subpath}`
  }

  return `http://localhost:${fallbackPort}`
}

const buildGrafanaDashboardUrl = (grafanaBaseUrl: string): string => {
  return `${trimTrailingSlash(grafanaBaseUrl)}/d/petties-observability/petties-observability?orgId=1`
}

const withTimeout = async (input: string, timeoutMs = 6000): Promise<Response> => {
  const controller = new AbortController()
  const timeoutId = globalThis.setTimeout(() => controller.abort(), timeoutMs)

  try {
    return await fetch(input, { method: 'GET', signal: controller.signal })
  } finally {
    globalThis.clearTimeout(timeoutId)
  }
}

const parseHealthPayload = async (response: Response): Promise<Record<string, unknown> | null> => {
  try {
    return (await response.json()) as Record<string, unknown>
  } catch {
    return null
  }
}

const PROM_LINE_PATTERN = /^([a-zA-Z_:][a-zA-Z0-9_:]*)(\{[^}]*\})?\s+([+-]?(?:\d+\.?\d*|\.\d+)(?:[eE][+-]?\d+)?|[+-]?Inf|NaN)$/

const parsePrometheusLabels = (raw: string): Record<string, string> => {
  const result: Record<string, string> = {}
  const matcher = /([a-zA-Z_][a-zA-Z0-9_]*)="((?:\\.|[^"\\])*)"/g
  let match: RegExpExecArray | null = matcher.exec(raw)

  while (match) {
    const key = match[1]
    const value = match[2]
      .replace(/\\"/g, '"')
      .replace(/\\\\/g, '\\')
      .replace(/\\n/g, '\n')
    result[key] = value
    match = matcher.exec(raw)
  }

  return result
}

const parsePrometheusValue = (raw: string): number | null => {
  if (raw === 'NaN') return null
  if (raw === '+Inf' || raw === 'Inf') return Number.POSITIVE_INFINITY
  if (raw === '-Inf') return Number.NEGATIVE_INFINITY

  const parsed = Number(raw)
  if (!Number.isFinite(parsed) && !Number.isNaN(parsed)) {
    return parsed
  }
  return Number.isNaN(parsed) ? null : parsed
}

const parsePrometheusText = (content: string): PrometheusSample[] => {
  const rows = content.split(/\r?\n/)
  const samples: PrometheusSample[] = []

  for (const rawRow of rows) {
    const line = rawRow.trim()
    if (!line || line.startsWith('#')) continue

    const match = line.match(PROM_LINE_PATTERN)
    if (!match) continue

    const name = match[1]
    const labels = match[2] ? parsePrometheusLabels(match[2]) : {}
    const parsedValue = parsePrometheusValue(match[3])
    if (parsedValue === null) continue

    samples.push({ name, labels, value: parsedValue })
  }

  return samples
}

const sumMetricValues = (
  samples: PrometheusSample[],
  metricName: string,
  predicate?: (labels: Record<string, string>) => boolean,
): number | null => {
  let total = 0
  let found = false

  for (const sample of samples) {
    if (sample.name !== metricName) continue
    if (predicate && !predicate(sample.labels)) continue
    if (!Number.isFinite(sample.value)) continue
    total += sample.value
    found = true
  }

  return found ? total : null
}

const estimateHistogramP95Ms = (samples: PrometheusSample[], bucketName: string): number | null => {
  const cumulativeByLe = new Map<number, number>()

  for (const sample of samples) {
    if (sample.name !== bucketName) continue
    const leValue = sample.labels.le
    if (!leValue) continue

    const parsedLe = leValue === '+Inf' ? Number.POSITIVE_INFINITY : Number(leValue)
    if (Number.isNaN(parsedLe) || !Number.isFinite(sample.value)) continue

    const current = cumulativeByLe.get(parsedLe) ?? 0
    cumulativeByLe.set(parsedLe, current + sample.value)
  }

  if (cumulativeByLe.size === 0) return null

  const buckets = Array.from(cumulativeByLe.entries())
    .map(([le, cumulative]) => ({ le, cumulative }))
    .sort((a, b) => a.le - b.le)

  const totalCount = buckets[buckets.length - 1]?.cumulative ?? 0
  if (totalCount <= 0) return null

  const target = totalCount * 0.95
  let previousLe = 0
  let previousCumulative = 0

  for (const bucket of buckets) {
    if (bucket.cumulative >= target) {
      if (!Number.isFinite(bucket.le)) {
        return previousLe > 0 ? previousLe * 1000 : null
      }

      const bucketSpan = bucket.cumulative - previousCumulative
      if (bucketSpan <= 0) {
        return bucket.le * 1000
      }

      const ratio = (target - previousCumulative) / bucketSpan
      const quantileSeconds = previousLe + (bucket.le - previousLe) * ratio
      return Math.max(0, quantileSeconds * 1000)
    }

    previousLe = Number.isFinite(bucket.le) ? bucket.le : previousLe
    previousCumulative = bucket.cumulative
  }

  return null
}

const parseNumericValue = (value: unknown): number | null => {
  if (typeof value === 'number' && Number.isFinite(value)) {
    return value
  }

  if (typeof value === 'string') {
    const cleaned = value.replace(',', '.').trim()
    if (!cleaned) return null
    const parsed = Number(cleaned)
    if (Number.isFinite(parsed)) {
      return parsed
    }
  }

  return null
}

const resolveLatencyMs = (item: AuditLogItem): number | null => {
  const candidates: unknown[] = [
    item.metadata.latency_ms,
    item.metadata.latencyMs,
    item.metadata.duration_ms,
    item.metadata.durationMs,
    item.metadata.duration,
    item.result.latency_ms,
    item.result.latencyMs,
  ]

  for (const candidate of candidates) {
    const parsed = parseNumericValue(candidate)
    if (parsed !== null && parsed >= 0) {
      return parsed
    }
  }

  return null
}

const percentile = (samples: number[], ratio: number): number | null => {
  if (samples.length === 0) return null
  const index = Math.max(0, Math.min(samples.length - 1, Math.ceil(samples.length * ratio) - 1))
  return samples[index]
}

const formatPercent = (value: number): string => `${value.toFixed(1)}%`

const formatPercentNullable = (value: number | null): string => {
  if (value === null || Number.isNaN(value)) return 'N/A'
  return formatPercent(value)
}

const formatCount = (value: number | null): string => {
  if (value === null || Number.isNaN(value)) return 'N/A'
  return Math.round(value).toLocaleString('vi-VN')
}

const formatLatency = (value: number | null): string => {
  if (value === null) return 'N/A'
  return `${Math.round(value)} ms`
}

const serviceHealthClassName = (status: ServiceHealth['status']): string => {
  if (status === 'healthy') return 'bg-emerald-50 text-emerald-900 border-emerald-300'
  if (status === 'error') return 'bg-red-50 text-red-900 border-red-300'
  return 'bg-stone-100 text-stone-700 border-stone-300'
}

const serviceHealthLabel = (status: ServiceHealth['status']): string => {
  if (status === 'healthy') return 'Hoạt động'
  if (status === 'error') return 'Lỗi kết nối'
  return 'Đang kiểm tra'
}

const resolveItemSourceScope = (item: AuditLogItem, backendServiceName: string): Exclude<SourceScope, 'ALL'> => {
  const itemService = (item.service || '').trim().toLowerCase()
  const backendService = (backendServiceName || '').trim().toLowerCase()

  if (backendService && itemService === backendService) {
    return 'BACKEND'
  }

  if (itemService.includes('ai')) {
    return 'AI'
  }

  return backendService ? 'AI' : 'BACKEND'
}

const sourceBadgeClassName = (source: Exclude<SourceScope, 'ALL'>): string => {
  if (source === 'BACKEND') {
    return 'bg-blue-100 text-blue-800 border-blue-300'
  }
  return 'bg-purple-100 text-purple-800 border-purple-300'
}

const sourceLabel = (source: Exclude<SourceScope, 'ALL'>): string => {
  return source === 'BACKEND' ? 'Backend' : 'AI Service'
}

export default function SystemLogsPage() {
  const { showToast } = useToast()

  const grafanaUrl = resolveObservabilityUrl('VITE_GRAFANA_URL', 3001)
  const grafanaDashboardUrl = buildGrafanaDashboardUrl(grafanaUrl)
  const prometheusUrl = resolveObservabilityUrl('VITE_PROMETHEUS_URL', 9090)
  const backendMetricsRawUrl = `${trimTrailingSlash(env.API_BASE_URL)}/actuator/prometheus`

  const [items, setItems] = useState<AuditLogItem[]>([])
  const [loading, setLoading] = useState(true)
  const [reloading, setReloading] = useState(false)

  const [page, setPage] = useState(1)
  const [total, setTotal] = useState(0)
  const [serviceName, setServiceName] = useState('')
  const [backendServiceName, setBackendServiceName] = useState('')
  const [fetchedAt, setFetchedAt] = useState('')

  const [statusFilter, setStatusFilter] = useState('ALL')
  const [sourceFilter, setSourceFilter] = useState<SourceScope>('ALL')
  const [actionInput, setActionInput] = useState('')
  const [userInput, setUserInput] = useState('')
  const [requestInput, setRequestInput] = useState('')
  const [statusCodeInput, setStatusCodeInput] = useState('')
  const [expandedRowKey, setExpandedRowKey] = useState<string | null>(null)
  const [selectedEventIds, setSelectedEventIds] = useState<string[]>([])
  const [deleteFromInput, setDeleteFromInput] = useState('')
  const [deleteToInput, setDeleteToInput] = useState('')
  const [deleteDialog, setDeleteDialog] = useState<DeleteDialogState | null>(null)
  const [deletingLogs, setDeletingLogs] = useState(false)
  const [activeTab, setActiveTab] = useState<MonitoringTab>('RAW_LOGS')

  const [aiHealth, setAiHealth] = useState<ServiceHealth>({
    status: 'checking',
    message: 'Đang kiểm tra...',
  })
  const [backendHealth, setBackendHealth] = useState<ServiceHealth>({
    status: 'checking',
    message: 'Đang kiểm tra...',
  })
  const [lastHealthCheckedAt, setLastHealthCheckedAt] = useState('')
  const [healthChecking, setHealthChecking] = useState(false)
  const [loadMetrics, setLoadMetrics] = useState<LoadMetricsSnapshot | null>(null)
  const [loadMetricsLoading, setLoadMetricsLoading] = useState(false)

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

  const allSelectableEventIds = useMemo(() => {
    return filteredItems
      .map((item) => item.event_id)
      .filter((eventId): eventId is string => Boolean(eventId))
  }, [filteredItems])

  const isAllVisibleSelected = useMemo(() => {
    if (allSelectableEventIds.length === 0) return false
    return allSelectableEventIds.every((eventId) => selectedEventIds.includes(eventId))
  }, [allSelectableEventIds, selectedEventIds])

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

  const loadStats = useMemo(() => {
    const latencySamples = filteredItems
      .map((item) => resolveLatencyMs(item))
      .filter((value): value is number => value !== null)
      .sort((a, b) => a - b)

    let clientErrorCount = 0
    let serverErrorCount = 0
    let failureCount = 0

    filteredItems.forEach((item) => {
      const status = resolveStatus(item)
      const statusCode = Number(resolveHttpStatusCode(item))
      if (!Number.isNaN(statusCode)) {
        if (statusCode >= 400 && statusCode < 500) clientErrorCount += 1
        if (statusCode >= 500) serverErrorCount += 1
      }

      if (status === 'FAILED' || status === 'ERROR' || status === 'DENIED') {
        failureCount += 1
      }
    })

    const requestCount = filteredItems.length
    const errorCount = clientErrorCount + serverErrorCount

    return {
      requestCount,
      clientErrorCount,
      serverErrorCount,
      failureCount,
      errorRate: requestCount > 0 ? (errorCount / requestCount) * 100 : 0,
      failureRate: requestCount > 0 ? (failureCount / requestCount) * 100 : 0,
      avgLatency:
        latencySamples.length > 0
          ? latencySamples.reduce((sum, value) => sum + value, 0) / latencySamples.length
          : null,
      p95Latency: percentile(latencySamples, 0.95),
      p99Latency: percentile(latencySamples, 0.99),
      highLatencyCount: latencySamples.filter((value) => value >= 1000).length,
      hasLatencyData: latencySamples.length > 0,
    }
  }, [filteredItems])

  const securityStats = useMemo(() => {
    let unauthorizedCount = 0
    let forbiddenCount = 0
    let deniedCount = 0
    let loginFailureCount = 0

    const suspiciousLogs = filteredItems.filter((item) => {
      const status = resolveStatus(item)
      const statusCode = resolveHttpStatusCode(item)
      const action = (item.action || '').toUpperCase()
      const isAuthFail = statusCode === '401' || statusCode === '403'
      const isDenied = status === 'DENIED' || status === 'FAILED' || status === 'ERROR'
      const isLoginAction = action.includes('LOGIN') || action.includes('AUTH')

      if (statusCode === '401') unauthorizedCount += 1
      if (statusCode === '403') forbiddenCount += 1
      if (status === 'DENIED') deniedCount += 1
      if (isLoginAction && (isAuthFail || isDenied)) {
        loginFailureCount += 1
      }

      return isAuthFail || isDenied
    })

    const recentSuspicious = [...suspiciousLogs]
      .sort((a, b) => new Date(b.occurred_at).getTime() - new Date(a.occurred_at).getTime())
      .slice(0, 6)

    return {
      unauthorizedCount,
      forbiddenCount,
      deniedCount,
      loginFailureCount,
      suspiciousCount: suspiciousLogs.length,
      recentSuspicious,
    }
  }, [filteredItems])

  const refreshLoadMetrics = useCallback(async () => {
    setLoadMetricsLoading(true)

    const backendMetricsUrl = `${trimTrailingSlash(env.API_BASE_URL)}/actuator/prometheus`

    const agentApiBase = typeof env.AGENT_API_BASE_URL === 'string' ? env.AGENT_API_BASE_URL : ''
    const agentServiceBase =
      typeof env.AGENT_SERVICE_URL === 'string' && env.AGENT_SERVICE_URL.length > 0
        ? env.AGENT_SERVICE_URL
        : agentApiBase

    const aiMetricsCandidates = Array.from(
      new Set(
        [
          `${trimTrailingSlash(agentApiBase)}/metrics`,
          `${trimTrailingSlash(agentServiceBase)}/metrics`,
          `${trimTrailingSlash(agentApiBase).replace(/\/api\/v1$/, '')}/metrics`,
          `${trimTrailingSlash(agentApiBase).replace(/\/api$/, '')}/metrics`,
        ]
          .map((url) => url.trim())
          .filter((url) => url.startsWith('http')),
      ),
    )

    let backendWarning = ''
    let aiWarning = ''
    let backendSamples: PrometheusSample[] = []
    let aiSamples: PrometheusSample[] = []

    try {
      const backendResponse = await withTimeout(backendMetricsUrl)
      if (backendResponse.ok) {
        backendSamples = parsePrometheusText(await backendResponse.text())
      } else {
        backendWarning = `Backend metrics lỗi HTTP ${backendResponse.status}`
      }
    } catch {
      backendWarning = 'Không lấy được backend metrics'
    }

    for (const candidate of aiMetricsCandidates) {
      try {
        const aiResponse = await withTimeout(candidate)
        if (!aiResponse.ok) {
          aiWarning = `AI metrics lỗi HTTP ${aiResponse.status}`
          continue
        }

        aiSamples = parsePrometheusText(await aiResponse.text())
        aiWarning = ''
        break
      } catch {
        aiWarning = 'Không lấy được AI metrics'
      }
    }

    const backendRequestTotal = sumMetricValues(backendSamples, 'http_server_requests_seconds_count')
    const backend5xxTotal = sumMetricValues(
      backendSamples,
      'http_server_requests_seconds_count',
      (labels) => /^5\d\d$/.test(labels.status ?? ''),
    )
    const backendErrorRate =
      backendRequestTotal && backendRequestTotal > 0 && backend5xxTotal !== null
        ? (backend5xxTotal / backendRequestTotal) * 100
        : null
    const backendP95Ms = estimateHistogramP95Ms(backendSamples, 'http_server_requests_seconds_bucket')

    const aiRequestTotal = sumMetricValues(aiSamples, 'petties_ai_http_requests_total')
    const aiErrorTotal = sumMetricValues(aiSamples, 'petties_ai_http_errors_total')
    const aiErrorRate =
      aiRequestTotal && aiRequestTotal > 0 && aiErrorTotal !== null
        ? (aiErrorTotal / aiRequestTotal) * 100
        : null
    const aiP95Ms = estimateHistogramP95Ms(aiSamples, 'petties_ai_http_request_duration_seconds_bucket')
    const aiInFlight = sumMetricValues(aiSamples, 'petties_ai_http_in_flight_requests')

    const hasPrometheusSignal =
      backendRequestTotal !== null ||
      backendP95Ms !== null ||
      aiRequestTotal !== null ||
      aiP95Ms !== null ||
      aiInFlight !== null

    if (!hasPrometheusSignal) {
      setLoadMetrics({
        source: 'logs',
        backendRequestTotal: loadStats.requestCount,
        backendErrorRate: loadStats.errorRate,
        backendP95Ms: loadStats.p95Latency,
        aiRequestTotal: null,
        aiErrorRate: null,
        aiP95Ms: null,
        aiInFlight: null,
        warning:
          backendWarning || aiWarning
            ? `${backendWarning}${backendWarning && aiWarning ? ' | ' : ''}${aiWarning}`
            : 'Không đọc được endpoint Prometheus, đang dùng fallback từ log.',
        updatedAt: new Date().toISOString(),
      })
      setLoadMetricsLoading(false)
      return
    }

    setLoadMetrics({
      source: 'prometheus',
      backendRequestTotal,
      backendErrorRate,
      backendP95Ms,
      aiRequestTotal,
      aiErrorRate,
      aiP95Ms,
      aiInFlight,
      warning:
        backendWarning || aiWarning
          ? `${backendWarning}${backendWarning && aiWarning ? ' | ' : ''}${aiWarning}`
          : '',
      updatedAt: new Date().toISOString(),
    })

    setLoadMetricsLoading(false)
  }, [loadStats.errorRate, loadStats.p95Latency, loadStats.requestCount])

  const checkServices = useCallback(async () => {
    setHealthChecking(true)

    const agentApiBase = typeof env.AGENT_API_BASE_URL === 'string' ? env.AGENT_API_BASE_URL : ''
    const agentServiceBase =
      typeof env.AGENT_SERVICE_URL === 'string' && env.AGENT_SERVICE_URL.length > 0
        ? env.AGENT_SERVICE_URL
        : agentApiBase

    const aiHealthCandidates = Array.from(
      new Set(
        [
          `${trimTrailingSlash(agentApiBase)}/health`,
          `${trimTrailingSlash(agentServiceBase)}/health`,
          `${trimTrailingSlash(agentApiBase).replace(/\/api$/, '')}/health`,
        ]
          .map((url) => url.trim())
          .filter((url) => url.startsWith('http')),
      ),
    )

    let aiErrorMessage = 'Không kết nối được'
    let aiHealthy = false

    for (const healthUrl of aiHealthCandidates) {
      try {
        const response = await withTimeout(healthUrl)

        if (!response.ok) {
          aiErrorMessage = `Lỗi HTTP ${response.status}`
          continue
        }

        const payload = await parseHealthPayload(response)
        const service = typeof payload?.service === 'string' ? payload.service : 'Dịch vụ AI'
        const version = typeof payload?.version === 'string' ? payload.version : undefined

        setAiHealth({
          status: 'healthy',
          message: service ? `Dịch vụ: ${service}` : 'Dịch vụ AI',
          version,
        })
        aiHealthy = true
        break
      } catch (error) {
        if (error instanceof DOMException && error.name === 'AbortError') {
          aiErrorMessage = 'Hết thời gian kết nối'
        }
      }
    }

    if (!aiHealthy) {
      setAiHealth({ status: 'error', message: aiErrorMessage })
    }

    try {
      const backendResponse = await withTimeout(`${env.API_BASE_URL}/actuator/health`)
      if (backendResponse.ok) {
        const payload = (await parseHealthPayload(backendResponse)) as { status?: string } | null
        setBackendHealth({
          status: 'healthy',
          message: payload?.status === 'UP' ? 'Hoạt động' : payload?.status || 'OK',
        })
      } else {
        setBackendHealth({ status: 'error', message: `Lỗi HTTP ${backendResponse.status}` })
      }
    } catch {
      setBackendHealth({ status: 'error', message: 'Không kết nối được' })
    } finally {
      setLastHealthCheckedAt(new Date().toISOString())
      setHealthChecking(false)
    }
  }, [])

  const loadLogs = useCallback(
    async (silent = false, overridePage?: number) => {
      if (silent) {
        setReloading(true)
      } else {
        setLoading(true)
      }

      const targetPage = overridePage ?? page

      try {
        const response = await backendSystemLogApi.listAuditLogs({
          page: targetPage,
          page_size: PAGE_SIZE,
          status: statusFilter === 'ALL' ? undefined : statusFilter,
          action: appliedAction || undefined,
          userId: appliedUser || undefined,
          requestId: appliedRequest || undefined,
          source: sourceFilter,
        })
        setItems(response.items ?? [])
        setTotal(response.total ?? 0)
        setServiceName(response.service ?? '')
        setBackendServiceName(response.backend_service ?? '')
        setFetchedAt(response.fetchedAt ?? '')
      } catch {
        showToast('error', 'Không thể tải nhật ký hệ thống')
      } finally {
        setLoading(false)
        setReloading(false)
      }
    },
    [appliedAction, appliedRequest, appliedUser, page, showToast, sourceFilter, statusFilter],
  )

  useEffect(() => {
    void loadLogs()
  }, [loadLogs])

  useEffect(() => {
    void checkServices()
  }, [checkServices])

  useEffect(() => {
    void refreshLoadMetrics()
  }, [refreshLoadMetrics])

  useEffect(() => {
    setExpandedRowKey(null)
    setSelectedEventIds([])
  }, [page, sourceFilter, statusFilter, appliedAction, appliedUser, appliedRequest, appliedStatusCode])

  const applyTextFilters = () => {
    setPage(1)
    setAppliedAction(actionInput.trim())
    setAppliedUser(userInput.trim())
    setAppliedRequest(requestInput.trim())
    setAppliedStatusCode(statusCodeInput.trim())
  }

  const resetFilters = () => {
    setStatusFilter('ALL')
    setSourceFilter('ALL')
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

  const toggleRowSelection = (eventId: string) => {
    setSelectedEventIds((prev) => {
      if (prev.includes(eventId)) {
        return prev.filter((id) => id !== eventId)
      }
      return [...prev, eventId]
    })
  }

  const toggleSelectAllVisible = () => {
    setSelectedEventIds((prev) => {
      if (isAllVisibleSelected) {
        return prev.filter((id) => !allSelectableEventIds.includes(id))
      }

      const union = new Set([...prev, ...allSelectableEventIds])
      return Array.from(union)
    })
  }

  const openSelectedDeleteDialog = () => {
    if (selectedEventIds.length === 0) {
      showToast('error', 'Vui lòng chọn ít nhất một bản ghi để xóa')
      return
    }

    setDeleteDialog({
      mode: 'selected',
      source: sourceFilter,
      eventIds: [...selectedEventIds],
    })
  }

  const openTimeRangeDeleteDialog = () => {
    const from = deleteFromInput.trim()
    const to = deleteToInput.trim()
    if (!from || !to) {
      showToast('error', 'Vui lòng chọn đủ thời gian bắt đầu và kết thúc')
      return
    }

    const fromDate = new Date(from)
    const toDate = new Date(to)
    if (Number.isNaN(fromDate.getTime()) || Number.isNaN(toDate.getTime())) {
      showToast('error', 'Khoảng thời gian không hợp lệ')
      return
    }
    if (fromDate.getTime() > toDate.getTime()) {
      showToast('error', 'Thời gian bắt đầu không được lớn hơn thời gian kết thúc')
      return
    }

    setDeleteDialog({
      mode: 'time-range',
      source: sourceFilter,
      fromTime: from,
      toTime: to,
    })
  }

  const executeDelete = useCallback(
    async (dialog: DeleteDialogState) => {
      if (deletingLogs) {
        return
      }

      setDeletingLogs(true)
      try {
        if (dialog.mode === 'selected') {
          const response = await backendSystemLogApi.bulkDeleteAuditLogs(dialog.eventIds, dialog.source)
          showToast('success', response.message || `Đã xóa ${response.deleted_count} bản ghi`) 
        } else {
          const response = await backendSystemLogApi.deleteAuditLogsByTimeRange(
            new Date(dialog.fromTime).toISOString(),
            new Date(dialog.toTime).toISOString(),
            dialog.source,
          )
          showToast('success', response.message || `Đã xóa ${response.deleted_count} bản ghi theo thời gian`)
        }

        setSelectedEventIds([])
        setExpandedRowKey(null)
        setPage(1)
        await loadLogs(true, 1)
      } catch (error) {
        const message = error instanceof Error ? error.message : 'Xóa audit logs thất bại'
        showToast('error', message)
      } finally {
        setDeletingLogs(false)
      }
    },
    [deletingLogs, loadLogs, showToast],
  )

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

  const refreshAllData = () => {
    void Promise.all([loadLogs(true), checkServices(), refreshLoadMetrics()])
  }

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

              <div className="mt-3 flex flex-wrap items-center gap-2">
                <a
                  href={grafanaDashboardUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex items-center justify-center border-2 border-stone-900 bg-emerald-300 px-3 py-1.5 text-xs font-bold uppercase text-stone-900 shadow-[2px_2px_0_#1c1917]"
                >
                  Mở Petties Observability
                </a>

                <a
                  href={grafanaUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex items-center justify-center border-2 border-stone-900 bg-emerald-200 px-3 py-1.5 text-xs font-bold uppercase text-stone-900 shadow-[2px_2px_0_#1c1917]"
                >
                  Mở Grafana
                </a>

                <a
                  href={prometheusUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex items-center justify-center border-2 border-stone-900 bg-blue-200 px-3 py-1.5 text-xs font-bold uppercase text-stone-900 shadow-[2px_2px_0_#1c1917]"
                >
                  Mở Prometheus
                </a>

                <a
                  href={backendMetricsRawUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex items-center justify-center border-2 border-stone-900 bg-amber-200 px-3 py-1.5 text-xs font-bold uppercase text-stone-900 shadow-[2px_2px_0_#1c1917]"
                >
                  Metrics backend (raw)
                </a>
              </div>
            </div>

            <button
              type="button"
              onClick={refreshAllData}
              disabled={loading || reloading || healthChecking || loadMetricsLoading || deletingLogs}
              className="inline-flex items-center justify-center border-2 border-stone-900 bg-amber-400 px-4 py-2 text-sm font-bold uppercase text-stone-900 shadow-[3px_3px_0_#1c1917] disabled:cursor-not-allowed disabled:opacity-60"
            >
              {reloading || healthChecking || loadMetricsLoading ? 'Đang tải...' : 'Làm mới'}
            </button>
          </div>
        </div>

        <div className="rounded-xl border-2 border-stone-900 bg-white p-4 shadow-[4px_4px_0_#1c1917]">
          <div className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-8">
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
              <label className="mb-1 block text-xs font-bold uppercase text-stone-600">Nguồn log</label>
              <select
                value={sourceFilter}
                onChange={(event) => {
                  setSourceFilter(event.target.value as SourceScope)
                  setPage(1)
                }}
                aria-label="Lọc nguồn log"
                title="Lọc nguồn log"
                className="w-full border-2 border-stone-900 px-3 py-2 text-sm font-semibold"
              >
                <option value="ALL">Tất cả nguồn</option>
                <option value="BACKEND">Backend</option>
                <option value="AI">AI Service</option>
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

        <div className="rounded-xl border-2 border-stone-900 bg-white p-3 shadow-[4px_4px_0_#1c1917]">
          <div className="flex flex-wrap gap-2">
            {MONITORING_TABS.map((tab) => (
              <button
                key={tab.key}
                type="button"
                onClick={() => setActiveTab(tab.key)}
                className={`border-2 border-stone-900 px-3 py-1.5 text-xs font-bold uppercase shadow-[2px_2px_0_#1c1917] ${
                  activeTab === tab.key
                    ? 'bg-amber-300 text-stone-900'
                    : 'bg-stone-100 text-stone-700'
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>
        </div>

        {activeTab === 'HEALTH' ? (
          <div className="rounded-xl border-2 border-stone-900 bg-white p-4 shadow-[4px_4px_0_#1c1917]">
            <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
              <div>
                <p className="text-sm font-bold text-stone-900">Giám sát sức khỏe dịch vụ</p>
                <p className="text-xs font-medium text-stone-600">
                  Dữ liệu lấy trực tiếp từ endpoint health của Backend và AI Service.
                </p>
              </div>
              <p className="text-xs font-semibold text-stone-600">
                Lần kiểm tra gần nhất: {lastHealthCheckedAt ? formatDateTime(lastHealthCheckedAt) : 'N/A'}
              </p>
            </div>

            <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
              <div className={`rounded-xl border-2 p-4 shadow-[3px_3px_0_#1c1917] ${serviceHealthClassName(backendHealth.status)}`}>
                <p className="text-xs font-bold uppercase">Backend API</p>
                <p className="mt-1 text-2xl font-black">{serviceHealthLabel(backendHealth.status)}</p>
                <p className="mt-1 text-sm font-semibold">{backendHealth.message}</p>
              </div>

              <div className={`rounded-xl border-2 p-4 shadow-[3px_3px_0_#1c1917] ${serviceHealthClassName(aiHealth.status)}`}>
                <p className="text-xs font-bold uppercase">AI Service</p>
                <p className="mt-1 text-2xl font-black">{serviceHealthLabel(aiHealth.status)}</p>
                <p className="mt-1 text-sm font-semibold">{aiHealth.message}</p>
                {aiHealth.version ? <p className="mt-1 text-xs">Phiên bản: {aiHealth.version}</p> : null}
              </div>
            </div>
          </div>
        ) : null}

        {activeTab === 'LOAD' ? (
          <div className="rounded-xl border-2 border-stone-900 bg-white p-4 shadow-[4px_4px_0_#1c1917]">
            <div className="mb-3">
              <p className="text-sm font-bold text-stone-900">Giám sát dấu hiệu quá tải</p>
              <p className="text-xs font-medium text-stone-600">
                Chỉ số lấy trực tiếp từ endpoint Prometheus của Backend và AI Service. Khi endpoint lỗi sẽ fallback về log để không gián đoạn màn hình.
              </p>
            </div>

            <div className="mb-3 flex flex-wrap items-center gap-2 text-xs font-semibold text-stone-600">
              <span className="rounded border border-stone-300 bg-stone-100 px-2 py-1">
                Nguồn: {loadMetrics?.source === 'prometheus' ? 'Prometheus metrics' : 'Fallback log'}
              </span>
              <span className="rounded border border-stone-300 bg-stone-100 px-2 py-1">
                Cập nhật: {loadMetrics?.updatedAt ? formatDateTime(loadMetrics.updatedAt) : 'N/A'}
              </span>
            </div>

            <div className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-4">
              <div className="rounded-xl border-2 border-stone-900 bg-stone-100 p-4 shadow-[3px_3px_0_#1c1917]">
                <p className="text-xs font-bold uppercase text-stone-700">Backend tổng request</p>
                <p className="mt-1 text-2xl font-black text-stone-900">
                  {formatCount(loadMetrics?.backendRequestTotal ?? null)}
                </p>
              </div>
              <div className="rounded-xl border-2 border-stone-900 bg-amber-50 p-4 shadow-[3px_3px_0_#1c1917]">
                <p className="text-xs font-bold uppercase text-amber-800">Backend lỗi 5xx</p>
                <p className="mt-1 text-2xl font-black text-amber-900">{formatPercentNullable(loadMetrics?.backendErrorRate ?? null)}</p>
                <p className="mt-1 text-xs font-semibold text-amber-800">
                  Nếu N/A, endpoint metrics chưa trả đủ series
                </p>
              </div>
              <div className="rounded-xl border-2 border-stone-900 bg-blue-50 p-4 shadow-[3px_3px_0_#1c1917]">
                <p className="text-xs font-bold uppercase text-blue-800">Backend p95</p>
                <p className="mt-1 text-2xl font-black text-blue-900">{formatLatency(loadMetrics?.backendP95Ms ?? null)}</p>
                <p className="mt-1 text-xs font-semibold text-blue-800">
                  Ước lượng từ histogram bucket
                </p>
              </div>

              <div className="rounded-xl border-2 border-stone-900 bg-emerald-50 p-4 shadow-[3px_3px_0_#1c1917]">
                <p className="text-xs font-bold uppercase text-emerald-800">AI tổng request</p>
                <p className="mt-1 text-2xl font-black text-emerald-900">{formatCount(loadMetrics?.aiRequestTotal ?? null)}</p>
              </div>
              <div className="rounded-xl border-2 border-stone-900 bg-red-50 p-4 shadow-[3px_3px_0_#1c1917]">
                <p className="text-xs font-bold uppercase text-red-800">AI error rate</p>
                <p className="mt-1 text-2xl font-black text-red-900">{formatPercentNullable(loadMetrics?.aiErrorRate ?? null)}</p>
              </div>
              <div className="rounded-xl border-2 border-stone-900 bg-cyan-50 p-4 shadow-[3px_3px_0_#1c1917]">
                <p className="text-xs font-bold uppercase text-cyan-800">AI p95</p>
                <p className="mt-1 text-2xl font-black text-cyan-900">{formatLatency(loadMetrics?.aiP95Ms ?? null)}</p>
              </div>
              <div className="rounded-xl border-2 border-stone-900 bg-orange-50 p-4 shadow-[3px_3px_0_#1c1917]">
                <p className="text-xs font-bold uppercase text-orange-800">AI in-flight</p>
                <p className="mt-1 text-2xl font-black text-orange-900">{formatCount(loadMetrics?.aiInFlight ?? null)}</p>
              </div>
            </div>

            {loadMetrics?.warning ? (
              <div className="mt-3 rounded border border-amber-300 bg-amber-50 p-3 text-xs font-semibold text-amber-900">
                {loadMetrics.warning}
              </div>
            ) : null}

            {loadMetrics?.source === 'logs' ? (
              <div className="mt-3 rounded border border-stone-300 bg-stone-50 p-3 text-xs font-semibold text-stone-700">
                Fallback log hiện tại: bản ghi {loadStats.requestCount} • tỷ lệ lỗi {formatPercent(loadStats.errorRate)} • p95 {formatLatency(loadStats.p95Latency)}
              </div>
            ) : null}
          </div>
        ) : null}

        {activeTab === 'SECURITY' ? (
          <div className="rounded-xl border-2 border-stone-900 bg-white p-4 shadow-[4px_4px_0_#1c1917]">
            <div className="mb-3">
              <p className="text-sm font-bold text-stone-900">Giám sát an toàn hệ thống</p>
              <p className="text-xs font-medium text-stone-600">
                Theo dõi cảnh báo truy cập trái phép và mẫu hành vi đáng ngờ từ log backend.
              </p>
            </div>

            <div className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-4">
              <div className="rounded-xl border-2 border-stone-900 bg-red-50 p-4 shadow-[3px_3px_0_#1c1917]">
                <p className="text-xs font-bold uppercase text-red-800">401 chưa xác thực</p>
                <p className="mt-1 text-2xl font-black text-red-900">{securityStats.unauthorizedCount}</p>
              </div>
              <div className="rounded-xl border-2 border-stone-900 bg-orange-50 p-4 shadow-[3px_3px_0_#1c1917]">
                <p className="text-xs font-bold uppercase text-orange-800">403 bị từ chối</p>
                <p className="mt-1 text-2xl font-black text-orange-900">{securityStats.forbiddenCount}</p>
              </div>
              <div className="rounded-xl border-2 border-stone-900 bg-amber-50 p-4 shadow-[3px_3px_0_#1c1917]">
                <p className="text-xs font-bold uppercase text-amber-800">Đăng nhập thất bại</p>
                <p className="mt-1 text-2xl font-black text-amber-900">{securityStats.loginFailureCount}</p>
              </div>
              <div className="rounded-xl border-2 border-stone-900 bg-stone-100 p-4 shadow-[3px_3px_0_#1c1917]">
                <p className="text-xs font-bold uppercase text-stone-700">Bản ghi nghi ngờ</p>
                <p className="mt-1 text-2xl font-black text-stone-900">{securityStats.suspiciousCount}</p>
                <p className="mt-1 text-xs font-semibold text-stone-700">
                  DENIED/FAILED/ERROR hoặc mã 401/403
                </p>
              </div>
            </div>

            <div className="mt-3 rounded border border-stone-300 bg-stone-50 p-3">
              <p className="text-xs font-bold uppercase text-stone-700">Bản ghi nghi ngờ gần nhất</p>
              {securityStats.recentSuspicious.length === 0 ? (
                <p className="mt-2 text-xs font-semibold text-stone-600">Chưa có bản ghi nghi ngờ trong phạm vi lọc hiện tại.</p>
              ) : (
                <div className="mt-2 overflow-x-auto">
                  <table className="w-full divide-y divide-stone-300">
                    <thead>
                      <tr>
                        <th className="px-2 py-1 text-left text-[11px] font-bold uppercase text-stone-600">Thời gian</th>
                        <th className="px-2 py-1 text-left text-[11px] font-bold uppercase text-stone-600">Action</th>
                        <th className="px-2 py-1 text-left text-[11px] font-bold uppercase text-stone-600">Mã HTTP</th>
                        <th className="px-2 py-1 text-left text-[11px] font-bold uppercase text-stone-600">User</th>
                      </tr>
                    </thead>
                    <tbody>
                      {securityStats.recentSuspicious.map((item) => (
                        <tr key={`security-${item.event_id}`} className="border-t border-stone-200">
                          <td className="px-2 py-1 text-xs text-stone-700">{formatDateTime(item.occurred_at)}</td>
                          <td className="px-2 py-1 text-xs font-semibold text-stone-900">{item.action || 'N/A'}</td>
                          <td className="px-2 py-1 text-xs font-semibold text-stone-700">{resolveHttpStatusCode(item) || 'N/A'}</td>
                          <td className="px-2 py-1 text-xs text-stone-700">{resolveActor(item)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </div>
        ) : null}

        {activeTab === 'RAW_LOGS' ? (
          <>
            <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
              <div className="rounded-xl border-2 border-stone-900 bg-emerald-50 p-4 shadow-[3px_3px_0_#1c1917]">
                <p className="text-xs font-bold uppercase text-emerald-800">Thành công (trang hiện tại)</p>
                <p className="mt-1 text-2xl font-black text-emerald-900">{pageStats.success}</p>
              </div>
              <div className="rounded-xl border-2 border-stone-900 bg-red-50 p-4 shadow-[3px_3px_0_#1c1917]">
                <p className="text-xs font-bold uppercase text-red-800">Thất bại/lỗi (trang hiện tại)</p>
                <p className="mt-1 text-2xl font-black text-red-900">{pageStats.failed}</p>
              </div>
            </div>

            <div className="rounded-xl border-2 border-stone-900 bg-white p-4 shadow-[4px_4px_0_#1c1917]">
              <div className="flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
                <div>
                  <p className="text-sm font-bold text-stone-900">Bulk delete theo bản ghi đã chọn</p>
                  <p className="text-xs font-medium text-stone-600">
                    Đã chọn {selectedEventIds.length} bản ghi trên trang hiện tại.
                  </p>
                  <div className="mt-2 flex flex-wrap gap-2">
                    <button
                      type="button"
                      onClick={toggleSelectAllVisible}
                      disabled={allSelectableEventIds.length === 0 || deletingLogs}
                      className="border-2 border-stone-900 bg-stone-100 px-3 py-1.5 text-xs font-bold uppercase text-stone-900 shadow-[2px_2px_0_#1c1917] disabled:cursor-not-allowed disabled:opacity-60"
                    >
                      {isAllVisibleSelected ? 'Bỏ chọn trang' : 'Chọn toàn trang'}
                    </button>
                    <button
                      type="button"
                      onClick={() => setSelectedEventIds([])}
                      disabled={selectedEventIds.length === 0 || deletingLogs}
                      className="border-2 border-stone-900 bg-stone-100 px-3 py-1.5 text-xs font-bold uppercase text-stone-900 shadow-[2px_2px_0_#1c1917] disabled:cursor-not-allowed disabled:opacity-60"
                    >
                      Xóa chọn
                    </button>
                    <button
                      type="button"
                      onClick={openSelectedDeleteDialog}
                      disabled={selectedEventIds.length === 0 || deletingLogs}
                      className="border-2 border-stone-900 bg-red-200 px-3 py-1.5 text-xs font-bold uppercase text-stone-900 shadow-[2px_2px_0_#1c1917] disabled:cursor-not-allowed disabled:opacity-60"
                    >
                      {deletingLogs ? 'Đang xóa...' : 'Xóa bản ghi đã chọn'}
                    </button>
                  </div>
                </div>

                <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 lg:min-w-[420px]">
                  <div>
                    <label className="mb-1 block text-xs font-bold uppercase text-stone-600">Từ thời gian</label>
                    <input
                      type="datetime-local"
                      value={deleteFromInput}
                      onChange={(event) => setDeleteFromInput(event.target.value)}
                      aria-label="Từ thời gian xóa log"
                      title="Từ thời gian xóa log"
                      className="w-full border-2 border-stone-900 px-3 py-2 text-sm font-semibold"
                    />
                  </div>
                  <div>
                    <label className="mb-1 block text-xs font-bold uppercase text-stone-600">Đến thời gian</label>
                    <input
                      type="datetime-local"
                      value={deleteToInput}
                      onChange={(event) => setDeleteToInput(event.target.value)}
                      aria-label="Đến thời gian xóa log"
                      title="Đến thời gian xóa log"
                      className="w-full border-2 border-stone-900 px-3 py-2 text-sm font-semibold"
                    />
                  </div>
                  <div className="sm:col-span-2">
                    <button
                      type="button"
                      onClick={openTimeRangeDeleteDialog}
                      disabled={deletingLogs}
                      className="w-full border-2 border-stone-900 bg-orange-200 px-3 py-2 text-xs font-bold uppercase text-stone-900 shadow-[2px_2px_0_#1c1917] disabled:cursor-not-allowed disabled:opacity-60"
                    >
                      {deletingLogs ? 'Đang xóa...' : 'Xóa theo khoảng thời gian'}
                    </button>
                  </div>
                </div>
              </div>
            </div>

        <div className="overflow-hidden rounded-xl border-2 border-stone-900 bg-white shadow-[4px_4px_0_#1c1917]">
          <div className="overflow-x-auto">
            <table className="w-full table-fixed divide-y divide-stone-300">
              <thead className="bg-stone-100">
                <tr>
                  <th className="w-[72px] px-3 py-2 text-left text-xs font-bold uppercase text-stone-700">
                    <input
                      type="checkbox"
                      checked={isAllVisibleSelected}
                      onChange={toggleSelectAllVisible}
                      aria-label="Chọn tất cả bản ghi trang hiện tại"
                      className="h-4 w-4 border-2 border-stone-900"
                    />
                  </th>
                  <th className="w-[176px] px-3 py-2 text-left text-xs font-bold uppercase text-stone-700">Thời gian</th>
                  <th className="w-[92px] px-3 py-2 text-left text-xs font-bold uppercase text-stone-700">Action</th>
                  <th className="w-[124px] px-3 py-2 text-left text-xs font-bold uppercase text-stone-700">Trạng thái</th>
                  <th className="w-[124px] px-3 py-2 text-left text-xs font-bold uppercase text-stone-700">Nguồn</th>
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
                    <td colSpan={10} className="px-4 py-8 text-center text-sm font-medium text-stone-600">
                      Đang tải nhật ký hệ thống...
                    </td>
                  </tr>
                ) : filteredItems.length === 0 ? (
                  <tr>
                    <td colSpan={10} className="px-4 py-8 text-center text-sm font-medium text-stone-600">
                      Không có bản ghi phù hợp bộ lọc hiện tại.
                    </td>
                  </tr>
                ) : (
                  filteredItems.map((item, index) => {
                    const status = resolveStatus(item)
                    const statusCode = resolveHttpStatusCode(item)
                    const source = resolveItemSourceScope(item, backendServiceName)
                    const selected = selectedEventIds.includes(item.event_id)
                    const rowKey = `${item.event_id || 'event'}-${index}`
                    const expanded = expandedRowKey === rowKey
                    const failureReason = resolveFailureReason(item, status)
                    const fullPayloadText = formatPayloadDisplay(buildFullPayload(item))
                    return (
                      <Fragment key={rowKey}>
                        <tr className="align-top hover:bg-stone-50">
                          <td className="px-3 py-3 text-xs text-stone-700">
                            <input
                              type="checkbox"
                              checked={selected}
                              onChange={() => toggleRowSelection(item.event_id)}
                              aria-label={`Chọn bản ghi ${item.event_id}`}
                              className="h-4 w-4 border-2 border-stone-900"
                            />
                          </td>
                          <td className="truncate px-3 py-3 text-xs text-stone-700">{formatDateTime(item.occurred_at)}</td>
                          <td className="truncate px-3 py-3 text-xs font-semibold text-stone-900">{item.action || 'N/A'}</td>
                          <td className="px-3 py-3 text-xs">
                            <span
                              className={`inline-flex rounded border px-2 py-0.5 text-[11px] font-bold ${statusClassName(status)}`}
                            >
                              {status}
                            </span>
                          </td>
                          <td className="px-3 py-3 text-xs">
                            <span className={`inline-flex rounded border px-2 py-0.5 text-[11px] font-bold ${sourceBadgeClassName(source)}`}>
                              {sourceLabel(source)}
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
                            <td colSpan={10} className="px-3 py-3">
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
                disabled={page <= 1 || loading || reloading || deletingLogs}
                className="border-2 border-stone-900 bg-white px-3 py-1.5 text-xs font-bold uppercase text-stone-900 shadow-[2px_2px_0_#1c1917] disabled:cursor-not-allowed disabled:opacity-50"
              >
                Trang trước
              </button>
              <button
                type="button"
                onClick={() => setPage((prev) => Math.min(totalPages, prev + 1))}
                disabled={page >= totalPages || loading || reloading || deletingLogs}
                className="border-2 border-stone-900 bg-white px-3 py-1.5 text-xs font-bold uppercase text-stone-900 shadow-[2px_2px_0_#1c1917] disabled:cursor-not-allowed disabled:opacity-50"
              >
                Trang sau
              </button>
            </div>
          </div>
        </div>
          </>
        ) : null}

        <ConfirmDialog
          isOpen={deleteDialog !== null}
          onClose={() => setDeleteDialog(null)}
          onConfirm={() => {
            if (deleteDialog) {
              void executeDelete(deleteDialog)
            }
          }}
          title={deleteDialog?.mode === 'time-range' ? 'Xác nhận xóa theo thời gian' : 'Xác nhận xóa bản ghi đã chọn'}
          message={
            deleteDialog?.mode === 'time-range'
              ? `Bạn có chắc muốn xóa audit logs trong khoảng thời gian đã chọn (nguồn: ${deleteDialog.source})? Hành động này không thể hoàn tác.`
              : `Bạn có chắc muốn xóa ${deleteDialog?.eventIds.length ?? 0} bản ghi audit log (nguồn: ${deleteDialog?.source ?? 'ALL'})? Hành động này không thể hoàn tác.`
          }
          confirmText={deletingLogs ? 'Đang xử lý...' : 'Xóa'}
          cancelText="Hủy"
          variant="danger"
        />
      </div>
    </div>
  )
}
