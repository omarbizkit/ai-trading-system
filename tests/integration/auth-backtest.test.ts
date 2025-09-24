import { test, expect } from "@playwright/test";

/**
 * T022: Integration test authenticated backtesting flow
 * Validates complete authenticated user backtest workflow from quickstart.md Scenario 2
 * Must fail until full implementation exists (TDD approach)
 */

test.describe("Authenticated Backtesting Flow - Integration Test", () => {
  test("should complete full authenticated backtest workflow", async ({ page }) => {
    // This test MUST FAIL initially (TDD approach)

    // Step 1: Navigate from bizkit.dev to maintain SSO session
    // Simulate arriving from main portfolio with active session
    await page.goto("/", {
      extraHTTPHeaders: {
        "X-Test-Session": "authenticated-user-session"
      }
    });

    // Step 2: Verify seamless login state transfer
    const userIndicator = page.locator('[data-testid="user-indicator"]');
    await expect(userIndicator).toBeVisible();
    await expect(userIndicator).toContainText("Welcome"); // Should show user greeting

    const loginButton = page.locator('[data-testid="login-button"]');
    await expect(loginButton).not.toBeVisible(); // Should not show login if authenticated

    // Step 3: Navigate to "Backtesting" section
    const backtestingTab = page.locator('[data-testid="backtesting-tab"]');
    await expect(backtestingTab).toBeVisible();
    await backtestingTab.click();

    // Should navigate to backtesting page
    await expect(page).toHaveURL(/.*backtesting/);

    // Step 4: Select cryptocurrency (ETH)
    const coinSelector = page.locator('[data-testid="backtest-coin-selector"]');
    await expect(coinSelector).toBeVisible();
    await coinSelector.selectOption("ETH");

    // Step 5: Choose historical time period (last 30 days)
    const timePeriodSelector = page.locator('[data-testid="time-period-selector"]');
    await expect(timePeriodSelector).toBeVisible();
    await timePeriodSelector.selectOption("30days");

    // Or use custom date range
    const customDateToggle = page.locator('[data-testid="custom-date-toggle"]');
    if (await customDateToggle.isVisible()) {
      await customDateToggle.click();

      const startDateInput = page.locator('[data-testid="start-date"]');
      const endDateInput = page.locator('[data-testid="end-date"]');

      // Set date range (30 days ago to now)
      const endDate = new Date();
      const startDate = new Date();
      startDate.setDate(endDate.getDate() - 30);

      await startDateInput.fill(startDate.toISOString().split("T")[0]);
      await endDateInput.fill(endDate.toISOString().split("T")[0]);
    }

    // Step 6: Set simulation parameters (stop-loss: 2%, take-profit: 5%)
    const stopLossInput = page.locator('[data-testid="stop-loss-percent"]');
    await expect(stopLossInput).toBeVisible();
    await stopLossInput.fill("2");

    const takeProfitInput = page.locator('[data-testid="take-profit-percent"]');
    await expect(takeProfitInput).toBeVisible();
    await takeProfitInput.fill("5");

    // Step 7: Start backtest execution
    const startBacktestButton = page.locator('[data-testid="start-backtest"]');
    await expect(startBacktestButton).toBeVisible();
    await expect(startBacktestButton).toBeEnabled();
    await startBacktestButton.click();

    // Should show progress indicator
    const progressIndicator = page.locator('[data-testid="backtest-progress"]');
    await expect(progressIndicator).toBeVisible();

    // Step 8: Wait for completion (should take <30 seconds)
    const startTime = Date.now();

    // Wait for completion
    const resultsSection = page.locator('[data-testid="backtest-results"]');
    await expect(resultsSection).toBeVisible({ timeout: 35000 });

    const endTime = Date.now();
    const executionTime = endTime - startTime;

    // Verify performance requirement (<30 seconds)
    expect(executionTime).toBeLessThan(30000);

    // Progress indicator should disappear
    await expect(progressIndicator).not.toBeVisible();

    // Step 9: Review performance metrics dashboard
    const performanceMetrics = page.locator('[data-testid="performance-metrics"]');
    await expect(performanceMetrics).toBeVisible();

    // Validate win rate percentage (0-100%)
    const winRate = page.locator('[data-testid="win-rate"]');
    await expect(winRate).toBeVisible();
    await expect(winRate).toContainText(/%/);

    const winRateText = await winRate.textContent();
    const winRateValue = parseFloat(winRateText!.replace("%", ""));
    expect(winRateValue).toBeGreaterThanOrEqual(0);
    expect(winRateValue).toBeLessThanOrEqual(100);

    // Validate total return percentage (can be negative)
    const totalReturn = page.locator('[data-testid="total-return"]');
    await expect(totalReturn).toBeVisible();
    await expect(totalReturn).toContainText(/%/);

    // Validate maximum drawdown (negative percentage)
    const maxDrawdown = page.locator('[data-testid="max-drawdown"]');
    await expect(maxDrawdown).toBeVisible();
    await expect(maxDrawdown).toContainText(/%/);

    // Validate total trades count
    const totalTrades = page.locator('[data-testid="total-trades"]');
    await expect(totalTrades).toBeVisible();
    await expect(totalTrades).toContainText(/\d+/);

    // Validate final capital calculation
    const finalCapital = page.locator('[data-testid="final-capital"]');
    await expect(finalCapital).toBeVisible();
    await expect(finalCapital).toContainText(/\$\d+/);

    // Step 10: Examine detailed trade log with timestamps
    const tradeLog = page.locator('[data-testid="trade-log"]');
    await expect(tradeLog).toBeVisible();

    const tradeEntries = page.locator('[data-testid="trade-entry"]');
    const tradeCount = await tradeEntries.count();

    // Verify trades count matches metrics
    const totalTradesText = await totalTrades.textContent();
    const expectedTradeCount = parseInt(totalTradesText!);
    expect(tradeCount).toBe(expectedTradeCount);

    if (tradeCount > 0) {
      // Verify first trade entry structure
      const firstTrade = tradeEntries.nth(0);
      await expect(firstTrade).toContainText(/BUY|SELL/);
      await expect(firstTrade).toContainText("ETH");

      // Verify timestamp format
      const timestamp = firstTrade.locator('[data-testid="trade-timestamp"]');
      await expect(timestamp).toBeVisible();
      await expect(timestamp).toContainText(/\d{4}-\d{2}-\d{2}/); // Date format
    }

    // Step 11: Analyze price chart with trade markers
    const priceChart = page.locator('[data-testid="price-chart"]');
    await expect(priceChart).toBeVisible();

    // Verify chart shows price data
    const chartCanvas = page.locator("canvas");
    await expect(chartCanvas).toBeVisible();

    // Verify trade markers on chart
    const tradeMarkers = page.locator('[data-testid="trade-marker"]');
    if (tradeCount > 0) {
      await expect(tradeMarkers).toHaveCount(tradeCount);
    }

    // Step 12: View equity growth curve
    const equityCurve = page.locator('[data-testid="equity-curve"]');
    await expect(equityCurve).toBeVisible();

    // Should show portfolio value progression over time
    const equityChart = equityCurve.locator("canvas");
    await expect(equityChart).toBeVisible();
  });

  test("should validate SSO seamless authentication", async ({ page }) => {
    // Test cross-subdomain authentication
    await page.goto("/", {
      extraHTTPHeaders: {
        "Authorization": "Bearer valid-jwt-token"
      }
    });

    // Should automatically be authenticated
    const userMenu = page.locator('[data-testid="user-menu"]');
    await expect(userMenu).toBeVisible();

    // Should show user profile information
    const userProfile = page.locator('[data-testid="user-profile"]');
    await expect(userProfile).toBeVisible();

    // Should not show any login prompts
    const loginPrompt = page.locator('[data-testid="login-prompt"]');
    await expect(loginPrompt).not.toBeVisible();
  });

  test("should save backtest results to user account", async ({ page }) => {
    await page.goto("/", {
      extraHTTPHeaders: {
        "X-Test-Session": "authenticated-user-session"
      }
    });

    // Navigate to backtesting
    await page.locator('[data-testid="backtesting-tab"]').click();

    // Configure and run backtest
    await page.locator('[data-testid="backtest-coin-selector"]').selectOption("BTC");
    await page.locator('[data-testid="time-period-selector"]').selectOption("7days");
    await page.locator('[data-testid="start-backtest"]').click();

    // Wait for completion
    await expect(page.locator('[data-testid="backtest-results"]')).toBeVisible({ timeout: 35000 });

    // Results should be saved
    const saveIndicator = page.locator('[data-testid="save-indicator"]');
    await expect(saveIndicator).toBeVisible();
    await expect(saveIndicator).toContainText("Saved");

    // Navigate to history to verify saved
    const historyTab = page.locator('[data-testid="history-tab"]');
    await historyTab.click();

    // Should show saved backtest in history
    const backtestHistory = page.locator('[data-testid="backtest-history"]');
    await expect(backtestHistory).toBeVisible();

    const recentBacktest = page.locator('[data-testid="backtest-entry"]').first();
    await expect(recentBacktest).toBeVisible();
    await expect(recentBacktest).toContainText("BTC");
    await expect(recentBacktest).toContainText("backtest");
  });

  test("should handle different cryptocurrency selections", async ({ page }) => {
    await page.goto("/", {
      extraHTTPHeaders: {
        "X-Test-Session": "authenticated-user-session"
      }
    });

    await page.locator('[data-testid="backtesting-tab"]').click();

    const supportedCoins = ["BTC", "ETH", "ADA"];

    for (const coin of supportedCoins) {
      // Select coin
      await page.locator('[data-testid="backtest-coin-selector"]').selectOption(coin);

      // Verify coin is selected
      const selectedValue = await page.locator('[data-testid="backtest-coin-selector"]').inputValue();
      expect(selectedValue).toBe(coin);

      // Verify price data loads for the coin
      const priceDataIndicator = page.locator('[data-testid="price-data-loaded"]');
      await expect(priceDataIndicator).toBeVisible({ timeout: 5000 });
    }
  });

  test("should validate backtest parameter constraints", async ({ page }) => {
    await page.goto("/", {
      extraHTTPHeaders: {
        "X-Test-Session": "authenticated-user-session"
      }
    });

    await page.locator('[data-testid="backtesting-tab"]').click();

    // Test invalid stop-loss (negative)
    await page.locator('[data-testid="stop-loss-percent"]').fill("-5");

    const errorMessage = page.locator('[data-testid="parameter-error"]');
    await expect(errorMessage).toBeVisible();
    await expect(errorMessage).toContainText("Stop loss must be positive");

    // Test invalid take-profit (too high)
    await page.locator('[data-testid="stop-loss-percent"]').fill("2");
    await page.locator('[data-testid="take-profit-percent"]').fill("500");

    await expect(errorMessage).toContainText("Take profit too high");

    // Start backtest button should be disabled
    const startButton = page.locator('[data-testid="start-backtest"]');
    await expect(startButton).toBeDisabled();
  });

  test("should handle large date ranges appropriately", async ({ page }) => {
    await page.goto("/", {
      extraHTTPHeaders: {
        "X-Test-Session": "authenticated-user-session"
      }
    });

    await page.locator('[data-testid="backtesting-tab"]').click();

    // Try to set a very large date range
    await page.locator('[data-testid="custom-date-toggle"]').click();

    const startDate = "2020-01-01";
    const endDate = new Date().toISOString().split("T")[0];

    await page.locator('[data-testid="start-date"]').fill(startDate);
    await page.locator('[data-testid="end-date"]').fill(endDate);

    // Should either warn about performance or limit the range
    const warningMessage = page.locator('[data-testid="date-range-warning"]');
    await expect(warningMessage).toBeVisible();
    await expect(warningMessage).toContainText(/performance|limit/);
  });

  test("should show progress updates during execution", async ({ page }) => {
    await page.goto("/", {
      extraHTTPHeaders: {
        "X-Test-Session": "authenticated-user-session"
      }
    });

    await page.locator('[data-testid="backtesting-tab"]').click();

    // Set up a longer backtest
    await page.locator('[data-testid="backtest-coin-selector"]').selectOption("ETH");
    await page.locator('[data-testid="time-period-selector"]').selectOption("30days");
    await page.locator('[data-testid="start-backtest"]').click();

    // Should show progress indicators
    const progressBar = page.locator('[data-testid="progress-bar"]');
    await expect(progressBar).toBeVisible();

    const progressText = page.locator('[data-testid="progress-text"]');
    await expect(progressText).toBeVisible();
    await expect(progressText).toContainText(/Processing|Analyzing/);

    // Progress should update
    await page.waitForTimeout(5000);
    const updatedProgress = await progressText.textContent();
    expect(updatedProgress).toBeTruthy();

    // Wait for completion
    await expect(page.locator('[data-testid="backtest-results"]')).toBeVisible({ timeout: 35000 });

    // Progress indicators should disappear
    await expect(progressBar).not.toBeVisible();
  });
});