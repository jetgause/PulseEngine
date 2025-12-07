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

const InitiateSchema = z.object({
  broker: z.string(),
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
    const { broker } = InitiateSchema.parse(body)

    // Check if broker supports OAuth2
    if (!BrokerAdapterFactory.supportsOAuth2(broker)) {
      if (BrokerAdapterFactory.requiresSessionAuth(broker)) {
        return new Response(
          JSON.stringify({ 
            error: `${broker} requires session-based authentication. Please use the session auth flow.`,
            requiresSessionAuth: true,
          }),
          { 
            status: 400, 
            headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
          }
        )
      }
      
      throw new Error(`Broker ${broker} not supported`)
    }

    // Get auth manager
    const authManager = BrokerAdapterFactory.getAuthManager(broker, user.id)
    
    if (!(authManager instanceof UniversalOAuth2Manager)) {
      throw new Error('Expected OAuth2 manager')
    }

    // Generate authorization URL
    const authUrl = await authManager.getAuthorizationUrl(user.id)

    // Log initiation
    await supabase.from('alerts').insert({
      user_id: user.id,
      type: 'broker_oauth_initiated',
      message: `OAuth flow initiated for ${broker}`,
      metadata: { broker },
    })

    return new Response(
      JSON.stringify({ 
        url: authUrl,
        broker,
        message: 'Redirect user to this URL to authorize broker connection',
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )

  } catch (error) {
    console.error('OAuth initiate error:', error)
    
    return new Response(
      JSON.stringify({ 
        error: error instanceof z.ZodError 
          ? error.errors 
          : error.message || 'Failed to initiate OAuth flow' 
      }),
      { 
        status: error instanceof z.ZodError ? 400 : 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      }
    )
  }
})
