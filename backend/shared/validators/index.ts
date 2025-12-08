/**
 * Data validation schemas and utilities
 * Using a simple validation approach that works in both frontend and backend
 */

export class ValidationError extends Error {
  constructor(
    message: string,
    public field?: string,
    public errors?: Record<string, string[]>
  ) {
    super(message)
    this.name = 'ValidationError'
  }
}

/**
 * Validate tool execution parameters
 */
export function validateToolExecution(data: any): void {
  const errors: Record<string, string[]> = {}

  if (!data.toolId || typeof data.toolId !== 'string') {
    errors.toolId = ['Tool ID is required and must be a string']
  }

  if (!data.parameters || typeof data.parameters !== 'object') {
    errors.parameters = ['Parameters must be an object']
  }

  if (Object.keys(errors).length > 0) {
    throw new ValidationError('Validation failed', undefined, errors)
  }
}

/**
 * Validate tool creation/update
 */
export function validateTool(data: any, isUpdate = false): void {
  const errors: Record<string, string[]> = {}

  if (!isUpdate || data.name !== undefined) {
    if (!data.name || typeof data.name !== 'string') {
      errors.name = ['Name is required and must be a string']
    } else if (data.name.length < 3 || data.name.length > 255) {
      errors.name = ['Name must be between 3 and 255 characters']
    }
  }

  if (!isUpdate || data.type !== undefined) {
    const validTypes = ['data_processor', 'api_caller', 'calculator', 'custom']
    if (!data.type || !validTypes.includes(data.type)) {
      errors.type = [`Type must be one of: ${validTypes.join(', ')}`]
    }
  }

  if (data.version !== undefined) {
    if (typeof data.version !== 'string' || !/^\d+\.\d+\.\d+$/.test(data.version)) {
      errors.version = ['Version must be in semver format (e.g., 1.0.0)']
    }
  }

  if (Object.keys(errors).length > 0) {
    throw new ValidationError('Validation failed', undefined, errors)
  }
}

/**
 * Sanitize string input to prevent XSS
 * Note: For production use with user-generated HTML content, consider using
 * a comprehensive library like DOMPurify for better protection.
 * This basic implementation handles common HTML entities.
 */
export function sanitizeString(input: string): string {
  if (!input) return ''
  
  return input
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#x27;')
    .replace(/\//g, '&#x2F;')
}

/**
 * Sanitize HTML content (basic implementation)
 * For production with rich text content, use DOMPurify:
 * 
 * import DOMPurify from 'dompurify'
 * export function sanitizeHTML(html: string): string {
 *   return DOMPurify.sanitize(html, { ALLOWED_TAGS: ['b', 'i', 'em', 'strong', 'a'] })
 * }
 */
export function sanitizeHTML(html: string): string {
  // This is a basic implementation. For production with user-generated HTML,
  // use DOMPurify or a similar library for comprehensive XSS protection.
  console.warn('Using basic HTML sanitization. Consider DOMPurify for production.')
  return sanitizeString(html)
}

/**
 * Validate email format
 */
export function validateEmail(email: string): boolean {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
  return emailRegex.test(email)
}

/**
 * Validate UUID format
 */
export function validateUUID(uuid: string): boolean {
  const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
  return uuidRegex.test(uuid)
}

/**
 * Validate pagination parameters
 */
export function validatePagination(params: any): { page: number; limit: number } {
  const page = parseInt(params.page) || 1
  const limit = Math.min(parseInt(params.limit) || 10, 100) // Max 100 per page

  if (page < 1) {
    throw new ValidationError('Page must be greater than 0', 'page')
  }

  if (limit < 1 || limit > 100) {
    throw new ValidationError('Limit must be between 1 and 100', 'limit')
  }

  return { page, limit }
}
