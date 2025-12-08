import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { z } from 'https://deno.land/x/zod@v3.22.4/mod.ts'
import { BrokerAdapterFactory } from '../../shared/lib/broker-adapter-factory.ts'
import { UniversalOAuth2Manager } from '../../shared/lib/universal-oauth2-manager.ts'

const corsHeaders = {
  'Access-Control-Allow-Origin': Deno.env.get('FRONTEND_URL') ?? '',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}

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
    // Verify JWT
    const authHeader = req.headers.get('Authorization')
    if (!authHeader) throw new Error('Missing authorization header')

    const token = authHeader.replace('Bearer ', '')
    const { data: { user }, error: authError } = await supabase.auth.getUser(token)
    
    if (authError || !user) throw new Error('Unauthorized')

    // Validate input
    const body = await req.json()
    const { broker, code, state } = CallbackSchema.parse(body)

    // Validate state parameter
    try {
      const stateData = JSON.parse(atob(state))
      if (stateData.userId !== user.id) {
        throw new Error('State validation failed: user ID mismatch')
      }
      
      const stateAge = Date.now() - stateData.timestamp
      if (stateAge > 15 * 60 * 1000) { // 15 minutes
        throw new Error('State validation failed: expired')
      }
    } catch (error) {
      throw new Error(`Invalid state parameter: ${error.message}`)
    }

    // Get auth manager
    const authManager = BrokerAdapterFactory.getAuthManager(broker, user.id)
    
    if (!(authManager instanceof UniversalOAuth2Manager)) {
      throw new Error('Expected OAuth2 manager')
    }

    // Exchange code for tokens
    const credentials = await authManager.exchangeCodeForTokens(code, user.id)

    // Create success alert
    await supabase.from('alerts').insert({
      user_id: user.id,
      type: 'broker_connected',
      message: `Successfully connected to ${broker}`,
      metadata: { 
        broker,
        expires_at: new Date(credentials.expires_at).toISOString(),
      },
    })

    return new Response(
      JSON.stringify({ 
        success: true,
        broker,
        expires_at: new Date(credentials.expires_at).toISOString(),
        message: `Successfully connected to ${broker}`,
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )

  } catch (error) {
    console.error('OAuth callback error:', error)
    
    return new Response(
      JSON.stringify({ 
        error: error instanceof z.ZodError 
          ? error.errors 
          : error.message || 'Failed to complete OAuth flow' 
      }),
      { 
        status: error instanceof z.ZodError ? 400 : 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      }
    )
  }
})
