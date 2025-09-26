# AI Trading System API Documentation

**Version**: 1.0.0
**Base URL**: https://ai-trading.bizkit.dev/api
**Development**: http://localhost:4321/api

## Overview

The AI Trading System API provides endpoints for cryptocurrency trading simulation, backtesting, and portfolio management. All trading operations use simulated capital only - no real money transactions are supported.

## Authentication

The API uses Bearer token authentication. Include your JWT token in the Authorization header:

```
Authorization: Bearer YOUR_JWT_TOKEN
```

Authentication is required for:
- User profile management
- Trading run operations
- Personal trading history
- Saved preferences

## Base URLs

- **Production**: `https://ai-trading.bizkit.dev/api`
- **Development**: `http://localhost:4321/api`

## Rate Limits

- **Authenticated users**: 100 requests per minute
- **Guest users**: 50 requests per minute
- **Market data**: 30 requests per minute (CoinGecko API limits)

## Error Handling

All API errors follow the standard HTTP status codes with JSON response format:

```json
{
  "error": "Error message",
  "code": "ERROR_CODE",
  "details": {},
  "timestamp": "2025-01-01T12:00:00Z"
}
```

### Common Error Codes

| Status | Code | Description |
|--------|------|-------------|
| 400 | VALIDATION_ERROR | Invalid request parameters |
| 401 | UNAUTHORIZED | Authentication required |
| 403 | FORBIDDEN | Insufficient permissions |
| 404 | NOT_FOUND | Resource not found |
| 429 | RATE_LIMITED | Too many requests |
| 500 | INTERNAL_ERROR | Server error |

---

## User Management

### Get User Profile
```http
GET /api/user/profile
```

**Authentication**: Required

**Response**:
```json
{
  "id": "550e8400-e29b-41d4-a716-446655440000",
  "display_name": "Trading Pro",
  "default_capital": 10000,
  "risk_tolerance": "medium",
  "preferred_coins": ["BTC", "ETH", "ADA"],
  "notification_settings": {
    "email_alerts": false,
    "push_notifications": true,
    "trade_confirmations": true,
    "performance_reports": true
  },
  "created_at": "2025-01-01T00:00:00Z",
  "updated_at": "2025-01-01T12:00:00Z"
}
```

### Update User Profile
```http
PUT /api/user/profile
```

**Authentication**: Required

**Request Body**:
```json
{
  "display_name": "Updated Name",
  "default_capital": 15000,
  "risk_tolerance": "high",
  "preferred_coins": ["BTC", "ETH", "SOL"],
  "notification_settings": {
    "email_alerts": true,
    "push_notifications": true,
    "trade_confirmations": true,
    "performance_reports": false
  }
}
```

**Response**: Updated user profile object

---

## Trading Runs

### Get Trading Runs
```http
GET /api/runs
```

**Authentication**: Required

**Query Parameters**:
- `limit` (optional): Number of runs to return (default: 20, max: 100)
- `offset` (optional): Skip number of runs (default: 0)
- `type` (optional): Filter by session type (`simulation` | `backtest`)
- `coin_symbol` (optional): Filter by cryptocurrency symbol

**Response**:
```json
{
  "runs": [
    {
      "id": "run-123",
      "user_id": "user-456",
      "coin_symbol": "BTC",
      "session_type": "simulation",
      "starting_capital": 10000,
      "final_capital": 11500,
      "total_trades": 15,
      "successful_trades": 9,
      "win_rate": 60.0,
      "total_return": 15.0,
      "max_drawdown": 0.05,
      "session_start": "2025-01-01T00:00:00Z",
      "session_end": "2025-01-01T23:59:59Z",
      "parameters": {
        "risk_per_trade": 2,
        "stop_loss_percent": 5,
        "take_profit_percent": 10,
        "max_positions": 1,
        "min_confidence": 0.7
      }
    }
  ],
  "total": 25,
  "has_more": true
}
```

### Create Trading Run
```http
POST /api/runs
```

**Authentication**: Required

**Request Body**:
```json
{
  "coin_symbol": "BTC",
  "session_type": "simulation",
  "starting_capital": 10000,
  "parameters": {
    "risk_per_trade": 2,
    "stop_loss_percent": 5,
    "take_profit_percent": 10,
    "max_positions": 1,
    "min_confidence": 0.7
  },
  "time_period_start": "2025-01-01T00:00:00Z",
  "time_period_end": "2025-01-10T23:59:59Z"
}
```

**Response**: Created trading run object with `201 Created` status

### Get Trading Run Details
```http
GET /api/runs/{runId}
```

**Authentication**: Required

**Path Parameters**:
- `runId`: UUID of the trading run

**Response**: Single trading run object with detailed metrics

### Update Trading Run
```http
PATCH /api/runs/{runId}
```

**Authentication**: Required

**Request Body** (partial update):
```json
{
  "final_capital": 11500,
  "session_end": "2025-01-01T23:59:59Z",
  "max_drawdown": 0.08
}
```

**Response**: Updated trading run object

---

## Trades

### Get Trades for Run
```http
GET /api/runs/{runId}/trades
```

**Authentication**: Required

**Query Parameters**:
- `limit` (optional): Number of trades to return (default: 50, max: 500)
- `offset` (optional): Skip number of trades (default: 0)
- `trade_type` (optional): Filter by type (`buy` | `sell`)

**Response**:
```json
{
  "trades": [
    {
      "id": "trade-789",
      "run_id": "run-123",
      "user_id": "user-456",
      "trade_type": "buy",
      "coin_symbol": "BTC",
      "quantity": 0.1,
      "price": 50000,
      "total_value": 5000,
      "fee": 5,
      "net_value": 5005,
      "portfolio_value_before": 10000,
      "portfolio_value_after": 4995,
      "profit_loss": null,
      "trade_reason": "ai_signal",
      "ai_confidence": 0.85,
      "execution_time": "2025-01-01T10:30:00Z"
    }
  ],
  "total": 15,
  "summary": {
    "total_volume": 75000,
    "total_profit_loss": 1500,
    "win_rate": 60.0,
    "average_trade_size": 5000
  }
}
```

### Execute Trade
```http
POST /api/runs/{runId}/trades
```

**Authentication**: Required

**Request Body**:
```json
{
  "trade_type": "buy",
  "coin_symbol": "BTC",
  "quantity": 0.1,
  "trade_reason": "ai_signal",
  "ai_confidence": 0.85
}
```

**Response**: Executed trade object with `201 Created` status

---

## Market Data

### Get Current Market Data
```http
GET /api/market/{coinSymbol}
```

**Authentication**: Not required

**Path Parameters**:
- `coinSymbol`: Cryptocurrency symbol (e.g., `BTC`, `ETH`, `ADA`)

**Response**:
```json
{
  "coin_symbol": "BTC",
  "current_price": 50000,
  "price_change_24h": 1000,
  "price_change_percentage_24h": 2.04,
  "volume_24h": 25000000000,
  "market_cap": 950000000000,
  "circulating_supply": 19000000,
  "total_supply": 21000000,
  "fear_greed_index": 65,
  "sentiment_score": 0.2,
  "data_source": "coingecko",
  "last_updated": "2025-01-01T12:00:00Z"
}
```

### Get Historical Market Data
```http
GET /api/market/{coinSymbol}/history
```

**Authentication**: Not required

**Query Parameters**:
- `days` (required): Number of days of history (1-365)
- `interval` (optional): Data interval (`1h` | `4h` | `1d`) - default: `1d`

**Response**:
```json
{
  "coin_symbol": "BTC",
  "interval": "1d",
  "data_points": 30,
  "historical_data": [
    {
      "timestamp": "2025-01-01T00:00:00Z",
      "open": 49500,
      "high": 50500,
      "low": 49000,
      "close": 50000,
      "volume": 1500000000
    }
  ],
  "period_start": "2024-12-01T00:00:00Z",
  "period_end": "2025-01-01T00:00:00Z"
}
```

---

## AI Predictions

### Get AI Prediction
```http
GET /api/predictions/{coinSymbol}
```

**Authentication**: Not required

**Query Parameters**:
- `horizon` (optional): Prediction horizon in minutes (default: 60, max: 1440)

**Response**:
```json
{
  "coin_symbol": "BTC",
  "predicted_price": 51000,
  "predicted_direction": "up",
  "confidence_score": 0.85,
  "prediction_horizon": 60,
  "model_version": "1.2.0",
  "created_at": "2025-01-01T12:00:00Z",
  "input_features": {
    "current_price": 50000,
    "volume_24h": 25000000000,
    "sentiment_score": 0.2,
    "fear_greed_index": 65,
    "technical_indicators": {
      "rsi": 45.0,
      "macd": 120.5,
      "moving_average_20": 49500
    }
  }
}
```

---

## Backtesting

### Run Backtest
```http
POST /api/backtest
```

**Authentication**: Not required for basic backtests

**Request Body**:
```json
{
  "coin_symbol": "BTC",
  "start_date": "2024-01-01T00:00:00Z",
  "end_date": "2024-12-31T23:59:59Z",
  "starting_capital": 10000,
  "parameters": {
    "risk_per_trade": 2,
    "stop_loss_percent": 5,
    "take_profit_percent": 10,
    "max_positions": 1,
    "min_confidence": 0.7,
    "rebalance_frequency": "weekly"
  }
}
```

**Response**:
```json
{
  "backtest_id": "bt-456",
  "status": "running",
  "estimated_completion": "2025-01-01T12:05:00Z",
  "progress_url": "/api/backtest/bt-456/progress"
}
```

### Get Backtest Results
```http
GET /api/backtest/{backtestId}/results
```

**Response**:
```json
{
  "backtest_id": "bt-456",
  "status": "completed",
  "run": {
    "id": "run-789",
    "coin_symbol": "BTC",
    "starting_capital": 10000,
    "final_capital": 12500,
    "period_start": "2024-01-01T00:00:00Z",
    "period_end": "2024-12-31T23:59:59Z"
  },
  "performance": {
    "total_return": 25.0,
    "annualized_return": 25.0,
    "max_drawdown": 8.5,
    "sharpe_ratio": 1.45,
    "win_rate": 65.5,
    "profit_factor": 2.1,
    "total_trades": 142,
    "avg_trade_return": 17.6
  },
  "timeline": [
    {
      "date": "2024-01-01",
      "portfolio_value": 10000,
      "price": 42000,
      "trades": 0
    }
  ]
}
```

---

## Data Models

### TradingUser
- `id`: String (UUID) - User identifier
- `display_name`: String (3-50 chars) - Display name
- `default_capital`: Number (0-1M) - Default starting capital
- `risk_tolerance`: Enum (`low`, `medium`, `high`) - Risk preference
- `preferred_coins`: Array[String] (max 10) - Favorite cryptocurrencies
- `notification_settings`: Object - User notification preferences

### TradingRun
- `id`: String (UUID) - Run identifier
- `user_id`: String (UUID) - Associated user
- `coin_symbol`: String - Cryptocurrency symbol
- `session_type`: Enum (`simulation`, `backtest`) - Run type
- `starting_capital`: Number - Initial capital amount
- `final_capital`: Number - Final portfolio value
- `total_trades`: Number - Number of trades executed
- `win_rate`: Number - Percentage of profitable trades
- `max_drawdown`: Number - Maximum portfolio decline

### Trade
- `id`: String (UUID) - Trade identifier
- `run_id`: String (UUID) - Associated trading run
- `trade_type`: Enum (`buy`, `sell`) - Trade direction
- `coin_symbol`: String - Cryptocurrency symbol
- `quantity`: Number - Amount traded
- `price`: Number - Execution price
- `total_value`: Number - Trade value before fees
- `profit_loss`: Number - Realized profit/loss

### MarketData
- `coin_symbol`: String - Cryptocurrency symbol
- `current_price`: Number - Current market price
- `volume_24h`: Number - 24-hour trading volume
- `market_cap`: Number - Total market capitalization
- `price_change_24h`: Number - 24-hour price change
- `fear_greed_index`: Number (0-100) - Market sentiment indicator

---

## Webhooks (Future)

The API will support webhooks for real-time notifications:

### Available Events
- `trade.executed` - Trade completion
- `run.completed` - Trading run finished
- `prediction.updated` - New AI prediction available
- `price.alert` - Price threshold reached

### Webhook Format
```json
{
  "event": "trade.executed",
  "timestamp": "2025-01-01T12:00:00Z",
  "data": {
    "trade_id": "trade-123",
    "run_id": "run-456",
    "user_id": "user-789"
  }
}
```

---

## SDKs and Libraries

### JavaScript/TypeScript
```bash
npm install @ai-trading/sdk
```

```javascript
import { TradingClient } from '@ai-trading/sdk';

const client = new TradingClient({
  apiKey: 'your-api-key',
  baseUrl: 'https://ai-trading.bizkit.dev/api'
});

const runs = await client.runs.list();
```

### Python (Planned)
```bash
pip install ai-trading-sdk
```

---

## Changelog

### Version 1.0.0 (2025-01-01)
- Initial API release
- User management endpoints
- Trading run operations
- Market data integration
- AI prediction service
- Backtesting engine

### Upcoming Features
- Portfolio optimization endpoints
- Social trading features
- Advanced analytics
- Mobile push notifications
- Real-time WebSocket feeds

---

## Support

- **Documentation**: https://docs.ai-trading.bizkit.dev
- **API Status**: https://status.ai-trading.bizkit.dev
- **GitHub Issues**: https://github.com/ai-trading-system/issues
- **Discord Community**: https://discord.gg/ai-trading

For technical support, please include:
- API endpoint URL
- Request/response examples
- Error messages
- Timestamp of the issue

---

*Last updated: January 1, 2025*