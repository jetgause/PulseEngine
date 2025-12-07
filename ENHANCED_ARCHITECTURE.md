# Enhanced PulseEngine Architecture

## Refined Architecture with Separation of Concerns

```
┌─────────────────────────────────────────────────────────────┐
│                  Frontend (Netlify)                          │
│  • React SPA with Vite                                       │
│  • Static hosting with CDN                                   │
│  • Environment-based configuration                           │
└─────────────────────────────────────────────────────────────┘
                            │
                    HTTPS/WebSocket
                            ▼
┌─────────────────────────────────────────────────────────────┐
│              Edge Functions (Auth Only)                      │
│  • Authentication & Authorization                            │
│  • Token validation & refresh                                │
│  • Session management                                        │
│  • User registration & login                                 │
└─────────────────────────────────────────────────────────────┘
                            │
                ┌───────────┴───────────┐
                ▼                       ▼
┌───────────────────────┐   ┌───────────────────────┐
│  Supabase (DB + RLS)  │   │  Workers (Background) │
│  • PostgreSQL with    │   │  • Payment Processing │
│    Row Level Security │   │  • Broker API Jobs    │
│  • Real-time subs     │   │  • Data Sync Jobs     │
│  • Storage (S3)       │   │  • Alert Jobs         │
└───────────────────────┘   └───────────────────────┘
```

## Component Responsibilities

### 1. Frontend (Netlify)
- **Static Site Hosting**: React app built with Vite
- **CDN Distribution**: Global edge delivery
- **Client-Side Logic**: UI rendering, state management
- **Direct Supabase Calls**: Read operations via Supabase client

### 2. Edge Functions (Authentication Only)
- **Auth Endpoints**:
  - `POST /auth/register` - User registration
  - `POST /auth/login` - User login with email/password
  - `POST /auth/google` - Google OAuth callback
  - `POST /auth/refresh` - Token refresh
  - `POST /auth/logout` - Session termination
  - `GET /auth/verify` - Token verification

**Why Auth Only?**
- Low latency for authentication checks
- Stateless operations (no heavy processing)
- Critical path optimization
- Reduces edge function costs

### 3. Supabase (Database + RLS)
- **PostgreSQL Database**: All data storage
- **Row-Level Security**: User-level access control
- **Real-time Subscriptions**: Live data updates
- **Storage**: File storage (market data CSVs)
- **Direct Client Access**: Frontend reads directly via Supabase client

**RLS Policies Enforce**:
- Users can only access their own data
- Subscription tier limits
- API rate limits
- Data provider access

### 4. Workers (Background Jobs)
- **Payment Processing Worker**:
  - Process Stripe webhooks
  - Verify crypto transactions
  - Update subscription status
  - Send payment confirmations
  
- **Broker API Worker**:
  - Execute trade orders
  - Sync positions from brokers
  - Monitor order status
  - Handle broker callbacks
  
- **Data Sync Worker**:
  - Fetch data from providers
  - Update market data cache
  - Generate derived data
  
- **Alert Worker**:
  - Send Discord notifications
  - Email alerts
  - Push notifications
  - Alert aggregation

## Data Flow Examples

### Authentication Flow
```
1. User submits login → Frontend
2. Frontend calls → Edge Function (Auth)
3. Edge Function validates → Supabase Auth
4. Returns JWT → Frontend
5. Frontend stores token in localStorage
6. Subsequent requests include token
7. Supabase RLS validates token automatically
```

### Trading Flow
```
1. User places order → Frontend
2. Frontend writes to orders table → Supabase (RLS validates)
3. Database trigger fires → Worker queue
4. Broker Worker picks up job
5. Worker calls broker API
6. Worker updates order status → Supabase
7. Real-time subscription notifies → Frontend
8. Alert Worker sends Discord notification
```

### Payment Flow
```
1. User initiates checkout → Frontend
2. Frontend creates checkout record → Supabase
3. Stripe webhook received → Payment Worker
4. Worker verifies signature
5. Worker updates subscription → Supabase
6. Real-time subscription notifies → Frontend
```

## Deployment Architecture

### Netlify Configuration
```toml
# netlify.toml
[build]
  command = "npm run build"
  publish = "dist"
  base = "frontend"

[[redirects]]
  from = "/*"
  to = "/index.html"
  status = 200

[[headers]]
  for = "/*"
  [headers.values]
    X-Frame-Options = "DENY"
    X-Content-Type-Options = "nosniff"
```

### Supabase Configuration
```toml
# backend/supabase/config.toml
[api]
enabled = true
port = 54321

[db]
port = 5432
pooler_enabled = true
pooler_port = 54329

[auth]
enabled = true
# Only edge functions handle auth
external_url = "https://your-netlify-site.netlify.app"

[realtime]
enabled = true

[storage]
enabled = true
file_size_limit = "50MiB"
```

### Worker Configuration
Workers can be deployed to:
- **Cloudflare Workers** (recommended for edge)
- **Deno Deploy** (TypeScript native)
- **AWS Lambda** (if you need AWS integration)
- **Google Cloud Run** (containerized)

## Security Architecture

### Edge Functions (Auth)
```typescript
// Only auth endpoints in edge functions
const authEndpoints = {
  '/auth/register': handleRegister,
  '/auth/login': handleLogin,
  '/auth/google': handleGoogleOAuth,
  '/auth/refresh': handleRefresh,
  '/auth/logout': handleLogout,
  '/auth/verify': handleVerify,
}

// All other operations go through Supabase RLS
```

### Supabase RLS Example
```sql
-- Users can only read their own orders
CREATE POLICY "Users view own orders"
  ON orders FOR SELECT
  TO authenticated
  USING (user_id = auth.uid());

-- Users can only create orders within their tier limits
CREATE POLICY "Users create orders within limits"
  ON orders FOR INSERT
  TO authenticated
  WITH CHECK (
    user_id = auth.uid() AND
    (SELECT check_tier_limits(auth.uid(), 'concurrent_orders'))
  );
```

### Worker Security
```typescript
// Workers authenticate with service role key
const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY // Bypass RLS
)

// Workers validate webhook signatures
const isValidWebhook = await verifySignature(
  request.body,
  request.headers['stripe-signature'],
  process.env.STRIPE_WEBHOOK_SECRET
)
```

## Performance Optimization

### Frontend
- **Code Splitting**: Dynamic imports for routes
- **Lazy Loading**: Components loaded on demand
- **Asset Optimization**: Images, fonts compressed
- **CDN Caching**: Static assets cached at edge

### Edge Functions (Auth Only)
- **Cold Start**: < 50ms (minimal code)
- **Response Time**: < 100ms (auth checks only)
- **Caching**: JWT validation cached

### Supabase
- **Connection Pooling**: 10,000 connections
- **Read Replicas**: Scale read operations
- **Indexes**: All query paths indexed
- **Materialized Views**: Pre-computed aggregations

### Workers
- **Queue-Based**: Async processing
- **Retry Logic**: Exponential backoff
- **Dead Letter Queue**: Failed job handling
- **Concurrency Control**: Rate limiting per resource

## Cost Optimization

### Edge Functions (Auth Only)
- **Invocations**: ~10M/month
- **Duration**: 50ms average
- **Cost**: ~$5/month (vs $500+ for all operations)

### Supabase Direct Access
- **Zero Edge Function Cost**: Direct client reads
- **RLS Enforcement**: Security at database level
- **Real-time Included**: No extra cost

### Workers
- **Pay Per Use**: Only when jobs run
- **Batch Processing**: Group operations
- **Scheduled Jobs**: Off-peak processing

## Monitoring

### Netlify
- **Build Status**: Deploy logs
- **Analytics**: Page views, load times
- **Error Tracking**: Client-side errors

### Edge Functions
- **Invocation Count**: Auth requests
- **Error Rate**: Failed auth attempts
- **Latency**: p50, p95, p99

### Supabase
- **Query Performance**: Slow query log
- **Connection Pool**: Usage metrics
- **Storage**: Usage and growth

### Workers
- **Job Queue Depth**: Pending jobs
- **Processing Time**: Job duration
- **Failure Rate**: Retry counts
- **Dead Letter Queue**: Failed jobs

## Migration Path

### Current State
- ✅ Frontend structure
- ✅ Database schema
- ✅ Payment edge function (move to worker)
- ⚠️ API Gateway edge function (split: auth to edge, rest direct)
- ⚠️ Tools edge function (move to worker)

### Step 1: Separate Auth Edge Functions
1. Create dedicated auth edge functions
2. Remove non-auth routes from API gateway
3. Update frontend to call Supabase directly for data

### Step 2: Implement Workers
1. Set up worker infrastructure (Cloudflare/Deno Deploy)
2. Create payment processing worker
3. Create broker API worker
4. Create alert worker

### Step 3: Move Heavy Operations
1. Move payment processing from edge to worker
2. Move tool execution from edge to worker
3. Move data sync from edge to worker

### Step 4: Optimize Database
1. Ensure all RLS policies are in place
2. Add necessary indexes
3. Set up connection pooling
4. Configure read replicas

## Benefits of This Architecture

### Scalability
- **Frontend**: Unlimited via CDN
- **Auth**: Fast edge functions
- **Database**: Read replicas + pooling
- **Workers**: Auto-scaling queues

### Cost Efficiency
- **Reduced Edge Function Costs**: Auth only
- **Direct Database Access**: No middleware overhead
- **Worker Efficiency**: Batch processing

### Performance
- **Low Latency Reads**: Direct from frontend
- **Fast Auth**: Edge optimized
- **Async Processing**: Non-blocking operations

### Security
- **RLS**: Database-level security
- **Service Role**: Workers bypass RLS safely
- **Token Validation**: Edge function auth

### Maintainability
- **Clear Separation**: Each component has one job
- **Easy Testing**: Independent components
- **Simple Debugging**: Isolated concerns

## Implementation Priority

1. **Phase 1**: Create auth-only edge functions
2. **Phase 2**: Update frontend to use Supabase client directly
3. **Phase 3**: Implement payment worker
4. **Phase 4**: Implement broker worker
5. **Phase 5**: Implement alert worker
6. **Phase 6**: Remove old edge functions

---

**Architecture Version**: 2.0
**Status**: Enhanced for Production Scale
**Updated**: December 7, 2025
