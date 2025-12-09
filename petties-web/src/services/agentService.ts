/**
 * Agent Service - API calls to petties-agent-serivce
 * 
 * Routes through API Gateway:
 * - Development: http://localhost:8080/ai/*
 * - Production: https://api.petties.com/ai/*
 */

// API Gateway URL (handles routing to ai-service internally)
const API_GATEWAY_URL = import.meta.env.VITE_API_GATEWAY_URL || 'http://localhost:8080'
const AI_SERVICE_BASE = `${API_GATEWAY_URL}/ai`

// For local dev without gateway
const DIRECT_AI_URL = import.meta.env.VITE_AGENT_SERVICE_URL || 'http://localhost:8000'
const USE_GATEWAY = import.meta.env.VITE_USE_GATEWAY !== 'false'

// Base URL for AI service
const AGENT_SERVICE_URL = USE_GATEWAY ? AI_SERVICE_BASE : DIRECT_AI_URL

// Get auth token from localStorage
const getAuthHeaders = (): Record<string, string> => {
    const token = localStorage.getItem('accessToken')
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

export interface Agent {
    id: number
    name: string
    agent_type: 'main' | 'booking' | 'medical' | 'research'
    description?: string
    temperature: number
    max_tokens: number
    model: string
    system_prompt?: string
    enabled: boolean
    created_at?: string
    updated_at?: string
    tools?: string[]
}

export interface AgentListResponse {
    total: number
    main_agent?: Agent
    sub_agents: Agent[]
}

export interface Tool {
    id: number
    name: string
    tool_type: 'code_based' | 'api_based'
    source: 'fastmcp_code' | 'swagger_imported' | 'manual_api'
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

// ===== AGENT APIs =====

export const agentApi = {
    // Get all agents with hierarchy
    async getAgents(): Promise<AgentListResponse> {
        const response = await fetchWithAuth(`${AGENT_SERVICE_URL}/api/v1/agents`)
        if (!response.ok) throw new Error('Failed to fetch agents')
        return response.json()
    },

    // Get single agent
    async getAgent(id: number): Promise<Agent> {
        const response = await fetchWithAuth(`${AGENT_SERVICE_URL}/api/v1/agents/${id}`)
        if (!response.ok) throw new Error('Failed to fetch agent')
        const data = await response.json()
        return data.agent
    },

    // Update agent config
    async updateAgent(id: number, data: Partial<Agent>): Promise<Agent> {
        const response = await fetchWithAuth(`${AGENT_SERVICE_URL}/api/v1/agents/${id}`, {
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
        const response = await fetchWithAuth(`${AGENT_SERVICE_URL}/api/v1/agents/${id}/prompt`, {
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
    async getPromptHistory(id: number): Promise<any[]> {
        const response = await fetchWithAuth(`${AGENT_SERVICE_URL}/api/v1/agents/${id}/prompt-history`)
        if (!response.ok) throw new Error('Failed to fetch prompt history')
        const data = await response.json()
        return data.versions
    },

    // Test agent
    async testAgent(id: number, message: string): Promise<string> {
        const response = await fetchWithAuth(`${AGENT_SERVICE_URL}/api/v1/agents/${id}/test`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ message })
        })
        if (!response.ok) throw new Error('Failed to test agent')
        const data = await response.json()
        return data.response
    }
}

// ===== TOOL APIs =====

export const toolApi = {
    // Get all tools
    async getTools(): Promise<{ total: number; tools: Tool[] }> {
        const response = await fetchWithAuth(`${AGENT_SERVICE_URL}/api/v1/tools`)
        if (!response.ok) throw new Error('Failed to fetch tools')
        return response.json()
    },

    // Toggle tool enabled
    async toggleTool(id: number, enabled: boolean): Promise<void> {
        const response = await fetchWithAuth(`${AGENT_SERVICE_URL}/api/v1/tools/${id}/enable`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ enabled })
        })
        if (!response.ok) throw new Error('Failed to toggle tool')
    },

    // Assign tool to agent
    async assignToAgent(id: number, agentName: string): Promise<void> {
        const response = await fetchWithAuth(`${AGENT_SERVICE_URL}/api/v1/tools/${id}/assign`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ agent_name: agentName })
        })
        if (!response.ok) throw new Error('Failed to assign tool')
    },

    // Import from Swagger
    async importSwagger(swaggerUrl: string): Promise<any> {
        const response = await fetchWithAuth(`${AGENT_SERVICE_URL}/api/v1/tools/import-swagger`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ swagger_url: swaggerUrl, auto_enable: false })
        })
        if (!response.ok) throw new Error('Failed to import from Swagger')
        return response.json()
    },

    // Scan code tools
    async scanTools(): Promise<any> {
        const response = await fetchWithAuth(`${AGENT_SERVICE_URL}/api/v1/tools/scan`, {
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
        const response = await fetchWithAuth(`${AGENT_SERVICE_URL}/api/v1/knowledge/documents`)
        if (!response.ok) throw new Error('Failed to fetch documents')
        return response.json()
    },

    // Upload document
    async uploadDocument(file: File, notes?: string): Promise<any> {
        const formData = new FormData()
        formData.append('file', file)
        if (notes) formData.append('notes', notes)
        formData.append('uploaded_by', 'admin')

        const response = await fetchWithAuth(`${AGENT_SERVICE_URL}/api/v1/knowledge/upload`, {
            method: 'POST',
            body: formData
        })
        if (!response.ok) throw new Error('Failed to upload document')
        return response.json()
    },

    // Delete document
    async deleteDocument(id: number): Promise<void> {
        const response = await fetchWithAuth(`${AGENT_SERVICE_URL}/api/v1/knowledge/documents/${id}`, {
            method: 'DELETE'
        })
        if (!response.ok) throw new Error('Failed to delete document')
    },

    // Query knowledge base
    async query(queryText: string, topK: number = 5): Promise<QueryResult[]> {
        const response = await fetchWithAuth(`${AGENT_SERVICE_URL}/api/v1/knowledge/query`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ query: queryText, top_k: topK, min_score: 0.5 })
        })
        if (!response.ok) throw new Error('Failed to query knowledge base')
        const data = await response.json()
        return data.chunks
    },

    // Get status
    async getStatus(): Promise<any> {
        const response = await fetchWithAuth(`${AGENT_SERVICE_URL}/api/v1/knowledge/status`)
        if (!response.ok) throw new Error('Failed to fetch status')
        return response.json()
    }
}

// ===== WEBSOCKET =====

export const createChatWebSocket = (sessionId: string): WebSocket => {
    const wsUrl = USE_GATEWAY
        ? `${API_GATEWAY_URL.replace('http', 'ws')}/ai/ws/chat/${sessionId}`
        : `${DIRECT_AI_URL.replace('http', 'ws')}/ws/chat/${sessionId}`
    return new WebSocket(wsUrl)
}

export default { agentApi, toolApi, knowledgeApi, createChatWebSocket }

