-- AI Trading System Database Schema
-- All tables are prefixed with 'trading_' to avoid conflicts with other projects

-- Enable required extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Custom types for trading system
CREATE TYPE session_type AS ENUM ('simulation', 'backtest');
CREATE TYPE trade_type AS ENUM ('buy', 'sell');
CREATE TYPE trade_reason AS ENUM ('ai_signal', 'stop_loss', 'take_profit', 'manual');
CREATE TYPE risk_tolerance AS ENUM ('low', 'medium', 'high');
CREATE TYPE prediction_direction AS ENUM ('up', 'down', 'hold');

-- Trading Users table
-- Extended user profile data linked to Supabase Auth users
CREATE TABLE public.trading_users (
    id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    display_name TEXT NOT NULL CHECK (char_length(display_name) >= 3 AND char_length(display_name) <= 50),
    default_capital DECIMAL(12,2) NOT NULL DEFAULT 10000.00 CHECK (default_capital > 0 AND default_capital <= 1000000),
    risk_tolerance risk_tolerance NOT NULL DEFAULT 'medium',
    preferred_coins JSONB DEFAULT '[]'::jsonb CHECK (jsonb_array_length(preferred_coins) <= 10),
    notification_settings JSONB DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Trading Runs table
-- Complete trading session records (simulations or backtests)
CREATE TABLE public.trading_runs (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID REFERENCES public.trading_users(id) ON DELETE CASCADE, -- nullable for guest sessions
    session_type session_type NOT NULL,
    coin_symbol TEXT NOT NULL,
    starting_capital DECIMAL(12,2) NOT NULL CHECK (starting_capital >= 0),
    final_capital DECIMAL(12,2) CHECK (final_capital >= 0),
    total_trades INTEGER DEFAULT 0 CHECK (total_trades >= 0),
    winning_trades INTEGER DEFAULT 0 CHECK (winning_trades >= 0),
    win_rate DECIMAL(5,2) GENERATED ALWAYS AS (
        CASE
            WHEN total_trades > 0 THEN (winning_trades::decimal / total_trades::decimal * 100)
            ELSE 0
        END
    ) STORED CHECK (win_rate >= 0 AND win_rate <= 100),
    total_return DECIMAL(8,4), -- can be negative for losses
    max_drawdown DECIMAL(8,4), -- negative percentage
    session_start TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    session_end TIMESTAMPTZ CHECK (session_end >= session_start),
    time_period_start TIMESTAMPTZ, -- for backtests
    time_period_end TIMESTAMPTZ CHECK (time_period_end >= time_period_start),
    ai_model_version TEXT NOT NULL DEFAULT '1.0.0',
    parameters JSONB DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Trading Trades table
-- Individual buy/sell transaction records within trading sessions
CREATE TABLE public.trading_trades (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    run_id UUID NOT NULL REFERENCES public.trading_runs(id) ON DELETE CASCADE,
    user_id UUID REFERENCES public.trading_users(id) ON DELETE CASCADE, -- nullable for guest
    trade_type trade_type NOT NULL,
    coin_symbol TEXT NOT NULL,
    quantity DECIMAL(18,8) NOT NULL CHECK (quantity > 0),
    price DECIMAL(12,2) NOT NULL CHECK (price > 0),
    total_value DECIMAL(12,2) GENERATED ALWAYS AS (quantity * price) STORED,
    fee DECIMAL(12,2) NOT NULL DEFAULT 0 CHECK (fee >= 0),
    net_value DECIMAL(12,2) GENERATED ALWAYS AS (
        CASE
            WHEN trade_type = 'buy' THEN (quantity * price + fee)
            ELSE (quantity * price - fee)
        END
    ) STORED,
    portfolio_value_before DECIMAL(12,2) NOT NULL,
    portfolio_value_after DECIMAL(12,2) NOT NULL,
    profit_loss DECIMAL(12,2), -- nullable for buy orders, calculated for sells
    trade_reason trade_reason NOT NULL DEFAULT 'manual',
    ai_confidence DECIMAL(3,2) CHECK (ai_confidence >= 0 AND ai_confidence <= 1),
    market_price DECIMAL(12,2) NOT NULL CHECK (market_price > 0),
    execution_time TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Market Data table (cached)
-- Cached cryptocurrency market data to reduce API calls
CREATE TABLE public.market_data (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    coin_symbol TEXT NOT NULL,
    price_source TEXT NOT NULL DEFAULT 'coingecko',
    current_price DECIMAL(12,2) NOT NULL CHECK (current_price > 0),
    price_change_24h DECIMAL(8,4),
    volume_24h DECIMAL(18,2),
    market_cap DECIMAL(18,2),
    sentiment_score DECIMAL(3,2) CHECK (sentiment_score >= -1 AND sentiment_score <= 1),
    fear_greed_index INTEGER CHECK (fear_greed_index >= 0 AND fear_greed_index <= 100),
    last_updated TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    historical_data JSONB DEFAULT '[]'::jsonb,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    -- Ensure only one record per coin symbol
    UNIQUE(coin_symbol)
);

-- AI Predictions table (optional)
-- ML model prediction results for audit and improvement
CREATE TABLE public.ai_predictions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    coin_symbol TEXT NOT NULL,
    model_version TEXT NOT NULL,
    input_features JSONB NOT NULL,
    predicted_price DECIMAL(12,2) NOT NULL CHECK (predicted_price > 0),
    predicted_direction prediction_direction NOT NULL,
    confidence_score DECIMAL(3,2) NOT NULL CHECK (confidence_score >= 0 AND confidence_score <= 1),
    prediction_horizon INTEGER NOT NULL CHECK (prediction_horizon > 0 AND prediction_horizon <= 60),
    actual_price DECIMAL(12,2) CHECK (actual_price > 0),
    accuracy_score DECIMAL(3,2) CHECK (accuracy_score >= 0 AND accuracy_score <= 1),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    resolved_at TIMESTAMPTZ
);

-- Performance Indexes
CREATE INDEX idx_trading_runs_user_created ON public.trading_runs(user_id, created_at DESC);
CREATE INDEX idx_trading_runs_session_type ON public.trading_runs(session_type);
CREATE INDEX idx_trading_trades_run_execution ON public.trading_trades(run_id, execution_time);
CREATE INDEX idx_trading_trades_user_created ON public.trading_trades(user_id, created_at DESC);
CREATE INDEX idx_market_data_symbol_updated ON public.market_data(coin_symbol, last_updated DESC);
CREATE INDEX idx_ai_predictions_symbol_created ON public.ai_predictions(coin_symbol, created_at DESC);

-- Row Level Security (RLS) Policies

-- Enable RLS on all tables
ALTER TABLE public.trading_users ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.trading_runs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.trading_trades ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.market_data ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ai_predictions ENABLE ROW LEVEL SECURITY;

-- Trading Users policies
CREATE POLICY "Users can only read/update their own profile" ON public.trading_users
    FOR ALL USING (auth.uid() = id);

-- Trading Runs policies
CREATE POLICY "Users can read/write their own runs" ON public.trading_runs
    FOR ALL USING (auth.uid() = user_id OR user_id IS NULL);

-- Trading Trades policies
CREATE POLICY "Users can read/write their own trades" ON public.trading_trades
    FOR ALL USING (auth.uid() = user_id OR user_id IS NULL);

-- Market Data policies (public read-only)
CREATE POLICY "Market data is readable by all users" ON public.market_data
    FOR SELECT USING (true);

CREATE POLICY "Market data is writable by service role only" ON public.market_data
    FOR INSERT WITH CHECK (auth.role() = 'service_role');

CREATE POLICY "Market data is updatable by service role only" ON public.market_data
    FOR UPDATE USING (auth.role() = 'service_role');

-- AI Predictions policies (public read-only for transparency)
CREATE POLICY "AI predictions are readable by all users" ON public.ai_predictions
    FOR SELECT USING (true);

CREATE POLICY "AI predictions are writable by service role only" ON public.ai_predictions
    FOR INSERT WITH CHECK (auth.role() = 'service_role');

-- Trigger to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

CREATE TRIGGER update_trading_users_updated_at
    BEFORE UPDATE ON public.trading_users
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Function to calculate trade profit/loss
CREATE OR REPLACE FUNCTION calculate_trade_profit_loss()
RETURNS TRIGGER AS $$
DECLARE
    buy_price DECIMAL(12,2);
    buy_quantity DECIMAL(18,8);
BEGIN
    -- Only calculate P/L for sell trades
    IF NEW.trade_type = 'sell' THEN
        -- Find the corresponding buy trade (simplified - in reality would need FIFO/LIFO logic)
        SELECT price, quantity INTO buy_price, buy_quantity
        FROM public.trading_trades
        WHERE run_id = NEW.run_id
            AND coin_symbol = NEW.coin_symbol
            AND trade_type = 'buy'
            AND execution_time < NEW.execution_time
        ORDER BY execution_time DESC
        LIMIT 1;

        IF buy_price IS NOT NULL THEN
            NEW.profit_loss = (NEW.price - buy_price) * NEW.quantity - NEW.fee;
        END IF;
    END IF;

    RETURN NEW;
END;
$$ language 'plpgsql';

CREATE TRIGGER calculate_profit_loss_trigger
    BEFORE INSERT ON public.trading_trades
    FOR EACH ROW EXECUTE FUNCTION calculate_trade_profit_loss();

-- Comments for documentation
COMMENT ON TABLE public.trading_users IS 'Extended user profiles for trading system functionality';
COMMENT ON TABLE public.trading_runs IS 'Complete trading sessions with performance metrics';
COMMENT ON TABLE public.trading_trades IS 'Individual trade transactions within runs';
COMMENT ON TABLE public.market_data IS 'Cached cryptocurrency market data from external APIs';
COMMENT ON TABLE public.ai_predictions IS 'ML model predictions for audit and performance tracking';