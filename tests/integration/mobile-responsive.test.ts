import { test, expect } from "@playwright/test";

/**
 * T026: Integration test mobile responsiveness
 * Validates mobile responsive design from quickstart.md Scenario 6
 * Must fail until full implementation exists (TDD approach)
 */

test.describe("Mobile Responsiveness - Integration Test", () => {
  // Common mobile viewport sizes
  const mobileViewports = [
    { width: 375, height: 667, name: "iPhone SE" },
    { width: 390, height: 844, name: "iPhone 12/13" },
    { width: 414, height: 896, name: "iPhone 11 Pro Max" },
    { width: 360, height: 640, name: "Android Small" },
    { width: 412, height: 915, name: "Android Large" }
  ];

  const tabletViewports = [
    { width: 768, height: 1024, name: "iPad" },
    { width: 820, height: 1180, name: "iPad Air" },
    { width: 1024, height: 768, name: "iPad Landscape" }
  ];

  test("should display responsive UI across all major mobile devices", async ({ page }) => {
    // This test MUST FAIL initially (TDD approach)

    for (const viewport of mobileViewports) {
      // Step 1: Access site on mobile device
      await page.setViewportSize(viewport);
      await page.goto("/");

      // Step 2: Navigate through all major sections

      // Home page should be mobile-friendly
      const homeContent = page.locator('[data-testid="home-content"]');
      await expect(homeContent).toBeVisible();

      // Navigation should be accessible on mobile
      const mobileNav = page.locator('[data-testid="mobile-nav"]');
      const navToggle = page.locator('[data-testid="nav-toggle"]');

      // Should have either mobile navigation or hamburger menu
      const hasNavigation = await mobileNav.isVisible() || await navToggle.isVisible();
      expect(hasNavigation).toBe(true);

      if (await navToggle.isVisible()) {
        await navToggle.click();
        await expect(mobileNav).toBeVisible();
      }

      // Step 3: Execute trades on mobile interface
      await page.locator('[data-testid="start-simulation"]').click();

      // Trading interface should be mobile-optimized
      const tradingInterface = page.locator('[data-testid="trading-interface"]');
      await expect(tradingInterface).toBeVisible();

      // Check that interface fits within viewport
      const interfaceBounds = await tradingInterface.boundingBox();
      expect(interfaceBounds!.width).toBeLessThanOrEqual(viewport.width);

      // Trade buttons should be touch-friendly (minimum 44px)
      const buyButton = page.locator('[data-testid="buy-button"]');
      const sellButton = page.locator('[data-testid="sell-button"]');

      await expect(buyButton).toBeVisible();
      await expect(sellButton).toBeVisible();

      const buyButtonBounds = await buyButton.boundingBox();
      const sellButtonBounds = await sellButton.boundingBox();

      expect(buyButtonBounds!.height).toBeGreaterThanOrEqual(44);
      expect(sellButtonBounds!.height).toBeGreaterThanOrEqual(44);

      // Execute a trade to test interaction
      await buyButton.click();

      // Trade confirmation should be mobile-friendly
      const confirmDialog = page.locator('[data-testid="confirm-dialog"]');
      await expect(confirmDialog).toBeVisible();

      const confirmButton = page.locator('[data-testid="confirm-buy"]');
      await expect(confirmButton).toBeVisible();

      const confirmBounds = await confirmButton.boundingBox();
      expect(confirmBounds!.height).toBeGreaterThanOrEqual(44);

      await confirmButton.click();

      // Step 4: Verify chart readability and interaction
      const priceChart = page.locator('[data-testid="price-chart"]');
      await expect(priceChart).toBeVisible();

      // Chart should fit mobile screen
      const chartBounds = await priceChart.boundingBox();
      expect(chartBounds!.width).toBeLessThanOrEqual(viewport.width);
      expect(chartBounds!.height).toBeGreaterThan(200); // Minimum readable height

      // Touch interactions should work
      await priceChart.tap();

      // Chart tooltip should appear
      const chartTooltip = page.locator('[data-testid="chart-tooltip"]');
      if (await chartTooltip.isVisible()) {
        // Tooltip should be positioned correctly for mobile
        const tooltipBounds = await chartTooltip.boundingBox();
        expect(tooltipBounds!.x).toBeGreaterThanOrEqual(0);
        expect(tooltipBounds!.x + tooltipBounds!.width).toBeLessThanOrEqual(viewport.width);
      }

      // Step 5: Check navigation menu functionality
      const menuItems = [
        '[data-testid="dashboard-nav"]',
        '[data-testid="backtesting-nav"]',
        '[data-testid="history-nav"]',
        '[data-testid="profile-nav"]'
      ];

      for (const menuItem of menuItems) {
        if (await page.locator(menuItem).isVisible()) {
          await page.locator(menuItem).click();

          // Page should load and be responsive
          const pageContent = page.locator('[data-testid="page-content"]');
          await expect(pageContent).toBeVisible();

          const contentBounds = await pageContent.boundingBox();
          expect(contentBounds!.width).toBeLessThanOrEqual(viewport.width);
        }
      }

      // Step 6: Confirm form inputs work correctly
      const quantityInput = page.locator('[data-testid="trade-quantity"]');
      if (await quantityInput.isVisible()) {
        // Input should be touch-friendly
        const inputBounds = await quantityInput.boundingBox();
        expect(inputBounds!.height).toBeGreaterThanOrEqual(44);

        // Should accept touch input
        await quantityInput.tap();
        await quantityInput.fill("0.5");

        const inputValue = await quantityInput.inputValue();
        expect(inputValue).toBe("0.5");
      }

      // Step 7: Validate neon theme displays properly
      const neonElements = page.locator('[data-testid*="neon"], .neon, [class*="glow"]');
      const neonCount = await neonElements.count();

      if (neonCount > 0) {
        // Neon effects should be visible on mobile
        const firstNeonElement = neonElements.nth(0);
        await expect(firstNeonElement).toBeVisible();

        // Neon colors should be preserved (check computed styles)
        const elementColor = await firstNeonElement.evaluate(el => {
          return window.getComputedStyle(el).color;
        });

        // Should have vibrant colors (not default black/white)
        expect(elementColor).not.toBe("rgb(0, 0, 0)");
        expect(elementColor).not.toBe("rgb(255, 255, 255)");
      }

      console.log(`✓ Mobile responsiveness verified for ${viewport.name} (${viewport.width}x${viewport.height})`);
    }
  });

  test("should handle tablet viewports appropriately", async ({ page }) => {
    for (const viewport of tabletViewports) {
      await page.setViewportSize(viewport);
      await page.goto("/");

      // Tablet should have hybrid mobile/desktop layout
      const layout = page.locator('[data-testid="main-layout"]');
      await expect(layout).toBeVisible();

      // Navigation might be different on tablet
      const tabletNav = page.locator('[data-testid="tablet-nav"]');
      const desktopNav = page.locator('[data-testid="desktop-nav"]');
      const mobileNav = page.locator('[data-testid="mobile-nav"]');

      // Should have appropriate navigation for tablet
      const hasTabletNav = await tabletNav.isVisible() ||
                          await desktopNav.isVisible() ||
                          await mobileNav.isVisible();
      expect(hasTabletNav).toBe(true);

      await page.locator('[data-testid="start-simulation"]').click();

      // Chart should be larger on tablet
      const chart = page.locator('[data-testid="price-chart"]');
      await expect(chart).toBeVisible();

      const chartBounds = await chart.boundingBox();
      expect(chartBounds!.width).toBeGreaterThan(400); // Larger than mobile
      expect(chartBounds!.height).toBeGreaterThan(300);

      // Should support both touch and mouse interactions
      await chart.hover(); // Mouse interaction
      await chart.tap();    // Touch interaction

      console.log(`✓ Tablet responsiveness verified for ${viewport.name} (${viewport.width}x${viewport.height})`);
    }
  });

  test("should handle orientation changes", async ({ page }) => {
    // Start in portrait
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto("/");
    await page.locator('[data-testid="start-simulation"]').click();

    // Verify portrait layout
    const portraitChart = page.locator('[data-testid="price-chart"]');
    await expect(portraitChart).toBeVisible();
    const portraitBounds = await portraitChart.boundingBox();

    // Switch to landscape
    await page.setViewportSize({ width: 844, height: 390 });
    await page.waitForTimeout(1000); // Allow for layout adjustment

    // Chart should adapt to landscape
    const landscapeChart = page.locator('[data-testid="price-chart"]');
    await expect(landscapeChart).toBeVisible();
    const landscapeBounds = await landscapeChart.boundingBox();

    // Chart should be wider in landscape
    expect(landscapeBounds!.width).toBeGreaterThan(portraitBounds!.width);

    // Navigation should adapt
    const landscapeNav = page.locator('[data-testid="nav-container"]');
    await expect(landscapeNav).toBeVisible();

    // Trade controls should remain accessible
    const buyButton = page.locator('[data-testid="buy-button"]');
    const sellButton = page.locator('[data-testid="sell-button"]');

    await expect(buyButton).toBeVisible();
    await expect(sellButton).toBeVisible();

    // Should be able to execute trades in landscape
    await buyButton.click();
    const confirmDialog = page.locator('[data-testid="confirm-dialog"]');
    await expect(confirmDialog).toBeVisible();
  });

  test("should optimize touch interactions", async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 667 });
    await page.goto("/");
    await page.locator('[data-testid="start-simulation"]').click();

    // Test swipe gestures on chart
    const chart = page.locator('[data-testid="price-chart"]');
    await expect(chart).toBeVisible();

    // Simulate swipe left (pan chart)
    await chart.touchscreen.swipe(100, 300, 50, 300, 10);

    // Chart should respond to swipe
    await page.waitForTimeout(500);

    // Test pinch zoom (if supported)
    const chartCanvas = page.locator("canvas");
    if (await chartCanvas.isVisible()) {
      // Simulate pinch gesture
      await chart.touchscreen.tap(200, 300);
      await page.waitForTimeout(100);
    }

    // Test touch interactions on trade log
    const tradeLog = page.locator('[data-testid="trade-log"]');
    if (await tradeLog.isVisible()) {
      // Should be scrollable with touch
      await tradeLog.touchscreen.swipe(200, 400, 200, 200, 10);
    }

    // Test dropdown/select interactions
    const coinSelector = page.locator('[data-testid="coin-selector"]');
    if (await coinSelector.isVisible()) {
      await coinSelector.tap();

      // Dropdown should be touch-friendly
      const dropdown = page.locator('[data-testid="coin-dropdown"]');
      if (await dropdown.isVisible()) {
        const dropdownItems = page.locator('[data-testid="coin-option"]');
        const itemCount = await dropdownItems.count();

        if (itemCount > 0) {
          const firstItem = dropdownItems.nth(0);
          const itemBounds = await firstItem.boundingBox();
          expect(itemBounds!.height).toBeGreaterThanOrEqual(44); // Touch target size
        }
      }
    }
  });

  test("should maintain readability at all screen sizes", async ({ page }) => {
    const testSizes = [
      { width: 320, height: 568, name: "Small Mobile" },
      { width: 375, height: 667, name: "Medium Mobile" },
      { width: 414, height: 896, name: "Large Mobile" },
      { width: 768, height: 1024, name: "Tablet" }
    ];

    for (const size of testSizes) {
      await page.setViewportSize(size);
      await page.goto("/");
      await page.locator('[data-testid="start-simulation"]').click();

      // Check text readability
      const priceDisplay = page.locator('[data-testid="current-price"]');
      await expect(priceDisplay).toBeVisible();

      // Price should be large enough to read
      const fontSize = await priceDisplay.evaluate(el => {
        return window.getComputedStyle(el).fontSize;
      });

      const fontSizeValue = parseFloat(fontSize.replace("px", ""));
      expect(fontSizeValue).toBeGreaterThanOrEqual(14); // Minimum readable size

      // Portfolio value should be prominent
      const portfolioValue = page.locator('[data-testid="portfolio-value"]');
      await expect(portfolioValue).toBeVisible();

      const portfolioFontSize = await portfolioValue.evaluate(el => {
        return window.getComputedStyle(el).fontSize;
      });

      const portfolioFontSizeValue = parseFloat(portfolioFontSize.replace("px", ""));
      expect(portfolioFontSizeValue).toBeGreaterThanOrEqual(16);

      // Trade log entries should be readable
      const tradeEntries = page.locator('[data-testid="trade-entry"]');
      if (await tradeEntries.count() > 0) {
        const firstEntry = tradeEntries.nth(0);
        await expect(firstEntry).toBeVisible();

        const entryBounds = await firstEntry.boundingBox();
        expect(entryBounds!.height).toBeGreaterThanOrEqual(48); // Adequate touch target
      }

      // Buttons should have adequate contrast
      const buyButton = page.locator('[data-testid="buy-button"]');
      const buttonColor = await buyButton.evaluate(el => {
        const styles = window.getComputedStyle(el);
        return {
          color: styles.color,
          backgroundColor: styles.backgroundColor
        };
      });

      // Should have defined colors (not transparent)
      expect(buttonColor.backgroundColor).not.toBe("rgba(0, 0, 0, 0)");

      console.log(`✓ Readability verified for ${size.name} (${size.width}x${size.height})`);
    }
  });

  test("should handle mobile-specific features", async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 667 });
    await page.goto("/");

    // Test mobile-specific navigation patterns
    const mobileMenu = page.locator('[data-testid="mobile-menu"]');
    const hamburgerButton = page.locator('[data-testid="hamburger-menu"]');

    if (await hamburgerButton.isVisible()) {
      await hamburgerButton.click();
      await expect(mobileMenu).toBeVisible();

      // Menu should overlay content
      const menuBounds = await mobileMenu.boundingBox();
      expect(menuBounds!.width).toBeGreaterThan(250); // Adequate menu width

      // Close menu by tapping outside or close button
      const closeButton = page.locator('[data-testid="close-menu"]');
      if (await closeButton.isVisible()) {
        await closeButton.click();
      } else {
        // Tap outside menu to close
        await page.tap(50, 50);
      }

      await expect(mobileMenu).not.toBeVisible();
    }

    // Test pull-to-refresh (if implemented)
    await page.locator('[data-testid="start-simulation"]').click();

    const refreshArea = page.locator('[data-testid="refresh-area"]');
    if (await refreshArea.isVisible()) {
      // Simulate pull-to-refresh gesture
      await refreshArea.touchscreen.swipe(200, 100, 200, 300, 20);

      // Should show refresh indicator
      const refreshIndicator = page.locator('[data-testid="refresh-indicator"]');
      await expect(refreshIndicator).toBeVisible({ timeout: 2000 });
    }

    // Test mobile-optimized modals
    const settingsButton = page.locator('[data-testid="settings-button"]');
    if (await settingsButton.isVisible()) {
      await settingsButton.click();

      const settingsModal = page.locator('[data-testid="settings-modal"]');
      await expect(settingsModal).toBeVisible();

      // Modal should be full-screen or near full-screen on mobile
      const modalBounds = await settingsModal.boundingBox();
      const screenWidth = 375;
      const widthRatio = modalBounds!.width / screenWidth;

      expect(widthRatio).toBeGreaterThan(0.8); // At least 80% of screen width
    }
  });

  test("should handle performance on mobile devices", async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 667 });

    // Measure page load time
    const startTime = Date.now();
    await page.goto("/");
    const loadTime = Date.now() - startTime;

    // Should load reasonably fast on mobile
    expect(loadTime).toBeLessThan(5000); // 5 seconds max for mobile

    // Start simulation and measure interaction performance
    const interactionStart = Date.now();
    await page.locator('[data-testid="start-simulation"]').click();

    // Wait for simulation to be ready
    await page.waitForSelector('[data-testid="buy-button"]');
    const interactionTime = Date.now() - interactionStart;

    expect(interactionTime).toBeLessThan(3000); // 3 seconds max for interaction

    // Test scroll performance
    const tradeLogContainer = page.locator('[data-testid="trade-log-container"]');
    if (await tradeLogContainer.isVisible()) {
      // Generate some content to scroll
      for (let i = 0; i < 3; i++) {
        await page.locator('[data-testid="buy-button"]').click();
        await page.locator('[data-testid="confirm-buy"]').click();
        await page.waitForTimeout(500);
      }

      // Test smooth scrolling
      const scrollStart = Date.now();
      await tradeLogContainer.touchscreen.swipe(200, 400, 200, 100, 10);
      const scrollTime = Date.now() - scrollStart;

      expect(scrollTime).toBeLessThan(1000); // Scroll should be responsive
    }

    // Test chart rendering performance
    const chartContainer = page.locator('[data-testid="price-chart"]');
    await expect(chartContainer).toBeVisible();

    // Chart should render within reasonable time
    const chartCanvas = page.locator("canvas");
    await expect(chartCanvas).toBeVisible({ timeout: 3000 });
  });
});