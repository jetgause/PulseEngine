import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { z } from 'https://deno.land/x/zod@v3.22.4/mod.ts'

const corsHeaders = {
  'Access-Control-Allow-Origin': Deno.env.get('FRONTEND_URL') ?? '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'GET, OPTIONS',
}

const QuoteSchema = z.object({
  symbols: z.array(z.string()).min(1).max(50),
})

const OptionsChainSchema = z.object({
  symbol: z.string().regex(/^[A-Z]{1,5}(\.[A-Z]{1,2})?$/),
  expiration: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(), // YYYY-MM-DD
})

const GammaExposureSchema = z.object({
  symbol: z.string().regex(/^[A-Z]{1,5}(\.[A-Z]{1,2})?$/),
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

    // Check user's tier and rate limits
    const { data: profile } = await supabase
      .from('profiles')
      .select('tier, credits')
      .eq('id', user.id)
      .single()

    if (!profile) throw new Error('User profile not found')

    // Check rate limits based on tier
    const { data: usageToday } = await supabase
      .from('usage_metrics')
      .select('api_calls')
      .eq('user_id', user.id)
      .gte('date', new Date().toISOString().split('T')[0])
      .single()

    const tierLimits: Record<string, number> = {
      free: 100,
      pro: 1000,
      premium: 10000,
      enterprise: 1000000,
    }

    const limit = tierLimits[profile.tier] || 100
    if (usageToday && usageToday.api_calls >= limit) {
      return new Response(
        JSON.stringify({ error: `Rate limit exceeded. Upgrade your tier to get more API calls.` }),
        { status: 429, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    const { pathname, searchParams } = new URL(req.url)

    let responseData: any

    // Real-time quotes
    if (pathname.endsWith('/quotes')) {
      const symbols = searchParams.get('symbols')?.split(',') ?? []
      const validated = QuoteSchema.parse({ symbols })

      responseData = await fetchAlpacaQuotes(validated.symbols)
    }
    // Options chain
    else if (pathname.endsWith('/options-chain')) {
      const symbol = searchParams.get('symbol') ?? ''
      const expiration = searchParams.get('expiration') ?? undefined
      
      const validated = OptionsChainSchema.parse({ symbol, expiration })
      responseData = await fetchTradierOptionsChain(validated.symbol, validated.expiration)
    }
    // Gamma exposure calculation
    else if (pathname.endsWith('/gamma-exposure')) {
      const symbol = searchParams.get('symbol') ?? 'SPY'
      
      const validated = GammaExposureSchema.parse({ symbol })
      
      // Fetch options chain
      const chain = await fetchTradierOptionsChain(validated.symbol)
      
      // Calculate gamma exposure
      responseData = calculateGammaWalls(chain, validated.symbol)
    }
    else {
      return new Response(
        JSON.stringify({ error: 'Route not found' }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Track usage
    await supabase.rpc('increment_api_calls', { p_user_id: user.id })

    return new Response(
      JSON.stringify({ data: responseData }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )

  } catch (error) {
    console.error('Market data error:', error)
    
    const status = error instanceof z.ZodError ? 400 : 
                   error.message === 'Unauthorized' ? 401 :
                   error.message.includes('Rate limit') ? 429 : 500
    
    return new Response(
      JSON.stringify({ 
        error: error instanceof z.ZodError 
          ? error.errors 
          : error.message || 'Market data request failed' 
      }),
      { 
        status,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      }
    )
  }
})

async function fetchAlpacaQuotes(symbols: string[]) {
  const apiKey = Deno.env.get('ALPACA_API_KEY')
  const apiSecret = Deno.env.get('ALPACA_API_SECRET')

  if (!apiKey || !apiSecret) {
    throw new Error('Alpaca API credentials not configured')
  }

  const response = await fetch(
    `https://data.alpaca.markets/v2/stocks/quotes/latest?symbols=${symbols.join(',')}`,
    {
      headers: {
        'APCA-API-KEY-ID': apiKey,
        'APCA-API-SECRET-KEY': apiSecret,
      },
    }
  )

  if (!response.ok) {
    const errorText = await response.text()
    throw new Error(`Alpaca API error: ${response.status} - ${errorText}`)
  }
  
  const data = await response.json()
  return data.quotes
}

async function fetchTradierOptionsChain(symbol: string, expiration?: string) {
  const apiKey = Deno.env.get('TRADIER_API_KEY')

  if (!apiKey) {
    throw new Error('Tradier API key not configured')
  }

  const url = expiration
    ? `https://api.tradier.com/v1/markets/options/chains?symbol=${symbol}&expiration=${expiration}`
    : `https://api.tradier.com/v1/markets/options/chains?symbol=${symbol}`

  const response = await fetch(url, {
    headers: {
      'Authorization': `Bearer ${apiKey}`,
      'Accept': 'application/json',
    },
  })

  if (!response.ok) {
    const errorText = await response.text()
    throw new Error(`Tradier API error: ${response.status} - ${errorText}`)
  }
  
  const data = await response.json()
  
  // Handle case where no options are available
  if (!data.options || !data.options.option) {
    return []
  }
  
  return Array.isArray(data.options.option) ? data.options.option : [data.options.option]
}

interface OptionData {
  strike: number
  option_type: 'call' | 'put'
  open_interest: number
  gamma: number
  bid: number
  ask: number
}

function calculateGammaWalls(optionsChain: OptionData[], symbol: string) {
  // Simplified gamma exposure calculation
  // In production, use Black-Scholes model for accurate gamma calculation
  
  const gammaByStrike = new Map<number, { call_gamma: number; put_gamma: number; net_gamma: number }>()
  
  for (const option of optionsChain) {
    const strike = option.strike
    
    if (!gammaByStrike.has(strike)) {
      gammaByStrike.set(strike, { call_gamma: 0, put_gamma: 0, net_gamma: 0 })
    }
    
    const current = gammaByStrike.get(strike)!
    
    // Estimate gamma exposure = gamma * open_interest * 100 (shares per contract)
    // For calls: dealers are short gamma (negative for them, positive for retail)
    // For puts: dealers are short gamma (negative for them, positive for retail)
    const gammaEstimate = option.gamma || estimateGamma(option)
    const exposure = gammaEstimate * option.open_interest * 100
    
    if (option.option_type === 'call') {
      current.call_gamma += exposure
      current.net_gamma += exposure
    } else if (option.option_type === 'put') {
      current.put_gamma += exposure
      current.net_gamma -= exposure // Puts have negative gamma for dealers
    }
    
    gammaByStrike.set(strike, current)
  }
  
  // Convert to array and sort by strike
  const gammaLevels = Array.from(gammaByStrike.entries())
    .map(([strike, gamma]) => ({
      strike,
      ...gamma,
    }))
    .sort((a, b) => a.strike - b.strike)
  
  // Identify gamma walls (high concentration areas)
  const avgGamma = gammaLevels.reduce((sum, level) => sum + Math.abs(level.net_gamma), 0) / gammaLevels.length
  const gammaWalls = gammaLevels
    .filter(level => Math.abs(level.net_gamma) > avgGamma * 2)
    .map(level => ({
      ...level,
      type: level.net_gamma > 0 ? 'resistance' : 'support',
      strength: Math.abs(level.net_gamma) / avgGamma,
    }))
  
  return {
    symbol,
    gamma_levels: gammaLevels,
    gamma_walls: gammaWalls,
    total_call_gamma: gammaLevels.reduce((sum, l) => sum + l.call_gamma, 0),
    total_put_gamma: gammaLevels.reduce((sum, l) => sum + l.put_gamma, 0),
    net_gamma: gammaLevels.reduce((sum, l) => sum + l.net_gamma, 0),
  }
}

function estimateGamma(option: OptionData): number {
  // Simplified gamma estimation based on option price
  // In production, calculate using Black-Scholes formula:
  // gamma = N'(d1) / (S * sigma * sqrt(T))
  
  const midPrice = (option.bid + option.ask) / 2
  
  if (midPrice === 0) return 0
  
  // Rough estimation: gamma is higher for ATM options and decreases for OTM/ITM
  // This is a placeholder - use proper Black-Scholes in production
  const estimatedGamma = 0.001 * (1 / (1 + Math.abs(midPrice - option.strike) / 10))
  
  return estimatedGamma
}
