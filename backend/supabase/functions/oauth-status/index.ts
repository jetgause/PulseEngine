import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': Deno.env.get('FRONTEND_URL') ?? '',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'GET, OPTIONS',
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders })
  }

  const supabase = createClient(
    Deno.env.get('SUPABASE_URL') ?? '',
    Deno.env.get('SUPABASE_ANON_KEY') ?? '',
  )

  try {
    // Verify JWT
    const authHeader = req.headers.get('Authorization')
    if (!authHeader) throw new Error('Missing authorization header')

    const token = authHeader.replace('Bearer ', '')
    const { data: { user }, error: authError } = await supabase.auth.getUser(token)
    
    if (authError || !user) throw new Error('Unauthorized')

    // Get broker parameter
    const url = new URL(req.url)
    const broker = url.searchParams.get('broker')

    if (broker) {
      // Get status for specific broker
      const { data: connection } = await supabase
        .from('user_broker_connections')
        .select('*')
        .eq('user_id', user.id)
        .eq('broker', broker)
        .eq('is_active', true)
        .single()

      return new Response(
        JSON.stringify({ 
          broker,
          connected: !!connection,
          expires_at: connection?.expires_at,
          token_type: connection?.token_type,
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    } else {
      // Get status for all brokers
      const { data: connections } = await supabase
        .from('user_broker_connections')
        .select('*')
        .eq('user_id', user.id)
        .eq('is_active', true)

      const status = connections?.map(conn => ({
        broker: conn.broker,
        connected: true,
        expires_at: conn.expires_at,
        token_type: conn.token_type,
      })) || []

      return new Response(
        JSON.stringify({ connections: status }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

  } catch (error) {
    console.error('OAuth status error:', error)
    
    return new Response(
      JSON.stringify({ 
        error: error.message || 'Failed to get OAuth status' 
      }),
      { 
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      }
    )
  }
})
