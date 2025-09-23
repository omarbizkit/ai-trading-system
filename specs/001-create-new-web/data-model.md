# Data Model: AI Trading System

## Entities Overview

This document defines the core data entities for the AI Trading System, derived from the functional requirements in the feature specification.

## Database Schema (Supabase PostgreSQL)

### trading_users
Extended user profile data linked to Supabase Auth users.

**Fields**:
- `id` (UUID, Primary Key) - Links to auth.users.id
- `display_name` (TEXT) - User's display name for trading interface
- `default_capital` (DECIMAL) - Starting capital for new simulations (default: 10000.00)
- `risk_tolerance` (ENUM: low, medium, high) - User's risk preference setting
- `preferred_coins` (JSON) - Array of favorite cryptocurrency symbols
- `notification_settings` (JSON) - User preference for alerts and notifications
- `created_at` (TIMESTAMPTZ) - Account creation timestamp
- `updated_at` (TIMESTAMPTZ) - Last profile update timestamp

**Relationships**:
- 1:N with trading_runs (user can have multiple trading sessions)
- 1:N with trading_trades (user can have multiple individual trades)

**Validation Rules**:
- default_capital must be > 0 and <= 1000000
- preferred_coins array limited to 10 symbols
- display_name must be 3-50 characters

### trading_runs
Complete trading session records (simulations or backtests).

**Fields**:
- `id` (UUID, Primary Key) - Unique run identifier
- `user_id` (UUID, Foreign Key) - Links to trading_users.id (nullable for guest sessions)
- `session_type` (ENUM: simulation, backtest) - Type of trading session
- `coin_symbol` (TEXT) - Primary cryptocurrency traded (e.g., 'BTC', 'ETH')
- `starting_capital` (DECIMAL) - Initial capital for this session
- `final_capital` (DECIMAL) - Ending capital after all trades
- `total_trades` (INTEGER) - Count of trades executed
- `winning_trades` (INTEGER) - Count of profitable trades
- `win_rate` (DECIMAL) - Percentage of winning trades (calculated)
- `total_return` (DECIMAL) - Overall return percentage
- `max_drawdown` (DECIMAL) - Maximum loss from peak (negative percentage)
- `session_start` (TIMESTAMPTZ) - When trading session began
- `session_end` (TIMESTAMPTZ) - When trading session ended
- `time_period_start` (TIMESTAMPTZ) - Start of price data period (for backtests)
- `time_period_end` (TIMESTAMPTZ) - End of price data period (for backtests)
- `ai_model_version` (TEXT) - Version identifier of ML model used
- `parameters` (JSON) - Session configuration (stop loss %, take profit %, etc.)
- `created_at` (TIMESTAMPTZ) - Record creation timestamp

**Relationships**:
- N:1 with trading_users (many runs per user)
- 1:N with trading_trades (one run contains multiple trades)

**Validation Rules**:
- starting_capital and final_capital must be >= 0
- win_rate must be between 0 and 100
- total_return can be negative (losses)
- session_end must be after session_start

**State Transitions**:
- ACTIVE → COMPLETED (normal session completion)
- ACTIVE → STOPPED (user-initiated stop)
- ACTIVE → ERROR (system error during session)

### trading_trades
Individual buy/sell transaction records within trading sessions.

**Fields**:
- `id` (UUID, Primary Key) - Unique trade identifier
- `run_id` (UUID, Foreign Key) - Links to trading_runs.id
- `user_id` (UUID, Foreign Key) - Links to trading_users.id (nullable for guest)
- `trade_type` (ENUM: buy, sell) - Type of transaction
- `coin_symbol` (TEXT) - Cryptocurrency symbol traded
- `quantity` (DECIMAL) - Amount of cryptocurrency traded
- `price` (DECIMAL) - Price per unit at time of trade
- `total_value` (DECIMAL) - Total trade value (quantity × price)
- `fee` (DECIMAL) - Trading fee applied (simulated)
- `net_value` (DECIMAL) - Total value after fees
- `portfolio_value_before` (DECIMAL) - Portfolio value before this trade
- `portfolio_value_after` (DECIMAL) - Portfolio value after this trade
- `profit_loss` (DECIMAL) - P/L for this specific trade (nullable for buy orders)
- `trade_reason` (ENUM: ai_signal, stop_loss, take_profit, manual) - Why trade was executed
- `ai_confidence` (DECIMAL) - ML model confidence score (0-1)
- `market_price` (DECIMAL) - Actual market price at trade time
- `execution_time` (TIMESTAMPTZ) - When trade was executed
- `created_at` (TIMESTAMPTZ) - Record creation timestamp

**Relationships**:
- N:1 with trading_runs (many trades per run)
- N:1 with trading_users (many trades per user)

**Validation Rules**:
- quantity must be > 0
- price and market_price must be > 0
- ai_confidence must be between 0 and 1
- profit_loss only calculated for sell orders
- execution_time must be within session timeframe

### market_data (cached)
Cached cryptocurrency market data to reduce API calls.

**Fields**:
- `id` (UUID, Primary Key) - Unique record identifier
- `coin_symbol` (TEXT) - Cryptocurrency symbol
- `price_source` (TEXT) - Data provider (e.g., 'coingecko')
- `current_price` (DECIMAL) - Latest price in USD
- `price_change_24h` (DECIMAL) - 24-hour price change percentage
- `volume_24h` (DECIMAL) - 24-hour trading volume
- `market_cap` (DECIMAL) - Current market capitalization
- `sentiment_score` (DECIMAL) - Aggregated sentiment indicator (-1 to 1)
- `fear_greed_index` (INTEGER) - Market fear/greed index (0-100)
- `last_updated` (TIMESTAMPTZ) - When data was last refreshed
- `historical_data` (JSON) - Array of historical price points
- `created_at` (TIMESTAMPTZ) - Record creation timestamp

**Validation Rules**:
- current_price must be > 0
- sentiment_score must be between -1 and 1
- fear_greed_index must be between 0 and 100
- Cache TTL: 30 seconds for current price, 1 hour for historical data

### ai_predictions (optional)
ML model prediction results for audit and improvement.

**Fields**:
- `id` (UUID, Primary Key) - Unique prediction identifier
- `coin_symbol` (TEXT) - Cryptocurrency predicted
- `model_version` (TEXT) - ML model version used
- `input_features` (JSON) - Feature vector used for prediction
- `predicted_price` (DECIMAL) - Model's price prediction
- `predicted_direction` (ENUM: up, down, hold) - Predicted price movement
- `confidence_score` (DECIMAL) - Model confidence (0-1)
- `prediction_horizon` (INTEGER) - Minutes ahead predicted
- `actual_price` (DECIMAL) - Actual price at prediction time (nullable)
- `accuracy_score` (DECIMAL) - Prediction accuracy when resolved (nullable)
- `created_at` (TIMESTAMPTZ) - When prediction was made
- `resolved_at` (TIMESTAMPTZ) - When actual outcome was recorded

**Validation Rules**:
- predicted_price must be > 0
- confidence_score must be between 0 and 1
- prediction_horizon must be > 0 and <= 60 minutes
- accuracy_score calculated when resolved_at is set

## Row Level Security (RLS) Policies

### trading_users
- Users can only read/update their own profile
- Guest users cannot access this table

### trading_runs
- Users can read/write their own runs
- Guest runs (user_id = null) are accessible by session

### trading_trades
- Users can read/write their own trades
- Guest trades follow same pattern as runs

### market_data
- Read-only for all users (public cache)
- Write access restricted to system/admin

### ai_predictions
- Read-only for all users (for transparency)
- Write access restricted to ML inference system

## Indexes for Performance

```sql
-- Critical queries optimization
CREATE INDEX idx_trading_runs_user_created ON trading_runs(user_id, created_at DESC);
CREATE INDEX idx_trading_trades_run_execution ON trading_trades(run_id, execution_time);
CREATE INDEX idx_market_data_symbol_updated ON market_data(coin_symbol, last_updated DESC);
CREATE INDEX idx_ai_predictions_symbol_created ON ai_predictions(coin_symbol, created_at DESC);
```

## Data Retention Policy

- **trading_runs/trading_trades**: Retain indefinitely (portfolio showcase value)
- **market_data**: Historical data kept for 90 days, current data refreshed continuously
- **ai_predictions**: Retain for 30 days for model performance analysis
- **guest sessions**: Expire after 24 hours of inactivity