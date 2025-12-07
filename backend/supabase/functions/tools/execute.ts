import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

interface ToolExecutionRequest {
  toolId: string
  parameters: Record<string, any>
}

interface ToolExecutionResponse {
  executionId: string
  status: 'pending' | 'running' | 'completed' | 'failed'
  result?: any
  error?: string
}

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    // Get Supabase client
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_ANON_KEY') ?? '',
      {
        auth: {
          persistSession: false,
        },
      }
    )

    // Get user from auth header
    const authHeader = req.headers.get('Authorization')
    if (!authHeader) {
      return new Response(
        JSON.stringify({ error: 'Missing authorization header' }),
        {
          status: 401,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      )
    }

    const token = authHeader.replace('Bearer ', '')
    const { data: { user }, error: authError } = await supabaseClient.auth.getUser(token)

    if (authError || !user) {
      return new Response(
        JSON.stringify({ error: 'Invalid token' }),
        {
          status: 401,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      )
    }

    // Parse request body
    const { toolId, parameters }: ToolExecutionRequest = await req.json()

    // Validate tool exists
    const { data: tool, error: toolError } = await supabaseClient
      .from('tools')
      .select('*')
      .eq('id', toolId)
      .single()

    if (toolError || !tool) {
      return new Response(
        JSON.stringify({ error: 'Tool not found' }),
        {
          status: 404,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      )
    }

    // Check if tool is enabled
    if (!tool.enabled) {
      return new Response(
        JSON.stringify({ error: 'Tool is disabled' }),
        {
          status: 403,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      )
    }

    // Create execution record
    const executionId = crypto.randomUUID()
    const { error: insertError } = await supabaseClient
      .from('tool_executions')
      .insert({
        id: executionId,
        tool_id: toolId,
        user_id: user.id,
        parameters,
        status: 'pending',
        started_at: new Date().toISOString(),
      })

    if (insertError) {
      console.error('Failed to create execution record:', insertError)
      return new Response(
        JSON.stringify({ error: 'Failed to create execution' }),
        {
          status: 500,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      )
    }

    // Execute tool logic - implementations below
    const result = await executeToolLogic(tool, parameters)

    // Update execution record with result
    const { error: updateError } = await supabaseClient
      .from('tool_executions')
      .update({
        status: 'completed',
        result,
        completed_at: new Date().toISOString(),
      })
      .eq('id', executionId)

    if (updateError) {
      console.error('Failed to update execution record:', updateError)
      // Continue anyway - execution succeeded even if we couldn't save the result
    }

    const response: ToolExecutionResponse = {
      executionId,
      status: 'completed',
      result,
    }

    return new Response(
      JSON.stringify(response),
      {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    )
  } catch (error) {
    console.error('Error executing tool:', error)
    return new Response(
      JSON.stringify({ error: error.message || 'Internal server error' }),
      {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    )
  }
})

/**
 * Execute tool logic based on tool configuration
 * This is a placeholder that should be extended with actual tool implementations
 */
async function executeToolLogic(tool: any, parameters: Record<string, any>): Promise<any> {
  // Tool logic should be implemented here
  // This is where the "edge tools logic" stays in the backend
  
  console.log(`Executing tool: ${tool.name}`)
  console.log(`Parameters:`, parameters)
  
  // Example: Simple tool execution based on tool type
  switch (tool.type) {
    case 'data_processor':
      return processData(parameters)
    case 'api_caller':
      return callExternalAPI(parameters)
    case 'calculator':
      return calculate(parameters)
    default:
      return { message: 'Tool executed successfully', parameters }
  }
}

// Example tool implementations
function processData(params: any) {
  return {
    processed: true,
    inputCount: Array.isArray(params.data) ? params.data.length : 0,
    timestamp: new Date().toISOString(),
  }
}

async function callExternalAPI(params: any) {
  // Placeholder for external API calls
  return {
    called: true,
    endpoint: params.endpoint || 'default',
    timestamp: new Date().toISOString(),
  }
}

function calculate(params: any) {
  const { operation, values } = params
  let result = 0
  
  switch (operation) {
    case 'sum':
      result = values.reduce((a: number, b: number) => a + b, 0)
      break
    case 'multiply':
      result = values.reduce((a: number, b: number) => a * b, 1)
      break
    default:
      result = 0
  }
  
  return { result, operation, values }
}
