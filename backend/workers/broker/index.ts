/**
 * Broker API Worker
 * 
 * Handles all broker-related background jobs:
 * - Order execution
 * - Position synchronization
 * - Order status monitoring
 * - Broker callback handling
 * 
 * Deploy to: Cloudflare Workers, Deno Deploy, or AWS Lambda
 */

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

interface BrokerJob {
  type: 'execute_order' | 'sync_positions' | 'monitor_orders' | 'handle_callback'
  data: any
  retryCount?: number
}

const MAX_RETRIES = 3
const RETRY_DELAY = 5000 // 5 seconds

/**
 * Main worker handler
 */
export async function handleBrokerJob(job: BrokerJob): Promise<void> {
  const supabase = createClient(
    Deno.env.get('SUPABASE_URL') ?? '',
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '' // Service role bypasses RLS
  )

  try {
    console.log(`Processing broker job: ${job.type}`)

    switch (job.type) {
      case 'execute_order':
        await executeOrder(job.data, supabase)
        break
      case 'sync_positions':
        await syncPositions(job.data, supabase)
        break
      case 'monitor_orders':
        await monitorOrders(job.data, supabase)
        break
      case 'handle_callback':
        await handleBrokerCallback(job.data, supabase)
        break
      default:
        throw new Error(`Unknown job type: ${job.type}`)
    }

    console.log(`Broker job completed: ${job.type}`)
  } catch (error) {
    console.error(`Broker job failed: ${job.type}`, error)

    // Retry logic
    const retryCount = job.retryCount || 0
    if (retryCount < MAX_RETRIES) {
      console.log(`Retrying job (attempt ${retryCount + 1}/${MAX_RETRIES})`)
      await new Promise(resolve => setTimeout(resolve, RETRY_DELAY * (retryCount + 1)))
      await handleBrokerJob({ ...job, retryCount: retryCount + 1 })
    } else {
      // Move to dead letter queue
      await moveToDeadLetterQueue(job, error, supabase)
    }
  }
}

/**
 * Execute trade order
 */
async function executeOrder(data: any, supabase: any) {
  const { orderId } = data

  // Get order details
  const { data: order, error } = await supabase
    .from('orders')
    .select(`
      *,
      user_broker_connections (
        *,
        brokers (*)
      )
    `)
    .eq('id', orderId)
    .single()

  if (error || !order) {
    throw new Error('Order not found')
  }

  // Get broker adapter
  const broker = getBrokerAdapter(
    order.user_broker_connections.brokers.slug,
    order.user_broker_connections
  )

  // Update order status to submitted
  await supabase
    .from('orders')
    .update({
      status: 'submitted',
      submitted_at: new Date().toISOString(),
    })
    .eq('id', orderId)

  try {
    // Execute order via broker API
    const result = await broker.placeOrder({
      symbol: order.symbol,
      side: order.side,
      type: order.order_type,
      quantity: order.quantity,
      price: order.price,
      stopPrice: order.stop_price,
      timeInForce: order.time_in_force,
    })

    // Update order with broker order ID
    await supabase
      .from('orders')
      .update({
        broker_order_id: result.orderId,
        status: result.status,
        updated_at: new Date().toISOString(),
      })
      .eq('id', orderId)

    // Send Discord alert
    await sendOrderAlert(order.user_id, order, 'Order submitted successfully', supabase)

  } catch (error) {
    // Update order status to rejected
    await supabase
      .from('orders')
      .update({
        status: 'rejected',
        error_message: error.message,
        updated_at: new Date().toISOString(),
      })
      .eq('id', orderId)

    // Send error alert
    await sendOrderAlert(order.user_id, order, `Order rejected: ${error.message}`, supabase)

    throw error
  }
}

/**
 * Sync positions from broker
 */
async function syncPositions(data: any, supabase: any) {
  const { userId, brokerConnectionId } = data

  // Get broker connection
  const { data: connection } = await supabase
    .from('user_broker_connections')
    .select(`
      *,
      brokers (*)
    `)
    .eq('id', brokerConnectionId)
    .single()

  if (!connection) {
    throw new Error('Broker connection not found')
  }

  const broker = getBrokerAdapter(connection.brokers.slug, connection)

  // Fetch positions from broker
  const positions = await broker.getPositions()

  // Update positions in database
  for (const position of positions) {
    await supabase
      .from('positions')
      .upsert({
        user_id: userId,
        broker_connection_id: brokerConnectionId,
        symbol: position.symbol,
        quantity: position.quantity,
        avg_entry_price: position.avgPrice,
        current_price: position.currentPrice,
        market_value: position.marketValue,
        unrealized_pnl: position.unrealizedPnL,
        unrealized_pnl_percent: position.unrealizedPnLPercent,
        side: position.side,
        opened_at: position.openedAt,
        updated_at: new Date().toISOString(),
      }, {
        onConflict: 'user_id,broker_connection_id,symbol'
      })
  }

  // Update last sync time
  await supabase
    .from('user_broker_connections')
    .update({ last_connected_at: new Date().toISOString() })
    .eq('id', brokerConnectionId)
}

/**
 * Monitor orders for status updates
 */
async function monitorOrders(data: any, supabase: any) {
  // Get all submitted orders
  const { data: orders } = await supabase
    .from('orders')
    .select(`
      *,
      user_broker_connections (
        *,
        brokers (*)
      )
    `)
    .in('status', ['submitted', 'pending'])

  if (!orders || orders.length === 0) return

  // Check each order status
  for (const order of orders) {
    try {
      const broker = getBrokerAdapter(
        order.user_broker_connections.brokers.slug,
        order.user_broker_connections
      )

      const status = await broker.getOrderStatus(order.broker_order_id)

      // Update if status changed
      if (status.status !== order.status) {
        await supabase
          .from('orders')
          .update({
            status: status.status,
            filled_quantity: status.filledQuantity,
            filled_avg_price: status.avgFillPrice,
            filled_at: status.filledAt,
            updated_at: new Date().toISOString(),
          })
          .eq('id', order.id)

        // Send alert if filled
        if (status.status === 'filled') {
          await sendOrderAlert(
            order.user_id,
            order,
            `Order filled: ${status.filledQuantity} ${order.symbol} @ ${status.avgFillPrice}`,
            supabase
          )
        }
      }
    } catch (error) {
      console.error(`Failed to monitor order ${order.id}:`, error)
    }
  }
}

/**
 * Handle broker callback (webhook)
 */
async function handleBrokerCallback(data: any, supabase: any) {
  const { broker, event, payload } = data

  console.log(`Broker callback from ${broker}:`, event)

  // Process based on event type
  switch (event) {
    case 'order_filled':
      await handleOrderFilled(payload, supabase)
      break
    case 'order_cancelled':
      await handleOrderCancelled(payload, supabase)
      break
    case 'position_updated':
      await handlePositionUpdated(payload, supabase)
      break
    default:
      console.log(`Unhandled broker event: ${event}`)
  }
}

/**
 * Handle order filled event
 */
async function handleOrderFilled(payload: any, supabase: any) {
  const { brokerOrderId, filledQuantity, avgPrice } = payload

  await supabase
    .from('orders')
    .update({
      status: 'filled',
      filled_quantity: filledQuantity,
      filled_avg_price: avgPrice,
      filled_at: new Date().toISOString(),
    })
    .eq('broker_order_id', brokerOrderId)
}

/**
 * Handle order cancelled event
 */
async function handleOrderCancelled(payload: any, supabase: any) {
  const { brokerOrderId } = payload

  await supabase
    .from('orders')
    .update({
      status: 'cancelled',
      cancelled_at: new Date().toISOString(),
    })
    .eq('broker_order_id', brokerOrderId)
}

/**
 * Handle position updated event
 */
async function handlePositionUpdated(payload: any, supabase: any) {
  const { userId, symbol, position } = payload

  await supabase
    .from('positions')
    .update({
      quantity: position.quantity,
      current_price: position.currentPrice,
      market_value: position.marketValue,
      unrealized_pnl: position.unrealizedPnL,
      updated_at: new Date().toISOString(),
    })
    .eq('user_id', userId)
    .eq('symbol', symbol)
}

/**
 * Send order alert to user
 */
async function sendOrderAlert(
  userId: string,
  order: any,
  message: string,
  supabase: any
) {
  // Create alert
  await supabase.from('alerts').insert({
    user_id: userId,
    alert_type: 'trade_execution',
    title: `Order ${order.side} ${order.symbol}`,
    message,
    severity: 'info',
    metadata: { orderId: order.id },
    sent_at: new Date().toISOString(),
  })

  // Queue Discord notification
  const { data: integration } = await supabase
    .from('user_discord_integrations')
    .select('*')
    .eq('user_id', userId)
    .eq('enabled', true)
    .single()

  if (integration) {
    // This would queue a job for the alerts worker
    console.log(`Discord alert queued for user ${userId}`)
  }
}

/**
 * Get broker adapter
 */
function getBrokerAdapter(brokerSlug: string, connection: any) {
  // This would return the appropriate broker adapter
  // For now, return a mock adapter
  return {
    async placeOrder(order: any) {
      console.log('Placing order:', order)
      return {
        orderId: `mock_${Date.now()}`,
        status: 'submitted',
      }
    },
    async getPositions() {
      console.log('Fetching positions')
      return []
    },
    async getOrderStatus(orderId: string) {
      console.log('Checking order status:', orderId)
      return {
        status: 'filled',
        filledQuantity: 10,
        avgFillPrice: 150.50,
        filledAt: new Date().toISOString(),
      }
    },
  }
}

/**
 * Move failed job to dead letter queue
 */
async function moveToDeadLetterQueue(job: BrokerJob, error: any, supabase: any) {
  console.error('Moving job to dead letter queue', job, error)

  await supabase.from('failed_jobs').insert({
    job_type: 'broker',
    job_data: job,
    error_message: error.message,
    error_stack: error.stack,
    failed_at: new Date().toISOString(),
  })
}

/**
 * Cloudflare Workers entry point
 */
export default {
  async fetch(request: Request, env: any): Promise<Response> {
    try {
      const job: BrokerJob = await request.json()
      await handleBrokerJob(job)
      
      return new Response(JSON.stringify({ success: true }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      })
    } catch (error) {
      return new Response(
        JSON.stringify({ error: error.message }),
        {
          status: 500,
          headers: { 'Content-Type': 'application/json' },
        }
      )
    }
  },
}
