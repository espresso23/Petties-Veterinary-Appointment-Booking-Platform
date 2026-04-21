/**
 * Agent Service - API calls to petties-agent-service
 * 
 * Direct connection to AI Service.
 * Supports both:
 * - Dedicated AI domain/service
 * - Unified reverse proxy (/ai for REST, /ws/chat for WebSocket)
 */

import { useAuthStore } from '../store/authStore'
import { env } from '../config/env'

// Direct AI Service URL (no gateway)
// Use centralized env config for consistency
const AGENT_API_BASE_URL = env.AGENT_API_BASE_URL
const AGENT_WS_BASE_URL = env.AGENT_WS_BASE_URL

// Get auth token from authStore (single source of truth)
const getAuthHeaders = (): Record<string, string> => {
    const token = useAuthStore.getState().accessToken
    return token ? { 'Authorization': `Bearer ${token}` } : {}
}

// Fetch with auth
const fetchWithAuth = async (url: string, options: RequestInit = {}): Promise<Response> => {
    const headers = {
        ...getAuthHeaders(),
        ...(options.headers || {})
    }
    return fetch(url, { ...options, headers })
}

const fetchBackendWithAuth = async (path: string, options: RequestInit = {}): Promise<Response> => {
    const backendUrl = `${env.API_BASE_URL}${path}`
    const headers = {
        ...getAuthHeaders(),
        ...(options.headers || {}),
    }
    return fetch(backendUrl, { ...options, headers })
}

// ===== TYPES =====

export interface AgentListResponse {
    agents: Agent[]
}


export interface Agent {
    id: number
    name: string
    agent_type: string // No longer restricted to specific types
    description?: string
    temperature: number
    max_tokens: number
    top_p: number // Added top_p support
    model: string
    enabled: boolean
    created_at?: string
    updated_at?: string
    tools?: string[]
}

export interface ScanToolsResult {
    discovered: number
    new_tools: string[]
}

export interface UploadDocumentResult {
    success: boolean
    document_id: number
    message?: string
}

export interface ProcessDocumentResult {
    success: boolean
    chunks_created: number
}

export interface KnowledgeStatusResult {
    total_documents: number
    processed_documents: number
    total_vectors: number
    total_image_vectors: number
    storage_size_bytes?: number
}

export interface Tool {
    id: number
    name: string
    description?: string
    enabled: boolean
    is_system_managed?: boolean
    is_admin_configurable?: boolean
}

export interface Document {
    id: number
    filename: string
    file_type?: string
    file_size?: number
    processed: boolean
    vector_count: number
    image_count?: number
    uploaded_at?: string
}

export interface QueryResult {
    document_id: number
    document_name: string
    chunk_index: number
    content: string
    score: number
}

// ===== AI INSIGHTS TYPES =====

export interface FeedbackStatsResponse {
    total: number
    period_days: number
    by_type: Record<string, number>
    by_category: Record<string, number>
    positive_rate: number
    error?: string
}

export interface FeedbackItem {
    feedback_id: string
    message_id: string
    session_id: string
    user_id: string
    user_role: string
    feedback_type: string
    feedback_category: string
    feedback_reason: string
    feedback_text: string
    tool_used: string
    message_content: string
    weight: number
    created_at: string
}

export interface FeedbackListResponse {
    total: number
    page: number
    page_size: number
    items: FeedbackItem[]
}

export interface FeedbackListParams {
    page?: number
    page_size?: number
    feedback_type?: string
    feedback_category?: string
    user_role?: string
    date_from?: string
    date_to?: string
}

export interface SubmitFeedbackRequest {
    message_id: string
    session_id: string
    feedback_type: 'thumbs_up' | 'thumbs_down' | 'report' | 'confirmed' | 'vet_confirmed'
    feedback_category?: string
    feedback_reason?: string
    feedback_text?: string
}

export interface SubmitFeedbackResponse {
    success: boolean
    status: string
    feedback_id?: string
    category: string
    weight: number
    used_for_analytics: boolean
    used_for_monitoring: boolean
    used_for_enrichment: boolean
    message?: string
    error?: string
}

export interface CaseMemoryStatsResponse {
    success: boolean
    points_count: number
    status: string
    collection: string
    initialized: boolean
    image_enabled: boolean
    [key: string]: unknown
}

export interface CaseMemoryPruneResponse {
    success: boolean
    message: string
    pruned_count: number
    criteria: {
        older_than_days: number
    }
}

export interface CaseMemoryItem {
    case_id: string
    species: string
    chief_complaint: string
    display_name_vi?: string
    final_diagnosis_text: string
    canonical_code?: string
    mapping_status?: string
    exam_at?: string
}

export interface CaseMemoryPrescription {
    medicine_name?: string
    medicine?: string
    dosage?: string
    frequency?: string
    duration_days?: number
    duration?: string | number
    instructions?: string
    source?: string
    source_detail?: string
}

export interface CaseMemoryProtocolPattern {
    soap_template?: {
        assessment?: string
    }
    common_prescriptions?: CaseMemoryPrescription[]
    common_tests?: Array<{ test?: string; result?: string }>
    common_recommendations?: string[]
}

/** Chỉ số lúc khám lưu trong Case Memory (đồng bộ từ EMR). */
export interface CaseMemoryVitals {
    weight_kg?: number | null
    temperature_c?: number | null
    heart_rate?: number | null
    bcs?: number | null
}

export interface CaseMemoryDetailItem extends CaseMemoryItem {
    emr_id?: string | null
    pet_id?: string | null
    booking_id?: string | null
    clinic_id?: string | null
    breed?: string | null
    age_months?: number | null
    sex?: string | null
    allergies?: string | null
    symptoms?: string[]
    physical_exam?: string[]
    vitals?: CaseMemoryVitals | Record<string, unknown> | null
    clinical_notes?: string
    clinical_image_urls?: string[]
    text_content: string
    protocol_pattern?: CaseMemoryProtocolPattern
}

export interface CaseMemoryListResponse {
    success: boolean
    items: CaseMemoryItem[]
    total: number
    page: number
    page_size: number
}

export interface CaseMemoryDetailResponse {
    success: boolean
    case: CaseMemoryDetailItem
}

export interface CaseMemoryListParams {
    query?: string
    species?: string
    diagnosis?: string
    page?: number
    page_size?: number
}

export type ChatContextType = 'BUSINESS_CHAT' | 'PLAYGROUND_TEST'

export interface CreateChatSessionRequest {
    agent_id?: number
    title?: string
    context_type: ChatContextType
}

export interface CreateChatSessionResponse {
    success: boolean
    session_id: string
    agent_id?: number
    context_type: ChatContextType
    user_role: string
    clinic_id?: string | null
    created_at: string
}

export interface ChatSessionMessage {
    message_id?: string
    user_id?: string
    role: 'user' | 'assistant' | 'system'
    content: string
    context_type?: ChatContextType
    timestamp?: string
    react_trace?: Array<{
        step_index?: number
        step_type?: 'thought' | 'action' | 'observation'
        content?: string
        tool_name?: string
        tool_params?: Record<string, unknown>
        tool_result?: unknown
        timestamp?: string
    }>
    metadata?: Record<string, unknown>
}

export interface ChatSessionDetail {
    session_id: string
    agent_id?: number
    title?: string
    context_type: ChatContextType
    user_role?: string
    clinic_id?: string | null
    messages: ChatSessionMessage[]
    created_at?: string
    updated_at?: string
}

export interface ChatSessionSummary {
    session_id: string
    agent_id?: number
    title?: string
    context_type: ChatContextType
    user_role?: string
    clinic_id?: string | null
    messages: ChatSessionMessage[]
    created_at?: string
    updated_at?: string
}

export interface SessionListResponse {
    total: number
    sessions: ChatSessionSummary[]
}

export interface StaffDiagnosisRequest {
    request_id?: string
    previous_request_id?: string
    pet_id?: string
    booking_id?: string
    species: 'dog' | 'cat' | 'other'
    breed?: string
    age_months?: number
    weight_kg?: number
    sex?: 'male' | 'female' | 'unknown'
    allergies?: string[]
    doctor_description: string
    body_part?: string
    symptoms?: string[]
    image_urls?: string[]
    image_analysis_mode?: 'full' | 'describe_only'
    synthesis_mode?: 'full' | 'selected_only'
    selected_diagnosis_code?: string
    selected_diagnosis_label?: string
    follow_up_answers?: Array<{
        question: string
        answer: string
    }>
    soap_draft?: {
        subjective?: string
        objective?: string
        assessment?: string
        plan?: string
    }
}

export interface StaffDiagnosisSuggestion {
    canonical_code?: string | null
    display_name_vi: string
    rank: number
    score_percent: number
    score_basis: string
    confidence_note: string
    supporting_reasons: string[]
    taxonomy_system?: string
    taxonomy_subsystem?: string
    reasoning?: string
    differential_diagnoses?: Array<Record<string, unknown>>
}

export interface StaffDiagnosisPrescriptionSuggestion {
    medicine_name: string
    dosage?: string
    frequency?: string
    times_of_day?: string[]
    timesOfDay?: string[]
    before_after_meal?: string
    beforeAfterMeal?: string
    frequency_note?: string
    frequencyNote?: string
    duration_days?: number | null
    durationDays?: number | null
    instructions: string
    caution?: string | null
    source?: string
    source_detail?: string
}

export interface AuditLogItem {
    event_id: string
    occurred_at: string
    service: string
    environment: string
    actor: Record<string, unknown>
    action: string
    resource: Record<string, unknown>
    result: Record<string, unknown>
    correlation: Record<string, unknown>
    metadata: Record<string, unknown>
    changes: Record<string, unknown>
}

export interface AuditLogListResponse {
    items: AuditLogItem[]
    total: number
    page: number
    page_size: number
}

export interface BackendSystemAuditLogListResponse {
    source: string
    service: string
    backend_service?: string
    scope?: string
    total: number
    page: number
    page_size: number
    items: AuditLogItem[]
    fetchedAt: string
}

export interface BackendSystemAuditLogDeleteResponse {
    scope: string
    requested_count?: number
    deleted_count: number
    from_time?: string
    to_time?: string
    message: string
    deletedAt?: string
}

export interface StaffDiagnosisResponse {
    request_id: string
    evidence_mode: 'internal_grounded' | 'vlm_fallback' | 'llm_fallback'
    evidence_banner: string
    score_label: string
    top_differentials: StaffDiagnosisSuggestion[]
    supporting_evidence_from_kb: string[]
    similar_confirmed_cases: string[]
    vision_findings: string[]
    image_descriptions: string[]
    image_analysis: Array<{ url: string; description: string; order: number }>
    suggested_questions: string[]
    soap_suggestions: {
        subjective_draft: string
        objective_draft: string
        assessment_draft: string
        plan_draft: string
    }
    prescription_suggestions: StaffDiagnosisPrescriptionSuggestion[]
    payload_status?: 'ok' | 'incomplete'
    payload_warnings?: string[]
    disclaimer: string
}

// ===== AGENT APIs =====

export const agentApi = {
    // Get all agents with hierarchy
    async getAgents(): Promise<AgentListResponse> {
        const response = await fetchWithAuth(`${AGENT_API_BASE_URL}/api/v1/agents`)
        if (!response.ok) throw new Error('Failed to fetch agents')
        return response.json()
    },

    // Get single agent
    async getAgent(id: number): Promise<Agent> {
        const response = await fetchWithAuth(`${AGENT_API_BASE_URL}/api/v1/agents/${id}`)
        if (!response.ok) throw new Error('Failed to fetch agent')
        const data = await response.json()
        return data.agent
    },

    // Update agent config
    async updateAgent(id: number, data: Partial<Agent>): Promise<Agent> {
        const response = await fetchWithAuth(`${AGENT_API_BASE_URL}/api/v1/agents/${id}`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(data)
        })
        if (!response.ok) throw new Error('Failed to update agent')
        const result = await response.json()
        return result.agent
    },

    // Test agent - returns response with thinking process and tool calls
    async testAgent(id: number, message: string, model?: string): Promise<AgentTestResponse> {
        const response = await fetchWithAuth(`${AGENT_API_BASE_URL}/api/v1/agents/${id}/test`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ message, model })
        })
        if (!response.ok) throw new Error('Failed to test agent')
        const data = await response.json()
        // Support both old (string) and new (object) response format
        if (typeof data.response === 'string') {
            return {
                content: data.response,
                thinkingProcess: data.thinking_process || [],
                toolCalls: data.tool_calls || [],
                citations: data.citations || []
            }
        }
        return {
            content: data.response?.content || data.content || '',
            thinkingProcess: data.response?.thinking_process || data.thinking_process || [],
            toolCalls: data.response?.tool_calls || data.tool_calls || [],
            citations: data.response?.citations || data.citations || []
        }
    }
}

// Agent test response interface
export interface AgentTestResponse {
    content: string
    thinkingProcess: string[]
    toolCalls: Array<{ tool: string; input: unknown; output?: unknown }>
    citations: Array<{ type: 'rag' | 'web'; source: string; url?: string }>
}


// ===== TOOL APIs =====

export const toolApi = {
    // Get all tools
    async getTools(): Promise<{ total: number; tools: Tool[] }> {
        const response = await fetchWithAuth(`${AGENT_API_BASE_URL}/api/v1/tools`)
        if (!response.ok) throw new Error('Failed to fetch tools')
        return response.json()
    },

    // Toggle tool enabled
    async toggleTool(id: number, enabled: boolean): Promise<void> {
        const response = await fetchWithAuth(`${AGENT_API_BASE_URL}/api/v1/tools/${id}/enable`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ enabled })
        })
        if (!response.ok) throw new Error('Failed to toggle tool')
    },

    // Scan code tools
    async scanTools(): Promise<ScanToolsResult> {
        const response = await fetchWithAuth(`${AGENT_API_BASE_URL}/api/v1/tools/scan`, {
            method: 'POST'
        })
        if (!response.ok) throw new Error('Failed to scan tools')
        return response.json()
    }
}

// ===== KNOWLEDGE APIs =====

export const knowledgeApi = {
    // Get all documents
    async getDocuments(): Promise<{ total: number; documents: Document[] }> {
        const response = await fetchWithAuth(`${AGENT_API_BASE_URL}/api/v1/knowledge/documents`)
        if (!response.ok) throw new Error('Failed to fetch documents')
        return response.json()
    },

    // Upload document
    async uploadDocument(file: File, notes?: string): Promise<UploadDocumentResult> {
        const formData = new FormData()
        formData.append('file', file)
        if (notes) formData.append('notes', notes)
        formData.append('uploaded_by', 'admin')

        const response = await fetchWithAuth(`${AGENT_API_BASE_URL}/api/v1/knowledge/upload`, {
            method: 'POST',
            body: formData
        })

        if (!response.ok) {
            const errorData = await response.json().catch(() => null)
            const errorMessage = errorData?.detail || `Upload failed with status ${response.status}`
            throw new Error(errorMessage)
        }

        const result = await response.json()

        // Auto-process document after upload
        if (result.document_id) {
            await this.processDocument(result.document_id)
        }

        return result
    },

    // Process document to create vectors
    async processDocument(documentId: number): Promise<ProcessDocumentResult> {
        const response = await fetchWithAuth(`${AGENT_API_BASE_URL}/api/v1/knowledge/documents/${documentId}/process`, {
            method: 'POST'
        })

        if (!response.ok) {
            const errorData = await response.json().catch(() => null)
            const errorMessage = errorData?.detail || `Processing failed with status ${response.status}`
            throw new Error(errorMessage)
        }

        return response.json()
    },

    // Delete document
    async deleteDocument(id: number): Promise<void> {
        const response = await fetchWithAuth(`${AGENT_API_BASE_URL}/api/v1/knowledge/documents/${id}`, {
            method: 'DELETE'
        })
        if (!response.ok) throw new Error('Failed to delete document')
    },

    // Query knowledge base
    async query(queryText: string, topK: number = 5, minScore: number = 0.5): Promise<QueryResult[]> {
        const response = await fetchWithAuth(`${AGENT_API_BASE_URL}/api/v1/knowledge/query`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ query: queryText, top_k: topK, min_score: minScore })
        })
        if (!response.ok) throw new Error('Failed to query knowledge base')
        const data = await response.json()
        return data.chunks
    },

    // Fetch document blob for preview (handles auth via headers)
    async fetchDocumentBlob(documentId: number): Promise<{ blob: Blob; contentType: string }> {
        const response = await fetchWithAuth(`${AGENT_API_BASE_URL}/api/v1/knowledge/documents/${documentId}/download`)
        if (!response.ok) throw new Error('Không thể tải tài liệu')
        const blob = await response.blob()
        return { blob, contentType: response.headers.get('content-type') || 'application/octet-stream' }
    },

    // Fetch text content for TXT/MD preview
    async fetchDocumentText(documentId: number): Promise<string> {
        const response = await fetchWithAuth(`${AGENT_API_BASE_URL}/api/v1/knowledge/documents/${documentId}/download`)
        if (!response.ok) throw new Error('Không thể tải tài liệu')
        return response.text()
    },

    // Get status
    async getStatus(): Promise<KnowledgeStatusResult> {
        const response = await fetchWithAuth(`${AGENT_API_BASE_URL}/api/v1/knowledge/status`)
        if (!response.ok) throw new Error('Failed to fetch status')
        return response.json()
    }
}

// ===== CHAT APIs =====

export const chatApi = {
    async createSession(payload: CreateChatSessionRequest): Promise<CreateChatSessionResponse> {
        const response = await fetchWithAuth(`${AGENT_API_BASE_URL}/api/v1/chat/sessions`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
        })

        if (!response.ok) throw new Error('Failed to create chat session')
        return response.json()
    },

    async getSession(sessionId: string): Promise<ChatSessionDetail> {
        const response = await fetchWithAuth(`${AGENT_API_BASE_URL}/api/v1/chat/sessions/${sessionId}`)
        if (!response.ok) throw new Error('Failed to fetch chat session')
        return response.json()
    },

    async listSessions(contextType?: ChatContextType, limit: number = 20): Promise<SessionListResponse> {
        const params = new URLSearchParams({ limit: String(limit) })
        if (contextType) {
            params.set('context_type', contextType)
        }

        const response = await fetchWithAuth(`${AGENT_API_BASE_URL}/api/v1/chat/sessions?${params.toString()}`)
        if (!response.ok) throw new Error('Failed to fetch chat sessions')
        return response.json()
    },

    async deleteSession(sessionId: string): Promise<void> {
        const response = await fetchWithAuth(`${AGENT_API_BASE_URL}/api/v1/chat/sessions/${sessionId}`, {
            method: 'DELETE'
        })
        if (!response.ok) throw new Error('Failed to delete chat session')
    }
}

// ===== STAFF DIAGNOSIS API =====

export const diagnosisApi = {
    async analyzeCase(payload: StaffDiagnosisRequest): Promise<StaffDiagnosisResponse> {
        const response = await fetchWithAuth(`${AGENT_API_BASE_URL}/api/v1/staff-diagnosis/analyze`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
        })

        if (!response.ok) {
            const err = await response.json().catch(() => null)
            throw new Error(err?.detail || 'Không thể phân tích ca bệnh')
        }
        return response.json()
    }
}

// ===== FEEDBACK API =====

export const feedbackApi = {
    async getStats(days: number = 30): Promise<FeedbackStatsResponse> {
        const response = await fetchWithAuth(`${AGENT_API_BASE_URL}/api/v1/chat/feedback/stats?days=${days}`)
        if (!response.ok) throw new Error('Không thể lấy thống kê feedback')
        return response.json()
    },

    async list(params: FeedbackListParams = {}): Promise<FeedbackListResponse> {
        const searchParams = new URLSearchParams()
        if (params.page) searchParams.set('page', String(params.page))
        if (params.page_size) searchParams.set('page_size', String(params.page_size))
        if (params.feedback_type) searchParams.set('feedback_type', params.feedback_type)
        if (params.feedback_category) searchParams.set('feedback_category', params.feedback_category)
        if (params.user_role) searchParams.set('user_role', params.user_role)
        if (params.date_from) searchParams.set('date_from', params.date_from)
        if (params.date_to) searchParams.set('date_to', params.date_to)

        const response = await fetchWithAuth(`${AGENT_API_BASE_URL}/api/v1/chat/feedback/list?${searchParams.toString()}`)
        if (!response.ok) throw new Error('Không thể lấy danh sách feedback')
        return response.json()
    },

    async submitFeedback(data: SubmitFeedbackRequest): Promise<SubmitFeedbackResponse> {
        const response = await fetchWithAuth(`${AGENT_API_BASE_URL}/api/v1/chat/feedback`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(data)
        })
        if (!response.ok) throw new Error('Không thể gửi feedback')
        return response.json()
    },
    async deleteFeedback(feedbackId: string): Promise<{ success: boolean; feedback_id: string; case_deleted?: boolean; message: string }> {
        const response = await fetchWithAuth(`${AGENT_API_BASE_URL}/api/v1/chat/feedback/${feedbackId}`, {
            method: 'DELETE'
        })
        if (!response.ok) {
            const err = await response.json().catch(() => null)
            throw new Error(err?.detail || 'Khong the xoa feedback')
        }
        return response.json()
    },
}

// ===== CASE MEMORY API =====

export const caseMemoryApi = {
    async getStats(): Promise<CaseMemoryStatsResponse> {
        const response = await fetchWithAuth(`${AGENT_API_BASE_URL}/api/v1/knowledge/case-memory/stats`)
        if (!response.ok) throw new Error('Không thể lấy thống kê Case Memory')
        return response.json()
    },

    async list(params: CaseMemoryListParams = {}): Promise<CaseMemoryListResponse> {
        const searchParams = new URLSearchParams()
        if (params.query) searchParams.set('query', params.query)
        if (params.species) searchParams.set('species', params.species)
        if (params.diagnosis) searchParams.set('diagnosis', params.diagnosis)
        if (params.page) searchParams.set('page', String(params.page))
        if (params.page_size) searchParams.set('page_size', String(params.page_size))
        
        const queryString = searchParams.toString()
        const response = await fetchWithAuth(
            `${AGENT_API_BASE_URL}/api/v1/knowledge/case-memory${queryString ? `?${queryString}` : ''}`
        )
        if (!response.ok) {
            const err = await response.json().catch(() => null)
            throw new Error(err?.detail || 'Không thể lấy danh sách Case Memory')
        }
        return response.json()
    },

    async get(caseId: string): Promise<CaseMemoryDetailResponse> {
        const response = await fetchWithAuth(`${AGENT_API_BASE_URL}/api/v1/knowledge/case-memory/${caseId}`)
        if (!response.ok) {
            const err = await response.json().catch(() => null)
            throw new Error(err?.detail || 'Không thể lấy chi tiết Case')
        }
        return response.json()
    },

    async delete(caseId: string): Promise<{ success: boolean; message: string }> {
        const response = await fetchWithAuth(`${AGENT_API_BASE_URL}/api/v1/knowledge/case-memory/${caseId}`, {
            method: 'DELETE'
        })
        if (!response.ok) {
            const err = await response.json().catch(() => null)
            throw new Error(err?.detail || 'Không thể xóa Case')
        }
        return response.json()
    },

    async prune(olderThanDays: number = 90): Promise<CaseMemoryPruneResponse> {
        const params = new URLSearchParams({
            older_than_days: String(olderThanDays)
        })
        const response = await fetchWithAuth(`${AGENT_API_BASE_URL}/api/v1/knowledge/case-memory/prune?${params.toString()}`, {
            method: 'POST'
        })
        if (!response.ok) {
            const err = await response.json().catch(() => null)
            throw new Error(err?.detail || 'Không thể dọn dẹp Case Memory')
        }
        return response.json()
    }
}

// ===== WEBSOCKET =====

/**
 * Create WebSocket connection for chat
 * Automatically converts http/https to ws/wss
 * Includes JWT token as query param for authentication
 */
export const createChatWebSocket = (sessionId: string, contextType?: string): WebSocket => {
    const token = useAuthStore.getState().accessToken
    const params = new URLSearchParams()

    if (token) {
        params.set('token', token)
    }
    if (contextType) {
        params.set('context_type', contextType)
    }

    const queryString = params.toString()
    const fullWsUrl = `${AGENT_WS_BASE_URL}/ws/chat/${sessionId}${queryString ? `?${queryString}` : ''}`

    // Debug log in development (mask token)
    if (import.meta.env.DEV) {
        const maskedUrl = token
            ? fullWsUrl.replace(token, `${token.slice(0, 8)}...`)
            : fullWsUrl
        console.log('WebSocket URL:', maskedUrl)
    }

    return new WebSocket(fullWsUrl)
}

// ===== DISEASE CATALOG APIs (NEW) =====

export const diseaseCatalogApi = {
    async getStats(): Promise<{
        success: boolean
        catalog: { total_diseases: number; total_aliases: number }
    }> {
        const response = await fetchWithAuth(`${AGENT_API_BASE_URL}/api/v1/knowledge/disease-catalog/stats`)
        if (!response.ok) throw new Error('Không thể lấy thống kê Disease Catalog')
        return response.json()
    },

    async list(params: {
        species?: string
        system?: string
        page?: number
        page_size?: number
    } = {}): Promise<{
        success: boolean
        items: Array<{
            canonical_code: string
            display_name_vi: string
            system: string
            subsystem: string
            aliases: string[]
            species: string[]
        }>
        total: number
        page: number
        page_size: number
    }> {
        const queryParams = new URLSearchParams()
        if (params.species) queryParams.set('species', params.species)
        if (params.system) queryParams.set('system', params.system)
        if (params.page) queryParams.set('page', params.page.toString())
        if (params.page_size) queryParams.set('page_size', params.page_size.toString())

        const queryString = queryParams.toString()
        const response = await fetchWithAuth(
            `${AGENT_API_BASE_URL}/api/v1/knowledge/disease-catalog${queryString ? `?${queryString}` : ''}`
        )
        if (!response.ok) {
            const err = await response.json().catch(() => null)
            throw new Error(err?.detail || 'Không thể lấy danh sách Disease Catalog')
        }
        return response.json()
    },
}

export const auditLogApi = {
    async list(params: {
        page?: number
        page_size?: number
        user_id?: string
        action?: string
        resource_type?: string
        status?: string
        request_id?: string
        from_time?: string
        to_time?: string
    } = {}): Promise<AuditLogListResponse> {
        const queryParams = new URLSearchParams()
        if (params.page) queryParams.set('page', String(params.page))
        if (params.page_size) queryParams.set('page_size', String(params.page_size))
        if (params.user_id) queryParams.set('user_id', params.user_id)
        if (params.action) queryParams.set('action', params.action)
        if (params.resource_type) queryParams.set('resource_type', params.resource_type)
        if (params.status) queryParams.set('status', params.status)
        if (params.request_id) queryParams.set('request_id', params.request_id)
        if (params.from_time) queryParams.set('from_time', params.from_time)
        if (params.to_time) queryParams.set('to_time', params.to_time)

        const queryString = queryParams.toString()
        const response = await fetchWithAuth(
            `${AGENT_API_BASE_URL}/api/v1/audit-logs${queryString ? `?${queryString}` : ''}`,
        )
        if (!response.ok) {
            const err = await response.json().catch(() => null)
            throw new Error(err?.detail || 'Khong the lay audit logs')
        }
        return response.json()
    },
}

export const backendSystemLogApi = {
    async listAuditLogs(params: {
        page?: number
        page_size?: number
        status?: string
        action?: string
        userId?: string
        requestId?: string
        source?: 'ALL' | 'BACKEND' | 'AI'
    } = {}): Promise<BackendSystemAuditLogListResponse> {
        const queryParams = new URLSearchParams()
        queryParams.set('page', String(params.page || 1))
        queryParams.set('pageSize', String(params.page_size || 30))
        if (params.status) queryParams.set('status', params.status)
        if (params.action) queryParams.set('action', params.action)
        if (params.userId) queryParams.set('userId', params.userId)
        if (params.requestId) queryParams.set('requestId', params.requestId)
        if (params.source) queryParams.set('source', params.source)
        const response = await fetchBackendWithAuth(`/admin/system-logs/backend?${queryParams.toString()}`)
        if (!response.ok) {
            const err = await response.json().catch(() => null)
            throw new Error(err?.message || err?.detail || 'Khong the lay backend logs')
        }
        return response.json()
    },

    async bulkDeleteAuditLogs(
        eventIds: string[],
        source: 'ALL' | 'BACKEND' | 'AI' = 'ALL',
    ): Promise<BackendSystemAuditLogDeleteResponse> {
        const response = await fetchBackendWithAuth('/admin/system-logs/backend/bulk', {
            method: 'DELETE',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ eventIds, source }),
        })
        if (!response.ok) {
            const err = await response.json().catch(() => null)
            throw new Error(err?.message || err?.detail || 'Khong the xoa audit logs')
        }
        return response.json()
    },

    async deleteAuditLogsByTimeRange(
        fromTime: string,
        toTime: string,
        source: 'ALL' | 'BACKEND' | 'AI' = 'ALL',
    ): Promise<BackendSystemAuditLogDeleteResponse> {
        const response = await fetchBackendWithAuth('/admin/system-logs/backend/time-range', {
            method: 'DELETE',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ fromTime, toTime, source }),
        })
        if (!response.ok) {
            const err = await response.json().catch(() => null)
            throw new Error(err?.message || err?.detail || 'Khong the xoa audit logs theo khoang thoi gian')
        }
        return response.json()
    },
}

export default {
    agentApi,
    toolApi,
    knowledgeApi,
    chatApi,
    diagnosisApi,
    feedbackApi,
    caseMemoryApi,
    diseaseCatalogApi,
    auditLogApi,
    backendSystemLogApi,
    createChatWebSocket,
}
