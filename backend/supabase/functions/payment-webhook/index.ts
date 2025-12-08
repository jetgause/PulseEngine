import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import Stripe from 'https://esm.sh/stripe@13.11.0'

/**
 * Payment Webhook Edge Function
 * 
 * Purpose: Handle Stripe/USDC payment confirmations (webhook-only, not client-facing)
 * 
 * Handles:
 * - checkout.session.completed: Process successful checkouts
 * - payment_intent.succeeded: Handle one-time payment completion
 * - customer.subscription.deleted: Handle subscription cancellations
 * - customer.subscription.updated: Handle subscription changes
 * 
 * Security: Uses service role key (appropriate for webhooks with signature verification)
 */

const stripe = new Stripe(Deno.env.get('STRIPE_SECRET_KEY') ?? '', {
  apiVersion: '2023-10-16',
})

serve(async (req) => {
  const supabase = createClient(
    Deno.env.get('SUPABASE_URL') ?? '',
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '', // Service role OK for webhooks
  )

  try {
    // Verify Stripe signature
    const signature = req.headers.get('stripe-signature')
    if (!signature) {
      throw new Error('Missing Stripe signature')
    }

    const body = await req.text()
    const webhookSecret = Deno.env.get('STRIPE_WEBHOOK_SECRET') ?? ''

    if (!webhookSecret) {
      throw new Error('Webhook secret not configured')
    }

    // Verify webhook signature
    const event = stripe.webhooks.constructEvent(body, signature, webhookSecret)

    console.log('Webhook received:', event.type, 'ID:', event.id)

    // Replay attack protection: Check if event already processed
    const { data: existingEvent } = await supabase
      .from('processed_webhook_events')
      .select('id')
      .eq('event_id', event.id)
      .single()

    if (existingEvent) {
      console.log(`Event ${event.id} already processed, skipping...`)
      return new Response(
        JSON.stringify({ received: true, already_processed: true }),
        { status: 200, headers: { 'Content-Type': 'application/json' } }
      )
    }

    // Record event as processed
    await supabase.from('processed_webhook_events').insert({
      event_id: event.id,
      event_type: event.type,
      processed_at: new Date().toISOString(),
    })

    // Handle checkout.session.completed
    if (event.type === 'checkout.session.completed') {
      const session = event.data.object as Stripe.Checkout.Session
      
      const userId = session.metadata?.user_id
      const tier = session.metadata?.tier // 'free', 'pro', 'premium', 'elite'
      const credits = parseInt(session.metadata?.credits ?? '0')

      if (!userId) {
        throw new Error('Missing user_id in session metadata')
      }

      console.log(`Processing checkout for user ${userId}: ${tier} tier, ${credits} credits`)

      // Update user tier, credits, and subscription info
      const { error: updateError } = await supabase
        .from('profiles')
        .update({
          tier,
          credits: supabase.raw(`credits + ${credits}`),
          stripe_customer_id: session.customer as string,
          subscription_status: 'active',
          updated_at: new Date().toISOString(),
        })
        .eq('id', userId)

      if (updateError) {
        console.error('Failed to update profile:', updateError)
        throw updateError
      }

      // Log payment in payments table
      const { error: paymentError } = await supabase.from('payments').insert({
        user_id: userId,
        amount: session.amount_total ? session.amount_total / 100 : 0,
        currency: (session.currency?.toUpperCase() || 'USD'),
        payment_method: 'stripe',
        status: 'completed',
        stripe_payment_intent_id: session.payment_intent as string,
        stripe_subscription_id: session.subscription as string || null,
        stripe_customer_id: session.customer as string,
        metadata: { 
          tier, 
          credits,
          session_id: session.id,
        },
        paid_at: new Date().toISOString(),
      })

      if (paymentError) {
        console.error('Failed to log payment:', paymentError)
        // Don't throw - payment was successful even if logging failed
      }

      // Create alert for user
      await supabase.from('alerts').insert({
        user_id: userId,
        alert_type: 'payment',
        title: 'Payment Successful',
        message: `Your ${tier} subscription has been activated with ${credits} credits.`,
        severity: 'info',
        sent_at: new Date().toISOString(),
      })

      console.log(`Payment processed successfully for user ${userId}`)
    }

    // Handle payment_intent.succeeded (for one-time payments)
    if (event.type === 'payment_intent.succeeded') {
      const paymentIntent = event.data.object as Stripe.PaymentIntent
      
      console.log(`Payment intent succeeded: ${paymentIntent.id}`)

      const { error: updateError } = await supabase
        .from('payments')
        .update({
          status: 'completed',
          paid_at: new Date().toISOString(),
          metadata: supabase.raw(`
            COALESCE(metadata, '{}'::jsonb) || 
            '{"payment_intent_status": "${paymentIntent.status}"}'::jsonb
          `),
        })
        .eq('stripe_payment_intent_id', paymentIntent.id)

      if (updateError) {
        console.error('Failed to update payment:', updateError)
      }
    }

    // Handle subscription deletion/cancellation
    if (event.type === 'customer.subscription.deleted') {
      const subscription = event.data.object as Stripe.Subscription
      
      console.log(`Subscription deleted for customer: ${subscription.customer}`)

      const { error: updateError } = await supabase
        .from('profiles')
        .update({
          tier: 'free',
          subscription_status: 'canceled',
          updated_at: new Date().toISOString(),
        })
        .eq('stripe_customer_id', subscription.customer as string)

      if (updateError) {
        console.error('Failed to update subscription status:', updateError)
        throw updateError
      }

      // Get user ID for alert
      const { data: profile } = await supabase
        .from('profiles')
        .select('id')
        .eq('stripe_customer_id', subscription.customer as string)
        .single()

      if (profile) {
        await supabase.from('alerts').insert({
          user_id: profile.id,
          alert_type: 'payment',
          title: 'Subscription Cancelled',
          message: 'Your subscription has been cancelled. You have been moved to the free tier.',
          severity: 'warning',
          sent_at: new Date().toISOString(),
        })
      }

      console.log(`Subscription cancellation processed`)
    }

    // Handle subscription updates (tier changes, renewals)
    if (event.type === 'customer.subscription.updated') {
      const subscription = event.data.object as Stripe.Subscription
      
      console.log(`Subscription updated for customer: ${subscription.customer}`)

      // Determine tier from subscription metadata or product
      const tier = subscription.metadata?.tier || 'pro'
      const status = subscription.status // active, past_due, canceled, etc.

      const { error: updateError } = await supabase
        .from('profiles')
        .update({
          tier: status === 'active' ? tier : 'free',
          subscription_status: status,
          updated_at: new Date().toISOString(),
        })
        .eq('stripe_customer_id', subscription.customer as string)

      if (updateError) {
        console.error('Failed to update subscription:', updateError)
      }
    }

    // Handle payment failures
    if (event.type === 'invoice.payment_failed') {
      const invoice = event.data.object as Stripe.Invoice
      
      console.log(`Payment failed for customer: ${invoice.customer}`)

      // Update payment record
      await supabase.from('payments').insert({
        user_id: invoice.customer_email || '', // Will need to look up by customer ID
        amount: invoice.amount_due ? invoice.amount_due / 100 : 0,
        currency: invoice.currency?.toUpperCase() || 'USD',
        payment_method: 'stripe',
        status: 'failed',
        stripe_subscription_id: invoice.subscription as string || null,
        metadata: {
          error: invoice.last_finalization_error?.message || 'Payment failed',
          attempt_count: invoice.attempt_count,
        },
      })

      // Alert user
      const { data: profile } = await supabase
        .from('profiles')
        .select('id')
        .eq('stripe_customer_id', invoice.customer as string)
        .single()

      if (profile) {
        await supabase.from('alerts').insert({
          user_id: profile.id,
          alert_type: 'payment',
          title: 'Payment Failed',
          message: 'Your payment failed. Please update your payment method to avoid service interruption.',
          severity: 'error',
          sent_at: new Date().toISOString(),
        })
      }
    }

    // Return success response
    return new Response(
      JSON.stringify({ 
        received: true, 
        event_type: event.type,
        event_id: event.id,
      }), 
      {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      }
    )

  } catch (error) {
    console.error('Webhook error:', error)
    
    // Return 400 for signature verification failures
    // Stripe will retry on 500 errors but not 400s
    const status = error.message?.includes('signature') ? 400 : 500
    
    return new Response(
      JSON.stringify({ 
        error: error.message,
        timestamp: new Date().toISOString(),
      }),
      { 
        status,
        headers: { 'Content-Type': 'application/json' },
      }
    )
  }
})
