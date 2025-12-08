/**
 * Shared constants across the application
 */

export const API_VERSION = 'v1'

// Special value to represent unlimited/no limit
export const UNLIMITED = -1

export const TOOL_TYPES = {
  DATA_PROCESSOR: 'data_processor',
  API_CALLER: 'api_caller',
  CALCULATOR: 'calculator',
  CUSTOM: 'custom',
} as const

export const EXECUTION_STATUS = {
  PENDING: 'pending',
  RUNNING: 'running',
  COMPLETED: 'completed',
  FAILED: 'failed',
  CANCELLED: 'cancelled',
} as const

export const TOOL_CATEGORIES = {
  UTILITIES: 'utilities',
  INTEGRATION: 'integration',
  PROCESSING: 'processing',
  ANALYTICS: 'analytics',
  CUSTOM: 'custom',
} as const

export const ERROR_CODES = {
  VALIDATION_ERROR: 'VALIDATION_ERROR',
  AUTHENTICATION_ERROR: 'AUTHENTICATION_ERROR',
  AUTHORIZATION_ERROR: 'AUTHORIZATION_ERROR',
  NOT_FOUND: 'NOT_FOUND',
  TOOL_DISABLED: 'TOOL_DISABLED',
  EXECUTION_FAILED: 'EXECUTION_FAILED',
  RATE_LIMIT_EXCEEDED: 'RATE_LIMIT_EXCEEDED',
  INTERNAL_ERROR: 'INTERNAL_ERROR',
} as const

export const HTTP_STATUS = {
  OK: 200,
  CREATED: 201,
  NO_CONTENT: 204,
  BAD_REQUEST: 400,
  UNAUTHORIZED: 401,
  FORBIDDEN: 403,
  NOT_FOUND: 404,
  CONFLICT: 409,
  TOO_MANY_REQUESTS: 429,
  INTERNAL_SERVER_ERROR: 500,
} as const

export const RATE_LIMITS = {
  DEFAULT: {
    MAX_REQUESTS: 100,
    WINDOW_MS: 60000, // 1 minute
  },
  TOOL_EXECUTION: {
    MAX_REQUESTS: 20,
    WINDOW_MS: 60000,
  },
} as const

export const PAGINATION = {
  DEFAULT_PAGE: 1,
  DEFAULT_LIMIT: 10,
  MAX_LIMIT: 100,
} as const
