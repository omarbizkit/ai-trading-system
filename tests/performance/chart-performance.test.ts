/**
 * T082: Performance tests for chart rendering
 * Testing chart rendering performance with large datasets and interactions
 */

import { test, expect } from '@playwright/test';
import type { Page } from '@playwright/test';

// Chart performance thresholds (in milliseconds)
const CHART_THRESHOLDS = {
  INITIAL_RENDER: 1000,     // 1s for initial chart render
  DATA_UPDATE: 200,         // 200ms for data updates
  ZOOM_INTERACTION: 100,    // 100ms for zoom response
  PAN_INTERACTION: 50,      // 50ms for pan response
  RESIZE_RESPONSE: 200,     // 200ms for resize response
  ANIMATION_FRAME: 16.67    // 60fps = 16.67ms per frame
};

// Test data configurations
const TEST_DATA_SIZES = {
  SMALL: 100,      // 100 data points
  MEDIUM: 1000,    // 1k data points
  LARGE: 5000,     // 5k data points
  XLARGE: 10000    // 10k data points (stress test)
};

interface ChartPerformanceMetrics {
  renderTime: number;
  frameRate: number;
  memoryUsage: number;
  canvasOperations: number;
  dataPointsRendered: number;
  interactionLatency: number;
}

// Mock data generators
function generateOHLCData(count: number, startPrice: number = 50000): Array<{
  time: number;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
}> {
  const data = [];
  let currentPrice = startPrice;
  const baseTime = Date.now() - (count * 60 * 1000); // 1 minute intervals

  for (let i = 0; i < count; i++) {
    const volatility = 0.02; // 2% volatility
    const change = (Math.random() - 0.5) * volatility;

    const open = currentPrice;
    const close = open * (1 + change);
    const high = Math.max(open, close) * (1 + Math.random() * 0.01);
    const low = Math.min(open, close) * (1 - Math.random() * 0.01);

    data.push({
      time: baseTime + (i * 60 * 1000),
      open,
      high,
      low,
      close,
      volume: Math.random() * 1000000
    });

    currentPrice = close;
  }

  return data;
}

test.describe('Chart Rendering Performance', () => {
  test.beforeEach(async ({ page }) => {
    // Set up performance monitoring
    await page.addInitScript(() => {
      // Performance monitoring utilities
      window.chartPerformance = {
        renderTimes: [],
        frameRates: [],
        memorySnapshots: []
      };

      // Monitor frame rate
      let frameCount = 0;
      let lastFrameTime = performance.now();

      function countFrames() {
        frameCount++;
        const now = performance.now();
        const deltaTime = now - lastFrameTime;

        if (deltaTime >= 1000) { // Every second
          const fps = (frameCount * 1000) / deltaTime;
          window.chartPerformance.frameRates.push(fps);
          frameCount = 0;
          lastFrameTime = now;
        }

        requestAnimationFrame(countFrames);
      }
      countFrames();

      // Monitor memory usage
      setInterval(() => {
        if (performance.memory) {
          window.chartPerformance.memorySnapshots.push({
            used: performance.memory.usedJSHeapSize,
            total: performance.memory.totalJSHeapSize,
            timestamp: Date.now()
          });
        }
      }, 1000);
    });

    await page.setViewportSize({ width: 1440, height: 900 });
  });

  test('Chart initialization performance', async ({ page }) => {
    console.log('\n📊 Testing chart initialization performance');

    await page.goto('/simulation');

    // Wait for chart container
    const chartContainer = page.locator('[data-testid="trading-chart"]');
    await expect(chartContainer).toBeVisible();

    // Measure chart initialization time
    const initStartTime = Date.now();

    // Wait for chart to be fully rendered
    await page.waitForFunction(() => {
      const canvas = document.querySelector('canvas');
      return canvas && canvas.width > 0 && canvas.height > 0;
    }, { timeout: 5000 });

    const initTime = Date.now() - initStartTime;

    console.log(`📊 Chart initialization time: ${initTime}ms`);
    expect(initTime).toBeLessThan(CHART_THRESHOLDS.INITIAL_RENDER);

    // Verify chart is interactive
    const canvas = page.locator('canvas').first();
    await expect(canvas).toBeVisible();

    // Check canvas dimensions are reasonable
    const dimensions = await canvas.evaluate(el => ({
      width: el.width,
      height: el.height
    }));

    expect(dimensions.width).toBeGreaterThan(200);
    expect(dimensions.height).toBeGreaterThan(100);
  });

  Object.entries(TEST_DATA_SIZES).forEach(([sizeName, dataCount]) => {
    test(`Chart performance with ${sizeName.toLowerCase()} dataset (${dataCount} points)`, async ({ page }) => {
      console.log(`\n📈 Testing chart with ${dataCount} data points`);

      await page.goto('/simulation');
      await page.waitForLoadState('networkidle');

      // Generate test data
      const testData = generateOHLCData(dataCount);

      // Inject test data into the chart
      const renderStartTime = Date.now();

      await page.evaluate((data) => {
        // Mock chart data update
        if (window.TradingChart && window.TradingChart.updateData) {
          window.TradingChart.updateData(data);
        } else {
          // Fallback: dispatch custom event with data
          window.dispatchEvent(new CustomEvent('chartDataUpdate', {
            detail: { data, timestamp: Date.now() }
          }));
        }
      }, testData);

      // Wait for rendering to complete
      await page.waitForTimeout(100); // Allow for rendering

      const renderTime = Date.now() - renderStartTime;
      console.log(`⏱️  Render time: ${renderTime}ms for ${dataCount} points`);

      // Get performance metrics
      const metrics = await page.evaluate(() => ({
        frameRates: window.chartPerformance.frameRates,
        memoryUsage: window.chartPerformance.memorySnapshots.slice(-5), // Last 5 snapshots
        renderTimes: window.chartPerformance.renderTimes
      }));

      // Performance assertions based on data size
      if (dataCount <= TEST_DATA_SIZES.MEDIUM) {
        expect(renderTime).toBeLessThan(CHART_THRESHOLDS.DATA_UPDATE);
      } else if (dataCount <= TEST_DATA_SIZES.LARGE) {
        expect(renderTime).toBeLessThan(CHART_THRESHOLDS.DATA_UPDATE * 2); // 400ms for large
      } else {
        expect(renderTime).toBeLessThan(CHART_THRESHOLDS.DATA_UPDATE * 5); // 1s for xlarge
      }

      // Check frame rate (should maintain reasonable FPS)
      if (metrics.frameRates.length > 0) {
        const avgFrameRate = metrics.frameRates.reduce((sum, fps) => sum + fps, 0) / metrics.frameRates.length;
        console.log(`📺 Average FPS: ${avgFrameRate.toFixed(2)}`);
        expect(avgFrameRate).toBeGreaterThan(30); // Minimum 30 FPS
      }

      // Check memory usage stability
      if (metrics.memoryUsage.length > 1) {
        const memoryStart = metrics.memoryUsage[0].used;
        const memoryEnd = metrics.memoryUsage[metrics.memoryUsage.length - 1].used;
        const memoryGrowth = memoryEnd - memoryStart;

        console.log(`🧠 Memory growth: ${(memoryGrowth / 1024 / 1024).toFixed(2)}MB`);

        // Memory growth should be reasonable for dataset size
        const expectedGrowthMB = (dataCount * 100) / 1024 / 1024; // ~100 bytes per point
        expect(memoryGrowth).toBeLessThan(expectedGrowthMB * 2 * 1024 * 1024); // 2x tolerance
      }
    });
  });

  test('Chart zoom interaction performance', async ({ page }) => {
    console.log('\n🔍 Testing chart zoom interaction performance');

    await page.goto('/simulation');
    await page.waitForLoadState('networkidle');

    const chartCanvas = page.locator('canvas').first();
    await expect(chartCanvas).toBeVisible();

    // Perform zoom interactions
    const zoomTests = [
      { action: 'wheel', description: 'Mouse wheel zoom' },
      { action: 'pinch', description: 'Pinch zoom (simulated)' },
      { action: 'double-click', description: 'Double-click zoom' }
    ];

    for (const { action, description } of zoomTests) {
      console.log(`🔍 Testing ${description}`);

      const interactionStart = Date.now();

      switch (action) {
        case 'wheel':
          await chartCanvas.hover();
          await page.mouse.wheel(0, -120); // Zoom in
          break;
        case 'pinch':
          // Simulate pinch by using touch events (if supported)
          await chartCanvas.hover();
          await page.keyboard.down('Control');
          await page.mouse.wheel(0, -120);
          await page.keyboard.up('Control');
          break;
        case 'double-click':
          await chartCanvas.dblclick();
          break;
      }

      await page.waitForTimeout(50); // Allow for zoom response

      const interactionTime = Date.now() - interactionStart;
      console.log(`⚡ ${description} response: ${interactionTime}ms`);

      expect(interactionTime).toBeLessThan(CHART_THRESHOLDS.ZOOM_INTERACTION);
    }
  });

  test('Chart pan interaction performance', async ({ page }) => {
    console.log('\n👆 Testing chart pan interaction performance');

    await page.goto('/simulation');
    await page.waitForLoadState('networkidle');

    const chartCanvas = page.locator('canvas').first();
    await expect(chartCanvas).toBeVisible();

    // Get chart bounds for pan testing
    const chartBounds = await chartCanvas.boundingBox();
    if (!chartBounds) throw new Error('Chart not found');

    const centerX = chartBounds.x + chartBounds.width / 2;
    const centerY = chartBounds.y + chartBounds.height / 2;

    // Perform pan operations
    const panOperations = [
      { from: [centerX, centerY], to: [centerX + 100, centerY], direction: 'right' },
      { from: [centerX, centerY], to: [centerX - 100, centerY], direction: 'left' },
      { from: [centerX, centerY], to: [centerX, centerY + 50], direction: 'down' },
      { from: [centerX, centerY], to: [centerX, centerY - 50], direction: 'up' }
    ];

    for (const { from, to, direction } of panOperations) {
      console.log(`👆 Testing pan ${direction}`);

      const panStart = Date.now();

      await page.mouse.move(from[0], from[1]);
      await page.mouse.down();
      await page.mouse.move(to[0], to[1], { steps: 10 });
      await page.mouse.up();

      await page.waitForTimeout(50); // Allow for pan response

      const panTime = Date.now() - panStart;
      console.log(`👆 Pan ${direction} time: ${panTime}ms`);

      expect(panTime).toBeLessThan(CHART_THRESHOLDS.PAN_INTERACTION);
    }
  });

  test('Chart resize performance', async ({ page }) => {
    console.log('\n📏 Testing chart resize performance');

    await page.goto('/simulation');
    await page.waitForLoadState('networkidle');

    const chartContainer = page.locator('[data-testid="trading-chart"]');
    await expect(chartContainer).toBeVisible();

    // Test different viewport sizes
    const viewportSizes = [
      { width: 800, height: 600, name: 'Small' },
      { width: 1200, height: 800, name: 'Medium' },
      { width: 1920, height: 1080, name: 'Large' },
      { width: 1440, height: 900, name: 'Standard' } // Return to standard
    ];

    for (const { width, height, name } of viewportSizes) {
      console.log(`📏 Testing resize to ${name} (${width}x${height})`);

      const resizeStart = Date.now();

      await page.setViewportSize({ width, height });

      // Wait for chart to adapt to new size
      await page.waitForFunction(() => {
        const canvas = document.querySelector('canvas');
        return canvas && canvas.offsetWidth > 0;
      });

      const resizeTime = Date.now() - resizeStart;
      console.log(`📏 Resize to ${name}: ${resizeTime}ms`);

      expect(resizeTime).toBeLessThan(CHART_THRESHOLDS.RESIZE_RESPONSE);

      // Verify chart adapted correctly
      const canvasSize = await page.locator('canvas').first().evaluate(canvas => ({
        width: canvas.offsetWidth,
        height: canvas.offsetHeight
      }));

      expect(canvasSize.width).toBeGreaterThan(100);
      expect(canvasSize.height).toBeGreaterThan(50);
    }
  });

  test('Chart animation performance', async ({ page }) => {
    console.log('\n🎬 Testing chart animation performance');

    await page.goto('/simulation');
    await page.waitForLoadState('networkidle');

    // Monitor animation frame rate during updates
    await page.evaluate(() => {
      window.animationMetrics = {
        frameTimes: [],
        frameCount: 0
      };

      let lastFrameTime = performance.now();

      function monitorFrames() {
        const now = performance.now();
        const frameTime = now - lastFrameTime;

        window.animationMetrics.frameTimes.push(frameTime);
        window.animationMetrics.frameCount++;
        lastFrameTime = now;

        if (window.animationMetrics.frameCount < 60) { // Monitor 60 frames
          requestAnimationFrame(monitorFrames);
        }
      }

      requestAnimationFrame(monitorFrames);
    });

    // Trigger chart animations by updating data
    await page.evaluate(() => {
      // Simulate real-time price updates
      const updateData = () => {
        const price = 50000 + Math.random() * 1000;
        window.dispatchEvent(new CustomEvent('priceUpdate', {
          detail: { price, timestamp: Date.now() }
        }));
      };

      // Update every 50ms for 3 seconds
      for (let i = 0; i < 60; i++) {
        setTimeout(updateData, i * 50);
      }
    });

    // Wait for animations to complete
    await page.waitForTimeout(4000);

    // Analyze animation performance
    const animationMetrics = await page.evaluate(() => window.animationMetrics);

    if (animationMetrics && animationMetrics.frameTimes.length > 0) {
      const avgFrameTime = animationMetrics.frameTimes.reduce((sum, time) => sum + time, 0) / animationMetrics.frameTimes.length;
      const maxFrameTime = Math.max(...animationMetrics.frameTimes);
      const minFrameTime = Math.min(...animationMetrics.frameTimes);

      console.log(`🎬 Average frame time: ${avgFrameTime.toFixed(2)}ms`);
      console.log(`🎬 Max frame time: ${maxFrameTime.toFixed(2)}ms`);
      console.log(`🎬 Min frame time: ${minFrameTime.toFixed(2)}ms`);

      // Frame time should be consistent (close to 16.67ms for 60fps)
      expect(avgFrameTime).toBeLessThan(CHART_THRESHOLDS.ANIMATION_FRAME * 2); // Within 2x of ideal
      expect(maxFrameTime).toBeLessThan(100); // No frame should take longer than 100ms

      // Calculate FPS
      const avgFPS = 1000 / avgFrameTime;
      console.log(`🎬 Average FPS: ${avgFPS.toFixed(2)}`);
      expect(avgFPS).toBeGreaterThan(30); // Minimum 30 FPS
    }
  });

  test('Chart memory leak detection', async ({ page }) => {
    console.log('\n🔍 Testing for chart memory leaks');

    // Enable memory monitoring
    const client = await page.context().newCDPSession(page);
    await client.send('Performance.enable');

    await page.goto('/simulation');
    await page.waitForLoadState('networkidle');

    const initialMemory = await client.send('Performance.getMetrics');
    const initialHeap = initialMemory.metrics.find(m => m.name === 'JSHeapUsedSize')?.value || 0;

    console.log(`🧠 Initial heap: ${(initialHeap / 1024 / 1024).toFixed(2)}MB`);

    // Perform multiple data updates to simulate usage
    for (let i = 0; i < 10; i++) {
      const testData = generateOHLCData(500); // Medium dataset

      await page.evaluate((data) => {
        window.dispatchEvent(new CustomEvent('chartDataUpdate', {
          detail: { data, timestamp: Date.now() }
        }));
      }, testData);

      await page.waitForTimeout(200); // Allow processing
    }

    // Force garbage collection if possible
    await page.evaluate(() => {
      if (window.gc) {
        window.gc();
      }
    });

    await page.waitForTimeout(1000); // Allow GC

    const finalMemory = await client.send('Performance.getMetrics');
    const finalHeap = finalMemory.metrics.find(m => m.name === 'JSHeapUsedSize')?.value || 0;
    const memoryGrowth = finalHeap - initialHeap;

    console.log(`🧠 Final heap: ${(finalHeap / 1024 / 1024).toFixed(2)}MB`);
    console.log(`📈 Memory growth: ${(memoryGrowth / 1024 / 1024).toFixed(2)}MB`);

    // Memory growth should be reasonable (less than 20MB for the test operations)
    expect(memoryGrowth).toBeLessThan(20 * 1024 * 1024);

    // Total memory usage should be reasonable
    expect(finalHeap).toBeLessThan(100 * 1024 * 1024); // Less than 100MB
  });

  test('Chart performance under concurrent operations', async ({ page }) => {
    console.log('\n⚡ Testing chart performance under concurrent operations');

    await page.goto('/simulation');
    await page.waitForLoadState('networkidle');

    const chartCanvas = page.locator('canvas').first();
    await expect(chartCanvas).toBeVisible();

    // Start multiple concurrent operations
    const operationStart = Date.now();

    await Promise.all([
      // Data update
      page.evaluate(() => {
        const data = Array.from({ length: 1000 }, (_, i) => ({
          time: Date.now() + i * 60000,
          price: 50000 + Math.random() * 1000
        }));
        window.dispatchEvent(new CustomEvent('chartDataUpdate', { detail: { data } }));
      }),

      // Zoom operation
      (async () => {
        await page.waitForTimeout(100);
        await chartCanvas.hover();
        await page.mouse.wheel(0, -120);
      })(),

      // Pan operation
      (async () => {
        await page.waitForTimeout(200);
        const bounds = await chartCanvas.boundingBox();
        if (bounds) {
          await page.mouse.move(bounds.x + 100, bounds.y + 100);
          await page.mouse.down();
          await page.mouse.move(bounds.x + 200, bounds.y + 100);
          await page.mouse.up();
        }
      })(),

      // Resize operation
      (async () => {
        await page.waitForTimeout(300);
        await page.setViewportSize({ width: 1200, height: 800 });
      })()
    ]);

    const totalTime = Date.now() - operationStart;
    console.log(`⚡ Concurrent operations completed in: ${totalTime}ms`);

    // All operations should complete within reasonable time
    expect(totalTime).toBeLessThan(2000); // 2 seconds for all concurrent ops

    // Chart should still be responsive
    const finalInteractionStart = Date.now();
    await chartCanvas.click();
    const clickResponseTime = Date.now() - finalInteractionStart;

    expect(clickResponseTime).toBeLessThan(100);
    console.log(`🖱️  Post-stress click response: ${clickResponseTime}ms`);
  });
});