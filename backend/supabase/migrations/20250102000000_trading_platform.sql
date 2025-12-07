-- Trading Platform Schema Migration
-- Adds payment, subscriptions, broker connections, and trading features

-- ============================================================================
-- SUBSCRIPTION & PAYMENT TABLES
-- ============================================================================

-- Subscription tiers
CREATE TABLE IF NOT EXISTS public.subscription_tiers (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR(50) NOT NULL UNIQUE,
    slug VARCHAR(50) NOT NULL UNIQUE,
    description TEXT,
    price_monthly DECIMAL(10,2) NOT NULL,
    price_yearly DECIMAL(10,2),
    features JSONB DEFAULT '{}',
    limits JSONB DEFAULT '{}', -- API calls, backtests, etc.
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- User subscriptions
CREATE TABLE IF NOT EXISTS public.user_subscriptions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    tier_id UUID NOT NULL REFERENCES public.subscription_tiers(id),
    status VARCHAR(50) NOT NULL DEFAULT 'active', -- active, cancelled, expired, suspended
    payment_method VARCHAR(50), -- stripe, usdt, other
    stripe_subscription_id VARCHAR(255),
    stripe_customer_id VARCHAR(255),
    started_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    expires_at TIMESTAMP WITH TIME ZONE,
    cancelled_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(user_id, tier_id)
);

-- Payment history
CREATE TABLE IF NOT EXISTS public.payments (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    subscription_id UUID REFERENCES public.user_subscriptions(id),
    amount DECIMAL(10,2) NOT NULL,
    currency VARCHAR(10) NOT NULL, -- usd, usdt, etc.
    payment_method VARCHAR(50) NOT NULL, -- stripe, crypto
    status VARCHAR(50) NOT NULL, -- pending, completed, failed, refunded
    stripe_payment_intent_id VARCHAR(255),
    crypto_tx_hash VARCHAR(255),
    crypto_wallet_address VARCHAR(255),
    metadata JSONB DEFAULT '{}',
    paid_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- ============================================================================
-- DATA PROVIDER TABLES
-- ============================================================================

-- Available data providers
CREATE TABLE IF NOT EXISTS public.data_providers (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR(100) NOT NULL,
    slug VARCHAR(100) NOT NULL UNIQUE,
    description TEXT,
    provider_type VARCHAR(50) NOT NULL, -- api, csv, websocket
    supported_assets JSONB DEFAULT '[]', -- ['stocks', 'crypto', 'forex']
    rate_limits JSONB DEFAULT '{}',
    pricing_info JSONB DEFAULT '{}',
    min_tier VARCHAR(50), -- Minimum subscription tier required
    api_docs_url TEXT,
    enabled BOOLEAN DEFAULT true,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- User's connected data providers
CREATE TABLE IF NOT EXISTS public.user_data_providers (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    provider_id UUID NOT NULL REFERENCES public.data_providers(id),
    api_key_encrypted TEXT, -- Encrypted API key
    api_secret_encrypted TEXT,
    configuration JSONB DEFAULT '{}',
    status VARCHAR(50) DEFAULT 'active', -- active, disabled, error
    last_sync_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(user_id, provider_id)
);

-- ============================================================================
-- BROKER CONNECTION TABLES
-- ============================================================================

-- Available brokers
CREATE TABLE IF NOT EXISTS public.brokers (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR(100) NOT NULL,
    slug VARCHAR(100) NOT NULL UNIQUE,
    description TEXT,
    broker_type VARCHAR(50) NOT NULL, -- stocks, crypto, forex, cfd
    supported_order_types JSONB DEFAULT '[]',
    supported_markets JSONB DEFAULT '[]',
    min_tier VARCHAR(50), -- Minimum subscription tier required
    oauth_enabled BOOLEAN DEFAULT false,
    api_docs_url TEXT,
    enabled BOOLEAN DEFAULT true,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- User's broker connections
CREATE TABLE IF NOT EXISTS public.user_broker_connections (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    broker_id UUID NOT NULL REFERENCES public.brokers(id),
    connection_name VARCHAR(100), -- User-defined name
    api_key_encrypted TEXT,
    api_secret_encrypted TEXT,
    oauth_token_encrypted TEXT,
    oauth_refresh_token_encrypted TEXT,
    account_id VARCHAR(255),
    account_type VARCHAR(50), -- paper, live
    status VARCHAR(50) DEFAULT 'active', -- active, disabled, error, expired
    last_connected_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- ============================================================================
-- TRADING TABLES
-- ============================================================================

-- Trading strategies
CREATE TABLE IF NOT EXISTS public.trading_strategies (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    name VARCHAR(255) NOT NULL,
    description TEXT,
    strategy_type VARCHAR(50), -- momentum, mean_reversion, arbitrage, etc.
    tool_id UUID REFERENCES public.tools(id),
    configuration JSONB DEFAULT '{}',
    risk_parameters JSONB DEFAULT '{}',
    enabled BOOLEAN DEFAULT false,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Orders
CREATE TABLE IF NOT EXISTS public.orders (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    broker_connection_id UUID NOT NULL REFERENCES public.user_broker_connections(id),
    strategy_id UUID REFERENCES public.trading_strategies(id),
    broker_order_id VARCHAR(255), -- Broker's order ID
    symbol VARCHAR(50) NOT NULL,
    side VARCHAR(10) NOT NULL, -- buy, sell
    order_type VARCHAR(50) NOT NULL, -- market, limit, stop, stop_limit
    quantity DECIMAL(20,8) NOT NULL,
    filled_quantity DECIMAL(20,8) DEFAULT 0,
    price DECIMAL(20,8),
    stop_price DECIMAL(20,8),
    time_in_force VARCHAR(20), -- day, gtc, ioc, fok
    status VARCHAR(50) NOT NULL, -- pending, submitted, filled, cancelled, rejected, expired
    filled_avg_price DECIMAL(20,8),
    commission DECIMAL(20,8),
    error_message TEXT,
    submitted_at TIMESTAMP WITH TIME ZONE,
    filled_at TIMESTAMP WITH TIME ZONE,
    cancelled_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Positions
CREATE TABLE IF NOT EXISTS public.positions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    broker_connection_id UUID NOT NULL REFERENCES public.user_broker_connections(id),
    symbol VARCHAR(50) NOT NULL,
    quantity DECIMAL(20,8) NOT NULL,
    avg_entry_price DECIMAL(20,8) NOT NULL,
    current_price DECIMAL(20,8),
    market_value DECIMAL(20,8),
    unrealized_pnl DECIMAL(20,8),
    unrealized_pnl_percent DECIMAL(10,4),
    side VARCHAR(10), -- long, short
    opened_at TIMESTAMP WITH TIME ZONE,
    closed_at TIMESTAMP WITH TIME ZONE,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(user_id, broker_connection_id, symbol)
);

-- ============================================================================
-- MARKET DATA TABLES
-- ============================================================================

-- Market data library (metadata only, actual CSV files in storage)
CREATE TABLE IF NOT EXISTS public.market_data_files (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    symbol VARCHAR(50) NOT NULL,
    asset_type VARCHAR(50) NOT NULL, -- stock, crypto, forex, commodity
    timeframe VARCHAR(20) NOT NULL, -- 1min, 5min, 1hour, daily
    start_date DATE NOT NULL,
    end_date DATE NOT NULL,
    file_path TEXT NOT NULL,
    file_size_bytes BIGINT,
    row_count INTEGER,
    provider VARCHAR(100),
    data_quality_score DECIMAL(3,2), -- 0.00 to 1.00
    checksum VARCHAR(64),
    uploaded_by UUID REFERENCES auth.users(id),
    is_public BOOLEAN DEFAULT false,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Market data access log
CREATE TABLE IF NOT EXISTS public.market_data_access_log (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    file_id UUID REFERENCES public.market_data_files(id),
    access_type VARCHAR(50), -- download, stream, query
    bytes_transferred BIGINT,
    accessed_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- ============================================================================
-- BACKTESTING TABLES
-- ============================================================================

-- Backtest runs
CREATE TABLE IF NOT EXISTS public.backtests (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    strategy_id UUID REFERENCES public.trading_strategies(id),
    name VARCHAR(255) NOT NULL,
    description TEXT,
    symbols JSONB DEFAULT '[]',
    start_date DATE NOT NULL,
    end_date DATE NOT NULL,
    initial_capital DECIMAL(20,2) NOT NULL,
    data_file_ids JSONB DEFAULT '[]',
    configuration JSONB DEFAULT '{}',
    status VARCHAR(50) NOT NULL, -- pending, running, completed, failed
    results JSONB,
    performance_metrics JSONB,
    error_message TEXT,
    started_at TIMESTAMP WITH TIME ZONE,
    completed_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- ============================================================================
-- NOTIFICATION TABLES
-- ============================================================================

-- Discord integrations
CREATE TABLE IF NOT EXISTS public.user_discord_integrations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    webhook_url TEXT NOT NULL,
    webhook_name VARCHAR(100),
    enabled BOOLEAN DEFAULT true,
    alert_types JSONB DEFAULT '[]', -- ['trade_execution', 'signals', 'risk_alerts']
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Alert log
CREATE TABLE IF NOT EXISTS public.alerts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    alert_type VARCHAR(50) NOT NULL,
    title VARCHAR(255) NOT NULL,
    message TEXT NOT NULL,
    severity VARCHAR(20), -- info, warning, error, critical
    metadata JSONB DEFAULT '{}',
    sent_to_discord BOOLEAN DEFAULT false,
    sent_to_email BOOLEAN DEFAULT false,
    sent_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- ============================================================================
-- ANALYTICS TABLES
-- ============================================================================

-- Usage metrics
CREATE TABLE IF NOT EXISTS public.usage_metrics (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    metric_date DATE NOT NULL,
    api_calls INTEGER DEFAULT 0,
    backtests_run INTEGER DEFAULT 0,
    orders_placed INTEGER DEFAULT 0,
    data_downloaded_bytes BIGINT DEFAULT 0,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(user_id, metric_date)
);

-- ============================================================================
-- INDEXES
-- ============================================================================

-- Subscription indexes
CREATE INDEX IF NOT EXISTS idx_user_subscriptions_user_id ON public.user_subscriptions(user_id);
CREATE INDEX IF NOT EXISTS idx_user_subscriptions_status ON public.user_subscriptions(status);
CREATE INDEX IF NOT EXISTS idx_payments_user_id ON public.payments(user_id);
CREATE INDEX IF NOT EXISTS idx_payments_status ON public.payments(status);

-- Data provider indexes
CREATE INDEX IF NOT EXISTS idx_user_data_providers_user_id ON public.user_data_providers(user_id);
CREATE INDEX IF NOT EXISTS idx_user_data_providers_provider_id ON public.user_data_providers(provider_id);

-- Broker indexes
CREATE INDEX IF NOT EXISTS idx_user_broker_connections_user_id ON public.user_broker_connections(user_id);
CREATE INDEX IF NOT EXISTS idx_user_broker_connections_broker_id ON public.user_broker_connections(broker_id);

-- Trading indexes
CREATE INDEX IF NOT EXISTS idx_orders_user_id ON public.orders(user_id);
CREATE INDEX IF NOT EXISTS idx_orders_broker_connection_id ON public.orders(broker_connection_id);
CREATE INDEX IF NOT EXISTS idx_orders_symbol ON public.orders(symbol);
CREATE INDEX IF NOT EXISTS idx_orders_status ON public.orders(status);
CREATE INDEX IF NOT EXISTS idx_orders_created_at ON public.orders(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_positions_user_id ON public.positions(user_id);
CREATE INDEX IF NOT EXISTS idx_positions_broker_connection_id ON public.positions(broker_connection_id);

-- Market data indexes
CREATE INDEX IF NOT EXISTS idx_market_data_files_symbol ON public.market_data_files(symbol);
CREATE INDEX IF NOT EXISTS idx_market_data_files_asset_type ON public.market_data_files(asset_type);
CREATE INDEX IF NOT EXISTS idx_market_data_files_timeframe ON public.market_data_files(timeframe);
CREATE INDEX IF NOT EXISTS idx_market_data_access_log_user_id ON public.market_data_access_log(user_id);

-- Backtest indexes
CREATE INDEX IF NOT EXISTS idx_backtests_user_id ON public.backtests(user_id);
CREATE INDEX IF NOT EXISTS idx_backtests_status ON public.backtests(status);
CREATE INDEX IF NOT EXISTS idx_backtests_created_at ON public.backtests(created_at DESC);

-- Alert indexes
CREATE INDEX IF NOT EXISTS idx_alerts_user_id ON public.alerts(user_id);
CREATE INDEX IF NOT EXISTS idx_alerts_created_at ON public.alerts(created_at DESC);

-- ============================================================================
-- ROW LEVEL SECURITY
-- ============================================================================

-- Enable RLS on all tables
ALTER TABLE public.subscription_tiers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_subscriptions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.payments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.data_providers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_data_providers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.brokers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_broker_connections ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.trading_strategies ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.positions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.market_data_files ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.market_data_access_log ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.backtests ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_discord_integrations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.alerts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.usage_metrics ENABLE ROW LEVEL SECURITY;

-- Subscription tier policies (public read)
CREATE POLICY "Subscription tiers are viewable by everyone"
    ON public.subscription_tiers FOR SELECT
    USING (true);

-- User subscription policies
CREATE POLICY "Users can view their own subscriptions"
    ON public.user_subscriptions FOR SELECT
    TO authenticated
    USING (user_id = auth.uid());

CREATE POLICY "Users can insert their own subscriptions"
    ON public.user_subscriptions FOR INSERT
    TO authenticated
    WITH CHECK (user_id = auth.uid());

-- Payment policies
CREATE POLICY "Users can view their own payments"
    ON public.payments FOR SELECT
    TO authenticated
    USING (user_id = auth.uid());

-- Data provider policies
CREATE POLICY "Data providers are viewable by authenticated users"
    ON public.data_providers FOR SELECT
    TO authenticated
    USING (enabled = true);

CREATE POLICY "Users can view their own data provider connections"
    ON public.user_data_providers FOR SELECT
    TO authenticated
    USING (user_id = auth.uid());

CREATE POLICY "Users can manage their own data provider connections"
    ON public.user_data_providers FOR ALL
    TO authenticated
    USING (user_id = auth.uid());

-- Broker policies
CREATE POLICY "Brokers are viewable by authenticated users"
    ON public.brokers FOR SELECT
    TO authenticated
    USING (enabled = true);

CREATE POLICY "Users can manage their own broker connections"
    ON public.user_broker_connections FOR ALL
    TO authenticated
    USING (user_id = auth.uid());

-- Trading policies
CREATE POLICY "Users can manage their own strategies"
    ON public.trading_strategies FOR ALL
    TO authenticated
    USING (user_id = auth.uid());

CREATE POLICY "Users can view and manage their own orders"
    ON public.orders FOR ALL
    TO authenticated
    USING (user_id = auth.uid());

CREATE POLICY "Users can view and manage their own positions"
    ON public.positions FOR ALL
    TO authenticated
    USING (user_id = auth.uid());

-- Market data policies
CREATE POLICY "Public market data files are viewable by authenticated users"
    ON public.market_data_files FOR SELECT
    TO authenticated
    USING (is_public = true OR uploaded_by = auth.uid());

CREATE POLICY "Users can upload their own market data files"
    ON public.market_data_files FOR INSERT
    TO authenticated
    WITH CHECK (uploaded_by = auth.uid());

-- Backtest policies
CREATE POLICY "Users can manage their own backtests"
    ON public.backtests FOR ALL
    TO authenticated
    USING (user_id = auth.uid());

-- Alert policies
CREATE POLICY "Users can view their own alerts"
    ON public.alerts FOR SELECT
    TO authenticated
    USING (user_id = auth.uid());

-- ============================================================================
-- SEED DATA
-- ============================================================================

-- Insert subscription tiers
INSERT INTO public.subscription_tiers (name, slug, description, price_monthly, price_yearly, features, limits) VALUES
('Free', 'free', 'Basic features for beginners', 0.00, 0.00, 
 '{"delayed_data": true, "basic_backtesting": true, "community_support": true}'::jsonb,
 '{"api_calls_per_day": 100, "backtests_per_day": 3, "data_providers": 1}'::jsonb),
 
('Pro', 'pro', 'Professional trading features', 29.00, 290.00,
 '{"realtime_data": true, "unlimited_backtesting": true, "discord_alerts": true, "api_access": true}'::jsonb,
 '{"api_calls_per_day": 1000, "backtests_per_day": 999999, "data_providers": 3, "concurrent_trades": 10}'::jsonb),
 
('Premium', 'premium', 'Advanced features for serious traders', 99.00, 990.00,
 '{"all_pro_features": true, "websocket_data": true, "advanced_trading": true, "priority_support": true}'::jsonb,
 '{"api_calls_per_day": 10000, "backtests_per_day": 999999, "data_providers": 999, "concurrent_trades": 50}'::jsonb),
 
('Enterprise', 'enterprise', 'Custom enterprise solutions', 999.00, NULL,
 '{"all_premium_features": true, "dedicated_infrastructure": true, "white_label": true, "24_7_support": true}'::jsonb,
 '{"api_calls_per_day": 999999, "backtests_per_day": 999999, "data_providers": 999, "concurrent_trades": 999}'::jsonb)
ON CONFLICT (slug) DO NOTHING;

-- Insert data providers
INSERT INTO public.data_providers (name, slug, description, provider_type, supported_assets, min_tier, enabled) VALUES
('Alpha Vantage', 'alpha_vantage', 'Stock, Forex, and Crypto data', 'api', '["stocks", "forex", "crypto"]'::jsonb, 'free', true),
('Polygon.io', 'polygon', 'Real-time stock market data', 'api', '["stocks", "options"]'::jsonb, 'pro', true),
('Yahoo Finance', 'yahoo_finance', 'Free market data', 'api', '["stocks", "etfs", "indices"]'::jsonb, 'free', true),
('CoinGecko', 'coingecko', 'Cryptocurrency data', 'api', '["crypto"]'::jsonb, 'free', true),
('IEX Cloud', 'iex_cloud', 'Financial market data', 'api', '["stocks", "etfs"]'::jsonb, 'pro', true),
('Custom CSV', 'custom_csv', 'Upload your own CSV files', 'csv', '["custom"]'::jsonb, 'free', true)
ON CONFLICT (slug) DO NOTHING;

-- Insert brokers
INSERT INTO public.brokers (name, slug, description, broker_type, supported_order_types, min_tier, enabled) VALUES
('Alpaca', 'alpaca', 'Commission-free stock trading', 'stocks', '["market", "limit", "stop", "stop_limit"]'::jsonb, 'pro', true),
('Interactive Brokers', 'interactive_brokers', 'Professional trading platform', 'stocks', '["market", "limit", "stop", "stop_limit"]'::jsonb, 'premium', true),
('Coinbase Pro', 'coinbase_pro', 'Cryptocurrency trading', 'crypto', '["market", "limit"]'::jsonb, 'pro', true),
('Binance', 'binance', 'Global crypto exchange', 'crypto', '["market", "limit", "stop_limit"]'::jsonb, 'pro', true),
('TD Ameritrade', 'td_ameritrade', 'Full-service broker', 'stocks', '["market", "limit", "stop", "stop_limit"]'::jsonb, 'premium', true)
ON CONFLICT (slug) DO NOTHING;
