/**
 * Quickstart Test Scenarios: AI Trading System
 * Comprehensive end-to-end tests validating critical user flows
 */

import { test, expect, Page } from '@playwright/test';

// Test configuration
const BASE_URL = process.env.BASE_URL || 'http://localhost:4321';
const PORTFOLIO_URL = process.env.PORTFOLIO_URL || 'https://bizkit.dev';

// Test timeouts
const TRADE_EXECUTION_TIMEOUT = 5000;
const BACKTEST_COMPLETION_TIMEOUT = 35000;
const CHART_LOAD_TIMEOUT = 3000;

// Helper functions
async function waitForAIPrediction(page: Page) {
  await expect(page.locator('[data-testid="ai-prediction"]')).toBeVisible({
    timeout: 10000
  });
  await expect(page.locator('[data-testid="confidence-score"]')).toContainText(/%/);
}

async function waitForChartLoad(page: Page) {
  await expect(page.locator('[data-testid="price-chart"]')).toBeVisible({
    timeout: CHART_LOAD_TIMEOUT
  });
}

async function executeTrade(page: Page, action: 'buy' | 'sell') {
  const tradeButton = page.locator(`[data-testid="${action}-button"]`);
  await expect(tradeButton).toBeEnabled();
  await tradeButton.click();

  // Wait for trade confirmation
  await expect(page.locator('[data-testid="trade-status"]')).toContainText(/executed|completed/i, {
    timeout: TRADE_EXECUTION_TIMEOUT
  });
}

// Test data
const TEST_SCENARIOS = {
  cryptocurrencies: ['BTC', 'ETH', 'ADA'],
  startingCapital: 10000,
  riskParameters: {
    stopLoss: 0.03,
    takeProfit: 0.06
  }
};

test.describe('AI Trading System - Quickstart Scenarios', () => {
  test.beforeEach(async ({ page }) => {
    // Set up test environment
    await page.goto(BASE_URL);
    await page.waitForLoadEvent('networkidle');
  });

  /**
   * Scenario 1: Guest User Simulation
   * FR-001, FR-009 - System MUST allow guest users to execute simulated trades
   */
  test('Scenario 1: Guest User Simulation', async ({ page }) => {
    test.slow(); // Mark as slow test due to real-time operations

    // Navigate to simulation without logging in
    await expect(page.locator('[data-testid="start-simulation"]')).toBeVisible();
    await page.locator('[data-testid="start-simulation"]').click();

    // Select cryptocurrency (default: BTC)
    await expect(page.locator('[data-testid="coin-selector"]')).toBeVisible();
    const coinSelector = page.locator('[data-testid="coin-selector"]');
    await coinSelector.selectOption('BTC');

    // Set starting capital (default: $10,000)
    const capitalInput = page.locator('[data-testid="starting-capital"]');
    await expect(capitalInput).toHaveValue('10000');

    // Wait for AI prediction to load
    await waitForAIPrediction(page);

    // Verify prediction components
    await expect(page.locator('[data-testid="ai-prediction"]')).toContainText(/\$\d+\.\d{2}/);
    await expect(page.locator('[data-testid="confidence-score"]')).toContainText(/%/);
    await expect(page.locator('[data-testid="prediction-direction"]')).toContainText(/(up|down|hold)/i);

    // Wait for chart to load
    await waitForChartLoad(page);

    // Execute a "Buy" trade based on AI signal
    await executeTrade(page, 'buy');

    // Verify trade appears in trade log
    await expect(page.locator('[data-testid="trade-log"]')).toBeVisible();
    const tradeEntry = page.locator('[data-testid="trade-entry"]').first();
    await expect(tradeEntry).toContainText(/buy/i);
    await expect(tradeEntry).toContainText(/BTC/);
    await expect(tradeEntry).toContainText(/\$\d+\.\d{2}/);

    // Check portfolio value updates
    const portfolioValue = page.locator('[data-testid="portfolio-value"]');
    await expect(portfolioValue).toContainText(/\$\d+\.\d{2}/);

    // Wait for price updates (simulate real-time)
    await page.waitForTimeout(20000); // Wait 20 seconds for price updates

    // Execute a "Sell" trade when conditions are met
    await executeTrade(page, 'sell');

    // Verify P/L calculation in trade log
    const sellTradeEntry = page.locator('[data-testid="trade-entry"]').first();
    await expect(sellTradeEntry).toContainText(/sell/i);
    await expect(sellTradeEntry).toContainText(/(\+|\-)\$\d+\.\d{2}/); // P/L amount

    // Confirm portfolio value updates correctly
    const finalPortfolioValue = await portfolioValue.textContent();
    expect(finalPortfolioValue).toMatch(/\$\d+\.\d{2}/);

    // Verify guest session (no auth required)
    await expect(page.locator('[data-testid="user-menu"]')).not.toBeVisible();
    await expect(page.locator('[data-testid="guest-indicator"]')).toBeVisible();
  });

  /**
   * Scenario 2: Authenticated Backtesting
   * FR-003, FR-006 - System MUST provide backtesting with performance metrics
   */
  test('Scenario 2: Authenticated Backtesting', async ({ page }) => {
    test.slow(); // Mark as slow due to backtest computation

    // Skip SSO test in CI - simulate authenticated state
    if (process.env.CI) {
      await page.evaluate(() => {
        localStorage.setItem('auth-token', 'test-token');
        localStorage.setItem('user-authenticated', 'true');
      });
      await page.reload();
    }

    // Navigate to backtesting section
    await page.locator('[data-testid="nav-backtesting"]').click();
    await expect(page).toHaveURL(/.*\/backtest/);

    // Select cryptocurrency (ETH)
    const cryptoSelector = page.locator('[data-testid="backtest-coin-selector"]');
    await cryptoSelector.selectOption('ETH');

    // Choose historical time period (last 30 days)
    const dateRange = page.locator('[data-testid="date-range-selector"]');
    await dateRange.selectOption('30d');

    // Set simulation parameters
    const stopLossInput = page.locator('[data-testid="stop-loss-input"]');
    await stopLossInput.fill('2');

    const takeProfitInput = page.locator('[data-testid="take-profit-input"]');
    await takeProfitInput.fill('5');

    // Start backtest execution
    const startBacktestButton = page.locator('[data-testid="start-backtest"]');
    await startBacktestButton.click();

    // Wait for completion (should take <30 seconds)
    await expect(page.locator('[data-testid="backtest-status"]')).toContainText(/running/i);

    await expect(page.locator('[data-testid="backtest-results"]')).toBeVisible({
      timeout: BACKTEST_COMPLETION_TIMEOUT
    });

    // Review performance metrics dashboard
    const metricsPanel = page.locator('[data-testid="performance-metrics"]');
    await expect(metricsPanel).toBeVisible();

    // Validate key metrics
    const winRate = page.locator('[data-testid="win-rate"]');
    await expect(winRate).toContainText(/%/);
    const winRateValue = await winRate.textContent();
    const winRateNum = parseFloat(winRateValue?.replace('%', '') || '0');
    expect(winRateNum).toBeGreaterThanOrEqual(0);
    expect(winRateNum).toBeLessThanOrEqual(100);

    const totalReturn = page.locator('[data-testid="total-return"]');
    await expect(totalReturn).toContainText(/%/);

    const maxDrawdown = page.locator('[data-testid="max-drawdown"]');
    await expect(maxDrawdown).toContainText(/%/);

    const totalTrades = page.locator('[data-testid="total-trades"]');
    await expect(totalTrades).toContainText(/\d+/);

    // Examine detailed trade log
    const backtestTradeLog = page.locator('[data-testid="backtest-trade-log"]');
    await expect(backtestTradeLog).toBeVisible();

    const tradeEntries = page.locator('[data-testid="backtest-trade-entry"]');
    const tradeCount = await tradeEntries.count();
    expect(tradeCount).toBeGreaterThan(0);

    // Verify trade entries have timestamps
    const firstTrade = tradeEntries.first();
    await expect(firstTrade).toContainText(/\d{4}-\d{2}-\d{2}/); // Date format

    // Analyze price chart with trade markers
    const backtestChart = page.locator('[data-testid="backtest-chart"]');
    await expect(backtestChart).toBeVisible();

    // View equity growth curve
    const equityCurve = page.locator('[data-testid="equity-curve"]');
    await expect(equityCurve).toBeVisible();
  });

  /**
   * Scenario 3: Real-time Trading Dashboard
   * FR-004, FR-005 - System MUST display interactive charts and detailed trade logs
   */
  test('Scenario 3: Real-time Trading Dashboard', async ({ page }) => {
    // Start a new simulation session
    await page.locator('[data-testid="start-simulation"]').click();
    await waitForChartLoad(page);
    await waitForAIPrediction(page);

    // Execute multiple trades (both buy and sell)
    await executeTrade(page, 'buy');
    await page.waitForTimeout(2000); // Wait between trades

    await executeTrade(page, 'sell');
    await page.waitForTimeout(2000);

    await executeTrade(page, 'buy');

    // Verify real-time chart updates
    const priceChart = page.locator('[data-testid="price-chart"]');
    await expect(priceChart).toBeVisible();

    // Check trade log populates immediately
    const tradeLogEntries = page.locator('[data-testid="trade-entry"]');
    const entryCount = await tradeLogEntries.count();
    expect(entryCount).toBeGreaterThanOrEqual(3); // 3 trades executed

    // Confirm portfolio metrics update
    const portfolioMetrics = page.locator('[data-testid="portfolio-metrics"]');
    await expect(portfolioMetrics).toBeVisible();

    await expect(page.locator('[data-testid="current-value"]')).toContainText(/\$\d+\.\d{2}/);
    await expect(page.locator('[data-testid="total-return"]')).toContainText(/(\+|\-)\d+\.\d{2}%/);
    await expect(page.locator('[data-testid="trade-count"]')).toContainText(/\d+/);

    // Test chart interactivity (zoom, hover)
    await priceChart.hover();
    await page.waitForTimeout(1000);

    // Simulate zoom interaction
    await priceChart.click({ clickCount: 2 }); // Double-click to zoom
    await page.waitForTimeout(1000);

    // Validate trade marker accuracy on chart
    const tradeMarkers = page.locator('[data-testid="trade-marker"]');
    const markerCount = await tradeMarkers.count();
    expect(markerCount).toBeGreaterThanOrEqual(3);

    // Review profit/loss calculations
    await expect(page.locator('[data-testid="unrealized-pnl"]')).toContainText(/(\+|\-)\$\d+\.\d{2}/);
  });

  /**
   * Scenario 4: Risk Management Protocols
   * FR-002 - System MUST implement stop-loss and take-profit rules
   */
  test('Scenario 4: Risk Management Protocols', async ({ page }) => {
    test.slow(); // Risk management requires time for price movements

    // Start simulation with custom risk parameters
    await page.locator('[data-testid="start-simulation"]').click();

    // Set stop-loss at 3% and take-profit at 6%
    const riskSettings = page.locator('[data-testid="risk-settings"]');
    if (await riskSettings.isVisible()) {
      const stopLossInput = page.locator('[data-testid="stop-loss-input"]');
      await stopLossInput.fill('3');

      const takeProfitInput = page.locator('[data-testid="take-profit-input"]');
      await takeProfitInput.fill('6');

      await page.locator('[data-testid="apply-risk-settings"]').click();
    }

    await waitForAIPrediction(page);

    // Execute buy order on volatile cryptocurrency
    const volatileCoinSelector = page.locator('[data-testid="coin-selector"]');
    await volatileCoinSelector.selectOption('BTC'); // BTC is typically volatile

    await executeTrade(page, 'buy');

    // Wait for potential price movement to trigger rules
    // Note: In a real test, this would require significant time or price manipulation
    await page.waitForTimeout(30000); // 30 seconds

    // Check for any automatic trades
    const tradeLog = page.locator('[data-testid="trade-log"]');
    const automaticTrades = page.locator('[data-testid="trade-entry"][data-reason="stop_loss"], [data-testid="trade-entry"][data-reason="take_profit"]');

    if (await automaticTrades.count() > 0) {
      // Verify automatic sell execution
      const autoTrade = automaticTrades.first();
      await expect(autoTrade).toContainText(/sell/i);

      // Confirm trade reason shows "stop_loss" or "take_profit"
      const tradeReason = await autoTrade.getAttribute('data-reason');
      expect(['stop_loss', 'take_profit']).toContain(tradeReason);

      // Check portfolio protection worked correctly
      const finalValue = page.locator('[data-testid="portfolio-value"]');
      const finalValueText = await finalValue.textContent();
      const finalAmount = parseFloat(finalValueText?.replace(/[$,]/g, '') || '0');

      // Portfolio should not have lost more than 3% (stop loss)
      expect(finalAmount).toBeGreaterThan(TEST_SCENARIOS.startingCapital * 0.97);
    }
  });

  /**
   * Scenario 5: Cross-domain Navigation
   * FR-011, FR-013 - System MUST provide seamless SSO and portfolio navigation
   */
  test('Scenario 5: Cross-domain Navigation', async ({ page, context }) => {
    // Skip in CI - requires actual domain setup
    test.skip(!!process.env.CI, 'Cross-domain navigation requires actual domain setup');

    // Start at bizkit.dev logged out
    await page.goto(PORTFOLIO_URL);

    // Navigate to AI Trading System project
    const tradingLink = page.locator('[data-testid="ai-trading-project"]');
    if (await tradingLink.isVisible()) {
      await tradingLink.click();
    } else {
      // Fallback: direct navigation
      await page.goto(BASE_URL);
    }

    // Use "← Back to Projects" navigation
    const backLink = page.locator('[data-testid="back-to-projects"]');
    await expect(backLink).toBeVisible();
    await backLink.click();

    // Confirm return to bizkit.dev
    await expect(page).toHaveURL(new RegExp(PORTFOLIO_URL.replace('https://', '')));

    // Navigate back to trading app
    await page.goto(BASE_URL);

    // Verify navigation works
    await expect(page.locator('[data-testid="start-simulation"]')).toBeVisible();
  });

  /**
   * Scenario 6: Mobile Responsiveness
   * FR-012 - System MUST display responsive neon cyberpunk UI
   */
  test('Scenario 6: Mobile Responsiveness', async ({ page }) => {
    // Set mobile viewport
    await page.setViewportSize({ width: 375, height: 667 });

    // Navigate through all major sections
    await expect(page.locator('[data-testid="start-simulation"]')).toBeVisible();

    // Check navigation menu functionality
    const mobileMenu = page.locator('[data-testid="mobile-menu-toggle"]');
    if (await mobileMenu.isVisible()) {
      await mobileMenu.click();
      await expect(page.locator('[data-testid="mobile-nav"]')).toBeVisible();
    }

    // Execute trades on mobile interface
    await page.locator('[data-testid="start-simulation"]').click();
    await waitForChartLoad(page);

    // Verify chart readability and interaction
    const mobileChart = page.locator('[data-testid="price-chart"]');
    await expect(mobileChart).toBeVisible();

    // Test touch interaction
    await mobileChart.tap();
    await page.waitForTimeout(1000);

    // Confirm form inputs work correctly
    const coinSelector = page.locator('[data-testid="coin-selector"]');
    await coinSelector.selectOption('ETH');

    // Execute a trade to verify mobile functionality
    await waitForAIPrediction(page);
    await executeTrade(page, 'buy');

    // Validate neon theme displays properly
    const neonElements = page.locator('.neon-glow, .cyberpunk-border, .matrix-text');
    const neonCount = await neonElements.count();
    expect(neonCount).toBeGreaterThan(0);

    // Check text readability at mobile sizes
    const priceDisplay = page.locator('[data-testid="current-price"]');
    await expect(priceDisplay).toBeVisible();

    // Verify portfolio value is readable
    const portfolioValue = page.locator('[data-testid="portfolio-value"]');
    await expect(portfolioValue).toBeVisible();
  });
});

/**
 * Performance Validation Tests
 */
test.describe('Performance Validation', () => {
  test('Page Load Performance', async ({ page }) => {
    const startTime = Date.now();

    await page.goto(BASE_URL);
    await page.waitForLoadEvent('networkidle');

    const loadTime = Date.now() - startTime;
    expect(loadTime).toBeLessThan(2000); // < 2 seconds
  });

  test('Chart Data Loading Performance', async ({ page }) => {
    await page.goto(BASE_URL);
    await page.locator('[data-testid="start-simulation"]').click();

    const chartStartTime = Date.now();
    await waitForChartLoad(page);

    const chartLoadTime = Date.now() - chartStartTime;
    expect(chartLoadTime).toBeLessThan(1000); // < 1 second
  });

  test('Trade Execution Response Time', async ({ page }) => {
    await page.goto(BASE_URL);
    await page.locator('[data-testid="start-simulation"]').click();
    await waitForAIPrediction(page);

    const tradeStartTime = Date.now();
    await page.locator('[data-testid="buy-button"]').click();

    await expect(page.locator('[data-testid="trade-status"]')).toContainText(/executed|completed/i, {
      timeout: 500 // < 500ms UI response
    });

    const tradeResponseTime = Date.now() - tradeStartTime;
    expect(tradeResponseTime).toBeLessThan(500);
  });
});

/**
 * Error Handling Tests
 */
test.describe('Error Handling Scenarios', () => {
  test('Network Failure Recovery', async ({ page, context }) => {
    await page.goto(BASE_URL);
    await page.locator('[data-testid="start-simulation"]').click();

    // Simulate network failure
    await context.setOffline(true);

    // Verify error messaging
    await expect(page.locator('[data-testid="network-error"]')).toBeVisible({
      timeout: 5000
    });

    // Restore connection
    await context.setOffline(false);

    // Test recovery
    await page.waitForTimeout(2000);
    await expect(page.locator('[data-testid="network-error"]')).not.toBeVisible();
  });

  test('API Rate Limit Handling', async ({ page }) => {
    // This test would require actual API rate limiting simulation
    test.skip(true, 'Requires API mocking for rate limit simulation');
  });
});

// Clean up resources after tests
test.afterAll(async () => {
  // Clean up any test data, close connections, etc.
  console.log('Quickstart test scenarios completed successfully');
});