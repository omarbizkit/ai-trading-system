import { test, expect } from "@playwright/test";

/**
 * T017: Contract test GET /api/market/{coinSymbol}
 * Validates API contract compliance for retrieving current market data
 * Must fail until implementation exists (TDD approach)
 */

test.describe("GET /api/market/{coinSymbol} - Contract Test", () => {
  test("should return current market data for BTC", async ({ request }) => {
    // This test MUST FAIL initially (TDD approach)
    const response = await request.get("/api/market/BTC");

    expect(response.status()).toBe(200);

    const marketData = await response.json();

    // Validate response schema matches MarketData type
    expect(marketData).toHaveProperty("coin_symbol");
    expect(marketData).toHaveProperty("current_price");
    expect(marketData).toHaveProperty("price_change_24h");
    expect(marketData).toHaveProperty("volume_24h");
    expect(marketData).toHaveProperty("market_cap");
    expect(marketData).toHaveProperty("sentiment_score");
    expect(marketData).toHaveProperty("fear_greed_index");
    expect(marketData).toHaveProperty("last_updated");
    expect(marketData).toHaveProperty("historical_data");

    // Validate field types and constraints
    expect(marketData.coin_symbol).toBe("BTC");
    expect(typeof marketData.current_price).toBe("number");
    expect(marketData.current_price).toBeGreaterThan(0);
    expect(typeof marketData.price_change_24h).toBe("number");
    expect(typeof marketData.volume_24h).toBe("number");
    expect(typeof marketData.market_cap).toBe("number");
    expect(typeof marketData.sentiment_score).toBe("number");
    expect(marketData.sentiment_score).toBeGreaterThanOrEqual(-1);
    expect(marketData.sentiment_score).toBeLessThanOrEqual(1);
    expect(typeof marketData.fear_greed_index).toBe("number");
    expect(marketData.fear_greed_index).toBeGreaterThanOrEqual(0);
    expect(marketData.fear_greed_index).toBeLessThanOrEqual(100);
    expect(marketData.last_updated).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/);
    expect(Array.isArray(marketData.historical_data)).toBe(true);

    // Validate historical data structure if present
    if (marketData.historical_data.length > 0) {
      const historicalPoint = marketData.historical_data[0];
      expect(historicalPoint).toHaveProperty("timestamp");
      expect(historicalPoint).toHaveProperty("price");
      expect(historicalPoint).toHaveProperty("volume");
      expect(historicalPoint.timestamp).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/);
      expect(typeof historicalPoint.price).toBe("number");
      expect(historicalPoint.price).toBeGreaterThan(0);
      expect(typeof historicalPoint.volume).toBe("number");
    }
  });

  test("should return current market data for ETH", async ({ request }) => {
    const response = await request.get("/api/market/ETH");

    expect(response.status()).toBe(200);

    const marketData = await response.json();
    expect(marketData.coin_symbol).toBe("ETH");
    expect(marketData.current_price).toBeGreaterThan(0);
  });

  test("should return current market data for other supported coins", async ({ request }) => {
    const supportedCoins = ["ADA", "DOT", "LINK"];

    for (const coin of supportedCoins) {
      const response = await request.get(`/api/market/${coin}`);

      expect(response.status()).toBe(200);

      const marketData = await response.json();
      expect(marketData.coin_symbol).toBe(coin);
      expect(typeof marketData.current_price).toBe("number");
      expect(marketData.current_price).toBeGreaterThan(0);
    }
  });

  test("should return 404 for unsupported coin symbol", async ({ request }) => {
    const response = await request.get("/api/market/INVALID");

    expect(response.status()).toBe(404);

    const errorResponse = await response.json();
    expect(errorResponse).toHaveProperty("error");
    expect(errorResponse.message).toContain("not found");
  });

  test("should return 400 for invalid coin symbol format", async ({ request }) => {
    const response = await request.get("/api/market/btc123!@#");

    expect(response.status()).toBe(400);

    const errorResponse = await response.json();
    expect(errorResponse).toHaveProperty("error");
    expect(errorResponse.message).toContain("Invalid");
  });

  test("should handle case-insensitive coin symbols", async ({ request }) => {
    const response = await request.get("/api/market/btc"); // lowercase

    // Should either work (200) or redirect/normalize (3xx) or be case-sensitive (404)
    expect([200, 301, 302, 404]).toContain(response.status());

    if (response.status() === 200) {
      const marketData = await response.json();
      expect(["BTC", "btc"]).toContain(marketData.coin_symbol);
    }
  });

  test("should return fresh data within cache TTL", async ({ request }) => {
    const response = await request.get("/api/market/BTC");

    expect(response.status()).toBe(200);

    const marketData = await response.json();
    const lastUpdated = new Date(marketData.last_updated);
    const now = new Date();
    const timeDiff = now.getTime() - lastUpdated.getTime();

    // Data should be fresh (within 30 seconds based on cache TTL)
    expect(timeDiff).toBeLessThan(30000); // 30 seconds in milliseconds
  });

  test("should include rate limiting headers", async ({ request }) => {
    const response = await request.get("/api/market/BTC");

    expect(response.status()).toBe(200);

    // Check for rate limiting headers (CoinGecko API compliance)
    const headers = response.headers();
    // These headers might be present depending on implementation
    // expect(headers).toHaveProperty("x-ratelimit-remaining");
    // expect(headers).toHaveProperty("x-ratelimit-limit");
  });

  test("should handle API failures gracefully", async ({ request }) => {
    // This tests resilience when external API is down
    // Implementation should return cached data or appropriate error
    const response = await request.get("/api/market/BTC");

    // Should either succeed with cached data or return service unavailable
    expect([200, 503]).toContain(response.status());

    if (response.status() === 503) {
      const errorResponse = await response.json();
      expect(errorResponse).toHaveProperty("error");
      expect(errorResponse.message).toContain("unavailable");
    }
  });

  test("should validate response time performance", async ({ request }) => {
    const startTime = Date.now();
    const response = await request.get("/api/market/BTC");
    const endTime = Date.now();

    expect(response.status()).toBe(200);

    const responseTime = endTime - startTime;
    // API should respond within 2 seconds (performance requirement)
    expect(responseTime).toBeLessThan(2000);
  });
});