/**
 * T081: Performance tests for page load times
 * Testing page load performance with <2s target for all pages
 */

import { test, expect } from '@playwright/test';
import type { Page } from '@playwright/test';

// Performance thresholds (in milliseconds)
const PERFORMANCE_THRESHOLDS = {
  PAGE_LOAD: 2000,           // 2 seconds max page load
  FIRST_CONTENTFUL_PAINT: 800,  // 800ms for first meaningful content
  LARGEST_CONTENTFUL_PAINT: 1500, // 1.5s for largest content
  CUMULATIVE_LAYOUT_SHIFT: 0.1,  // CLS threshold
  TIME_TO_INTERACTIVE: 2000   // 2s for interactive
};

// Pages to test with their expected elements
const PAGES_TO_TEST = [
  {
    url: '/',
    name: 'Home Page',
    criticalElement: 'h1', // Main heading should be visible
    description: 'Landing page with trading system overview'
  },
  {
    url: '/simulation',
    name: 'Simulation Dashboard',
    criticalElement: '[data-testid="trading-chart"]',
    description: 'Main trading simulation interface'
  },
  {
    url: '/backtesting',
    name: 'Backtesting Page',
    criticalElement: '[data-testid="backtest-form"]',
    description: 'Historical backtesting interface'
  },
  {
    url: '/history',
    name: 'Trading History',
    criticalElement: '[data-testid="trade-history"]',
    description: 'Trading history and analytics'
  },
  {
    url: '/profile',
    name: 'User Profile',
    criticalElement: '[data-testid="user-profile"]',
    description: 'User settings and preferences'
  }
];

interface PerformanceMetrics {
  navigationStart: number;
  domContentLoaded: number;
  loadComplete: number;
  firstContentfulPaint: number;
  largestContentfulPaint: number;
  cumulativeLayoutShift: number;
  timeToInteractive: number;
  totalPageSize: number;
  resourceCount: number;
}

interface PageTestResult {
  pageName: string;
  url: string;
  loadTime: number;
  metrics: PerformanceMetrics;
  passed: boolean;
  issues: string[];
}

test.describe('Page Load Performance Tests', () => {
  test.beforeEach(async ({ page }) => {
    // Set viewport to standard desktop size
    await page.setViewportSize({ width: 1440, height: 900 });

    // Enable performance monitoring
    await page.addInitScript(() => {
      // Performance observer to capture metrics
      window.performanceMetrics = {};

      // Capture navigation timing
      window.addEventListener('load', () => {
        const navigation = performance.getEntriesByType('navigation')[0] as PerformanceNavigationTiming;
        window.performanceMetrics.navigationStart = navigation.navigationStart;
        window.performanceMetrics.domContentLoaded = navigation.domContentLoadedEventEnd - navigation.navigationStart;
        window.performanceMetrics.loadComplete = navigation.loadEventEnd - navigation.navigationStart;
      });

      // Capture paint timing
      const paintObserver = new PerformanceObserver((list) => {
        for (const entry of list.getEntries()) {
          if (entry.name === 'first-contentful-paint') {
            window.performanceMetrics.firstContentfulPaint = entry.startTime;
          }
        }
      });
      paintObserver.observe({ entryTypes: ['paint'] });

      // Capture LCP
      const lcpObserver = new PerformanceObserver((list) => {
        const entries = list.getEntries();
        const lastEntry = entries[entries.length - 1];
        window.performanceMetrics.largestContentfulPaint = lastEntry.startTime;
      });
      lcpObserver.observe({ entryTypes: ['largest-contentful-paint'] });

      // Capture CLS
      let clsValue = 0;
      const clsObserver = new PerformanceObserver((list) => {
        for (const entry of list.getEntries()) {
          if (!entry.hadRecentInput) {
            clsValue += entry.value;
          }
        }
        window.performanceMetrics.cumulativeLayoutShift = clsValue;
      });
      clsObserver.observe({ entryTypes: ['layout-shift'] });
    });
  });

  PAGES_TO_TEST.forEach(({ url, name, criticalElement, description }) => {
    test(`${name} should load within performance thresholds`, async ({ page }) => {
      console.log(`\n🧪 Testing ${name} (${url})`);
      console.log(`📝 ${description}`);

      const startTime = Date.now();

      // Navigate to page and wait for critical element
      await test.step(`Navigate to ${name}`, async () => {
        const response = await page.goto(url, {
          waitUntil: 'networkidle',
          timeout: 10000
        });

        expect(response?.status()).toBeLessThan(400);

        // Wait for critical element to ensure page is functional
        await expect(page.locator(criticalElement).first()).toBeVisible({
          timeout: PERFORMANCE_THRESHOLDS.PAGE_LOAD
        });
      });

      const loadTime = Date.now() - startTime;

      // Get performance metrics
      const metrics = await page.evaluate(() => {
        return {
          ...window.performanceMetrics,
          totalPageSize: performance.getEntriesByType('navigation')[0]?.transferSize || 0,
          resourceCount: performance.getEntriesByType('resource').length
        };
      });

      await test.step('Validate Performance Metrics', async () => {
        console.log(`⏱️  Page load time: ${loadTime}ms`);
        console.log(`🎨 First Contentful Paint: ${metrics.firstContentfulPaint}ms`);
        console.log(`🖼️  Largest Contentful Paint: ${metrics.largestContentfulPaint}ms`);
        console.log(`📊 Cumulative Layout Shift: ${metrics.cumulativeLayoutShift}`);
        console.log(`📦 Total page size: ${(metrics.totalPageSize / 1024).toFixed(2)}KB`);
        console.log(`🔗 Resource count: ${metrics.resourceCount}`);

        // Assert performance thresholds
        expect(loadTime).toBeLessThan(PERFORMANCE_THRESHOLDS.PAGE_LOAD);

        if (metrics.firstContentfulPaint) {
          expect(metrics.firstContentfulPaint).toBeLessThan(PERFORMANCE_THRESHOLDS.FIRST_CONTENTFUL_PAINT);
        }

        if (metrics.largestContentfulPaint) {
          expect(metrics.largestContentfulPaint).toBeLessThan(PERFORMANCE_THRESHOLDS.LARGEST_CONTENTFUL_PAINT);
        }

        if (metrics.cumulativeLayoutShift !== undefined) {
          expect(metrics.cumulativeLayoutShift).toBeLessThan(PERFORMANCE_THRESHOLDS.CUMULATIVE_LAYOUT_SHIFT);
        }
      });

      await test.step('Check Resource Optimization', async () => {
        // Get detailed resource information
        const resources = await page.evaluate(() => {
          return performance.getEntriesByType('resource').map(resource => ({
            name: resource.name,
            type: resource.initiatorType,
            size: resource.transferSize,
            duration: resource.duration,
            cached: resource.transferSize === 0 && resource.duration > 0
          }));
        });

        // Analyze resource efficiency
        const imageResources = resources.filter(r => r.type === 'img');
        const jsResources = resources.filter(r => r.type === 'script');
        const cssResources = resources.filter(r => r.type === 'link' || r.name.includes('.css'));

        console.log(`📸 Image resources: ${imageResources.length}`);
        console.log(`⚡ JavaScript resources: ${jsResources.length}`);
        console.log(`🎨 CSS resources: ${cssResources.length}`);

        // Check for excessive resources
        expect(jsResources.length).toBeLessThan(20); // Reasonable JS file limit
        expect(cssResources.length).toBeLessThan(10); // CSS file limit

        // Check for large resources
        const largeResources = resources.filter(r => r.size > 500000); // 500KB+
        if (largeResources.length > 0) {
          console.warn(`⚠️  Large resources found:`, largeResources.map(r => `${r.name} (${(r.size/1024).toFixed(2)}KB)`));
        }
        expect(largeResources.length).toBeLessThan(3); // Max 3 large resources
      });
    });
  });

  test('Performance under simulated slow network', async ({ page }) => {
    console.log('\n🐌 Testing performance under slow 3G conditions');

    // Simulate slow 3G network
    await page.route('**/*', async (route) => {
      await new Promise(resolve => setTimeout(resolve, 100)); // Add 100ms delay
      await route.continue();
    });

    const startTime = Date.now();
    await page.goto('/', { waitUntil: 'networkidle', timeout: 15000 });

    const loadTime = Date.now() - startTime;
    console.log(`🐌 Slow network load time: ${loadTime}ms`);

    // Under slow conditions, allow up to 5 seconds
    expect(loadTime).toBeLessThan(5000);

    // Critical elements should still be visible
    await expect(page.locator('h1').first()).toBeVisible();
  });

  test('Performance with cached resources', async ({ page }) => {
    console.log('\n💾 Testing performance with cached resources');

    // First load - warm up cache
    await page.goto('/', { waitUntil: 'networkidle' });

    // Second load - should be faster with cache
    const startTime = Date.now();
    await page.goto('/', { waitUntil: 'networkidle', timeout: 10000 });
    const cachedLoadTime = Date.now() - startTime;

    console.log(`💾 Cached load time: ${cachedLoadTime}ms`);

    // Cached load should be significantly faster
    expect(cachedLoadTime).toBeLessThan(PERFORMANCE_THRESHOLDS.PAGE_LOAD / 2); // 1 second
  });

  test('JavaScript bundle size analysis', async ({ page }) => {
    console.log('\n📦 Analyzing JavaScript bundle sizes');

    await page.goto('/', { waitUntil: 'networkidle' });

    const bundleInfo = await page.evaluate(() => {
      const scripts = performance.getEntriesByType('resource')
        .filter(r => r.initiatorType === 'script')
        .map(script => ({
          name: script.name.split('/').pop(),
          size: script.transferSize,
          duration: script.duration
        }))
        .sort((a, b) => b.size - a.size);

      const totalJSSize = scripts.reduce((sum, script) => sum + script.size, 0);

      return {
        scripts,
        totalSize: totalJSSize,
        scriptCount: scripts.length
      };
    });

    console.log(`📦 Total JavaScript size: ${(bundleInfo.totalSize / 1024).toFixed(2)}KB`);
    console.log(`📄 JavaScript files: ${bundleInfo.scriptCount}`);

    // Log largest scripts
    bundleInfo.scripts.slice(0, 5).forEach(script => {
      console.log(`  📜 ${script.name}: ${(script.size / 1024).toFixed(2)}KB`);
    });

    // Assert reasonable bundle sizes
    expect(bundleInfo.totalSize).toBeLessThan(1024 * 1024); // 1MB total JS
    expect(bundleInfo.scriptCount).toBeLessThan(15); // Reasonable number of scripts

    // Check for huge individual bundles
    const hugeBundles = bundleInfo.scripts.filter(s => s.size > 300 * 1024); // 300KB+
    if (hugeBundles.length > 0) {
      console.warn('⚠️  Large JavaScript bundles detected:', hugeBundles);
    }
    expect(hugeBundles.length).toBeLessThan(2); // At most 1 large bundle
  });

  test('CSS and styling performance', async ({ page }) => {
    console.log('\n🎨 Testing CSS and styling performance');

    await page.goto('/', { waitUntil: 'networkidle' });

    const styleInfo = await page.evaluate(() => {
      const styleSheets = Array.from(document.styleSheets);
      const linkElements = performance.getEntriesByType('resource')
        .filter(r => r.name.includes('.css') || r.initiatorType === 'link');

      const totalCSSSize = linkElements.reduce((sum, link) => sum + link.transferSize, 0);

      // Count CSS rules
      let totalRules = 0;
      styleSheets.forEach(sheet => {
        try {
          if (sheet.cssRules) {
            totalRules += sheet.cssRules.length;
          }
        } catch (e) {
          // CORS stylesheets may not be accessible
        }
      });

      return {
        stylesheetCount: styleSheets.length,
        totalSize: totalCSSSize,
        totalRules,
        linkResources: linkElements.length
      };
    });

    console.log(`🎨 CSS files: ${styleInfo.linkResources}`);
    console.log(`📐 Total CSS size: ${(styleInfo.totalSize / 1024).toFixed(2)}KB`);
    console.log(`📏 Total CSS rules: ${styleInfo.totalRules}`);

    // Assert reasonable CSS metrics
    expect(styleInfo.totalSize).toBeLessThan(200 * 1024); // 200KB CSS max
    expect(styleInfo.linkResources).toBeLessThan(8); // Reasonable CSS files
    expect(styleInfo.totalRules).toBeLessThan(5000); // CSS rules limit
  });

  test('Memory usage during navigation', async ({ page }) => {
    console.log('\n🧠 Testing memory usage during navigation');

    // Enable memory monitoring
    const client = await page.context().newCDPSession(page);
    await client.send('Performance.enable');

    const initialMemory = await client.send('Performance.getMetrics');
    const initialHeapUsed = initialMemory.metrics.find(m => m.name === 'JSHeapUsedSize')?.value || 0;

    console.log(`🧠 Initial heap size: ${(initialHeapUsed / 1024 / 1024).toFixed(2)}MB`);

    // Navigate through several pages
    const pages = ['/', '/simulation', '/backtesting', '/history'];
    for (const url of pages) {
      await page.goto(url, { waitUntil: 'networkidle' });
      await page.waitForTimeout(500); // Allow for JS execution
    }

    const finalMemory = await client.send('Performance.getMetrics');
    const finalHeapUsed = finalMemory.metrics.find(m => m.name === 'JSHeapUsedSize')?.value || 0;
    const memoryIncrease = finalHeapUsed - initialHeapUsed;

    console.log(`🧠 Final heap size: ${(finalHeapUsed / 1024 / 1024).toFixed(2)}MB`);
    console.log(`📈 Memory increase: ${(memoryIncrease / 1024 / 1024).toFixed(2)}MB`);

    // Memory usage shouldn't grow excessively
    expect(memoryIncrease).toBeLessThan(50 * 1024 * 1024); // 50MB increase limit
    expect(finalHeapUsed).toBeLessThan(100 * 1024 * 1024); // 100MB total limit
  });

  test('Page responsiveness under load', async ({ page }) => {
    console.log('\n⚡ Testing page responsiveness under computational load');

    await page.goto('/simulation', { waitUntil: 'networkidle' });

    // Simulate heavy computation
    const responsivenessBefore = await page.evaluate(() => {
      const start = performance.now();
      // Simulate blocking operation
      let sum = 0;
      for (let i = 0; i < 1000000; i++) {
        sum += Math.random();
      }
      const duration = performance.now() - start;
      return { duration, sum };
    });

    console.log(`⚡ Computation time: ${responsivenessBefore.duration.toFixed(2)}ms`);

    // Page should remain interactive during computation
    const button = page.locator('button').first();
    if (await button.count() > 0) {
      const clickStart = Date.now();
      await button.click();
      const clickDuration = Date.now() - clickStart;

      console.log(`🖱️  Click response time: ${clickDuration}ms`);
      expect(clickDuration).toBeLessThan(100); // Quick click response
    }

    // Check that computation didn't block the main thread excessively
    expect(responsivenessBefore.duration).toBeLessThan(100); // 100ms max for heavy computation
  });
});

test.describe('Performance Regression Tests', () => {
  test('Baseline performance measurement', async ({ page }) => {
    console.log('\n📊 Measuring baseline performance metrics');

    const results: PageTestResult[] = [];

    for (const { url, name } of PAGES_TO_TEST.slice(0, 3)) { // Test first 3 pages
      const startTime = Date.now();

      await page.goto(url, { waitUntil: 'networkidle' });
      const loadTime = Date.now() - startTime;

      const metrics = await page.evaluate(() => window.performanceMetrics || {});

      const result: PageTestResult = {
        pageName: name,
        url,
        loadTime,
        metrics: metrics as PerformanceMetrics,
        passed: loadTime < PERFORMANCE_THRESHOLDS.PAGE_LOAD,
        issues: []
      };

      if (loadTime >= PERFORMANCE_THRESHOLDS.PAGE_LOAD) {
        result.issues.push(`Load time ${loadTime}ms exceeds ${PERFORMANCE_THRESHOLDS.PAGE_LOAD}ms threshold`);
      }

      results.push(result);
      console.log(`📊 ${name}: ${loadTime}ms (${result.passed ? '✅' : '❌'})`);
    }

    // Overall performance summary
    const averageLoadTime = results.reduce((sum, r) => sum + r.loadTime, 0) / results.length;
    const passedCount = results.filter(r => r.passed).length;

    console.log(`\n📈 Performance Summary:`);
    console.log(`   Average load time: ${averageLoadTime.toFixed(2)}ms`);
    console.log(`   Pages passing: ${passedCount}/${results.length}`);
    console.log(`   Success rate: ${(passedCount / results.length * 100).toFixed(1)}%`);

    // At least 80% of pages should meet performance criteria
    expect(passedCount / results.length).toBeGreaterThanOrEqual(0.8);
    expect(averageLoadTime).toBeLessThan(PERFORMANCE_THRESHOLDS.PAGE_LOAD);
  });
});