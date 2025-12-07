-- Create table for market data
CREATE TABLE IF NOT EXISTS market_data (
    id BIGSERIAL PRIMARY KEY,
    symbol VARCHAR(20) NOT NULL,
    timestamp TIMESTAMPTZ NOT NULL,
    open DECIMAL(20, 8) NOT NULL,
    high DECIMAL(20, 8) NOT NULL,
    low DECIMAL(20, 8) NOT NULL,
    close DECIMAL(20, 8) NOT NULL,
    volume DECIMAL(20, 8),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(symbol, timestamp)
);

CREATE INDEX idx_market_data_symbol_timestamp ON market_data(symbol, timestamp DESC);

-- Create table for backtests
CREATE TABLE IF NOT EXISTS backtests (
    id BIGSERIAL PRIMARY KEY,
    user_id UUID REFERENCES auth.users(id),
    backtest_id VARCHAR(100) UNIQUE NOT NULL,
    strategy_name VARCHAR(100) NOT NULL,
    params JSONB,
    start_date DATE NOT NULL,
    end_date DATE NOT NULL,
    initial_capital DECIMAL(20, 2) NOT NULL,
    status VARCHAR(50) NOT NULL,
    results JSONB,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_backtests_user_id ON backtests(user_id);
CREATE INDEX idx_backtests_created_at ON backtests(created_at DESC);

-- Create table for paper trading accounts
CREATE TABLE IF NOT EXISTS paper_accounts (
    id BIGSERIAL PRIMARY KEY,
    user_id UUID REFERENCES auth.users(id) UNIQUE NOT NULL,
    initial_capital DECIMAL(20, 2) NOT NULL DEFAULT 100000.00,
    cash DECIMAL(20, 2) NOT NULL DEFAULT 100000.00,
    portfolio_value DECIMAL(20, 2) NOT NULL DEFAULT 100000.00,
    total_pnl DECIMAL(20, 2) NOT NULL DEFAULT 0.00,
    total_return DECIMAL(10, 6) NOT NULL DEFAULT 0.00,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create table for paper trading positions
CREATE TABLE IF NOT EXISTS paper_positions (
    id BIGSERIAL PRIMARY KEY,
    user_id UUID REFERENCES auth.users(id) NOT NULL,
    symbol VARCHAR(20) NOT NULL,
    quantity DECIMAL(20, 8) NOT NULL,
    avg_price DECIMAL(20, 8) NOT NULL,
    current_price DECIMAL(20, 8) NOT NULL,
    market_value DECIMAL(20, 2) NOT NULL,
    unrealized_pnl DECIMAL(20, 2) NOT NULL,
    unrealized_pnl_pct DECIMAL(10, 6) NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(user_id, symbol)
);

CREATE INDEX idx_paper_positions_user_id ON paper_positions(user_id);

-- Create table for paper trading orders
CREATE TABLE IF NOT EXISTS paper_orders (
    id BIGSERIAL PRIMARY KEY,
    user_id UUID REFERENCES auth.users(id) NOT NULL,
    order_id VARCHAR(100) UNIQUE NOT NULL,
    symbol VARCHAR(20) NOT NULL,
    side VARCHAR(10) NOT NULL CHECK (side IN ('buy', 'sell')),
    order_type VARCHAR(20) NOT NULL CHECK (order_type IN ('market', 'limit', 'stop', 'stop_limit')),
    quantity DECIMAL(20, 8) NOT NULL,
    price DECIMAL(20, 8),
    stop_price DECIMAL(20, 8),
    status VARCHAR(20) NOT NULL CHECK (status IN ('pending', 'filled', 'cancelled', 'rejected')),
    filled_quantity DECIMAL(20, 8) DEFAULT 0,
    filled_price DECIMAL(20, 8),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    filled_at TIMESTAMPTZ
);

CREATE INDEX idx_paper_orders_user_id ON paper_orders(user_id);
CREATE INDEX idx_paper_orders_status ON paper_orders(status);
CREATE INDEX idx_paper_orders_created_at ON paper_orders(created_at DESC);

-- Create table for paper trading trade history
CREATE TABLE IF NOT EXISTS paper_trades (
    id BIGSERIAL PRIMARY KEY,
    user_id UUID REFERENCES auth.users(id) NOT NULL,
    order_id VARCHAR(100) NOT NULL,
    symbol VARCHAR(20) NOT NULL,
    side VARCHAR(10) NOT NULL,
    quantity DECIMAL(20, 8) NOT NULL,
    price DECIMAL(20, 8) NOT NULL,
    commission DECIMAL(20, 2) NOT NULL,
    pnl DECIMAL(20, 2),
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_paper_trades_user_id ON paper_trades(user_id);
CREATE INDEX idx_paper_trades_created_at ON paper_trades(created_at DESC);

-- Create table for optimization jobs
CREATE TABLE IF NOT EXISTS optimization_jobs (
    id BIGSERIAL PRIMARY KEY,
    user_id UUID REFERENCES auth.users(id),
    strategy_name VARCHAR(100) NOT NULL,
    method VARCHAR(50) NOT NULL,
    param_grid JSONB,
    start_date DATE NOT NULL,
    end_date DATE NOT NULL,
    status VARCHAR(50) NOT NULL,
    best_params JSONB,
    best_metric DECIMAL(20, 6),
    results JSONB,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_optimization_jobs_user_id ON optimization_jobs(user_id);
CREATE INDEX idx_optimization_jobs_status ON optimization_jobs(status);
CREATE INDEX idx_optimization_jobs_created_at ON optimization_jobs(created_at DESC);

-- Create table for strategies
CREATE TABLE IF NOT EXISTS strategies (
    id BIGSERIAL PRIMARY KEY,
    user_id UUID REFERENCES auth.users(id) NOT NULL,
    name VARCHAR(100) NOT NULL,
    description TEXT,
    code TEXT NOT NULL,
    params JSONB,
    is_public BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_strategies_user_id ON strategies(user_id);
CREATE INDEX idx_strategies_is_public ON strategies(is_public);

-- Enable Row Level Security
ALTER TABLE market_data ENABLE ROW LEVEL SECURITY;
ALTER TABLE backtests ENABLE ROW LEVEL SECURITY;
ALTER TABLE paper_accounts ENABLE ROW LEVEL SECURITY;
ALTER TABLE paper_positions ENABLE ROW LEVEL SECURITY;
ALTER TABLE paper_orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE paper_trades ENABLE ROW LEVEL SECURITY;
ALTER TABLE optimization_jobs ENABLE ROW LEVEL SECURITY;
ALTER TABLE strategies ENABLE ROW LEVEL SECURITY;

-- Create policies for paper trading tables
CREATE POLICY "Users can view their own paper accounts" ON paper_accounts
    FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can update their own paper accounts" ON paper_accounts
    FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "Users can view their own positions" ON paper_positions
    FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can manage their own positions" ON paper_positions
    FOR ALL USING (auth.uid() = user_id);

CREATE POLICY "Users can view their own orders" ON paper_orders
    FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can create their own orders" ON paper_orders
    FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can view their own trades" ON paper_trades
    FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can view their own backtests" ON backtests
    FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can create their own backtests" ON backtests
    FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can view their own optimization jobs" ON optimization_jobs
    FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can create their own optimization jobs" ON optimization_jobs
    FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can view their own strategies" ON strategies
    FOR SELECT USING (auth.uid() = user_id OR is_public = TRUE);

CREATE POLICY "Users can manage their own strategies" ON strategies
    FOR ALL USING (auth.uid() = user_id);

-- Market data is readable by everyone
CREATE POLICY "Market data is readable by everyone" ON market_data
    FOR SELECT USING (TRUE);
