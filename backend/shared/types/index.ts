/**
 * Shared TypeScript types for PulseEngine
 * These types are used across frontend and backend
 */

export interface Tool {
  id: string
  name: string
  description: string
  type: ToolType
  category: string
  version: string
  enabled: boolean
  configuration: Record<string, any>
  created_at: string
  updated_at: string
  created_by?: string
}

export type ToolType = 'data_processor' | 'api_caller' | 'calculator' | 'custom'

export interface ToolExecution {
  id: string
  tool_id: string
  user_id: string
  parameters: Record<string, any>
  result?: any
  status: ExecutionStatus
  error_message?: string
  started_at: string
  completed_at?: string
  created_at: string
}

export type ExecutionStatus = 'pending' | 'running' | 'completed' | 'failed' | 'cancelled'

export interface ToolExecutionRequest {
  toolId: string
  parameters: Record<string, any>
}

export interface ToolExecutionResponse {
  executionId: string
  status: ExecutionStatus
  result?: any
  error?: string
}

export interface APIResponse<T = any> {
  data?: T
  error?: APIError
  pagination?: Pagination
}

export interface APIError {
  message: string
  code?: string
  details?: any
}

export interface Pagination {
  page: number
  limit: number
  total: number
  totalPages: number
}

export interface User {
  id: string
  email: string
  created_at: string
  metadata?: Record<string, any>
}
