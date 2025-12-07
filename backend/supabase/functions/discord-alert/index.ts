import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { z } from 'https://deno.land/x/zod@v3.22.4/mod.ts'

const TradeSignalSchema = z.object({
  userId: z.string().uuid(),
  alertType: z.literal('trade_signal'),
  data: z.object({
    signal_type: z.enum(['BUY', 'SELL']),
    symbol: z.string(),
    description: z.string(),
    entry_price: z.number(),
    stop_loss: z.number().optional(),
    target: z.number().optional(),
    confidence: z.number().min(0).max(100),
  }),
})

const OrderExecutedSchema = z.object({
  userId: z.string().uuid(),
  alertType: z.literal('order_executed'),
  data: z.object({
    order_id: z.string(),
    symbol: z.string(),
    action: z.enum(['buy', 'sell']),
    quantity: z.number(),
    price: z.number(),
    order_type: z.string(),
    broker: z.string(),
  }),
})

const PriceAlertSchema = z.object({
  userId: z.string().uuid(),
  alertType: z.literal('price_alert'),
  data: z.object({
    symbol: z.string(),
    current_price: z.number(),
    trigger_price: z.number(),
    condition: z.enum(['above', 'below']),
  }),
})

const AlertSchema = z.discriminatedUnion('alertType', [
  TradeSignalSchema,
  OrderExecutedSchema,
  PriceAlertSchema,
])

serve(async (req) => {
  const supabase = createClient(
    Deno.env.get('SUPABASE_URL') ?? '',
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
  )

  try {
    // Validate request body
    const body = await req.json()
    const validated = AlertSchema.parse(body)

    // Get user's Discord webhook URL
    const { data: integration, error: integrationError } = await supabase
      .from('user_discord_integrations')
      .select('webhook_url, enabled')
      .eq('user_id', validated.userId)
      .eq('enabled', true)
      .single()

    if (integrationError || !integration?.webhook_url) {
      return new Response(
        JSON.stringify({ error: 'No Discord webhook configured or integration disabled' }),
        {
          status: 400,
          headers: { 'Content-Type': 'application/json' },
        }
      )
    }

    // Build embed based on alert type
    let embed: any

    if (validated.alertType === 'trade_signal') {
      const { signal_type, symbol, description, entry_price, stop_loss, target, confidence } = validated.data
      
      embed = {
        title: `🚨 ${signal_type} Signal: ${symbol}`,
        description: description,
        color: signal_type === 'BUY' ? 0x00ff00 : 0xff0000, // Green for buy, red for sell
        fields: [
          { name: 'Entry Price', value: `$${entry_price.toFixed(2)}`, inline: true },
          ...(stop_loss ? [{ name: 'Stop Loss', value: `$${stop_loss.toFixed(2)}`, inline: true }] : []),
          ...(target ? [{ name: 'Target', value: `$${target.toFixed(2)}`, inline: true }] : []),
          { name: 'Confidence', value: `${confidence}%`, inline: true },
        ],
        timestamp: new Date().toISOString(),
        footer: { text: 'PulseEngine Trading Platform' },
      }
    } else if (validated.alertType === 'order_executed') {
      const { order_id, symbol, action, quantity, price, order_type, broker } = validated.data
      
      embed = {
        title: `✅ Order Executed: ${symbol}`,
        description: `${action.toUpperCase()} order successfully executed on ${broker}`,
        color: action === 'buy' ? 0x3498db : 0xe74c3c, // Blue for buy, red for sell
        fields: [
          { name: 'Action', value: action.toUpperCase(), inline: true },
          { name: 'Quantity', value: `${quantity}`, inline: true },
          { name: 'Price', value: `$${price.toFixed(2)}`, inline: true },
          { name: 'Order Type', value: order_type, inline: true },
          { name: 'Broker', value: broker.toUpperCase(), inline: true },
          { name: 'Order ID', value: order_id.substring(0, 8), inline: true },
        ],
        timestamp: new Date().toISOString(),
        footer: { text: 'PulseEngine Trading Platform' },
      }
    } else if (validated.alertType === 'price_alert') {
      const { symbol, current_price, trigger_price, condition } = validated.data
      
      embed = {
        title: `📊 Price Alert: ${symbol}`,
        description: `${symbol} is now ${condition} your trigger price`,
        color: 0xf39c12, // Orange
        fields: [
          { name: 'Current Price', value: `$${current_price.toFixed(2)}`, inline: true },
          { name: 'Trigger Price', value: `$${trigger_price.toFixed(2)}`, inline: true },
          { name: 'Condition', value: condition.toUpperCase(), inline: true },
        ],
        timestamp: new Date().toISOString(),
        footer: { text: 'PulseEngine Trading Platform' },
      }
    }

    // Send to Discord
    const response = await fetch(integration.webhook_url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ embeds: [embed] }),
    })

    if (!response.ok) {
      const errorText = await response.text()
      console.error('Discord webhook failed:', errorText)
      throw new Error(`Discord webhook failed: ${response.status}`)
    }

    // Log alert in database
    await supabase.from('alerts').insert({
      user_id: validated.userId,
      type: validated.alertType,
      channel: 'discord',
      status: 'sent',
      payload: validated.data,
      sent_at: new Date().toISOString(),
    })

    return new Response(
      JSON.stringify({ success: true, message: 'Alert sent to Discord' }),
      {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      }
    )

  } catch (error) {
    console.error('Discord alert error:', error)
    
    return new Response(
      JSON.stringify({ 
        error: error instanceof z.ZodError 
          ? error.errors 
          : error.message || 'Failed to send Discord alert' 
      }),
      { 
        status: error instanceof z.ZodError ? 400 : 500,
        headers: { 'Content-Type': 'application/json' }
      }
    )
  }
})
