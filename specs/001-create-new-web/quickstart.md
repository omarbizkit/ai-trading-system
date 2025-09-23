# Quickstart Test Scenarios: AI Trading System

## Overview
This document defines the critical user flows that must be tested to validate the AI Trading System functionality. These scenarios correspond to the acceptance criteria in the feature specification.

## Prerequisites
- Application deployed at `ai-trading.bizkit.dev`
- Supabase database with trading tables initialized
- CoinGecko API access configured
- Test user account with Google OAuth access

## Test Environment Setup
```bash
# Start local development server
npm run dev

# Start containerized test environment
podman-compose up

# Run against production
# Navigate to https://ai-trading.bizkit.dev
```

## Critical User Flows

### Scenario 1: Guest User Simulation
**Acceptance Criteria**: FR-001, FR-009 - System MUST allow guest users to execute simulated trades

**Steps**:
1. Navigate to `ai-trading.bizkit.dev`
2. Click "Start Simulation" without logging in
3. Select cryptocurrency (default: BTC)
4. Set starting capital (default: $10,000)
5. Wait for AI prediction to load
6. Execute a "Buy" trade based on AI signal
7. Monitor real-time price updates (15-30 second intervals)
8. Execute a "Sell" trade when conditions meet
9. Verify trade appears in trade log with P/L calculation
10. Confirm portfolio value updates correctly

**Expected Results**:
- ✅ Guest can access simulation without authentication
- ✅ AI prediction displays with confidence score
- ✅ Trades execute with realistic market prices
- ✅ Portfolio value updates in real-time
- ✅ Trade log shows complete transaction history

**Key Assertions**:
```javascript
// Playwright test assertions
await expect(page.locator('[data-testid="start-simulation"]')).toBeVisible();
await expect(page.locator('[data-testid="ai-prediction"]')).toContainText(/\d+\.\d{2}/);
await expect(page.locator('[data-testid="portfolio-value"]')).toContainText('$');
```

### Scenario 2: Authenticated Backtesting
**Acceptance Criteria**: FR-003, FR-006 - System MUST provide backtesting with performance metrics

**Steps**:
1. Navigate from `bizkit.dev` to maintain SSO session
2. Verify seamless login state transfer
3. Navigate to "Backtesting" section
4. Select cryptocurrency (ETH)
5. Choose historical time period (last 30 days)
6. Set simulation parameters (stop-loss: 2%, take-profit: 5%)
7. Start backtest execution
8. Wait for completion (should take <30 seconds)
9. Review performance metrics dashboard
10. Examine detailed trade log with timestamps
11. Analyze price chart with trade markers
12. View equity growth curve

**Expected Results**:
- ✅ SSO works seamlessly across subdomains
- ✅ Backtest completes within reasonable time
- ✅ Performance metrics calculate correctly
- ✅ Charts display trade markers at correct times
- ✅ Equity curve shows portfolio growth/decline

**Key Metrics to Validate**:
- Win rate percentage (0-100%)
- Total return percentage (can be negative)
- Maximum drawdown (negative percentage)
- Total trades count matches trade log entries
- Final capital = starting capital + total return

### Scenario 3: Real-time Trading Dashboard
**Acceptance Criteria**: FR-004, FR-005 - System MUST display interactive charts and detailed trade logs

**Steps**:
1. Start a new simulation session
2. Execute multiple trades (both buy and sell)
3. Verify real-time chart updates
4. Check trade log populates immediately
5. Confirm portfolio metrics update
6. Test chart interactivity (zoom, hover)
7. Validate trade marker accuracy on chart
8. Review profit/loss calculations

**Expected Results**:
- ✅ Price chart updates every 15-30 seconds
- ✅ Trade markers appear at correct price points
- ✅ Trade log shows complete transaction details
- ✅ Portfolio metrics calculate accurately
- ✅ Chart is interactive and responsive

### Scenario 4: Risk Management Protocols
**Acceptance Criteria**: FR-002 - System MUST implement stop-loss and take-profit rules

**Steps**:
1. Start simulation with custom risk parameters
2. Set stop-loss at 3% and take-profit at 6%
3. Execute buy order on volatile cryptocurrency
4. Wait for price movement to trigger rules
5. Verify automatic sell execution
6. Confirm trade reason shows "stop_loss" or "take_profit"
7. Check portfolio protection worked correctly

**Expected Results**:
- ✅ Automatic trades execute when thresholds hit
- ✅ Trade reasons logged correctly
- ✅ Portfolio protected from excessive losses
- ✅ Take-profit orders secure gains automatically

### Scenario 5: Cross-domain Navigation
**Acceptance Criteria**: FR-011, FR-013 - System MUST provide seamless SSO and portfolio navigation

**Steps**:
1. Start at `bizkit.dev` logged out
2. Sign in with Google OAuth
3. Navigate to AI Trading System project
4. Verify automatic login to `ai-trading.bizkit.dev`
5. Use "← Back to Projects" navigation
6. Confirm return to `bizkit.dev` maintains session
7. Navigate back to trading app
8. Verify session persistence

**Expected Results**:
- ✅ SSO works in both directions
- ✅ No re-authentication required
- ✅ User session persists across navigation
- ✅ Navigation links work correctly

### Scenario 6: Mobile Responsiveness
**Acceptance Criteria**: FR-012 - System MUST display responsive neon cyberpunk UI

**Steps**:
1. Access site on mobile device (or DevTools mobile view)
2. Navigate through all major sections
3. Execute trades on mobile interface
4. Verify chart readability and interaction
5. Check navigation menu functionality
6. Confirm form inputs work correctly
7. Validate neon theme displays properly

**Expected Results**:
- ✅ All functionality accessible on mobile
- ✅ Charts scale appropriately
- ✅ Touch interactions work smoothly
- ✅ Text remains readable at mobile sizes
- ✅ Neon cyberpunk theme maintained

## Performance Validation

### Load Time Targets
- **Initial page load**: < 2 seconds
- **Chart data loading**: < 1 second
- **Trade execution**: < 500ms UI response
- **Backtest completion**: < 30 seconds for 30-day period

### API Rate Limit Handling
- **CoinGecko API**: Verify graceful handling of 30 calls/min limit
- **Error states**: Confirm user-friendly error messages
- **Caching**: Validate local caching reduces API calls

## Error Handling Scenarios

### Network Failures
1. Disconnect internet during simulation
2. Verify error messaging
3. Confirm graceful degradation
4. Test recovery when connection restored

### API Failures
1. Simulate CoinGecko API downtime
2. Verify fallback mechanisms
3. Check cached data usage
4. Confirm user notifications

### Invalid Data
1. Test with malformed market data
2. Verify AI model error handling
3. Check input validation
4. Confirm transaction integrity

## Test Data Requirements

### Market Data
- BTC, ETH, ADA price data for last 90 days
- At least 3 different market sentiment scenarios
- Various volatility periods for testing

### User Accounts
- Test user with Google OAuth
- Guest session capabilities
- Multiple concurrent sessions

### Expected Outcomes
All test scenarios should pass consistently across:
- Chrome, Firefox, Safari browsers
- Desktop and mobile viewports
- Development, staging, and production environments
- Guest and authenticated user sessions

## Automation Setup

### Playwright Configuration
```javascript
// playwright.config.js example
module.exports = {
  testDir: './tests/e2e',
  timeout: 30000,
  use: {
    baseURL: 'http://localhost:4321',
    headless: true,
    screenshot: 'only-on-failure',
  },
  projects: [
    { name: 'desktop', use: { viewport: { width: 1280, height: 720 } } },
    { name: 'mobile', use: { viewport: { width: 375, height: 667 } } },
  ],
};
```

### Test Environment Variables
```bash
SUPABASE_URL=your-test-supabase-url
SUPABASE_ANON_KEY=your-test-anon-key
COINGECKO_API_KEY=your-test-api-key
TEST_USER_EMAIL=test@example.com
TEST_USER_PASSWORD=secure-test-password
```

## Success Criteria Summary
- ✅ All 6 critical user flows pass
- ✅ Performance targets met
- ✅ Error handling works correctly
- ✅ Mobile responsiveness validated
- ✅ Cross-browser compatibility confirmed
- ✅ SSO integration functions properly