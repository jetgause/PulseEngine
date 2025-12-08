import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
}

/**
 * API Gateway - Central routing and management for all API requests
 * This implements robust API management with:
 * - Authentication
 * - Rate limiting
 * - Request validation
 * - Error handling
 * - Logging
 */

interface RateLimitEntry {
  count: number
  resetTime: number
}

const rateLimitStore = new Map<string, RateLimitEntry>()

serve(async (req) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  const startTime = Date.now()
  const requestId = crypto.randomUUID()

  try {
    const url = new URL(req.url)
    const path = url.pathname
    const method = req.method

    console.log(`[${requestId}] ${method} ${path}`)

    // Initialize Supabase client
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_ANON_KEY') ?? '',
      {
        auth: {
          persistSession: false,
        },
      }
    )

    // Authentication check (skip for public endpoints)
    const publicEndpoints = ['/health', '/version']
    let user = null

    if (!publicEndpoints.includes(path)) {
      const authHeader = req.headers.get('Authorization')
      
      if (!authHeader) {
        return createErrorResponse('Missing authorization header', 401, requestId)
      }

      const token = authHeader.replace('Bearer ', '')
      const { data: { user: authUser }, error: authError } = await supabaseClient.auth.getUser(token)

      if (authError || !authUser) {
        return createErrorResponse('Invalid or expired token', 401, requestId)
      }

      user = authUser

      // Rate limiting
      const rateLimitKey = `${user.id}:${path}`
      const rateLimitResult = checkRateLimit(rateLimitKey, 20, 60000) // 20 requests per minute

      if (!rateLimitResult.allowed) {
        return createErrorResponse(
          'Rate limit exceeded',
          429,
          requestId,
          {
            retryAfter: Math.ceil((rateLimitResult.resetTime - Date.now()) / 1000),
          }
        )
      }
    }

    // Route requests
    let response: Response

    if (path === '/health') {
      response = createSuccessResponse({ status: 'healthy', timestamp: new Date().toISOString() })
    } else if (path === '/version') {
      response = createSuccessResponse({ version: 'v1.0.0', api: 'PulseEngine' })
    } else if (path.startsWith('/api/v1/tools')) {
      response = await routeToolsAPI(req, url, user, supabaseClient)
    } else if (path.startsWith('/api/v1/data')) {
      response = await routeDataAPI(req, url, user, supabaseClient)
    } else {
      response = createErrorResponse('Endpoint not found', 404, requestId)
    }

    // Add timing header
    const duration = Date.now() - startTime
    const headers = new Headers(response.headers)
    headers.set('X-Request-ID', requestId)
    headers.set('X-Response-Time', `${duration}ms`)

    console.log(`[${requestId}] Completed in ${duration}ms`)

    return new Response(response.body, {
      status: response.status,
      headers,
    })
  } catch (error) {
    console.error(`[${requestId}] Error:`, error)
    return createErrorResponse(
      'Internal server error',
      500,
      requestId,
      { message: error.message }
    )
  }
})

/**
 * Rate limiting check
 */
function checkRateLimit(key: string, maxRequests: number, windowMs: number): { allowed: boolean; resetTime: number } {
  const now = Date.now()
  const entry = rateLimitStore.get(key)

  if (!entry || now > entry.resetTime) {
    // New window
    const resetTime = now + windowMs
    rateLimitStore.set(key, { count: 1, resetTime })
    return { allowed: true, resetTime }
  }

  if (entry.count >= maxRequests) {
    return { allowed: false, resetTime: entry.resetTime }
  }

  entry.count++
  rateLimitStore.set(key, entry)
  return { allowed: true, resetTime: entry.resetTime }
}

/**
 * Route tools API requests
 */
async function routeToolsAPI(req: Request, url: URL, user: any, supabase: any): Promise<Response> {
  const path = url.pathname.replace('/api/v1/tools', '')

  if (path === '' && req.method === 'GET') {
    // List tools
    return await listTools(url, supabase)
  } else if (path.match(/^\/[^/]+$/) && req.method === 'GET') {
    // Get single tool
    const toolId = path.substring(1)
    return await getTool(toolId, supabase)
  } else if (path.match(/^\/[^/]+\/execute$/) && req.method === 'POST') {
    // Execute tool
    const toolId = path.split('/')[1]
    const body = await req.json()
    return await executeTool(toolId, body, user, supabase)
  }

  return createErrorResponse('Tools endpoint not found', 404)
}

/**
 * Route data API requests
 */
async function routeDataAPI(req: Request, url: URL, user: any, supabase: any): Promise<Response> {
  const path = url.pathname.replace('/api/v1/data', '')
  const parts = path.split('/').filter(p => p)

  if (parts.length === 0) {
    return createErrorResponse('Resource name required', 400)
  }

  const resource = parts[0]
  const id = parts[1]

  // Basic CRUD operations
  if (req.method === 'GET' && !id) {
    return await getResources(resource, url, supabase)
  } else if (req.method === 'GET' && id) {
    return await getResource(resource, id, supabase)
  } else if (req.method === 'POST') {
    const body = await req.json()
    return await createResource(resource, body, user, supabase)
  } else if (req.method === 'PUT' && id) {
    const body = await req.json()
    return await updateResource(resource, id, body, supabase)
  } else if (req.method === 'DELETE' && id) {
    return await deleteResource(resource, id, supabase)
  }

  return createErrorResponse('Invalid data operation', 400)
}

// Helper functions for API operations
async function listTools(url: URL, supabase: any) {
  const page = parseInt(url.searchParams.get('page') || '1')
  const limit = Math.min(parseInt(url.searchParams.get('limit') || '10'), 100)
  const offset = (page - 1) * limit

  const { data, error, count } = await supabase
    .from('tools')
    .select('*', { count: 'exact' })
    .eq('enabled', true)
    .range(offset, offset + limit - 1)

  if (error) throw error

  return createSuccessResponse({
    tools: data,
    pagination: {
      page,
      limit,
      total: count,
      totalPages: Math.ceil(count / limit),
    },
  })
}

async function getTool(toolId: string, supabase: any) {
  const { data, error } = await supabase
    .from('tools')
    .select('*')
    .eq('id', toolId)
    .single()

  if (error) throw error
  if (!data) return createErrorResponse('Tool not found', 404)

  return createSuccessResponse(data)
}

async function executeTool(toolId: string, params: any, user: any, supabase: any) {
  // This would call the tool execution edge function
  return createSuccessResponse({
    message: 'Tool execution not yet implemented in gateway',
    toolId,
    params,
  })
}

async function getResources(resource: string, url: URL, supabase: any) {
  const { data, error } = await supabase.from(resource).select('*')
  if (error) throw error
  return createSuccessResponse(data)
}

async function getResource(resource: string, id: string, supabase: any) {
  const { data, error } = await supabase.from(resource).select('*').eq('id', id).single()
  if (error) throw error
  return createSuccessResponse(data)
}

async function createResource(resource: string, body: any, user: any, supabase: any) {
  const { data, error } = await supabase.from(resource).insert(body).select().single()
  if (error) throw error
  return createSuccessResponse(data, 201)
}

async function updateResource(resource: string, id: string, body: any, supabase: any) {
  const { data, error } = await supabase.from(resource).update(body).eq('id', id).select().single()
  if (error) throw error
  return createSuccessResponse(data)
}

async function deleteResource(resource: string, id: string, supabase: any) {
  const { error } = await supabase.from(resource).delete().eq('id', id)
  if (error) throw error
  return new Response(null, { status: 204, headers: corsHeaders })
}

/**
 * Create success response
 */
function createSuccessResponse(data: any, status = 200): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  })
}

/**
 * Create error response
 */
function createErrorResponse(message: string, status = 400, requestId?: string, details?: any): Response {
  return new Response(
    JSON.stringify({
      error: message,
      status,
      requestId,
      details,
      timestamp: new Date().toISOString(),
    }),
    {
      status,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    }
  )
}
