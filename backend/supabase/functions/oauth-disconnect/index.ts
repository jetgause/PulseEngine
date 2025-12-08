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

const DisconnectSchema = z.object({
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
    const { broker } = DisconnectSchema.parse(body)

    // Get auth manager
    const authManager = BrokerAdapterFactory.getAuthManager(broker, user.id)
    
    if (authManager instanceof UniversalOAuth2Manager) {
      // OAuth2 disconnect
      await authManager.revokeAccess(user.id)
    } else {
      // Session-based disconnect (IBKR)
      await authManager.disconnect()
    }

    // Create disconnection alert
    await supabase.from('alerts').insert({
      user_id: user.id,
      type: 'broker_disconnected',
      message: `Disconnected from ${broker}`,
      metadata: { broker },
    })

    return new Response(
      JSON.stringify({ 
        success: true,
        broker,
        message: `Successfully disconnected from ${broker}`,
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )

  } catch (error) {
    console.error('OAuth disconnect error:', error)
    
    return new Response(
      JSON.stringify({ 
        error: error instanceof z.ZodError 
          ? error.errors 
          : error.message || 'Failed to disconnect broker' 
      }),
      { 
        status: error instanceof z.ZodError ? 400 : 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      }
    )
  }
})
