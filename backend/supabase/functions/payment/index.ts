import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import Stripe from 'https://esm.sh/stripe@14.0.0'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

/**
 * Payment Service - Handles Stripe and USDT payments
 * Endpoints:
 * - POST /create-checkout: Create Stripe checkout session
 * - POST /webhook: Handle Stripe webhooks
 * - POST /verify-crypto: Verify USDT payment
 * - GET /subscription-status: Get user's subscription status
 */

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const url = new URL(req.url)
    const path = url.pathname

    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    )

    const stripe = new Stripe(Deno.env.get('STRIPE_SECRET_KEY') ?? '', {
      apiVersion: '2023-10-16',
    })

    // Route requests
    if (path === '/create-checkout' && req.method === 'POST') {
      return await createCheckoutSession(req, supabaseClient, stripe)
    } else if (path === '/webhook' && req.method === 'POST') {
      return await handleStripeWebhook(req, supabaseClient, stripe)
    } else if (path === '/verify-crypto' && req.method === 'POST') {
      return await verifyCryptoPayment(req, supabaseClient)
    } else if (path === '/subscription-status' && req.method === 'GET') {
      return await getSubscriptionStatus(req, supabaseClient)
    }

    return new Response(JSON.stringify({ error: 'Not found' }), {
      status: 404,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  } catch (error) {
    console.error('Payment service error:', error)
    return new Response(
      JSON.stringify({ error: error.message || 'Internal server error' }),
      {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    )
  }
})

/**
 * Create Stripe checkout session
 */
async function createCheckoutSession(req: Request, supabase: any, stripe: any) {
  const { userId, tierSlug, interval = 'monthly' } = await req.json()

  // Get subscription tier
  const { data: tier, error: tierError } = await supabase
    .from('subscription_tiers')
    .select('*')
    .eq('slug', tierSlug)
    .single()

  if (tierError || !tier) {
    return new Response(
      JSON.stringify({ error: 'Invalid subscription tier' }),
      { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }

  // Get or create Stripe customer
  const { data: user } = await supabase.auth.admin.getUserById(userId)
  if (!user) {
    return new Response(
      JSON.stringify({ error: 'User not found' }),
      { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }

  // Check if customer exists
  let customerId: string
  const { data: subscription } = await supabase
    .from('user_subscriptions')
    .select('stripe_customer_id')
    .eq('user_id', userId)
    .single()

  if (subscription?.stripe_customer_id) {
    customerId = subscription.stripe_customer_id
  } else {
    const customer = await stripe.customers.create({
      email: user.user.email,
      metadata: { userId },
    })
    customerId = customer.id
  }

  // Create checkout session
  const price = interval === 'yearly' && tier.price_yearly 
    ? tier.price_yearly 
    : tier.price_monthly

  const session = await stripe.checkout.sessions.create({
    customer: customerId,
    mode: 'subscription',
    payment_method_types: ['card'],
    line_items: [
      {
        price_data: {
          currency: 'usd',
          product_data: {
            name: `${tier.name} Plan`,
            description: tier.description,
          },
          recurring: {
            interval: interval === 'yearly' ? 'year' : 'month',
          },
          unit_amount: Math.round(price * 100), // Convert to cents
        },
        quantity: 1,
      },
    ],
    success_url: `${Deno.env.get('FRONTEND_URL')}/payment/success?session_id={CHECKOUT_SESSION_ID}`,
    cancel_url: `${Deno.env.get('FRONTEND_URL')}/payment/cancelled`,
    metadata: {
      userId,
      tierId: tier.id,
      interval,
    },
  })

  return new Response(
    JSON.stringify({ sessionId: session.id, url: session.url }),
    { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
  )
}

/**
 * Handle Stripe webhooks
 */
async function handleStripeWebhook(req: Request, supabase: any, stripe: any) {
  const signature = req.headers.get('stripe-signature')
  const body = await req.text()

  let event: any
  try {
    event = stripe.webhooks.constructEvent(
      body,
      signature,
      Deno.env.get('STRIPE_WEBHOOK_SECRET')
    )
  } catch (err) {
    console.error('Webhook signature verification failed:', err.message)
    return new Response(JSON.stringify({ error: 'Webhook verification failed' }), {
      status: 400,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }

  // Handle different event types
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
  }

  return new Response(JSON.stringify({ received: true }), {
    status: 200,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  })
}

/**
 * Handle checkout completed
 */
async function handleCheckoutCompleted(session: any, supabase: any) {
  const { userId, tierId, interval } = session.metadata

  // Calculate expiration date
  const expiresAt = new Date()
  if (interval === 'yearly') {
    expiresAt.setFullYear(expiresAt.getFullYear() + 1)
  } else {
    expiresAt.setMonth(expiresAt.getMonth() + 1)
  }

  // Create or update subscription
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

  console.log(`Subscription activated for user ${userId}`)
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
  // Get subscription
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
  const expiresAt = new Date(subscription.expires_at)
  expiresAt.setMonth(expiresAt.getMonth() + 1)

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

  // Suspend subscription after 3 failed attempts
  if (invoice.attempt_count >= 3) {
    await supabase
      .from('user_subscriptions')
      .update({ status: 'suspended' })
      .eq('id', subscription.id)
  }
}

/**
 * Verify crypto (USDT) payment
 */
async function verifyCryptoPayment(req: Request, supabase: any) {
  const { userId, tierId, txHash, walletAddress, amount } = await req.json()

  // TODO: Verify transaction on blockchain
  // This is a placeholder - implement actual blockchain verification
  const isValid = await verifyTransactionOnChain(txHash, walletAddress, amount)

  if (!isValid) {
    return new Response(
      JSON.stringify({ error: 'Invalid transaction' }),
      { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }

  // Calculate expiration
  const expiresAt = new Date()
  expiresAt.setMonth(expiresAt.getMonth() + 1)

  // Create subscription
  await supabase.from('user_subscriptions').upsert({
    user_id: userId,
    tier_id: tierId,
    status: 'active',
    payment_method: 'usdt',
    expires_at: expiresAt.toISOString(),
  })

  // Record payment
  await supabase.from('payments').insert({
    user_id: userId,
    amount,
    currency: 'usdt',
    payment_method: 'crypto',
    status: 'completed',
    crypto_tx_hash: txHash,
    crypto_wallet_address: walletAddress,
    paid_at: new Date().toISOString(),
  })

  return new Response(
    JSON.stringify({ success: true, message: 'Payment verified' }),
    { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
  )
}

/**
 * Verify transaction on blockchain (placeholder)
 */
async function verifyTransactionOnChain(
  txHash: string,
  walletAddress: string,
  amount: number
): Promise<boolean> {
  // TODO: Implement actual blockchain verification using ethers.js or web3.js
  // 1. Connect to Ethereum/BSC/Polygon network
  // 2. Get transaction details
  // 3. Verify recipient address matches platform wallet
  // 4. Verify amount matches expected amount
  // 5. Verify transaction is confirmed
  
  console.log(`Verifying transaction: ${txHash}`)
  return true // Placeholder
}

/**
 * Get subscription status
 */
async function getSubscriptionStatus(req: Request, supabase: any) {
  const authHeader = req.headers.get('Authorization')
  if (!authHeader) {
    return new Response(
      JSON.stringify({ error: 'Missing authorization' }),
      { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }

  const token = authHeader.replace('Bearer ', '')
  const { data: { user }, error } = await supabase.auth.getUser(token)

  if (error || !user) {
    return new Response(
      JSON.stringify({ error: 'Invalid token' }),
      { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }

  // Get active subscription
  const { data: subscription } = await supabase
    .from('user_subscriptions')
    .select(`
      *,
      subscription_tiers (*)
    `)
    .eq('user_id', user.id)
    .eq('status', 'active')
    .single()

  if (!subscription) {
    return new Response(
      JSON.stringify({
        hasSubscription: false,
        tier: 'free',
      }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }

  return new Response(
    JSON.stringify({
      hasSubscription: true,
      subscription,
    }),
    { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
  )
}
