# Failure Mode Analysis - Quick Action Guide

## Immediate Actions Required (Critical Failures)

### 🔴 Priority 1: Security & Data Integrity (Must fix before ANY production deployment)

1. **Payment Webhook Security**
   - File: `backend/supabase/functions/payment-webhook/index.ts`
   - Issue: Webhook replay attacks possible
   - Fix: Add event ID deduplication
   - Time: 2 hours

2. **CORS Wildcard**
   - Files: All `**/index.ts` files
   - Issue: `Access-Control-Allow-Origin: *` if `FRONTEND_URL` not set
   - Fix: Make `FRONTEND_URL` required, fail if missing
   - Time: 1 hour

3. **XSS Vulnerability**
   - File: `backend/shared/validators/index.ts`
   - Issue: Insufficient sanitization
   - Fix: Integrate DOMPurify library
   - Time: 3 hours

4. **No Rate Limiting**
   - Files: `auth/index.ts`, `broker-order/index.ts`
   - Issue: Brute force and DDoS possible
   - Fix: Add rate limiting middleware
   - Time: 4 hours

5. **Tool Parameter Injection**
   - File: `backend/supabase/functions/tools/execute.ts`
   - Issue: Unsanitized parameters passed to tools
   - Fix: Add parameter validation and sandboxing
   - Time: 4 hours

### 🟡 Priority 2: Service Availability (Fix within 1 week)

6. **Circuit Breaker Missing**
   - Files: All broker integration functions
   - Issue: Cascading failures when external APIs down
   - Fix: Implement circuit breaker pattern
   - Time: 8 hours

7. **Database Transactions Missing**
   - Files: `payment-webhook/index.ts`, `broker-order/index.ts`, `oauth-callback/index.ts`
   - Issue: Inconsistent state on partial failures
   - Fix: Wrap critical operations in transactions
   - Time: 4 hours

8. **Timeout Handling**
   - Files: All external API calls
   - Issue: Functions hang on slow APIs
   - Fix: Add 10-30s timeouts to all external calls
   - Time: 2 hours

9. **Environment Variable Validation**
   - Files: All functions
   - Issue: Silent failures if env vars missing
   - Fix: Add startup validation
   - Time: 2 hours

10. **Connection Pool Exhaustion**
    - Files: All functions creating Supabase clients
    - Issue: Too many connections under load
    - Fix: Implement connection pooling
    - Time: 4 hours

### 🟢 Priority 3: Data Quality & UX (Fix within 2 weeks)

11. **Backtester Memory Issues**
    - File: `core/backtester/engine.py`
    - Issue: OOM with large datasets
    - Fix: Stream data in chunks
    - Time: 6 hours

12. **Options Greeks Edge Cases**
    - File: `core/greeks/options_greeks.py`
    - Issue: Numerical instability near expiration
    - Fix: Add minimum time-to-expiry checks
    - Time: 3 hours

13. **Market Data Caching**
    - File: `backend/supabase/functions/market-data/index.ts`
    - Issue: Rate limits from data providers
    - Fix: Add 5-minute cache
    - Time: 3 hours

14. **Discord Alert Rate Limiting**
    - File: `backend/supabase/functions/discord-alert/index.ts`
    - Issue: Alert spam, Discord rate limits
    - Fix: Queue and throttle alerts
    - Time: 4 hours

15. **Idempotency Key Validation**
    - File: `backend/supabase/functions/broker-order/index.ts`
    - Issue: Weak idempotency protection
    - Fix: Add key expiration and format validation
    - Time: 2 hours

---

## Code Changes Template

### Adding Timeout Example

```typescript
// BEFORE
const response = await fetch(brokerApiUrl, {
  method: 'POST',
  body: JSON.stringify(order)
})

// AFTER
const controller = new AbortController()
const timeoutId = setTimeout(() => controller.abort(), 10000) // 10s timeout

try {
  const response = await fetch(brokerApiUrl, {
    method: 'POST',
    body: JSON.stringify(order),
    signal: controller.signal
  })
  clearTimeout(timeoutId)
} catch (error) {
  if (error.name === 'AbortError') {
    // Handle timeout
    throw new Error('Order submission timed out - status unknown')
  }
  throw error
}
```

### Adding Environment Validation Example

```typescript
// At the start of each edge function
function validateEnv() {
  const required = ['SUPABASE_URL', 'SUPABASE_ANON_KEY', 'FRONTEND_URL']
  const missing = required.filter(key => !Deno.env.get(key))
  
  if (missing.length > 0) {
    throw new Error(`Missing required environment variables: ${missing.join(', ')}`)
  }
}

serve(async (req) => {
  validateEnv() // Fail fast
  // ... rest of function
})
```

### Adding Rate Limiting Example

```typescript
// Simple in-memory rate limiter (use Redis for production)
const rateLimitMap = new Map<string, {count: number, resetAt: number}>()

function rateLimit(key: string, maxRequests: number, windowMs: number): boolean {
  const now = Date.now()
  const data = rateLimitMap.get(key)
  
  if (!data || data.resetAt < now) {
    rateLimitMap.set(key, {count: 1, resetAt: now + windowMs})
    return true
  }
  
  if (data.count >= maxRequests) {
    return false // Rate limit exceeded
  }
  
  data.count++
  return true
}

// Usage
if (!rateLimit(`login:${email}`, 5, 60000)) { // 5 attempts per minute
  return new Response('Too many attempts. Try again later.', {status: 429})
}
```

### Adding Circuit Breaker Example

```typescript
class CircuitBreaker {
  private failures = 0
  private lastFailure = 0
  private state: 'closed' | 'open' | 'half-open' = 'closed'
  
  constructor(
    private threshold: number = 5,
    private timeout: number = 60000 // 1 minute
  ) {}
  
  async execute<T>(fn: () => Promise<T>): Promise<T> {
    if (this.state === 'open') {
      if (Date.now() - this.lastFailure > this.timeout) {
        this.state = 'half-open'
      } else {
        throw new Error('Circuit breaker is open')
      }
    }
    
    try {
      const result = await fn()
      this.onSuccess()
      return result
    } catch (error) {
      this.onFailure()
      throw error
    }
  }
  
  private onSuccess() {
    this.failures = 0
    this.state = 'closed'
  }
  
  private onFailure() {
    this.failures++
    this.lastFailure = Date.now()
    
    if (this.failures >= this.threshold) {
      this.state = 'open'
    }
  }
}

// Usage
const alpacaCircuitBreaker = new CircuitBreaker()

const result = await alpacaCircuitBreaker.execute(async () => {
  return await submitAlpacaOrder(credentials, order)
})
```

---

## Testing Checklist

Before marking any failure as fixed, verify:

- [ ] Unit test added for failure scenario
- [ ] Integration test covers the fix
- [ ] Error message is clear and actionable
- [ ] Monitoring/logging added
- [ ] Documentation updated
- [ ] Code review completed
- [ ] Tested in staging environment

---

## Monitoring Setup

### Critical Metrics to Track

1. **Error Rates**
   - Target: < 1% overall, < 0.1% for payments
   - Alert if > 5% for 5 minutes

2. **Latency**
   - Target: p50 < 200ms, p95 < 2s, p99 < 5s
   - Alert if p95 > 5s

3. **Rate Limit Hits**
   - Track by endpoint and user
   - Alert if user hitting limits frequently

4. **External API Failures**
   - Track by broker/provider
   - Alert if > 10% failure rate

5. **Database Connection Pool**
   - Track usage percentage
   - Alert if > 80% used

### Recommended Tools

- **Error Tracking**: Sentry
- **APM**: DataDog or New Relic
- **Logging**: CloudWatch or Logtail
- **Uptime**: UptimeRobot or Pingdom

---

## Rollout Strategy

### Phase 1: Security Fixes (Week 1)
- Fix all 🔴 Priority 1 items (1-5)
- Deploy to staging
- Run security audit
- Get security team approval

### Phase 2: Availability Fixes (Week 2)
- Fix all 🟡 Priority 2 items (6-10)
- Deploy to staging
- Run load tests
- Deploy to production with canary (10% traffic)

### Phase 3: Quality Fixes (Week 3-4)
- Fix all 🟢 Priority 3 items (11-15)
- Deploy incrementally
- Monitor metrics

### Phase 4: Monitoring & Documentation (Week 4)
- Set up all monitoring
- Complete documentation
- Create runbooks
- Train support team

---

## Emergency Procedures

### If Payment Webhook Compromised

1. Immediately disable webhook endpoint
2. Rotate Stripe webhook secret
3. Audit all recent payments
4. Enable enhanced logging
5. Re-deploy with fixed version

### If Rate Limit Attack Detected

1. Enable IP-based blocking
2. Reduce rate limits temporarily
3. Add CAPTCHA if needed
4. Notify security team
5. Review logs for patterns

### If Database Connection Pool Exhausted

1. Scale up database connections
2. Kill long-running queries
3. Restart affected edge functions
4. Add connection monitoring
5. Optimize queries

---

## Success Criteria

**System is production-ready when:**

- [ ] All 15 critical failures fixed
- [ ] All fixes tested in staging
- [ ] Load test passed (1000 req/sec)
- [ ] Security audit completed
- [ ] Monitoring fully operational
- [ ] Runbooks created
- [ ] Team trained
- [ ] Rollback plan tested
- [ ] 24/7 on-call schedule established

---

## Additional Resources

- Full FMA: `FAILURE_MODE_ANALYSIS.md`
- Deployment Guide: `DEPLOYMENT_SETUP.md`
- Architecture: `ARCHITECTURE.md`
- Compatibility Audit: `NETLIFY_SUPABASE_AUDIT.md`

---

**Remember**: Never deploy to production with any 🔴 Critical failures unresolved.
