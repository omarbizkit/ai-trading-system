import { test, expect } from "@playwright/test";

/**
 * T019: Contract test GET /api/predictions/{coinSymbol}
 * Validates API contract compliance for retrieving AI predictions
 * Must fail until implementation exists (TDD approach)
 */

test.describe("GET /api/predictions/{coinSymbol} - Contract Test", () => {
  test("should return AI prediction for BTC with default horizon", async ({ request }) => {
    // This test MUST FAIL initially (TDD approach)
    const response = await request.get("/api/predictions/BTC");

    expect(response.status()).toBe(200);

    const prediction = await response.json();

    // Validate response schema matches AIPrediction type
    expect(prediction).toHaveProperty("coin_symbol");
    expect(prediction).toHaveProperty("predicted_price");
    expect(prediction).toHaveProperty("predicted_direction");
    expect(prediction).toHaveProperty("confidence_score");
    expect(prediction).toHaveProperty("prediction_horizon");

    // Validate field types and constraints
    expect(prediction.coin_symbol).toBe("BTC");
    expect(typeof prediction.predicted_price).toBe("number");
    expect(prediction.predicted_price).toBeGreaterThan(0);
    expect(["up", "down", "hold"]).toContain(prediction.predicted_direction);
    expect(typeof prediction.confidence_score).toBe("number");
    expect(prediction.confidence_score).toBeGreaterThanOrEqual(0);
    expect(prediction.confidence_score).toBeLessThanOrEqual(1);
    expect(typeof prediction.prediction_horizon).toBe("number");
    expect(prediction.prediction_horizon).toBeGreaterThanOrEqual(1);
    expect(prediction.prediction_horizon).toBeLessThanOrEqual(60);
    expect(prediction.prediction_horizon).toBe(15); // Default horizon
  });

  test("should return AI prediction for ETH", async ({ request }) => {
    const response = await request.get("/api/predictions/ETH");

    expect(response.status()).toBe(200);

    const prediction = await response.json();
    expect(prediction.coin_symbol).toBe("ETH");
    expect(prediction.predicted_price).toBeGreaterThan(0);
  });

  test("should support custom prediction horizon", async ({ request }) => {
    const customHorizon = 30;
    const response = await request.get(`/api/predictions/BTC?horizon=${customHorizon}`);

    expect(response.status()).toBe(200);

    const prediction = await response.json();
    expect(prediction.prediction_horizon).toBe(customHorizon);
  });

  test("should support minimum horizon (5 minutes)", async ({ request }) => {
    const response = await request.get("/api/predictions/BTC?horizon=5");

    expect(response.status()).toBe(200);

    const prediction = await response.json();
    expect(prediction.prediction_horizon).toBe(5);
  });

  test("should support maximum horizon (60 minutes)", async ({ request }) => {
    const response = await request.get("/api/predictions/BTC?horizon=60");

    expect(response.status()).toBe(200);

    const prediction = await response.json();
    expect(prediction.prediction_horizon).toBe(60);
  });

  test("should return consistent prediction for same parameters", async ({ request }) => {
    // Make two requests with same parameters - should return consistent results
    const response1 = await request.get("/api/predictions/BTC?horizon=15");
    const response2 = await request.get("/api/predictions/BTC?horizon=15");

    expect(response1.status()).toBe(200);
    expect(response2.status()).toBe(200);

    const prediction1 = await response1.json();
    const prediction2 = await response2.json();

    // Predictions should be consistent (or vary within reasonable bounds)
    expect(prediction1.coin_symbol).toBe(prediction2.coin_symbol);
    expect(prediction1.predicted_direction).toBe(prediction2.predicted_direction);

    // Price predictions may vary slightly due to real-time data updates
    const priceDifference = Math.abs(prediction1.predicted_price - prediction2.predicted_price);
    const pricePercentDiff = priceDifference / prediction1.predicted_price;
    expect(pricePercentDiff).toBeLessThan(0.05); // Less than 5% difference
  });

  test("should return 400 for horizon below minimum", async ({ request }) => {
    const response = await request.get("/api/predictions/BTC?horizon=1");

    expect(response.status()).toBe(400);

    const errorResponse = await response.json();
    expect(errorResponse).toHaveProperty("error");
    expect(errorResponse.message).toContain("horizon");
  });

  test("should return 400 for horizon above maximum", async ({ request }) => {
    const response = await request.get("/api/predictions/BTC?horizon=120");

    expect(response.status()).toBe(400);

    const errorResponse = await response.json();
    expect(errorResponse).toHaveProperty("error");
    expect(errorResponse.message).toContain("horizon");
  });

  test("should return 400 for invalid horizon format", async ({ request }) => {
    const response = await request.get("/api/predictions/BTC?horizon=invalid");

    expect(response.status()).toBe(400);

    const errorResponse = await response.json();
    expect(errorResponse).toHaveProperty("error");
    expect(errorResponse.message).toContain("horizon");
  });

  test("should return 404 for unsupported coin symbol", async ({ request }) => {
    const response = await request.get("/api/predictions/INVALID");

    expect(response.status()).toBe(404);

    const errorResponse = await response.json();
    expect(errorResponse).toHaveProperty("error");
    expect(errorResponse.message).toContain("not found");
  });

  test("should handle model inference errors gracefully", async ({ request }) => {
    // Test resilience when ML model fails
    const response = await request.get("/api/predictions/BTC");

    // Should either succeed or return service unavailable
    expect([200, 503]).toContain(response.status());

    if (response.status() === 503) {
      const errorResponse = await response.json();
      expect(errorResponse).toHaveProperty("error");
      expect(errorResponse.message).toContain("unavailable");
    }
  });

  test("should include prediction metadata", async ({ request }) => {
    const response = await request.get("/api/predictions/BTC");

    expect(response.status()).toBe(200);

    const prediction = await response.json();

    // May include additional metadata (implementation-dependent)
    // These fields are optional but useful
    if (prediction.model_version) {
      expect(typeof prediction.model_version).toBe("string");
    }

    if (prediction.input_features) {
      expect(typeof prediction.input_features).toBe("object");
    }

    if (prediction.created_at) {
      expect(prediction.created_at).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/);
    }
  });

  test("should validate prediction confidence is reasonable", async ({ request }) => {
    const response = await request.get("/api/predictions/BTC");

    expect(response.status()).toBe(200);

    const prediction = await response.json();

    // Confidence should be within valid range
    expect(prediction.confidence_score).toBeGreaterThanOrEqual(0);
    expect(prediction.confidence_score).toBeLessThanOrEqual(1);

    // For portfolio showcase, confidence shouldn't be too low
    expect(prediction.confidence_score).toBeGreaterThan(0.1); // At least 10% confidence
  });

  test("should respect performance requirements", async ({ request }) => {
    const startTime = Date.now();
    const response = await request.get("/api/predictions/BTC");
    const endTime = Date.now();

    expect(response.status()).toBe(200);

    const responseTime = endTime - startTime;
    // AI predictions should be fast (<1s for client-side inference)
    expect(responseTime).toBeLessThan(1000);
  });

  test("should handle multiple coin predictions efficiently", async ({ request }) => {
    const coins = ["BTC", "ETH", "ADA"];
    const startTime = Date.now();

    const requests = coins.map(coin => request.get(`/api/predictions/${coin}`));
    const responses = await Promise.all(requests);

    const endTime = Date.now();

    // All should succeed
    responses.forEach(response => {
      expect(response.status()).toBe(200);
    });

    const totalTime = endTime - startTime;
    // Multiple predictions should complete within reasonable time
    expect(totalTime).toBeLessThan(3000); // 3 seconds for 3 predictions
  });
});