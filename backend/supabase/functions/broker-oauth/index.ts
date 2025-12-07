import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { z } from 'https://deno.land/x/zod@v3.22.4/mod.ts'
import { createOAuth2Manager } from '../../shared/lib/oauth2-manager.ts'

const corsHeaders = {
  'Access-Control-Allow-Origin': Deno.env.get('FRONTEND_URL') ?? '',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
}

const InitiateSchema = z.object({
  broker: z.enum(['alpaca', 'tdameritrade', 'schwab', 'etrade', 'tradier']),
})

const CallbackSchema = z.object({
  broker: z.string(),
  code: z.string(),
  state: z.string(),
})

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders })
  }

  const supabase = createClient(
    Deno.env.get('SUPABASE_URL') ?? '',
    Deno.env.get('SUPABASE_ANON_KEY') ?? '',
  )

  try {
    const { pathname } = new URL(req.url)

    // Initiate OAuth flow - returns authorization URL
    if (pathname === '/initiate' && req.method === 'POST') {
      // Verify JWT
      const authHeader = req.headers.get('Authorization')
      if (!authHeader) throw new Error('Missing authorization header')

      const token = authHeader.replace('Bearer ', '')
      const { data: { user }, error: authError } = await supabase.auth.getUser(token)
      
      if (authError || !user) throw new Error('Unauthorized')

      const body = await req.json()
      const { broker } = InitiateSchema.parse(body)

      // Create OAuth2 manager for the broker
      const oauth2Manager = createOAuth2Manager(broker)

      // Generate authorization URL
      const authUrl = oauth2Manager.getAuthorizationUrl(user.id)

      return new Response(
        JSON.stringify({ 
          url: authUrl,
          message: `Redirect user to this URL to authorize ${broker}`,
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Handle OAuth callback - exchange code for tokens
    if (pathname === '/callback' && req.method === 'POST') {
      // Verify JWT
      const authHeader = req.headers.get('Authorization')
      if (!authHeader) throw new Error('Missing authorization header')

      const token = authHeader.replace('Bearer ', '')
      const { data: { user }, error: authError } = await supabase.auth.getUser(token)
      
      if (authError || !user) throw new Error('Unauthorized')

      const body = await req.json()
      const { broker, code, state } = CallbackSchema.parse(body)

      // Create OAuth2 manager for the broker
      const oauth2Manager = createOAuth2Manager(broker)

      // Validate state parameter
      if (!oauth2Manager.validateState(state, user.id)) {
        throw new Error('Invalid or expired state parameter')
      }

      // Exchange code for tokens
      const credentials = await oauth2Manager.exchangeCodeForTokens(code, user.id)

      // Create alert for successful connection
      await supabase.from('alerts').insert({
        user_id: user.id,
        type: 'broker_connected',
        title: `${broker} connected`,
        message: `Successfully connected your ${broker} account`,
        severity: 'success',
        is_read: false,
      })

      return new Response(
        JSON.stringify({ 
          success: true,
          message: `Successfully connected ${broker} account`,
          expires_at: new Date(credentials.expires_at).toISOString(),
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Disconnect broker (revoke access)
    if (pathname === '/disconnect' && req.method === 'POST') {
      // Verify JWT
      const authHeader = req.headers.get('Authorization')
      if (!authHeader) throw new Error('Missing authorization header')

      const token = authHeader.replace('Bearer ', '')
      const { data: { user }, error: authError } = await supabase.auth.getUser(token)
      
      if (authError || !user) throw new Error('Unauthorized')

      const body = await req.json()
      const { broker } = InitiateSchema.parse(body)

      // Create OAuth2 manager for the broker
      const oauth2Manager = createOAuth2Manager(broker)

      // Revoke access
      await oauth2Manager.revokeAccess(user.id)

      return new Response(
        JSON.stringify({ 
          success: true,
          message: `Successfully disconnected ${broker} account`,
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Get connection status
    if (pathname === '/status' && req.method === 'GET') {
      // Verify JWT
      const authHeader = req.headers.get('Authorization')
      if (!authHeader) throw new Error('Missing authorization header')

      const token = authHeader.replace('Bearer ', '')
      const { data: { user }, error: authError } = await supabase.auth.getUser(token)
      
      if (authError || !user) throw new Error('Unauthorized')

      // Get all active broker connections
      const { data: connections, error } = await supabase
        .from('user_broker_connections')
        .select('broker_name, is_active, created_at, updated_at')
        .eq('user_id', user.id)
        .eq('is_active', true)

      if (error) throw error

      return new Response(
        JSON.stringify({ 
          connections: connections || [],
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    return new Response(
      JSON.stringify({ error: 'Route not found' }),
      { status: 404, headers: corsHeaders }
    )

  } catch (error) {
    console.error('Broker OAuth error:', error)
    
    return new Response(
      JSON.stringify({ 
        error: error instanceof z.ZodError 
          ? error.errors 
          : error.message || 'OAuth flow failed' 
      }),
      { 
        status: error instanceof z.ZodError ? 400 : 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      }
    )
  }
})
