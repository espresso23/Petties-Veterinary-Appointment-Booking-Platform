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
    system_prompt?: string
    enabled: boolean
    created_at?: string
    updated_at?: string
    tools?: string[]
}

export interface PromptVersion {
    version: number
    prompt: string
    created_at: string
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
    storage_size_bytes?: number
}

export interface Tool {
    id: number
    name: string
    description?: string
    enabled: boolean
    assigned_agents?: string[]
}

export interface Document {
    id: number
    filename: string
    file_type?: string
    file_size?: number
    processed: boolean
    vector_count: number
    uploaded_at?: string
}

export interface QueryResult {
    document_id: number
    document_name: string
    chunk_index: number
    content: string
    score: number
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

    // Update system prompt
    async updatePrompt(id: number, promptText: string, notes?: string): Promise<void> {
        const response = await fetchWithAuth(`${AGENT_API_BASE_URL}/api/v1/agents/${id}/prompt`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                prompt_text: promptText,
                notes: notes,
                created_by: 'admin'
            })
        })
        if (!response.ok) throw new Error('Failed to update prompt')
    },

    // Get prompt history
    async getPromptHistory(id: number): Promise<PromptVersion[]> {
        const response = await fetchWithAuth(`${AGENT_API_BASE_URL}/api/v1/agents/${id}/prompt-history`)
        if (!response.ok) throw new Error('Failed to fetch prompt history')
        const data = await response.json()
        return data.versions
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

    // Assign tool to agent
    async assignToAgent(id: number, agentName: string): Promise<void> {
        const response = await fetchWithAuth(`${AGENT_API_BASE_URL}/api/v1/tools/${id}/assign`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ agent_name: agentName })
        })
        if (!response.ok) throw new Error('Failed to assign tool')
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

// ===== WEBSOCKET =====

/**
 * Create WebSocket connection for chat
 * Automatically converts http/https to ws/wss
 */
export const createChatWebSocket = (sessionId: string): WebSocket => {
    const fullWsUrl = `${AGENT_WS_BASE_URL}/ws/chat/${sessionId}`

    // Debug log in development
    if (import.meta.env.DEV) {
        console.log('🔌 WebSocket URL:', fullWsUrl)
    }

    return new WebSocket(fullWsUrl)
}

export default { agentApi, toolApi, knowledgeApi, chatApi, createChatWebSocket }

