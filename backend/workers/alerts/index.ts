/**
 * Alerts Worker
 * 
 * Handles all alert/notification jobs:
 * - Discord webhook notifications
 * - Email alerts
 * - Push notifications
 * - Alert aggregation
 * 
 * Deploy to: Cloudflare Workers, Deno Deploy, or AWS Lambda
 */

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

interface AlertJob {
  type: 'discord' | 'email' | 'push' | 'aggregate'
  data: any
  retryCount?: number
}

const MAX_RETRIES = 3
const RETRY_DELAY = 2000 // 2 seconds

/**
 * Main worker handler
 */
export async function handleAlertJob(job: AlertJob): Promise<void> {
  const supabase = createClient(
    Deno.env.get('SUPABASE_URL') ?? '',
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
  )

  try {
    console.log(`Processing alert job: ${job.type}`)

    switch (job.type) {
      case 'discord':
        await sendDiscordAlert(job.data, supabase)
        break
      case 'email':
        await sendEmailAlert(job.data, supabase)
        break
      case 'push':
        await sendPushNotification(job.data, supabase)
        break
      case 'aggregate':
        await aggregateAlerts(job.data, supabase)
        break
      default:
        throw new Error(`Unknown job type: ${job.type}`)
    }

    console.log(`Alert job completed: ${job.type}`)
  } catch (error) {
    console.error(`Alert job failed: ${job.type}`, error)

    // Retry logic
    const retryCount = job.retryCount || 0
    if (retryCount < MAX_RETRIES) {
      console.log(`Retrying job (attempt ${retryCount + 1}/${MAX_RETRIES})`)
      await new Promise(resolve => setTimeout(resolve, RETRY_DELAY * (retryCount + 1)))
      await handleAlertJob({ ...job, retryCount: retryCount + 1 })
    } else {
      console.error('Max retries reached, alert not sent')
    }
  }
}

/**
 * Send Discord webhook notification
 */
async function sendDiscordAlert(data: any, supabase: any) {
  const { userId, alertType, title, message, metadata = {} } = data

  // Get user's Discord integration
  const { data: integration } = await supabase
    .from('user_discord_integrations')
    .select('*')
    .eq('user_id', userId)
    .eq('enabled', true)
    .single()

  if (!integration) {
    console.log(`No Discord integration for user ${userId}`)
    return
  }

  // Check if this alert type is enabled
  if (
    integration.alert_types &&
    integration.alert_types.length > 0 &&
    !integration.alert_types.includes(alertType)
  ) {
    console.log(`Alert type ${alertType} not enabled for user ${userId}`)
    return
  }

  // Create Discord embed
  const embed = {
    title: getEmojiForAlertType(alertType) + ' ' + title,
    description: message,
    color: getColorForAlertType(alertType),
    fields: getFieldsFromMetadata(metadata),
    timestamp: new Date().toISOString(),
    footer: {
      text: 'PulseEngine Trading Platform',
    },
  }

  // Send to Discord
  const response = await fetch(integration.webhook_url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      embeds: [embed],
      username: 'PulseEngine Bot',
    }),
  })

  if (!response.ok) {
    throw new Error(`Discord webhook failed: ${response.statusText}`)
  }

  // Update alert record
  await supabase
    .from('alerts')
    .update({ sent_to_discord: true })
    .eq('user_id', userId)
    .eq('alert_type', alertType)
    .is('sent_to_discord', false)
}

/**
 * Send email alert
 */
async function sendEmailAlert(data: any, supabase: any) {
  const { userId, alertType, title, message } = data

  // Get user email
  const { data: user } = await supabase.auth.admin.getUserById(userId)
  if (!user || !user.user.email) {
    console.log(`No email for user ${userId}`)
    return
  }

  // TODO: Implement email sending via SendGrid/Mailgun
  console.log(`Sending email to ${user.user.email}: ${title}`)

  // For now, just log
  console.log({
    to: user.user.email,
    subject: title,
    body: message,
  })

  // Update alert record
  await supabase
    .from('alerts')
    .update({ sent_to_email: true })
    .eq('user_id', userId)
    .eq('alert_type', alertType)
    .is('sent_to_email', false)
}

/**
 * Send push notification
 */
async function sendPushNotification(data: any, supabase: any) {
  const { userId, title, message } = data

  // TODO: Implement push notifications via Firebase/OneSignal
  console.log(`Sending push to user ${userId}: ${title}`)

  // For now, just log
  console.log({
    userId,
    title,
    body: message,
  })
}

/**
 * Aggregate alerts for digest
 */
async function aggregateAlerts(data: any, supabase: any) {
  const { userId, period = 'daily' } = data

  // Get alerts from the period
  const startDate = new Date()
  if (period === 'daily') {
    startDate.setDate(startDate.getDate() - 1)
  } else if (period === 'weekly') {
    startDate.setDate(startDate.getDate() - 7)
  }

  const { data: alerts } = await supabase
    .from('alerts')
    .select('*')
    .eq('user_id', userId)
    .gte('created_at', startDate.toISOString())
    .order('created_at', { ascending: false })

  if (!alerts || alerts.length === 0) {
    console.log(`No alerts to aggregate for user ${userId}`)
    return
  }

  // Group by type
  const grouped = alerts.reduce((acc: any, alert: any) => {
    if (!acc[alert.alert_type]) {
      acc[alert.alert_type] = []
    }
    acc[alert.alert_type].push(alert)
    return acc
  }, {})

  // Create digest message
  const digest = Object.entries(grouped)
    .map(([type, alerts]: [string, any]) => {
      return `**${type}**: ${alerts.length} alert(s)`
    })
    .join('\n')

  // Send digest
  await handleAlertJob({
    type: 'discord',
    data: {
      userId,
      alertType: 'digest',
      title: `${period.charAt(0).toUpperCase() + period.slice(1)} Alert Digest`,
      message: digest,
      metadata: { count: alerts.length },
    },
  })
}

/**
 * Get emoji for alert type
 */
function getEmojiForAlertType(alertType: string): string {
  const emojis: Record<string, string> = {
    trade_execution: '📊',
    signals: '🔔',
    risk_alerts: '⚠️',
    system: '🔧',
    payment: '💳',
    digest: '📋',
  }
  return emojis[alertType] || '📢'
}

/**
 * Get color for alert type
 */
function getColorForAlertType(alertType: string): number {
  const colors: Record<string, number> = {
    trade_execution: 0x00ff00, // Green
    signals: 0x0099ff, // Blue
    risk_alerts: 0xff9900, // Orange
    system: 0x9900ff, // Purple
    payment: 0x00ffff, // Cyan
    digest: 0xcccccc, // Gray
  }
  return colors[alertType] || 0x0099ff
}

/**
 * Get Discord fields from metadata
 */
function getFieldsFromMetadata(metadata: any): any[] {
  const fields: any[] = []

  if (metadata.symbol) {
    fields.push({ name: 'Symbol', value: metadata.symbol, inline: true })
  }
  if (metadata.side) {
    fields.push({ name: 'Side', value: metadata.side.toUpperCase(), inline: true })
  }
  if (metadata.quantity) {
    fields.push({ name: 'Quantity', value: metadata.quantity.toString(), inline: true })
  }
  if (metadata.price) {
    fields.push({ name: 'Price', value: `$${metadata.price}`, inline: true })
  }
  if (metadata.pnl) {
    const pnlColor = metadata.pnl >= 0 ? '🟢' : '🔴'
    fields.push({ 
      name: 'P&L', 
      value: `${pnlColor} $${metadata.pnl.toFixed(2)}`, 
      inline: true 
    })
  }

  return fields
}

/**
 * Cloudflare Workers entry point
 */
export default {
  async fetch(request: Request, env: any): Promise<Response> {
    try {
      const job: AlertJob = await request.json()
      await handleAlertJob(job)
      
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

  /**
   * Scheduled handler for periodic tasks (Cloudflare Workers Cron)
   */
  async scheduled(event: any, env: any, ctx: any) {
    console.log('Running scheduled alert jobs')

    const supabase = createClient(
      env.SUPABASE_URL,
      env.SUPABASE_SERVICE_ROLE_KEY
    )

    // Get all users with Discord enabled
    const { data: integrations } = await supabase
      .from('user_discord_integrations')
      .select('user_id')
      .eq('enabled', true)

    if (!integrations) return

    // Send daily digest to each user
    for (const integration of integrations) {
      await handleAlertJob({
        type: 'aggregate',
        data: { userId: integration.user_id, period: 'daily' },
      })
    }
  },
}
