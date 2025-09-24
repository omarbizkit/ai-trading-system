import { test, expect } from "@playwright/test";

/**
 * T023: Integration test real-time simulation dashboard
 * Validates real-time trading dashboard functionality from quickstart.md Scenario 3
 * Must fail until full implementation exists (TDD approach)
 */

test.describe("Real-time Trading Dashboard - Integration Test", () => {
  test("should display and update real-time trading dashboard", async ({ page }) => {
    // This test MUST FAIL initially (TDD approach)

    // Step 1: Start a new simulation session
    await page.goto("/");
    await page.locator('[data-testid="start-simulation"]').click();

    // Wait for dashboard to load
    const dashboard = page.locator('[data-testid="trading-dashboard"]');
    await expect(dashboard).toBeVisible();

    // Step 2: Execute multiple trades (both buy and sell)

    // First buy trade
    await page.locator('[data-testid="buy-button"]').click();
    await page.locator('[data-testid="confirm-buy"]').click();

    // Wait for trade to process
    await page.waitForTimeout(1000);

    // Second buy trade (different quantity)
    const quantityInput = page.locator('[data-testid="trade-quantity"]');
    await quantityInput.fill("0.25");
    await page.locator('[data-testid="buy-button"]').click();
    await page.locator('[data-testid="confirm-buy"]').click();

    await page.waitForTimeout(1000);

    // Sell trade
    await quantityInput.fill("0.3");
    await page.locator('[data-testid="sell-button"]').click();
    await page.locator('[data-testid="confirm-sell"]').click();

    // Step 3: Verify real-time chart updates
    const priceChart = page.locator('[data-testid="price-chart"]');
    await expect(priceChart).toBeVisible();

    // Chart should show current price data
    const chartCanvas = page.locator("canvas");
    await expect(chartCanvas).toBeVisible();

    // Monitor for chart updates (price updates every 15-30 seconds)
    const initialTimeStamp = await page.locator('[data-testid="chart-timestamp"]').textContent();

    // Wait for price update cycle
    await page.waitForTimeout(16000); // Wait ~15 seconds

    const updatedTimeStamp = await page.locator('[data-testid="chart-timestamp"]').textContent();

    // Chart should update with new price data
    expect(updatedTimeStamp).not.toBe(initialTimeStamp);

    // Step 4: Check trade log populates immediately
    const tradeLog = page.locator('[data-testid="trade-log"]');
    await expect(tradeLog).toBeVisible();

    const tradeEntries = page.locator('[data-testid="trade-entry"]');
    await expect(tradeEntries).toHaveCount(3); // 2 buys + 1 sell

    // Verify trades appear in chronological order (newest first)
    const firstEntry = tradeEntries.nth(0);
    const lastEntry = tradeEntries.nth(2);

    const firstTimestamp = await firstEntry.locator('[data-testid="trade-timestamp"]').textContent();
    const lastTimestamp = await lastEntry.locator('[data-testid="trade-timestamp"]').textContent();

    // First entry should be more recent than last entry
    expect(new Date(firstTimestamp!).getTime()).toBeGreaterThan(new Date(lastTimestamp!).getTime());

    // Step 5: Confirm portfolio metrics update
    const portfolioMetrics = page.locator('[data-testid="portfolio-metrics"]');
    await expect(portfolioMetrics).toBeVisible();

    // Portfolio value should reflect trades
    const portfolioValue = page.locator('[data-testid="portfolio-value"]');
    await expect(portfolioValue).toBeVisible();
    await expect(portfolioValue).toContainText(/\$\d+/);

    // Total trades count
    const totalTrades = page.locator('[data-testid="total-trades"]');
    await expect(totalTrades).toBeVisible();
    await expect(totalTrades).toContainText("3");

    // Current position (should show remaining BTC holdings)
    const currentPosition = page.locator('[data-testid="current-position"]');
    await expect(currentPosition).toBeVisible();
    await expect(currentPosition).toContainText("BTC");

    // Step 6: Test chart interactivity (zoom, hover)

    // Hover over chart to show price details
    const chartArea = page.locator('[data-testid="chart-area"]');
    await chartArea.hover();

    // Should show price tooltip
    const priceTooltip = page.locator('[data-testid="price-tooltip"]');
    await expect(priceTooltip).toBeVisible({ timeout: 2000 });

    // Zoom functionality
    const zoomInButton = page.locator('[data-testid="zoom-in"]');
    if (await zoomInButton.isVisible()) {
      await zoomInButton.click();

      // Chart should respond to zoom
      const zoomLevel = page.locator('[data-testid="zoom-level"]');
      await expect(zoomLevel).toBeVisible();
    }

    // Step 7: Validate trade marker accuracy on chart
    const tradeMarkers = page.locator('[data-testid="trade-marker"]');
    await expect(tradeMarkers).toHaveCount(3); // Should match number of trades

    // Click on a trade marker
    const firstMarker = tradeMarkers.nth(0);
    await firstMarker.click();

    // Should show trade details
    const markerTooltip = page.locator('[data-testid="marker-tooltip"]');
    await expect(markerTooltip).toBeVisible();
    await expect(markerTooltip).toContainText(/BUY|SELL/);
    await expect(markerTooltip).toContainText("BTC");

    // Step 8: Review profit/loss calculations
    const pnlSummary = page.locator('[data-testid="pnl-summary"]');
    await expect(pnlSummary).toBeVisible();

    // Should show realized P/L from the sell trade
    const realizedPnL = page.locator('[data-testid="realized-pnl"]');
    await expect(realizedPnL).toBeVisible();
    await expect(realizedPnL).toContainText(/[+-]\$\d+/);

    // Should show unrealized P/L from remaining holdings
    const unrealizedPnL = page.locator('[data-testid="unrealized-pnl"]');
    await expect(unrealizedPnL).toBeVisible();
    await expect(unrealizedPnL).toContainText(/[+-]\$\d+/);

    // Total P/L should be sum of realized + unrealized
    const totalPnL = page.locator('[data-testid="total-pnl"]');
    await expect(totalPnL).toBeVisible();
    await expect(totalPnL).toContainText(/[+-]\$\d+/);
  });

  test("should handle real-time price data streaming", async ({ page }) => {
    await page.goto("/");
    await page.locator('[data-testid="start-simulation"]').click();

    // Monitor price updates
    const currentPrice = page.locator('[data-testid="current-price"]');
    await expect(currentPrice).toBeVisible();

    const initialPrice = await currentPrice.textContent();

    // Price change indicator
    const priceChange = page.locator('[data-testid="price-change"]');
    await expect(priceChange).toBeVisible();

    // Wait for multiple price update cycles
    let priceUpdates = 0;
    let lastPrice = initialPrice;

    for (let i = 0; i < 3; i++) {
      await page.waitForTimeout(16000); // Wait for price update

      const newPrice = await currentPrice.textContent();
      if (newPrice !== lastPrice) {
        priceUpdates++;
        lastPrice = newPrice;

        // Price change indicator should update
        const changeText = await priceChange.textContent();
        expect(changeText).toMatch(/[+-]\d+\.\d{2}/); // Should show price change
      }
    }

    // Should have received at least one price update
    expect(priceUpdates).toBeGreaterThan(0);

    // Last updated timestamp should be recent
    const lastUpdated = page.locator('[data-testid="last-updated"]');
    await expect(lastUpdated).toBeVisible();

    const lastUpdatedText = await lastUpdated.textContent();
    const lastUpdatedTime = new Date(lastUpdatedText!);
    const now = new Date();
    const timeDiff = now.getTime() - lastUpdatedTime.getTime();

    // Should be updated within last minute
    expect(timeDiff).toBeLessThan(60000);
  });

  test("should show live portfolio performance metrics", async ({ page }) => {
    await page.goto("/");
    await page.locator('[data-testid="start-simulation"]').click();

    // Execute some trades to generate performance data
    await page.locator('[data-testid="buy-button"]').click();
    await page.locator('[data-testid="confirm-buy"]').click();
    await page.waitForTimeout(2000);

    await page.locator('[data-testid="sell-button"]').click();
    await page.locator('[data-testid="confirm-sell"]').click();

    // Performance metrics should update in real-time
    const performancePanel = page.locator('[data-testid="performance-panel"]');
    await expect(performancePanel).toBeVisible();

    // Win rate should be calculated
    const winRate = page.locator('[data-testid="win-rate"]');
    await expect(winRate).toBeVisible();
    await expect(winRate).toContainText(/\d+%/);

    // Average trade size
    const avgTradeSize = page.locator('[data-testid="avg-trade-size"]');
    await expect(avgTradeSize).toBeVisible();

    // Best trade
    const bestTrade = page.locator('[data-testid="best-trade"]');
    await expect(bestTrade).toBeVisible();

    // Worst trade
    const worstTrade = page.locator('[data-testid="worst-trade"]');
    await expect(worstTrade).toBeVisible();

    // Metrics should update as more trades are executed
    await page.locator('[data-testid="buy-button"]').click();
    await page.locator('[data-testid="confirm-buy"]').click();

    // Trade count should increase
    const totalTrades = page.locator('[data-testid="total-trades"]');
    await expect(totalTrades).toContainText("3");
  });

  test("should handle chart responsiveness on different screen sizes", async ({ page }) => {
    // Test desktop view
    await page.setViewportSize({ width: 1920, height: 1080 });
    await page.goto("/");
    await page.locator('[data-testid="start-simulation"]').click();

    const chart = page.locator('[data-testid="price-chart"]');
    await expect(chart).toBeVisible();

    // Chart should be full width on desktop
    const chartBounds = await chart.boundingBox();
    expect(chartBounds!.width).toBeGreaterThan(800);

    // Test tablet view
    await page.setViewportSize({ width: 768, height: 1024 });
    await page.waitForTimeout(1000);

    // Chart should adapt to smaller screen
    const tabletChartBounds = await chart.boundingBox();
    expect(tabletChartBounds!.width).toBeLessThan(chartBounds!.width);

    // Test mobile view
    await page.setViewportSize({ width: 375, height: 667 });
    await page.waitForTimeout(1000);

    // Chart should be optimized for mobile
    const mobileChartBounds = await chart.boundingBox();
    expect(mobileChartBounds!.width).toBeLessThan(400);

    // All chart controls should still be accessible
    const chartControls = page.locator('[data-testid="chart-controls"]');
    await expect(chartControls).toBeVisible();
  });

  test("should handle network interruptions gracefully", async ({ page }) => {
    await page.goto("/");
    await page.locator('[data-testid="start-simulation"]').click();

    // Start monitoring real-time updates
    const connectionStatus = page.locator('[data-testid="connection-status"]');
    await expect(connectionStatus).toContainText(/Connected|Online/);

    // Simulate network interruption
    await page.route("**/api/market/**", route => route.abort());

    // Should detect connection loss
    await expect(connectionStatus).toContainText(/Disconnected|Offline/, { timeout: 10000 });

    // Should show reconnection attempts
    const reconnectIndicator = page.locator('[data-testid="reconnect-indicator"]');
    await expect(reconnectIndicator).toBeVisible();

    // Restore network
    await page.unroute("**/api/market/**");

    // Should automatically reconnect
    await expect(connectionStatus).toContainText(/Connected|Online/, { timeout: 10000 });
    await expect(reconnectIndicator).not.toBeVisible();

    // Price updates should resume
    const currentPrice = page.locator('[data-testid="current-price"]');
    const priceBeforeReconnect = await currentPrice.textContent();

    await page.waitForTimeout(16000); // Wait for price update

    const priceAfterReconnect = await currentPrice.textContent();
    // Price should have updated or at least timestamp should be recent
    const lastUpdated = page.locator('[data-testid="last-updated"]');
    const lastUpdatedText = await lastUpdated.textContent();
    const timeSinceUpdate = Date.now() - new Date(lastUpdatedText!).getTime();
    expect(timeSinceUpdate).toBeLessThan(30000); // Within 30 seconds
  });

  test("should validate chart data integrity", async ({ page }) => {
    await page.goto("/");
    await page.locator('[data-testid="start-simulation"]').click();

    // Execute a trade and verify it appears correctly on chart
    const tradeTime = Date.now();
    await page.locator('[data-testid="buy-button"]').click();
    await page.locator('[data-testid="confirm-buy"]').click();

    // Trade marker should appear on chart
    const tradeMarkers = page.locator('[data-testid="trade-marker"]');
    await expect(tradeMarkers).toHaveCount(1);

    // Click on trade marker to verify details
    await tradeMarkers.nth(0).click();

    const markerTooltip = page.locator('[data-testid="marker-tooltip"]');
    await expect(markerTooltip).toBeVisible();

    // Verify timestamp is accurate
    const tradeTimestamp = markerTooltip.locator('[data-testid="trade-time"]');
    const timestampText = await tradeTimestamp.textContent();
    const tradeTimeFromChart = new Date(timestampText!).getTime();

    // Should be within 5 seconds of when trade was executed
    const timeDifference = Math.abs(tradeTimeFromChart - tradeTime);
    expect(timeDifference).toBeLessThan(5000);

    // Price on chart should match current market price
    const chartPrice = markerTooltip.locator('[data-testid="trade-price"]');
    const currentPrice = page.locator('[data-testid="current-price"]');

    const chartPriceText = await chartPrice.textContent();
    const currentPriceText = await currentPrice.textContent();

    // Prices should be within reasonable range (allowing for real-time fluctuation)
    const chartPriceValue = parseFloat(chartPriceText!.replace("$", ""));
    const currentPriceValue = parseFloat(currentPriceText!.replace("$", ""));
    const priceDifference = Math.abs(chartPriceValue - currentPriceValue);
    const pricePercentDiff = priceDifference / currentPriceValue;

    expect(pricePercentDiff).toBeLessThan(0.05); // Within 5%
  });
});