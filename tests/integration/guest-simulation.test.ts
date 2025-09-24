import { test, expect } from "@playwright/test";

/**
 * T021: Integration test guest user simulation flow
 * Validates complete guest user workflow from quickstart.md Scenario 1
 * Must fail until full implementation exists (TDD approach)
 */

test.describe("Guest User Simulation Flow - Integration Test", () => {
  test("should complete full guest simulation workflow", async ({ page }) => {
    // This test MUST FAIL initially (TDD approach)

    // Step 1: Navigate to ai-trading.bizkit.dev
    await page.goto("/");

    // Step 2: Click "Start Simulation" without logging in
    const startSimButton = page.locator('[data-testid="start-simulation"]');
    await expect(startSimButton).toBeVisible();
    await startSimButton.click();

    // Step 3: Select cryptocurrency (default: BTC)
    const coinSelector = page.locator('[data-testid="coin-selector"]');
    await expect(coinSelector).toBeVisible();
    await expect(coinSelector).toHaveValue("BTC"); // Default value

    // Step 4: Set starting capital (default: $10,000)
    const capitalInput = page.locator('[data-testid="starting-capital"]');
    await expect(capitalInput).toBeVisible();
    await expect(capitalInput).toHaveValue("10000");

    // Step 5: Wait for AI prediction to load
    const aiPrediction = page.locator('[data-testid="ai-prediction"]');
    await expect(aiPrediction).toBeVisible();
    await expect(aiPrediction).toContainText(/\$\d+/); // Should show price prediction

    const confidenceScore = page.locator('[data-testid="confidence-score"]');
    await expect(confidenceScore).toBeVisible();
    await expect(confidenceScore).toContainText(/%/); // Should show confidence percentage

    // Step 6: Execute a "Buy" trade based on AI signal
    const buyButton = page.locator('[data-testid="buy-button"]');
    await expect(buyButton).toBeVisible();
    await expect(buyButton).toBeEnabled();
    await buyButton.click();

    // Confirm buy trade
    const confirmBuyButton = page.locator('[data-testid="confirm-buy"]');
    await expect(confirmBuyButton).toBeVisible();
    await confirmBuyButton.click();

    // Verify trade execution
    const tradeNotification = page.locator('[data-testid="trade-notification"]');
    await expect(tradeNotification).toBeVisible();
    await expect(tradeNotification).toContainText("Buy order executed");

    // Step 7: Monitor real-time price updates (15-30 second intervals)
    const currentPrice = page.locator('[data-testid="current-price"]');
    await expect(currentPrice).toBeVisible();

    const initialPrice = await currentPrice.textContent();

    // Wait for price update (simulate real-time updates)
    await page.waitForTimeout(16000); // Wait ~15 seconds

    const updatedPrice = await currentPrice.textContent();
    // Price should be updated or at least DOM should reflect new timestamp
    const lastUpdated = page.locator('[data-testid="last-updated"]');
    await expect(lastUpdated).toBeVisible();

    // Step 8: Execute a "Sell" trade when conditions meet
    const sellButton = page.locator('[data-testid="sell-button"]');
    await expect(sellButton).toBeVisible();
    await expect(sellButton).toBeEnabled();
    await sellButton.click();

    // Confirm sell trade
    const confirmSellButton = page.locator('[data-testid="confirm-sell"]');
    await expect(confirmSellButton).toBeVisible();
    await confirmSellButton.click();

    // Verify sell execution
    await expect(tradeNotification).toContainText("Sell order executed");

    // Step 9: Verify trade appears in trade log with P/L calculation
    const tradeLog = page.locator('[data-testid="trade-log"]');
    await expect(tradeLog).toBeVisible();

    const tradeEntries = page.locator('[data-testid="trade-entry"]');
    await expect(tradeEntries).toHaveCount(2); // Buy and sell trades

    // Verify buy trade entry
    const buyTradeEntry = tradeEntries.nth(0);
    await expect(buyTradeEntry).toContainText("BUY");
    await expect(buyTradeEntry).toContainText("BTC");

    // Verify sell trade entry with P/L
    const sellTradeEntry = tradeEntries.nth(1);
    await expect(sellTradeEntry).toContainText("SELL");
    await expect(sellTradeEntry).toContainText("BTC");

    const profitLoss = sellTradeEntry.locator('[data-testid="profit-loss"]');
    await expect(profitLoss).toBeVisible();
    await expect(profitLoss).toContainText(/[+-]\$\d+/); // Should show profit or loss

    // Step 10: Confirm portfolio value updates correctly
    const portfolioValue = page.locator('[data-testid="portfolio-value"]');
    await expect(portfolioValue).toBeVisible();
    await expect(portfolioValue).toContainText(/\$\d+/);

    const portfolioChange = page.locator('[data-testid="portfolio-change"]');
    await expect(portfolioChange).toBeVisible();
    await expect(portfolioChange).toContainText(/%/); // Should show percentage change

    // Additional validations for guest user specific features

    // Verify no user account features are shown
    const userProfile = page.locator('[data-testid="user-profile"]');
    await expect(userProfile).not.toBeVisible();

    // Verify guest session indicator
    const guestIndicator = page.locator('[data-testid="guest-session"]');
    await expect(guestIndicator).toBeVisible();
    await expect(guestIndicator).toContainText("Guest Session");

    // Verify login prompt for saving data
    const saveDataPrompt = page.locator('[data-testid="save-data-prompt"]');
    await expect(saveDataPrompt).toBeVisible();
    await expect(saveDataPrompt).toContainText("Sign in to save");
  });

  test("should handle AI prediction loading states", async ({ page }) => {
    await page.goto("/");

    // Start simulation
    await page.locator('[data-testid="start-simulation"]').click();

    // Should show loading state while AI prediction loads
    const loadingIndicator = page.locator('[data-testid="ai-loading"]');
    await expect(loadingIndicator).toBeVisible();

    // Wait for prediction to load
    const aiPrediction = page.locator('[data-testid="ai-prediction"]');
    await expect(aiPrediction).toBeVisible({ timeout: 10000 });

    // Loading indicator should disappear
    await expect(loadingIndicator).not.toBeVisible();
  });

  test("should validate trade input constraints", async ({ page }) => {
    await page.goto("/");
    await page.locator('[data-testid="start-simulation"]').click();

    // Wait for simulation to be ready
    await page.waitForSelector('[data-testid="buy-button"]');

    // Try to execute trade with insufficient funds
    const quantityInput = page.locator('[data-testid="trade-quantity"]');
    await quantityInput.fill("999999"); // Impossibly large amount

    const buyButton = page.locator('[data-testid="buy-button"]');
    await buyButton.click();

    // Should show error message
    const errorMessage = page.locator('[data-testid="error-message"]');
    await expect(errorMessage).toBeVisible();
    await expect(errorMessage).toContainText("Insufficient funds");
  });

  test("should persist guest session data temporarily", async ({ page, context }) => {
    await page.goto("/");
    await page.locator('[data-testid="start-simulation"]').click();

    // Wait for simulation to start
    await page.waitForSelector('[data-testid="portfolio-value"]');

    // Execute a trade
    await page.locator('[data-testid="buy-button"]').click();
    await page.locator('[data-testid="confirm-buy"]').click();

    // Get initial portfolio value
    const portfolioValue = await page.locator('[data-testid="portfolio-value"]').textContent();

    // Create new page in same context (simulates tab refresh)
    const newPage = await context.newPage();
    await newPage.goto("/");

    // Session data should persist (in local storage or session storage)
    const persistedPortfolio = newPage.locator('[data-testid="portfolio-value"]');

    // May redirect to continue session or show resume prompt
    const resumeSession = newPage.locator('[data-testid="resume-session"]');
    if (await resumeSession.isVisible()) {
      await resumeSession.click();
    }

    // Portfolio value should be maintained or recoverable
    await expect(persistedPortfolio).toBeVisible();
  });

  test("should show performance metrics during simulation", async ({ page }) => {
    await page.goto("/");
    await page.locator('[data-testid="start-simulation"]').click();

    // Wait for simulation to be ready
    await page.waitForSelector('[data-testid="portfolio-value"]');

    // Execute multiple trades to generate metrics
    await page.locator('[data-testid="buy-button"]').click();
    await page.locator('[data-testid="confirm-buy"]').click();
    await page.waitForTimeout(1000);

    await page.locator('[data-testid="sell-button"]').click();
    await page.locator('[data-testid="confirm-sell"]').click();

    // Verify performance metrics are displayed
    const totalTrades = page.locator('[data-testid="total-trades"]');
    await expect(totalTrades).toBeVisible();
    await expect(totalTrades).toContainText("2");

    const winRate = page.locator('[data-testid="win-rate"]');
    await expect(winRate).toBeVisible();
    await expect(winRate).toContainText(/%/);

    const totalReturn = page.locator('[data-testid="total-return"]');
    await expect(totalReturn).toBeVisible();
    await expect(totalReturn).toContainText(/%/);
  });

  test("should handle network failures gracefully", async ({ page }) => {
    await page.goto("/");
    await page.locator('[data-testid="start-simulation"]').click();

    // Simulate network failure
    await page.route("**/api/market/**", route => route.abort());

    // Should show appropriate error message
    const networkError = page.locator('[data-testid="network-error"]');
    await expect(networkError).toBeVisible({ timeout: 10000 });
    await expect(networkError).toContainText("Connection error");

    // Should offer retry option
    const retryButton = page.locator('[data-testid="retry-button"]');
    await expect(retryButton).toBeVisible();
  });
});