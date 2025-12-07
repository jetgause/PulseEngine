/**
 * Payment Processing Worker
 * 
 * Handles all payment-related background jobs:
 * - Stripe webhook processing
 * - Crypto transaction verification
 * - Subscription updates
 * - Payment notifications
 * 
 * Deploy to: Cloudflare Workers, Deno Deploy, or AWS Lambda
 */

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import Stripe from 'https://esm.sh/stripe@14.0.0'

interface PaymentJob {
  type: 'stripe_webhook' | 'crypto_verification' | 'subscription_renewal' | 'payment_notification'
  data: any
  retryCount?: number
}

const MAX_RETRIES = 3
const RETRY_DELAY = 5000 // 5 seconds

/**
 * Main worker handler
 */
export async function handlePaymentJob(job: PaymentJob): Promise<void> {
  const supabase = createClient(
    Deno.env.get('SUPABASE_URL') ?? '',
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '' // Service role bypasses RLS
  )

  const stripe = new Stripe(Deno.env.get('STRIPE_SECRET_KEY') ?? '', {
    apiVersion: '2023-10-16',
  })

  try {
    console.log(`Processing payment job: ${job.type}`)

    switch (job.type) {
      case 'stripe_webhook':
        await processStripeWebhook(job.data, supabase, stripe)
        break
      case 'crypto_verification':
        await verifyCryptoTransaction(job.data, supabase)
        break
      case 'subscription_renewal':
        await processSubscriptionRenewal(job.data, supabase)
        break
      case 'payment_notification':
        await sendPaymentNotification(job.data, supabase)
        break
      default:
        throw new Error(`Unknown job type: ${job.type}`)
    }

    console.log(`Payment job completed: ${job.type}`)
  } catch (error) {
    console.error(`Payment job failed: ${job.type}`, error)

    // Retry logic
    const retryCount = job.retryCount || 0
    if (retryCount < MAX_RETRIES) {
      console.log(`Retrying job (attempt ${retryCount + 1}/${MAX_RETRIES})`)
      await new Promise(resolve => setTimeout(resolve, RETRY_DELAY * (retryCount + 1)))
      await handlePaymentJob({ ...job, retryCount: retryCount + 1 })
    } else {
      // Move to dead letter queue
      await moveToDeadLetterQueue(job, error, supabase)
    }
  }
}

/**
 * Process Stripe webhook event
 */
async function processStripeWebhook(event: any, supabase: any, stripe: any) {
  console.log(`Processing Stripe event: ${event.type}`)

  switch (event.type) {
    case 'checkout.session.completed':
      await handleCheckoutCompleted(event.data.object, supabase)
      break
    case 'customer.subscription.updated':
      await handleSubscriptionUpdated(event.data.object, supabase)
      break
    case 'customer.subscription.deleted':
      await handleSubscriptionDeleted(event.data.object, supabase)
      break
    case 'invoice.payment_succeeded':
      await handlePaymentSucceeded(event.data.object, supabase)
      break
    case 'invoice.payment_failed':
      await handlePaymentFailed(event.data.object, supabase)
      break
    default:
      console.log(`Unhandled event type: ${event.type}`)
  }
}

/**
 * Add months to a date safely (avoids date overflow issues)
 */
function addMonths(date: Date, months: number): Date {
  const result = new Date(date)
  const targetMonth = result.getMonth() + months
  const year = result.getFullYear() + Math.floor(targetMonth / 12)
  const month = targetMonth % 12
  const day = result.getDate()
  
  // Set to first of target month then check if day exists
  result.setFullYear(year, month, 1)
  const lastDayOfMonth = new Date(year, month + 1, 0).getDate()
  result.setDate(Math.min(day, lastDayOfMonth))
  
  return result
}

/**
 * Handle checkout completed
 */
async function handleCheckoutCompleted(session: any, supabase: any) {
  const { userId, tierId, interval } = session.metadata

  const expiresAt = interval === 'yearly' 
    ? addMonths(new Date(), 12)
    : addMonths(new Date(), 1)

  // Update subscription
  await supabase.from('user_subscriptions').upsert({
    user_id: userId,
    tier_id: tierId,
    status: 'active',
    payment_method: 'stripe',
    stripe_subscription_id: session.subscription,
    stripe_customer_id: session.customer,
    expires_at: expiresAt.toISOString(),
  })

  // Record payment
  await supabase.from('payments').insert({
    user_id: userId,
    amount: session.amount_total / 100,
    currency: session.currency,
    payment_method: 'stripe',
    status: 'completed',
    stripe_payment_intent_id: session.payment_intent,
    paid_at: new Date().toISOString(),
  })

  // Queue notification (don't call recursively)
  await queueNotificationJob(userId, 'subscription_activated', supabase)
}

/**
 * Handle subscription updated
 */
async function handleSubscriptionUpdated(subscription: any, supabase: any) {
  await supabase
    .from('user_subscriptions')
    .update({
      status: subscription.status,
      updated_at: new Date().toISOString(),
    })
    .eq('stripe_subscription_id', subscription.id)
}

/**
 * Handle subscription deleted
 */
async function handleSubscriptionDeleted(subscription: any, supabase: any) {
  await supabase
    .from('user_subscriptions')
    .update({
      status: 'cancelled',
      cancelled_at: new Date().toISOString(),
    })
    .eq('stripe_subscription_id', subscription.id)
}

/**
 * Handle payment succeeded
 */
async function handlePaymentSucceeded(invoice: any, supabase: any) {
  const { data: subscription } = await supabase
    .from('user_subscriptions')
    .select('*')
    .eq('stripe_subscription_id', invoice.subscription)
    .single()

  if (!subscription) return

  // Record payment
  await supabase.from('payments').insert({
    user_id: subscription.user_id,
    subscription_id: subscription.id,
    amount: invoice.amount_paid / 100,
    currency: invoice.currency,
    payment_method: 'stripe',
    status: 'completed',
    stripe_payment_intent_id: invoice.payment_intent,
    paid_at: new Date().toISOString(),
  })

  // Extend subscription
  const expiresAt = addMonths(new Date(subscription.expires_at), 1)

  await supabase
    .from('user_subscriptions')
    .update({ expires_at: expiresAt.toISOString() })
    .eq('id', subscription.id)
}

/**
 * Handle payment failed
 */
async function handlePaymentFailed(invoice: any, supabase: any) {
  const { data: subscription } = await supabase
    .from('user_subscriptions')
    .select('*')
    .eq('stripe_subscription_id', invoice.subscription)
    .single()

  if (!subscription) return

  // Record failed payment
  await supabase.from('payments').insert({
    user_id: subscription.user_id,
    subscription_id: subscription.id,
    amount: invoice.amount_due / 100,
    currency: invoice.currency,
    payment_method: 'stripe',
    status: 'failed',
    stripe_payment_intent_id: invoice.payment_intent,
    metadata: { error: invoice.last_payment_error },
  })

  // Suspend after 3 attempts
  if (invoice.attempt_count >= 3) {
    await supabase
      .from('user_subscriptions')
      .update({ status: 'suspended' })
      .eq('id', subscription.id)
  }
}

/**
 * Verify crypto transaction on blockchain
 */
async function verifyCryptoTransaction(data: any, supabase: any) {
  const { userId, tierId, txHash, amount } = data

  // TODO: Implement actual blockchain verification
  console.log(`Verifying crypto transaction: ${txHash}`)

  // If verified, activate subscription
  const expiresAt = addMonths(new Date(), 1)

  await supabase.from('user_subscriptions').upsert({
    user_id: userId,
    tier_id: tierId,
    status: 'active',
    payment_method: 'usdt',
    expires_at: expiresAt.toISOString(),
  })

  await supabase.from('payments').insert({
    user_id: userId,
    amount,
    currency: 'usdt',
    payment_method: 'crypto',
    status: 'completed',
    crypto_tx_hash: txHash,
    paid_at: new Date().toISOString(),
  })
}

/**
 * Process subscription renewal
 */
async function processSubscriptionRenewal(data: any, supabase: any) {
  const { subscriptionId } = data

  const { data: subscription } = await supabase
    .from('user_subscriptions')
    .select('*')
    .eq('id', subscriptionId)
    .single()

  if (!subscription) return

  // Check if renewal is needed
  const expiresAt = new Date(subscription.expires_at)
  const now = new Date()
  
  if (expiresAt > now) {
    console.log('Subscription not yet expired')
    return
  }

  // For Stripe subscriptions, renewal is automatic
  // For crypto, notify user to renew
  if (subscription.payment_method === 'usdt') {
    await queueNotificationJob(subscription.user_id, 'renewal_required', supabase)
  }
}

/**
 * Queue a notification job without recursion
 */
async function queueNotificationJob(userId: string, type: string, supabase: any) {
  await supabase.from('alerts').insert({
    user_id: userId,
    alert_type: 'payment',
    title: getNotificationTitle(type),
    message: getNotificationMessage(type),
    severity: 'info',
  })
}

/**
 * Send payment notification
 */
async function sendPaymentNotification(data: any, supabase: any) {
  const { userId, type } = data

  const { data: user } = await supabase.auth.admin.getUserById(userId)
  if (!user) return

  // TODO: Implement actual notification sending
  // - Email via SendGrid/Mailgun
  // - Discord webhook
  // - Push notification

  console.log(`Sending payment notification to ${user.user.email}: ${type}`)

  // Record alert
  await supabase.from('alerts').insert({
    user_id: userId,
    alert_type: 'payment',
    title: getNotificationTitle(type),
    message: getNotificationMessage(type),
    severity: 'info',
    sent_at: new Date().toISOString(),
  })
}

/**
 * Move failed job to dead letter queue
 */
async function moveToDeadLetterQueue(job: PaymentJob, error: any, supabase: any) {
  console.error('Moving job to dead letter queue', job, error)

  await supabase.from('failed_jobs').insert({
    job_type: 'payment',
    job_data: job,
    error_message: error.message,
    error_stack: error.stack,
    failed_at: new Date().toISOString(),
  })
}

/**
 * Helper functions
 */
function getNotificationTitle(type: string): string {
  const titles: Record<string, string> = {
    subscription_activated: 'Subscription Activated',
    renewal_required: 'Subscription Renewal Required',
    payment_failed: 'Payment Failed',
  }
  return titles[type] || 'Payment Update'
}

function getNotificationMessage(type: string): string {
  const messages: Record<string, string> = {
    subscription_activated: 'Your subscription has been activated successfully.',
    renewal_required: 'Your subscription is expiring soon. Please renew to continue using premium features.',
    payment_failed: 'Your payment failed. Please update your payment method.',
  }
  return messages[type] || 'Payment status updated'
}

/**
 * Cloudflare Workers entry point
 */
export default {
  async fetch(request: Request, env: any): Promise<Response> {
    try {
      const job: PaymentJob = await request.json()
      await handlePaymentJob(job)
      
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
