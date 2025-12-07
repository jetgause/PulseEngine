# PulseEngine Architecture Overview

## System Architecture

PulseEngine follows a modern 3-tier architecture designed for scalability, maintainability, and deployment flexibility.

```
┌─────────────────────────────────────────────────────────────┐
│                      USER INTERFACE                         │
│                    (Netlify Hosting)                        │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐    │
│  │  Dashboard   │  │ Paper Trading│  │  Backtester  │    │
│  └──────────────┘  └──────────────┘  └──────────────┘    │
│                                                             │
│  ┌──────────────┐  ┌──────────────┐                       │
│  │  Optimizer   │  │    Greeks    │                       │
│  └──────────────┘  └──────────────┘                       │
│                                                             │
│                  React + Vite Frontend                      │
└─────────────────────────────────────────────────────────────┘
                            │
                            │ HTTPS API Calls
                            ▼
┌─────────────────────────────────────────────────────────────┐
│                    BACKEND LAYER                            │
│                 (Supabase Platform)                         │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│  ┌────────────────────────────────────────────────────┐   │
│  │            Edge Functions (Serverless)              │   │
│  │                                                      │   │
│  │  ┌──────────┐ ┌──────────┐ ┌──────────┐ ┌────────┐│   │
│  │  │ Backtest │ │  Paper   │ │  Greeks  │ │Optimize││   │
│  │  │   API    │ │ Trading  │ │   API    │ │  API   ││   │
│  │  └──────────┘ └──────────┘ └──────────┘ └────────┘│   │
│  └────────────────────────────────────────────────────┘   │
│                           │                                 │
│                           ▼                                 │
│  ┌────────────────────────────────────────────────────┐   │
│  │         PostgreSQL Database                         │   │
│  │                                                      │   │
│  │  • market_data      • backtests                     │   │
│  │  • paper_accounts   • paper_positions               │   │
│  │  • paper_orders     • paper_trades                  │   │
│  │  • optimization_jobs • strategies                   │   │
│  └────────────────────────────────────────────────────┘   │
│                                                             │
│  ┌────────────────────────────────────────────────────┐   │
│  │         Authentication & Real-time                  │   │
│  │                                                      │   │
│  │  • User Auth        • Row Level Security            │   │
│  │  • Real-time Subs   • API Gateway                   │   │
│  └────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────┘
                            │
                            │ Python Core Library
                            ▼
┌─────────────────────────────────────────────────────────────┐
│                  CORE TRADING LOGIC                         │
│                   (Python Modules)                          │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐    │
│  │  Backtester  │  │   Optimizer  │  │    Greeks    │    │
│  │              │  │              │  │              │    │
│  │ • Trade      │  │ • Grid       │  │ • Delta      │    │
│  │   Engine     │  │   Search     │  │ • Gamma      │    │
│  │ • Metrics    │  │ • Monte      │  │ • Vega       │    │
│  │   Calc       │  │   Carlo      │  │ • Theta      │    │
│  │              │  │ • Walk       │  │ • Rho        │    │
│  │              │  │   Forward    │  │              │    │
│  └──────────────┘  └──────────────┘  └──────────────┘    │
│                                                             │
│  ┌──────────────────────────────────────────────────┐     │
│  │            Paper Trading Engine                   │     │
│  │                                                    │     │
│  │  • Order Management    • Position Tracking        │     │
│  │  • Portfolio Calc      • Trade Execution          │     │
│  └──────────────────────────────────────────────────┘     │
└─────────────────────────────────────────────────────────────┘
```

## Layer Responsibilities

### 1. Frontend Layer (React + Vite)

**Purpose**: User interface and interaction

**Components**:
- **Dashboard**: Overview of portfolio and system status
- **Paper Trading**: Order placement and position management
- **Backtester**: Strategy testing configuration and results
- **Optimizer**: Parameter optimization interface
- **Greeks Calculator**: Options risk metrics calculator

**Technology Stack**:
- React 18 for UI components
- Vite for fast development and building
- React Router for navigation
- Supabase JS client for API calls

**Deployment**: Netlify (CDN + serverless)

### 2. Backend Layer (Supabase)

**Purpose**: API, data storage, and business logic orchestration

**Components**:

#### Edge Functions (Serverless)
- **Backtest API**: Processes backtest requests
- **Paper Trading API**: Handles order submission and portfolio queries
- **Greeks API**: Calculates options Greeks
- **Optimizer API**: Manages optimization jobs

#### Database (PostgreSQL)
- **market_data**: Historical price data
- **backtests**: Backtest configurations and results
- **paper_accounts**: User paper trading accounts
- **paper_positions**: Current positions
- **paper_orders**: Order history
- **paper_trades**: Trade execution history
- **optimization_jobs**: Optimization task tracking
- **strategies**: User-defined strategies

#### Services
- **Authentication**: User management and session handling
- **Real-time**: WebSocket connections for live updates
- **Storage**: File storage for large datasets
- **Row Level Security**: Data access control

**Deployment**: Supabase Cloud (managed PostgreSQL + Edge Runtime)

### 3. Core Trading Logic Layer (Python)

**Purpose**: Trading algorithms and mathematical computations

**Modules**:

#### Backtester (`core/backtester/`)
- Trade simulation engine
- Performance metrics calculation
- Equity curve generation
- Commission and slippage modeling

#### Optimizer (`core/optimizer/`)
- Grid search optimization
- Monte Carlo simulation
- Walk-forward analysis
- Parameter sensitivity analysis

#### Options Greeks (`core/greeks/`)
- Black-Scholes model implementation
- Delta, Gamma, Vega, Theta, Rho calculations
- Support for calls and puts
- Dividend adjustment

#### Paper Trader (`core/paper_trader/`)
- Order management system
- Position tracking
- Portfolio value calculation
- Trade execution simulation

**Deployment**: Importable Python package (can be used locally or in Edge Functions)

## Data Flow

### 1. Backtest Request Flow

```
User → Frontend → Supabase Edge Function → Core Backtester → Database
  │                                                              │
  └──────────────────── Results ←──────────────────────────────┘
```

1. User configures backtest in frontend
2. Frontend sends request to `/functions/backtest`
3. Edge Function fetches historical data from database
4. Core Backtester processes the strategy
5. Results stored in `backtests` table
6. Results returned to frontend
7. Frontend displays metrics and charts

### 2. Paper Trading Flow

```
User → Frontend → Supabase Edge Function → Paper Trader → Database
  │                                                          │
  └───────────── Portfolio Updates ←────────────────────────┘
```

1. User submits order in frontend
2. Frontend sends order to `/functions/paper-trading`
3. Edge Function validates order
4. Paper Trader processes order
5. Order stored in `paper_orders` table
6. Position updated in `paper_positions` table
7. Trade recorded in `paper_trades` table
8. Updated portfolio returned to frontend

### 3. Greeks Calculation Flow

```
User → Frontend → Supabase Edge Function → Greeks Calculator → Frontend
```

1. User enters option parameters
2. Frontend sends request to `/functions/greeks`
3. Edge Function invokes Greeks Calculator
4. Calculator computes all Greeks
5. Results returned to frontend
6. Frontend displays Greeks with explanations

### 4. Optimization Flow

```
User → Frontend → Supabase Edge Function → Optimizer → Database
  │                      │                                  │
  │                      └── Async Processing ──────────────┤
  │                                                          │
  └────────────── Job Status Updates ←──────────────────────┘
```

1. User configures optimization
2. Frontend creates optimization job
3. Edge Function stores job in `optimization_jobs` table
4. Optimizer runs asynchronously (can be background process)
5. Results updated in database
6. Frontend polls for completion or receives real-time updates

## Security Architecture

### Authentication Flow

```
User → Supabase Auth → JWT Token → Row Level Security → Data
```

- Users authenticate via Supabase Auth
- JWT tokens issued for API access
- Row Level Security (RLS) policies enforce data access
- Each user can only access their own data

### RLS Policies

```sql
-- Example: Users can only view their own orders
CREATE POLICY "Users can view their own orders"
ON paper_orders FOR SELECT
USING (auth.uid() = user_id);
```

### API Security

- All API calls require authentication
- Service role key kept secret on server
- HTTPS enforced for all connections
- CORS configured for allowed origins

## Scalability Considerations

### Horizontal Scaling

1. **Frontend**: Automatically scaled by Netlify CDN
2. **Edge Functions**: Auto-scale with Supabase
3. **Database**: Managed by Supabase with connection pooling

### Performance Optimization

1. **Database Indexes**: On frequently queried columns
2. **Caching**: Browser cache for static assets
3. **Real-time Subscriptions**: For live updates without polling
4. **Pagination**: Large datasets fetched in chunks

### Future Scaling Options

1. **Microservices**: Split Edge Functions into separate services
2. **Message Queue**: For long-running optimization jobs
3. **Redis Cache**: For frequently accessed data
4. **Read Replicas**: For read-heavy workloads

## Development Workflow

```
Developer → Local Git → GitHub → Automated Deployment
                                     │
                                     ├→ Netlify (Frontend)
                                     └→ Supabase (Backend)
```

1. Develop locally with hot-reload
2. Push to GitHub repository
3. Netlify auto-deploys frontend on push
4. Supabase Edge Functions deployed via CLI
5. Database migrations applied via Supabase CLI

## Monitoring & Observability

### Frontend Monitoring
- Netlify Analytics for traffic
- Browser console for errors
- Performance metrics

### Backend Monitoring
- Supabase Logs for API requests
- Edge Function logs for errors
- Database query performance

### Application Monitoring
- Trade execution logs
- Backtest completion tracking
- Optimization job status

## Technology Choices Rationale

### Why React?
- Component reusability
- Large ecosystem
- Good performance with Virtual DOM
- Strong community support

### Why Supabase?
- Full backend solution (database, auth, API)
- PostgreSQL (robust, SQL standard)
- Real-time capabilities built-in
- Generous free tier
- Easy deployment

### Why Netlify?
- Automatic HTTPS
- Global CDN
- Git-based deployments
- Great developer experience
- Free tier for personal projects

### Why Python for Core?
- Excellent data science libraries (pandas, numpy, scipy)
- Industry standard for trading algorithms
- Easy to read and maintain
- Great for mathematical computations

## Future Architecture Enhancements

### Planned Improvements

1. **Microservices Architecture**: Split services for better scalability
2. **Event-Driven**: Use message queues for async processing
3. **Caching Layer**: Redis for frequently accessed data
4. **ML Integration**: TensorFlow/PyTorch for strategy generation
5. **Mobile Apps**: React Native for iOS/Android
6. **WebSockets**: Real-time market data streaming
7. **Docker**: Containerization for consistent deployment
8. **Kubernetes**: Orchestration for large-scale deployment

---

This architecture provides a solid foundation that's:
- **Scalable**: Can grow from hobby project to production system
- **Maintainable**: Clear separation of concerns
- **Secure**: Multiple layers of security
- **Cost-effective**: Free tier covers initial usage
- **Developer-friendly**: Modern tools and practices
