import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { z } from 'https://deno.land/x/zod@v3.22.4/mod.ts'

const corsHeaders = {
  'Access-Control-Allow-Origin': Deno.env.get('FRONTEND_URL') ?? 'http://localhost:5173',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}

const OrderSchema = z.object({
  broker: z.enum(['alpaca', 'ibkr', 'tradier', 'td', 'schwab']),
  action: z.enum(['buy', 'sell']),
  symbol: z.string().regex(/^[A-Z]{1,5}(\.[A-Z]+)?$/), // Stock ticker validation (supports BRK.B, BRK.BR format)
  qty: z.number().int().positive().max(10000),
  order_type: z.enum(['market', 'limit']).default('market'),
  limit_price: z.number().positive().optional(),
  time_in_force: z.enum(['day', 'gtc', 'ioc']).default('day'),
}).refine(
  (data) => data.order_type !== 'limit' || data.limit_price !== undefined,
  {
    message: 'Limit price is required for limit orders',
    path: ['limit_price'],
  }
)

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
    const order = OrderSchema.parse(body)

    // Check idempotency
    const idempotencyKey = req.headers.get('Idempotency-Key')
    if (idempotencyKey) {
      const { data: existing } = await supabase
        .from('orders')
        .select('*')
        .eq('idempotency_key', idempotencyKey)
        .eq('user_id', user.id)
        .single()

      if (existing) {
        return new Response(
          JSON.stringify({ data: existing, cached: true }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        )
      }
    }

    // Get user's broker connection (with credentials)
    const { data: brokerConnections, error: credError } = await supabase
      .from('user_broker_connections')
      .select('id, api_key_encrypted, api_secret_encrypted, account_type, brokers(slug)')
      .eq('user_id', user.id)
      .eq('brokers.slug', order.broker)
      .eq('status', 'active')
      .limit(1)

    if (credError || !brokerConnections || brokerConnections.length === 0) {
      throw new Error(`No active ${order.broker} connection found`)
    }

    const credentials = brokerConnections[0]

    // Submit order to broker
    let result
    switch (order.broker) {
      case 'alpaca':
        result = await submitAlpacaOrder(credentials, order)
        break
      case 'ibkr':
        result = await submitIBKROrder(credentials, order)
        break
      case 'tradier':
        result = await submitTradierOrder(credentials, order)
        break
      case 'td':
        result = await submitTDOrder(credentials, order)
        break
      case 'schwab':
        result = await submitSchwabOrder(credentials, order)
        break
      default:
        throw new Error(`Broker ${order.broker} not implemented yet`)
    }

    // Store order in database
    const { data: orderRecord, error: insertError } = await supabase
      .from('orders')
      .insert({
        user_id: user.id,
        broker_connection_id: credentials.id,
        broker_order_id: result.orderId,
        symbol: order.symbol,
        side: order.action,
        order_type: order.order_type,
        quantity: order.qty,
        price: order.limit_price,
        time_in_force: order.time_in_force,
        status: result.status,
        filled_quantity: result.metadata?.filled_qty || 0,
        filled_avg_price: result.metadata?.filled_avg_price,
        idempotency_key: idempotencyKey,
        metadata: result.metadata,
        submitted_at: new Date().toISOString(), // Use client timestamp for when order was submitted
      })
      .select()
      .single()

    if (insertError) throw insertError

    return new Response(
      JSON.stringify({ data: orderRecord }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )

  } catch (error) {
    console.error('Broker order error:', error)
    
    return new Response(
      JSON.stringify({ 
        error: error instanceof z.ZodError 
          ? error.errors 
          : error.message || 'Order submission failed' 
      }),
      { 
        status: error instanceof z.ZodError ? 400 : 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      }
    )
  }
})

// Helper: Decrypt credentials (placeholder - implement actual decryption)
function decryptCredential(encryptedValue: string): string {
  // TODO: Implement actual decryption using Supabase Vault or encryption key
  // For now, assume credentials are stored in plaintext (NOT PRODUCTION READY)
  // In production, use: https://supabase.com/docs/guides/database/vault
  console.warn('WARNING: Credentials are not encrypted. Implement decryption before production!')
  return encryptedValue
}

// Alpaca integration
async function submitAlpacaOrder(credentials: any, order: any) {
  // Determine if using paper or live API
  const baseUrl = credentials.account_type === 'live' 
    ? 'https://api.alpaca.markets'
    : 'https://paper-api.alpaca.markets'

  // Decrypt credentials before use
  const apiKey = decryptCredential(credentials.api_key_encrypted)
  const apiSecret = decryptCredential(credentials.api_secret_encrypted)

  // Build request body, only include limit_price for limit orders
  const requestBody: any = {
    symbol: order.symbol,
    qty: order.qty,
    side: order.action,
    type: order.order_type,
    time_in_force: order.time_in_force,
  }
  
  if (order.order_type === 'limit' && order.limit_price) {
    requestBody.limit_price = order.limit_price
  }

  const response = await fetch(`${baseUrl}/v2/orders`, {
    method: 'POST',
    headers: {
      'APCA-API-KEY-ID': apiKey,
      'APCA-API-SECRET-KEY': apiSecret,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(requestBody),
  })

  if (!response.ok) {
    let errorMessage = `Alpaca API error (${response.status})`
    try {
      const error = await response.json()
      errorMessage = `Alpaca error: ${error.message || error.code || JSON.stringify(error)}`
    } catch {
      // If response is not JSON, use status text
      errorMessage = `Alpaca error: ${response.statusText} (${response.status})`
    }
    throw new Error(errorMessage)
  }

  const data = await response.json()
  return {
    orderId: data.id,
    status: data.status, // Maps to our status field
    metadata: { 
      filled_qty: data.filled_qty, 
      filled_avg_price: data.filled_avg_price,
      broker_response: data 
    },
  }
}

// IBKR integration (placeholder)
async function submitIBKROrder(credentials: any, order: any) {
  // Implement IBKR Client Portal API integration
  // https://www.interactivebrokers.com/api/doc.html
  throw new Error('IBKR integration not implemented - requires Client Portal API setup')
}

// Tradier integration (placeholder)
async function submitTradierOrder(credentials: any, order: any) {
  // Implement Tradier Brokerage API integration
  // https://documentation.tradier.com/brokerage-api
  throw new Error('Tradier integration not implemented')
}

// TD Ameritrade integration (placeholder)
async function submitTDOrder(credentials: any, order: any) {
  // Implement TD Ameritrade API integration
  // Note: TD Ameritrade is being integrated with Schwab
  throw new Error('TD Ameritrade integration not implemented - migrating to Schwab')
}

// Charles Schwab integration (placeholder)
async function submitSchwabOrder(credentials: any, order: any) {
  // Implement Charles Schwab API integration
  // https://developer.schwab.com/
  throw new Error('Schwab integration not implemented')
}
