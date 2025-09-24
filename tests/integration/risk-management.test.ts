import { test, expect } from "@playwright/test";

/**
 * T024: Integration test risk management protocols
 * Validates risk management functionality from quickstart.md Scenario 4
 * Must fail until full implementation exists (TDD approach)
 */

test.describe("Risk Management Protocols - Integration Test", () => {
  test("should implement and execute stop-loss and take-profit rules", async ({ page }) => {
    // This test MUST FAIL initially (TDD approach)

    // Step 1: Start simulation with custom risk parameters
    await page.goto("/");
    await page.locator('[data-testid="start-simulation"]').click();

    // Step 2: Set stop-loss at 3% and take-profit at 6%
    const riskSettingsButton = page.locator('[data-testid="risk-settings"]');
    await expect(riskSettingsButton).toBeVisible();
    await riskSettingsButton.click();

    const stopLossInput = page.locator('[data-testid="stop-loss-percent"]');
    await expect(stopLossInput).toBeVisible();
    await stopLossInput.fill("3");

    const takeProfitInput = page.locator('[data-testid="take-profit-percent"]');
    await expect(takeProfitInput).toBeVisible();
    await takeProfitInput.fill("6");

    // Apply settings
    const applySettingsButton = page.locator('[data-testid="apply-risk-settings"]');
    await applySettingsButton.click();

    // Verify settings are applied
    const riskSettingsDisplay = page.locator('[data-testid="risk-settings-display"]');
    await expect(riskSettingsDisplay).toContainText("Stop Loss: 3%");
    await expect(riskSettingsDisplay).toContainText("Take Profit: 6%");

    // Step 3: Execute buy order on volatile cryptocurrency
    const coinSelector = page.locator('[data-testid="coin-selector"]');
    await coinSelector.selectOption("BTC"); // Choose volatile crypto

    await page.locator('[data-testid="buy-button"]').click();
    await page.locator('[data-testid="confirm-buy"]').click();

    // Verify trade is executed
    const tradeNotification = page.locator('[data-testid="trade-notification"]');
    await expect(tradeNotification).toContainText("Buy order executed");

    // Record initial trade details
    const tradeLog = page.locator('[data-testid="trade-log"]');
    await expect(tradeLog).toBeVisible();

    const buyTrade = page.locator('[data-testid="trade-entry"]').first();
    const buyPrice = await buyTrade.locator('[data-testid="trade-price"]').textContent();
    const buyPriceValue = parseFloat(buyPrice!.replace("$", ""));

    // Step 4: Wait for price movement to trigger rules
    // Simulate price changes that would trigger stop-loss or take-profit

    // Monitor for automatic trades
    const initialTradeCount = await page.locator('[data-testid="trade-entry"]').count();
    expect(initialTradeCount).toBe(1); // Only the buy trade initially

    // Mock price changes or wait for real price movement
    // In real implementation, this would involve actual price monitoring

    // For testing, we can simulate triggering conditions
    const simulatePriceChange = page.locator('[data-testid="simulate-price-change"]');
    if (await simulatePriceChange.isVisible()) {
      // Simulate price drop that triggers stop-loss
      await simulatePriceChange.click();
      await page.locator('[data-testid="simulate-drop"]').click();
    }

    // Step 5: Verify automatic sell execution
    // Wait for automatic trade execution (up to 30 seconds)
    await page.waitForFunction(
      () => document.querySelectorAll('[data-testid="trade-entry"]').length > 1,
      { timeout: 30000 }
    );

    const finalTradeCount = await page.locator('[data-testid="trade-entry"]').count();
    expect(finalTradeCount).toBe(2); // Buy + automatic sell

    // Step 6: Confirm trade reason shows "stop_loss" or "take_profit"
    const sellTrade = page.locator('[data-testid="trade-entry"]').first(); // Most recent trade
    const tradeReason = sellTrade.locator('[data-testid="trade-reason"]');
    await expect(tradeReason).toBeVisible();

    const reasonText = await tradeReason.textContent();
    expect(reasonText).toMatch(/stop_loss|take_profit/);

    // Step 7: Check portfolio protection worked correctly
    const portfolioValue = page.locator('[data-testid="portfolio-value"]');
    await expect(portfolioValue).toBeVisible();

    const finalPortfolioText = await portfolioValue.textContent();
    const finalPortfolioValue = parseFloat(finalPortfolioText!.replace("$", "").replace(",", ""));

    // Calculate expected portfolio value based on risk management
    const startingCapital = 10000; // Default starting capital

    if (reasonText!.includes("stop_loss")) {
      // Portfolio should have lost approximately 3%
      const expectedMinValue = startingCapital * 0.95; // Allow some variance
      const expectedMaxValue = startingCapital * 0.99;
      expect(finalPortfolioValue).toBeGreaterThan(expectedMinValue);
      expect(finalPortfolioValue).toBeLessThan(expectedMaxValue);
    } else if (reasonText!.includes("take_profit")) {
      // Portfolio should have gained approximately 6%
      const expectedMinValue = startingCapital * 1.04; // Allow some variance
      const expectedMaxValue = startingCapital * 1.08;
      expect(finalPortfolioValue).toBeGreaterThan(expectedMinValue);
      expect(finalPortfolioValue).toBeLessThan(expectedMaxValue);
    }

    // Verify profit/loss calculation
    const sellPrice = await sellTrade.locator('[data-testid="trade-price"]').textContent();
    const sellPriceValue = parseFloat(sellPrice!.replace("$", ""));

    const profitLoss = sellTrade.locator('[data-testid="profit-loss"]');
    const profitLossText = await profitLoss.textContent();
    const profitLossValue = parseFloat(profitLossText!.replace(/[$+]/, ""));

    // Verify P/L calculation is correct
    const expectedProfitLoss = (sellPriceValue - buyPriceValue) / buyPriceValue;

    if (reasonText!.includes("stop_loss")) {
      expect(expectedProfitLoss).toBeLessThan(-0.025); // At least 2.5% loss
      expect(profitLossValue).toBeLessThan(0);
    } else if (reasonText!.includes("take_profit")) {
      expect(expectedProfitLoss).toBeGreaterThan(0.05); // At least 5% gain
      expect(profitLossValue).toBeGreaterThan(0);
    }
  });

  test("should handle multiple positions with individual risk management", async ({ page }) => {
    await page.goto("/");
    await page.locator('[data-testid="start-simulation"]').click();

    // Set risk parameters
    await page.locator('[data-testid="risk-settings"]').click();
    await page.locator('[data-testid="stop-loss-percent"]').fill("2");
    await page.locator('[data-testid="take-profit-percent"]').fill("4");
    await page.locator('[data-testid="apply-risk-settings"]').click();

    // Execute multiple buy trades with different coins
    await page.locator('[data-testid="coin-selector"]').selectOption("BTC");
    await page.locator('[data-testid="trade-quantity"]').fill("0.1");
    await page.locator('[data-testid="buy-button"]').click();
    await page.locator('[data-testid="confirm-buy"]').click();
    await page.waitForTimeout(1000);

    await page.locator('[data-testid="coin-selector"]').selectOption("ETH");
    await page.locator('[data-testid="trade-quantity"]').fill("2");
    await page.locator('[data-testid="buy-button"]').click();
    await page.locator('[data-testid="confirm-buy"]').click();

    // Verify positions are tracked separately
    const positionsPanel = page.locator('[data-testid="positions-panel"]');
    await expect(positionsPanel).toBeVisible();

    const btcPosition = page.locator('[data-testid="position-BTC"]');
    const ethPosition = page.locator('[data-testid="position-ETH"]');

    await expect(btcPosition).toBeVisible();
    await expect(ethPosition).toBeVisible();

    // Each position should show its own stop-loss and take-profit levels
    const btcStopLoss = btcPosition.locator('[data-testid="stop-loss-level"]');
    const btcTakeProfit = btcPosition.locator('[data-testid="take-profit-level"]');

    await expect(btcStopLoss).toBeVisible();
    await expect(btcTakeProfit).toBeVisible();

    // Risk management should trigger independently for each position
    // This would require price simulation or real price monitoring
  });

  test("should allow dynamic risk parameter adjustments", async ({ page }) => {
    await page.goto("/");
    await page.locator('[data-testid="start-simulation"]').click();

    // Execute initial trade
    await page.locator('[data-testid="buy-button"]').click();
    await page.locator('[data-testid="confirm-buy"]').click();

    // Adjust risk parameters after trade execution
    await page.locator('[data-testid="risk-settings"]').click();
    await page.locator('[data-testid="stop-loss-percent"]').fill("5"); // More conservative
    await page.locator('[data-testid="take-profit-percent"]').fill("10"); // Higher target
    await page.locator('[data-testid="apply-risk-settings"]').click();

    // Verify settings are updated for existing positions
    const positionDetails = page.locator('[data-testid="position-details"]');
    await expect(positionDetails).toContainText("Stop Loss: 5%");
    await expect(positionDetails).toContainText("Take Profit: 10%");

    // New risk levels should apply to existing positions
    const stopLossLevel = page.locator('[data-testid="stop-loss-level"]');
    const takeProfitLevel = page.locator('[data-testid="take-profit-level"]');

    await expect(stopLossLevel).toBeVisible();
    await expect(takeProfitLevel).toBeVisible();
  });

  test("should validate risk parameter constraints", async ({ page }) => {
    await page.goto("/");
    await page.locator('[data-testid="start-simulation"]').click();

    await page.locator('[data-testid="risk-settings"]').click();

    // Test invalid stop-loss (negative)
    await page.locator('[data-testid="stop-loss-percent"]').fill("-5");
    const errorMessage = page.locator('[data-testid="risk-error"]');
    await expect(errorMessage).toBeVisible();
    await expect(errorMessage).toContainText("Stop loss must be positive");

    // Test invalid take-profit (lower than stop-loss)
    await page.locator('[data-testid="stop-loss-percent"]').fill("10");
    await page.locator('[data-testid="take-profit-percent"]').fill("5");
    await expect(errorMessage).toContainText("Take profit must be greater than stop loss");

    // Test extreme values
    await page.locator('[data-testid="stop-loss-percent"]').fill("50");
    await expect(errorMessage).toContainText("Stop loss too high");

    // Apply button should be disabled for invalid settings
    const applyButton = page.locator('[data-testid="apply-risk-settings"]');
    await expect(applyButton).toBeDisabled();

    // Valid settings should enable apply button
    await page.locator('[data-testid="stop-loss-percent"]').fill("3");
    await page.locator('[data-testid="take-profit-percent"]').fill("6");
    await expect(applyButton).toBeEnabled();
  });

  test("should show risk management analytics", async ({ page }) => {
    await page.goto("/");
    await page.locator('[data-testid="start-simulation"]').click();

    // Set risk parameters and execute trades
    await page.locator('[data-testid="risk-settings"]').click();
    await page.locator('[data-testid="stop-loss-percent"]').fill("2");
    await page.locator('[data-testid="take-profit-percent"]').fill("5");
    await page.locator('[data-testid="apply-risk-settings"]').click();

    // Execute multiple trades to generate risk data
    for (let i = 0; i < 3; i++) {
      await page.locator('[data-testid="buy-button"]').click();
      await page.locator('[data-testid="confirm-buy"]').click();
      await page.waitForTimeout(1000);

      // Simulate immediate sell to generate completed trades
      await page.locator('[data-testid="sell-button"]').click();
      await page.locator('[data-testid="confirm-sell"]').click();
      await page.waitForTimeout(1000);
    }

    // View risk analytics
    const riskAnalytics = page.locator('[data-testid="risk-analytics"]');
    await expect(riskAnalytics).toBeVisible();

    // Risk-adjusted return metrics
    const sharpeRatio = page.locator('[data-testid="sharpe-ratio"]');
    await expect(sharpeRatio).toBeVisible();

    const maxDrawdown = page.locator('[data-testid="max-drawdown"]');
    await expect(maxDrawdown).toBeVisible();

    // Risk management effectiveness
    const stopLossTriggered = page.locator('[data-testid="stop-loss-triggered"]');
    const takeProfitTriggered = page.locator('[data-testid="take-profit-triggered"]');

    await expect(stopLossTriggered).toBeVisible();
    await expect(takeProfitTriggered).toBeVisible();

    // Average loss per stop-loss trade
    const avgStopLossImpact = page.locator('[data-testid="avg-stop-loss-impact"]');
    await expect(avgStopLossImpact).toBeVisible();

    // Average gain per take-profit trade
    const avgTakeProfitGain = page.locator('[data-testid="avg-take-profit-gain"]');
    await expect(avgTakeProfitGain).toBeVisible();
  });

  test("should handle extreme market conditions", async ({ page }) => {
    await page.goto("/");
    await page.locator('[data-testid="start-simulation"]').click();

    // Set tight risk parameters
    await page.locator('[data-testid="risk-settings"]').click();
    await page.locator('[data-testid="stop-loss-percent"]').fill("1"); // Very tight
    await page.locator('[data-testid="take-profit-percent"]').fill("2");
    await page.locator('[data-testid="apply-risk-settings"]').click();

    await page.locator('[data-testid="buy-button"]').click();
    await page.locator('[data-testid="confirm-buy"]').click();

    // Simulate extreme price volatility
    const simulateVolatility = page.locator('[data-testid="simulate-volatility"]');
    if (await simulateVolatility.isVisible()) {
      await simulateVolatility.click();
    }

    // Risk management should still function correctly
    const riskStatus = page.locator('[data-testid="risk-status"]');
    await expect(riskStatus).toBeVisible();
    await expect(riskStatus).toContainText(/Active|Monitoring/);

    // Should not allow trades that would exceed risk limits
    const portfolioValue = page.locator('[data-testid="portfolio-value"]');
    await expect(portfolioValue).toBeVisible();

    // Try to make a large trade that would exceed risk tolerance
    await page.locator('[data-testid="trade-quantity"]').fill("10"); // Large quantity
    const buyButton = page.locator('[data-testid="buy-button"]');

    // Should show risk warning or disable trade
    const riskWarning = page.locator('[data-testid="risk-warning"]');
    if (await riskWarning.isVisible()) {
      await expect(riskWarning).toContainText("Risk limit");
    } else {
      // Button should be disabled for high-risk trades
      await expect(buyButton).toBeDisabled();
    }
  });

  test("should provide real-time risk monitoring", async ({ page }) => {
    await page.goto("/");
    await page.locator('[data-testid="start-simulation"]').click();

    // Enable risk monitoring
    await page.locator('[data-testid="risk-settings"]').click();
    await page.locator('[data-testid="stop-loss-percent"]').fill("3");
    await page.locator('[data-testid="take-profit-percent"]').fill("6");
    await page.locator('[data-testid="enable-monitoring"]').check();
    await page.locator('[data-testid="apply-risk-settings"]').click();

    await page.locator('[data-testid="buy-button"]').click();
    await page.locator('[data-testid="confirm-buy"]').click();

    // Risk monitor should show active position
    const riskMonitor = page.locator('[data-testid="risk-monitor"]');
    await expect(riskMonitor).toBeVisible();

    // Current position risk
    const positionRisk = page.locator('[data-testid="position-risk"]');
    await expect(positionRisk).toBeVisible();
    await expect(positionRisk).toContainText(/%/); // Should show risk percentage

    // Distance to stop-loss and take-profit
    const distanceToStopLoss = page.locator('[data-testid="distance-stop-loss"]');
    const distanceToTakeProfit = page.locator('[data-testid="distance-take-profit"]');

    await expect(distanceToStopLoss).toBeVisible();
    await expect(distanceToTakeProfit).toBeVisible();

    // Real-time price alerts
    const priceAlerts = page.locator('[data-testid="price-alerts"]');
    await expect(priceAlerts).toBeVisible();

    // Monitor updates as price changes
    await page.waitForTimeout(16000); // Wait for price update

    // Risk metrics should update
    const updatedRisk = await positionRisk.textContent();
    expect(updatedRisk).toMatch(/\d+\.\d{1,2}%/);
  });
});