import { test, expect } from "@playwright/test";

/**
 * T018: Contract test GET /api/market/{coinSymbol}/history
 * Validates API contract compliance for retrieving historical market data
 * Must fail until implementation exists (TDD approach)
 */

test.describe("GET /api/market/{coinSymbol}/history - Contract Test", () => {
  const fromDate = "2024-01-01T00:00:00Z";
  const toDate = "2024-01-31T23:59:59Z";

  test("should return historical data for BTC with required parameters", async ({ request }) => {
    // This test MUST FAIL initially (TDD approach)
    const response = await request.get(`/api/market/BTC/history?from=${fromDate}&to=${toDate}`);

    expect(response.status()).toBe(200);

    const historyResponse = await response.json();

    // Validate response structure
    expect(historyResponse).toHaveProperty("coin_symbol");
    expect(historyResponse).toHaveProperty("interval");
    expect(historyResponse).toHaveProperty("data");

    expect(historyResponse.coin_symbol).toBe("BTC");
    expect(historyResponse.interval).toBe("1h"); // Default interval
    expect(Array.isArray(historyResponse.data)).toBe(true);

    // Validate data points structure
    if (historyResponse.data.length > 0) {
      const dataPoint = historyResponse.data[0];

      expect(dataPoint).toHaveProperty("timestamp");
      expect(dataPoint).toHaveProperty("open");
      expect(dataPoint).toHaveProperty("high");
      expect(dataPoint).toHaveProperty("low");
      expect(dataPoint).toHaveProperty("close");
      expect(dataPoint).toHaveProperty("volume");

      // Validate field types and constraints
      expect(dataPoint.timestamp).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/);
      expect(typeof dataPoint.open).toBe("number");
      expect(dataPoint.open).toBeGreaterThan(0);
      expect(typeof dataPoint.high).toBe("number");
      expect(dataPoint.high).toBeGreaterThan(0);
      expect(typeof dataPoint.low).toBe("number");
      expect(dataPoint.low).toBeGreaterThan(0);
      expect(typeof dataPoint.close).toBe("number");
      expect(dataPoint.close).toBeGreaterThan(0);
      expect(typeof dataPoint.volume).toBe("number");
      expect(dataPoint.volume).toBeGreaterThanOrEqual(0);

      // Validate OHLC relationships
      expect(dataPoint.high).toBeGreaterThanOrEqual(dataPoint.open);
      expect(dataPoint.high).toBeGreaterThanOrEqual(dataPoint.close);
      expect(dataPoint.high).toBeGreaterThanOrEqual(dataPoint.low);
      expect(dataPoint.low).toBeLessThanOrEqual(dataPoint.open);
      expect(dataPoint.low).toBeLessThanOrEqual(dataPoint.close);
    }
  });

  test("should support 1h interval parameter", async ({ request }) => {
    const response = await request.get(`/api/market/ETH/history?from=${fromDate}&to=${toDate}&interval=1h`);

    expect(response.status()).toBe(200);

    const historyResponse = await response.json();
    expect(historyResponse.interval).toBe("1h");
    expect(historyResponse.coin_symbol).toBe("ETH");
  });

  test("should support 4h interval parameter", async ({ request }) => {
    const response = await request.get(`/api/market/BTC/history?from=${fromDate}&to=${toDate}&interval=4h`);

    expect(response.status()).toBe(200);

    const historyResponse = await response.json();
    expect(historyResponse.interval).toBe("4h");
  });

  test("should support 1d interval parameter", async ({ request }) => {
    const response = await request.get(`/api/market/BTC/history?from=${fromDate}&to=${toDate}&interval=1d`);

    expect(response.status()).toBe(200);

    const historyResponse = await response.json();
    expect(historyResponse.interval).toBe("1d");
  });

  test("should return data in chronological order", async ({ request }) => {
    const response = await request.get(`/api/market/BTC/history?from=${fromDate}&to=${toDate}`);

    expect(response.status()).toBe(200);

    const historyResponse = await response.json();

    if (historyResponse.data.length > 1) {
      // Verify data is ordered by timestamp in ascending order
      for (let i = 0; i < historyResponse.data.length - 1; i++) {
        const currentTime = new Date(historyResponse.data[i].timestamp).getTime();
        const nextTime = new Date(historyResponse.data[i + 1].timestamp).getTime();
        expect(nextTime).toBeGreaterThan(currentTime);
      }
    }
  });

  test("should return 400 for missing required from parameter", async ({ request }) => {
    const response = await request.get(`/api/market/BTC/history?to=${toDate}`);

    expect(response.status()).toBe(400);

    const errorResponse = await response.json();
    expect(errorResponse).toHaveProperty("error");
    expect(errorResponse.message).toContain("from");
  });

  test("should return 400 for missing required to parameter", async ({ request }) => {
    const response = await request.get(`/api/market/BTC/history?from=${fromDate}`);

    expect(response.status()).toBe(400);

    const errorResponse = await response.json();
    expect(errorResponse).toHaveProperty("error");
    expect(errorResponse.message).toContain("to");
  });

  test("should return 400 for invalid date format", async ({ request }) => {
    const invalidDate = "2024-13-45"; // Invalid date
    const response = await request.get(`/api/market/BTC/history?from=${invalidDate}&to=${toDate}`);

    expect(response.status()).toBe(400);

    const errorResponse = await response.json();
    expect(errorResponse).toHaveProperty("error");
    expect(errorResponse.message).toContain("Invalid");
  });

  test("should return 400 for from date after to date", async ({ request }) => {
    const laterDate = "2024-02-01T00:00:00Z";
    const earlierDate = "2024-01-01T00:00:00Z";

    const response = await request.get(`/api/market/BTC/history?from=${laterDate}&to=${earlierDate}`);

    expect(response.status()).toBe(400);

    const errorResponse = await response.json();
    expect(errorResponse).toHaveProperty("error");
    expect(errorResponse.message).toContain("from");
  });

  test("should return 400 for invalid interval parameter", async ({ request }) => {
    const response = await request.get(`/api/market/BTC/history?from=${fromDate}&to=${toDate}&interval=5m`);

    expect(response.status()).toBe(400);

    const errorResponse = await response.json();
    expect(errorResponse).toHaveProperty("error");
    expect(errorResponse.message).toContain("interval");
  });

  test("should return 400 for date range too large", async ({ request }) => {
    const veryOldDate = "2020-01-01T00:00:00Z";
    const response = await request.get(`/api/market/BTC/history?from=${veryOldDate}&to=${toDate}`);

    // Should limit the date range to prevent excessive data requests
    expect([200, 400]).toContain(response.status());

    if (response.status() === 400) {
      const errorResponse = await response.json();
      expect(errorResponse).toHaveProperty("error");
      expect(errorResponse.message).toContain("range");
    }
  });

  test("should return 404 for unsupported coin symbol", async ({ request }) => {
    const response = await request.get(`/api/market/INVALID/history?from=${fromDate}&to=${toDate}`);

    expect(response.status()).toBe(404);

    const errorResponse = await response.json();
    expect(errorResponse).toHaveProperty("error");
    expect(errorResponse.message).toContain("not found");
  });

  test("should handle future dates appropriately", async ({ request }) => {
    const futureDate = "2030-01-01T00:00:00Z";
    const response = await request.get(`/api/market/BTC/history?from=${fromDate}&to=${futureDate}`);

    // Should either limit to current date or return error
    expect([200, 400]).toContain(response.status());

    if (response.status() === 200) {
      const historyResponse = await response.json();
      // Data should not extend beyond current date
      const lastDataPoint = historyResponse.data[historyResponse.data.length - 1];
      const lastTimestamp = new Date(lastDataPoint.timestamp);
      expect(lastTimestamp.getTime()).toBeLessThanOrEqual(Date.now());
    }
  });

  test("should respect rate limiting", async ({ request }) => {
    // Make multiple requests to test rate limiting
    const requests = Array.from({ length: 5 }, () =>
      request.get(`/api/market/BTC/history?from=${fromDate}&to=${toDate}`)
    );

    const responses = await Promise.all(requests);

    // All should succeed initially, but rate limiting may kick in
    const successCount = responses.filter(r => r.status() === 200).length;
    const rateLimitedCount = responses.filter(r => r.status() === 429).length;

    expect(successCount + rateLimitedCount).toBe(5);

    if (rateLimitedCount > 0) {
      const rateLimitedResponse = responses.find(r => r.status() === 429);
      const errorResponse = await rateLimitedResponse!.json();
      expect(errorResponse).toHaveProperty("error");
      expect(errorResponse.message).toContain("rate limit");
    }
  });
});