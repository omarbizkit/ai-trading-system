import { test, expect } from "@playwright/test";

/**
 * T025: Integration test cross-domain SSO navigation
 * Validates seamless SSO between bizkit.dev and ai-trading.bizkit.dev from quickstart.md Scenario 5
 * Must fail until full implementation exists (TDD approach)
 */

test.describe("Cross-domain SSO Navigation - Integration Test", () => {
  test("should provide seamless SSO from bizkit.dev to ai-trading.bizkit.dev", async ({ page, context }) => {
    // This test MUST FAIL initially (TDD approach)

    // Step 1: Start at bizkit.dev logged out
    await page.goto("https://bizkit.dev", { waitUntil: "networkidle" });

    // Verify initially logged out
    const loginButton = page.locator('[data-testid="login-button"]');
    await expect(loginButton).toBeVisible();

    // Step 2: Sign in with Google OAuth
    await loginButton.click();

    // Select Google OAuth option
    const googleSignIn = page.locator('[data-testid="google-signin"]');
    await expect(googleSignIn).toBeVisible();
    await googleSignIn.click();

    // Handle OAuth flow (would normally redirect to Google)
    // For testing, simulate successful OAuth response
    await page.route("**/auth/callback**", route => {
      route.fulfill({
        status: 200,
        headers: {
          "Set-Cookie": "auth-token=mock-jwt-token; Domain=.bizkit.dev; Path=/; HttpOnly; Secure"
        },
        body: JSON.stringify({ success: true, user: { id: "test-user", email: "test@example.com" } })
      });
    });

    // Wait for successful authentication
    const userProfile = page.locator('[data-testid="user-profile"]');
    await expect(userProfile).toBeVisible({ timeout: 10000 });

    // Verify authentication state
    const userMenu = page.locator('[data-testid="user-menu"]');
    await expect(userMenu).toBeVisible();

    // Step 3: Navigate to AI Trading System project
    const projectsSection = page.locator('[data-testid="projects-section"]');
    await expect(projectsSection).toBeVisible();

    const aiTradingProject = page.locator('[data-testid="ai-trading-project"]');
    await expect(aiTradingProject).toBeVisible();
    await aiTradingProject.click();

    // Should navigate to ai-trading.bizkit.dev
    await expect(page).toHaveURL(/ai-trading\.bizkit\.dev/);

    // Step 4: Verify automatic login to ai-trading.bizkit.dev
    // Should not see login prompts
    const tradingLoginButton = page.locator('[data-testid="login-button"]');
    await expect(tradingLoginButton).not.toBeVisible();

    // Should see authenticated user interface
    const tradingUserMenu = page.locator('[data-testid="user-menu"]');
    await expect(tradingUserMenu).toBeVisible();

    // User profile should be accessible
    const tradingUserProfile = page.locator('[data-testid="user-profile"]');
    await expect(tradingUserProfile).toBeVisible();

    // Should show same user information
    const userEmail = page.locator('[data-testid="user-email"]');
    await expect(userEmail).toContainText("test@example.com");

    // Step 5: Use "← Back to Projects" navigation
    const backToProjectsLink = page.locator('[data-testid="back-to-projects"]');
    await expect(backToProjectsLink).toBeVisible();
    await expect(backToProjectsLink).toContainText("← Back to Projects");
    await backToProjectsLink.click();

    // Step 6: Confirm return to bizkit.dev maintains session
    await expect(page).toHaveURL(/bizkit\.dev/);

    // Should still be authenticated
    const portfolioUserMenu = page.locator('[data-testid="user-menu"]');
    await expect(portfolioUserMenu).toBeVisible();

    // No re-authentication required
    const portfolioLoginButton = page.locator('[data-testid="login-button"]');
    await expect(portfolioLoginButton).not.toBeVisible();

    // Step 7: Navigate back to trading app
    await page.locator('[data-testid="ai-trading-project"]').click();

    // Step 8: Verify session persistence
    await expect(page).toHaveURL(/ai-trading\.bizkit\.dev/);

    // Should still be authenticated without any login flow
    const persistentUserMenu = page.locator('[data-testid="user-menu"]');
    await expect(persistentUserMenu).toBeVisible();

    // Can access protected features
    const tradingHistory = page.locator('[data-testid="trading-history"]');
    await expect(tradingHistory).toBeVisible();

    const userSettings = page.locator('[data-testid="user-settings"]');
    await expect(userSettings).toBeVisible();
  });

  test("should handle SSO token refresh across domains", async ({ page, context }) => {
    // Simulate authenticated state with expiring token
    await context.addCookies([
      {
        name: "auth-token",
        value: "expiring-jwt-token",
        domain: ".bizkit.dev",
        path: "/",
        httpOnly: true,
        secure: true,
        expires: Math.floor(Date.now() / 1000) + 300 // Expires in 5 minutes
      }
    ]);

    // Start at trading app
    await page.goto("https://ai-trading.bizkit.dev");

    // Should be authenticated initially
    const userMenu = page.locator('[data-testid="user-menu"]');
    await expect(userMenu).toBeVisible();

    // Simulate token expiration by advancing time
    // In real scenario, this would happen naturally
    await page.route("**/api/user/profile", route => {
      if (route.request().headers()["authorization"]?.includes("expiring-jwt-token")) {
        route.fulfill({
          status: 401,
          body: JSON.stringify({ error: "Token expired" })
        });
      } else {
        route.continue();
      }
    });

    // Navigate to protected feature that would trigger token refresh
    const backtestingTab = page.locator('[data-testid="backtesting-tab"]');
    await backtestingTab.click();

    // Should automatically refresh token without user intervention
    const refreshIndicator = page.locator('[data-testid="token-refresh"]');
    if (await refreshIndicator.isVisible()) {
      await expect(refreshIndicator).not.toBeVisible({ timeout: 5000 });
    }

    // Should maintain authenticated state
    await expect(userMenu).toBeVisible();

    // Protected feature should load successfully
    const backtestingInterface = page.locator('[data-testid="backtesting-interface"]');
    await expect(backtestingInterface).toBeVisible();
  });

  test("should handle SSO logout across domains", async ({ page, context }) => {
    // Start authenticated
    await context.addCookies([
      {
        name: "auth-token",
        value: "valid-jwt-token",
        domain: ".bizkit.dev",
        path: "/",
        httpOnly: true,
        secure: true
      }
    ]);

    await page.goto("https://ai-trading.bizkit.dev");

    // Verify authenticated state
    const userMenu = page.locator('[data-testid="user-menu"]');
    await expect(userMenu).toBeVisible();

    // Logout from trading app
    await userMenu.click();
    const logoutButton = page.locator('[data-testid="logout-button"]');
    await expect(logoutButton).toBeVisible();
    await logoutButton.click();

    // Should be logged out
    const loginButton = page.locator('[data-testid="login-button"]');
    await expect(loginButton).toBeVisible();

    // Navigate back to main portfolio
    const portfolioLink = page.locator('[data-testid="back-to-projects"]');
    await portfolioLink.click();

    await expect(page).toHaveURL(/bizkit\.dev/);

    // Should also be logged out from main site
    const portfolioLoginButton = page.locator('[data-testid="login-button"]');
    await expect(portfolioLoginButton).toBeVisible();

    // Protected features should not be accessible
    const protectedSection = page.locator('[data-testid="protected-section"]');
    await expect(protectedSection).not.toBeVisible();
  });

  test("should handle guest-to-authenticated transition", async ({ page }) => {
    // Start as guest user on trading app
    await page.goto("https://ai-trading.bizkit.dev");

    // Use guest features
    await page.locator('[data-testid="start-simulation"]').click();
    await page.locator('[data-testid="buy-button"]').click();
    await page.locator('[data-testid="confirm-buy"]').click();

    // Verify guest session
    const guestIndicator = page.locator('[data-testid="guest-session"]');
    await expect(guestIndicator).toBeVisible();

    // Try to access feature that requires authentication
    const saveDataButton = page.locator('[data-testid="save-data"]');
    await saveDataButton.click();

    // Should prompt to sign in
    const signInPrompt = page.locator('[data-testid="signin-prompt"]');
    await expect(signInPrompt).toBeVisible();
    await expect(signInPrompt).toContainText("Sign in to save your data");

    // Sign in via SSO
    const signInButton = page.locator('[data-testid="signin-button"]');
    await signInButton.click();

    // Should redirect to bizkit.dev for authentication
    await expect(page).toHaveURL(/bizkit\.dev.*auth/);

    // Complete authentication flow
    const googleSignIn = page.locator('[data-testid="google-signin"]');
    await googleSignIn.click();

    // Should redirect back to trading app
    await expect(page).toHaveURL(/ai-trading\.bizkit\.dev/);

    // Guest session data should be preserved and associated with user
    const tradeLog = page.locator('[data-testid="trade-log"]');
    await expect(tradeLog).toBeVisible();

    const tradeEntries = page.locator('[data-testid="trade-entry"]');
    await expect(tradeEntries).toHaveCount(1); // Previous guest trade should be preserved

    // Should now show authenticated features
    const userMenu = page.locator('[data-testid="user-menu"]');
    await expect(userMenu).toBeVisible();

    const guestIndicatorAfterAuth = page.locator('[data-testid="guest-session"]');
    await expect(guestIndicatorAfterAuth).not.toBeVisible();
  });

  test("should validate cookie domain configuration", async ({ page, context }) => {
    // This test validates the technical SSO implementation

    await page.goto("https://bizkit.dev");

    // Authenticate and verify cookie is set with correct domain
    await page.locator('[data-testid="login-button"]').click();
    await page.locator('[data-testid="google-signin"]').click();

    // Wait for authentication
    await expect(page.locator('[data-testid="user-menu"]')).toBeVisible();

    // Check that cookie is set with .bizkit.dev domain
    const cookies = await context.cookies();
    const authCookie = cookies.find(cookie => cookie.name === "auth-token");

    expect(authCookie).toBeTruthy();
    expect(authCookie!.domain).toBe(".bizkit.dev");
    expect(authCookie!.httpOnly).toBe(true);
    expect(authCookie!.secure).toBe(true);

    // Navigate to subdomain and verify cookie is accessible
    await page.goto("https://ai-trading.bizkit.dev");

    // Should automatically be authenticated due to cookie domain
    const subdomainUserMenu = page.locator('[data-testid="user-menu"]');
    await expect(subdomainUserMenu).toBeVisible();

    // Verify same cookie is accessible on subdomain
    const subdomainCookies = await context.cookies();
    const subdomainAuthCookie = subdomainCookies.find(cookie =>
      cookie.name === "auth-token" && cookie.domain === ".bizkit.dev"
    );

    expect(subdomainAuthCookie).toBeTruthy();
    expect(subdomainAuthCookie!.value).toBe(authCookie!.value);
  });

  test("should handle SSO errors gracefully", async ({ page }) => {
    await page.goto("https://ai-trading.bizkit.dev");

    // Try to access protected feature
    const protectedFeature = page.locator('[data-testid="user-settings"]');
    await protectedFeature.click();

    // Should prompt for authentication
    const authPrompt = page.locator('[data-testid="auth-required"]');
    await expect(authPrompt).toBeVisible();

    await page.locator('[data-testid="signin-button"]').click();

    // Simulate OAuth error
    await page.route("**/auth/callback**", route => {
      route.fulfill({
        status: 400,
        body: JSON.stringify({ error: "OAuth error", message: "Authentication failed" })
      });
    });

    await page.locator('[data-testid="google-signin"]').click();

    // Should handle error gracefully
    const errorMessage = page.locator('[data-testid="auth-error"]');
    await expect(errorMessage).toBeVisible();
    await expect(errorMessage).toContainText("Authentication failed");

    // Should provide retry option
    const retryButton = page.locator('[data-testid="retry-auth"]');
    await expect(retryButton).toBeVisible();

    // Should not break the application
    const backToHomeButton = page.locator('[data-testid="back-to-home"]');
    await expect(backToHomeButton).toBeVisible();
    await backToHomeButton.click();

    // Should return to functioning state
    const homeContent = page.locator('[data-testid="home-content"]');
    await expect(homeContent).toBeVisible();
  });

  test("should maintain session state during navigation", async ({ page, context }) => {
    // Authenticate first
    await context.addCookies([
      {
        name: "auth-token",
        value: "valid-jwt-token",
        domain: ".bizkit.dev",
        path: "/",
        httpOnly: true,
        secure: true
      }
    ]);

    await page.goto("https://ai-trading.bizkit.dev");

    // Start a trading session
    await page.locator('[data-testid="start-simulation"]').click();
    await page.locator('[data-testid="buy-button"]').click();
    await page.locator('[data-testid="confirm-buy"]').click();

    // Navigate to different sections
    const sections = [
      '[data-testid="backtesting-tab"]',
      '[data-testid="history-tab"]',
      '[data-testid="profile-tab"]',
      '[data-testid="dashboard-tab"]'
    ];

    for (const section of sections) {
      await page.locator(section).click();

      // Should maintain authentication throughout navigation
      const userMenu = page.locator('[data-testid="user-menu"]');
      await expect(userMenu).toBeVisible();

      // No authentication challenges should appear
      const loginPrompt = page.locator('[data-testid="login-prompt"]');
      await expect(loginPrompt).not.toBeVisible();
    }

    // Navigate back to external site
    await page.locator('[data-testid="back-to-projects"]').click();
    await expect(page).toHaveURL(/bizkit\.dev/);

    // Should still be authenticated
    const portfolioUserMenu = page.locator('[data-testid="user-menu"]');
    await expect(portfolioUserMenu).toBeVisible();

    // Return to trading app
    await page.locator('[data-testid="ai-trading-project"]').click();

    // Session state should be restored
    const tradingState = page.locator('[data-testid="trading-state"]');
    await expect(tradingState).toBeVisible();

    // Previous trading data should be accessible
    const tradeHistory = page.locator('[data-testid="trade-history"]');
    await expect(tradeHistory).toBeVisible();
  });
});