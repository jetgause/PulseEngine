# PulseEngine Workers

Background job processors for the PulseEngine trading platform.

## Workers Overview

### 1. Payment Worker (`payment/`)
Handles payment processing and subscription management:
- Stripe webhook processing
- Crypto transaction verification
- Subscription renewals
- Payment notifications

### 2. Broker Worker (`broker/`)
Handles trading operations:
- Order execution via broker APIs
- Position synchronization
- Order status monitoring
- Broker callback handling

### 3. Alerts Worker (`alerts/`)
Handles notifications and alerts:
- Discord webhook notifications
- Email alerts
- Push notifications
- Daily/weekly alert digests

## Deployment Options

### Option 1: Cloudflare Workers (Recommended)
```bash
# Install Wrangler CLI
npm install -g wrangler

# Deploy payment worker
cd payment
wrangler deploy

# Deploy broker worker
cd ../broker
wrangler deploy

# Deploy alerts worker
cd ../alerts
wrangler deploy
```

**Cloudflare Workers Configuration** (`wrangler.toml`):
```toml
name = "pulse-engine-payment-worker"
main = "index.ts"
compatibility_date = "2024-01-01"

[env.production]
vars = { ENVIRONMENT = "production" }

[[env.production.bindings]]
type = "secret"
name = "SUPABASE_URL"

[[env.production.bindings]]
type = "secret"
name = "SUPABASE_SERVICE_ROLE_KEY"

[[env.production.bindings]]
type = "secret"
name = "STRIPE_SECRET_KEY"

[[env.production.bindings]]
type = "secret"
name = "STRIPE_WEBHOOK_SECRET"

# Cron triggers for scheduled jobs
[triggers]
crons = ["0 0 * * *"] # Daily at midnight
```

### Option 2: Deno Deploy
```bash
# Install Deno
curl -fsSL https://deno.land/x/install/install.sh | sh

# Deploy workers
deployctl deploy --project=pulse-payment index.ts
deployctl deploy --project=pulse-broker index.ts
deployctl deploy --project=pulse-alerts index.ts
```

### Option 3: AWS Lambda
```bash
# Package and deploy
zip -r payment-worker.zip payment/
aws lambda create-function \
  --function-name pulse-payment-worker \
  --runtime provided.al2 \
  --handler index.handler \
  --zip-file fileb://payment-worker.zip
```

## Environment Variables

All workers require these environment variables:

```env
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key
```

### Payment Worker Additional Variables
```env
STRIPE_SECRET_KEY=sk_live_...
STRIPE_WEBHOOK_SECRET=whsec_...
```

### Alerts Worker Additional Variables
```env
SENDGRID_API_KEY=SG...  # For email
FIREBASE_KEY=...        # For push notifications
```

## Queue Integration

### Using Cloudflare Queues
```typescript
// In your edge function, queue a job
await env.PAYMENT_QUEUE.send({
  type: 'stripe_webhook',
  data: webhookPayload
})

// Worker processes jobs from queue
export default {
  async queue(batch, env) {
    for (const message of batch.messages) {
      await handlePaymentJob(message.body)
      message.ack()
    }
  }
}
```

### Using Supabase Realtime (Alternative)
```typescript
// Listen for new rows in jobs table
supabase
  .from('payment_jobs')
  .on('INSERT', (payload) => {
    handlePaymentJob(payload.new)
  })
  .subscribe()
```

## Job Scheduling

### Cron Triggers (Cloudflare Workers)
```toml
# In wrangler.toml
[triggers]
crons = [
  "*/5 * * * *",  # Every 5 minutes - Monitor orders
  "0 * * * *",    # Every hour - Sync positions
  "0 0 * * *",    # Daily - Send digests
]
```

### Manual Triggers
```bash
# Trigger job via HTTP
curl -X POST https://worker.example.com \
  -H "Content-Type: application/json" \
  -d '{"type": "sync_positions", "data": {"userId": "123"}}'
```

## Monitoring

### Logs
```bash
# Cloudflare Workers
wrangler tail payment-worker

# Deno Deploy
deployctl logs pulse-payment
```

### Metrics
Workers automatically track:
- Job processing time
- Success/failure rates
- Retry counts
- Dead letter queue size

### Datadog Integration
```typescript
// In worker
import { metrics } from '@datadog/datadog-api-client'

metrics.sendMetric('worker.job.processed', 1, {
  tags: ['type:payment', 'status:success']
})
```

## Error Handling

### Retry Strategy
- Max retries: 3
- Exponential backoff: 5s, 10s, 15s
- Failed jobs moved to dead letter queue

### Dead Letter Queue
Failed jobs are stored in `failed_jobs` table:
```sql
SELECT * FROM failed_jobs 
WHERE job_type = 'payment' 
ORDER BY failed_at DESC;
```

### Manual Retry
```typescript
// Retry failed job
const failedJob = await supabase
  .from('failed_jobs')
  .select('*')
  .eq('id', jobId)
  .single()

await handlePaymentJob(failedJob.job_data)
```

## Testing

### Local Testing
```bash
# Run worker locally
deno run --allow-net --allow-env index.ts

# Send test job
curl -X POST http://localhost:8000 \
  -d '{"type": "execute_order", "data": {...}}'
```

### Integration Tests
```typescript
import { assertEquals } from 'https://deno.land/std/testing/asserts.ts'

Deno.test('Payment worker processes Stripe webhook', async () => {
  const job = {
    type: 'stripe_webhook',
    data: mockWebhookData
  }
  
  await handlePaymentJob(job)
  
  // Verify subscription updated
  const { data } = await supabase
    .from('user_subscriptions')
    .select('status')
    .eq('user_id', userId)
    .single()
    
  assertEquals(data.status, 'active')
})
```

## Performance Optimization

### Batching
```typescript
// Process multiple jobs in batch
const jobs = await getJobsFromQueue(100)
await Promise.all(jobs.map(handlePaymentJob))
```

### Caching
```typescript
// Cache broker adapters
const brokerCache = new Map()

function getBrokerAdapter(slug: string) {
  if (!brokerCache.has(slug)) {
    brokerCache.set(slug, createBrokerAdapter(slug))
  }
  return brokerCache.get(slug)
}
```

### Connection Pooling
```typescript
// Reuse Supabase client
let supabaseClient: any

function getSupabaseClient() {
  if (!supabaseClient) {
    supabaseClient = createClient(...)
  }
  return supabaseClient
}
```

## Cost Estimation

### Cloudflare Workers
- **Free Tier**: 100,000 requests/day
- **Paid**: $5/month + $0.50 per million requests
- **Estimated**: $10-50/month for 500k users

### Deno Deploy
- **Free Tier**: 100,000 requests/day
- **Pro**: $10/month + usage
- **Estimated**: $20-100/month for 500k users

### AWS Lambda
- **Free Tier**: 1M requests/month
- **Paid**: $0.20 per 1M requests + compute
- **Estimated**: $50-200/month for 500k users

## Security

### Environment Variables
Store sensitive data in worker secrets:
```bash
wrangler secret put STRIPE_SECRET_KEY
wrangler secret put SUPABASE_SERVICE_ROLE_KEY
```

### API Keys
Rotate keys regularly:
```bash
# Generate new service role key in Supabase
# Update worker secrets
wrangler secret put SUPABASE_SERVICE_ROLE_KEY
```

### Rate Limiting
Implement rate limiting in workers:
```typescript
const rateLimiter = new RateLimiter({
  maxRequests: 100,
  windowMs: 60000
})

if (!await rateLimiter.check(userId)) {
  throw new Error('Rate limit exceeded')
}
```

## Troubleshooting

### Common Issues

**Worker not processing jobs**
- Check environment variables
- Verify Supabase connection
- Check worker logs

**High failure rate**
- Check broker API status
- Verify API credentials
- Review error messages in dead letter queue

**Slow processing**
- Enable batching
- Add caching
- Scale worker instances

## Support

For issues with workers:
- Check logs: `wrangler tail <worker-name>`
- Review dead letter queue
- Contact support with job ID and error message
