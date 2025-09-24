import { test, expect } from "@playwright/test";

/**
 * T016: Contract test POST /api/runs/{runId}/trades
 * Validates API contract compliance for executing new trades
 * Must fail until implementation exists (TDD approach)
 */

test.describe("POST /api/runs/{runId}/trades - Contract Test", () => {
  const mockRunId = "550e8400-e29b-41d4-a716-446655440000";

  const validBuyTrade = {
    trade_type: "buy",
    coin_symbol: "BTC",
    quantity: 0.5,
    trade_reason: "ai_signal",
    ai_confidence: 0.85
  };

  const validSellTrade = {
    trade_type: "sell",
    coin_symbol: "BTC",
    quantity: 0.3,
    trade_reason: "take_profit",
    ai_confidence: 0.75
  };

  test("should execute buy trade successfully", async ({ request }) => {
    // This test MUST FAIL initially (TDD approach)
    const response = await request.post(`/api/runs/${mockRunId}/trades`, {
      headers: {
        "Authorization": "Bearer mock-jwt-token",
        "Content-Type": "application/json"
      },
      data: validBuyTrade
    });

    expect(response.status()).toBe(201);

    const newTrade = await response.json();

    // Validate response schema matches Trade type
    expect(newTrade).toHaveProperty("id");
    expect(newTrade.run_id).toBe(mockRunId);
    expect(newTrade.trade_type).toBe(validBuyTrade.trade_type);
    expect(newTrade.coin_symbol).toBe(validBuyTrade.coin_symbol);
    expect(newTrade.quantity).toBe(validBuyTrade.quantity);
    expect(newTrade.trade_reason).toBe(validBuyTrade.trade_reason);
    expect(newTrade.ai_confidence).toBe(validBuyTrade.ai_confidence);

    // System-generated fields
    expect(typeof newTrade.price).toBe("number");
    expect(newTrade.price).toBeGreaterThan(0);
    expect(typeof newTrade.total_value).toBe("number");
    expect(typeof newTrade.fee).toBe("number");
    expect(newTrade.fee).toBeGreaterThanOrEqual(0);
    expect(typeof newTrade.net_value).toBe("number");
    expect(typeof newTrade.portfolio_value_before).toBe("number");
    expect(typeof newTrade.portfolio_value_after).toBe("number");
    expect(typeof newTrade.market_price).toBe("number");
    expect(newTrade.market_price).toBeGreaterThan(0);

    // Buy trades should have null profit_loss
    expect(newTrade.profit_loss).toBeNull();

    // Timestamps
    expect(newTrade.execution_time).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/);
    expect(newTrade.created_at).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/);

    // Validate UUID format
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    expect(newTrade.id).toMatch(uuidRegex);

    // Validate calculations
    expect(Math.abs(newTrade.total_value - (newTrade.quantity * newTrade.price))).toBeLessThan(0.01);
    expect(Math.abs(newTrade.net_value - (newTrade.total_value + newTrade.fee))).toBeLessThan(0.01);
  });

  test("should execute sell trade successfully", async ({ request }) => {
    const response = await request.post(`/api/runs/${mockRunId}/trades`, {
      headers: {
        "Authorization": "Bearer mock-jwt-token",
        "Content-Type": "application/json"
      },
      data: validSellTrade
    });

    expect(response.status()).toBe(201);

    const newTrade = await response.json();

    expect(newTrade.trade_type).toBe("sell");

    // Sell trades should calculate profit_loss
    if (newTrade.profit_loss !== null) {
      expect(typeof newTrade.profit_loss).toBe("number");
    }

    // Portfolio value should update correctly for sell
    expect(newTrade.portfolio_value_after).not.toBe(newTrade.portfolio_value_before);
  });

  test("should return 400 for missing required fields", async ({ request }) => {
    const invalidData = {
      coin_symbol: "BTC"
      // Missing trade_type, quantity, trade_reason
    };

    const response = await request.post(`/api/runs/${mockRunId}/trades`, {
      headers: {
        "Authorization": "Bearer mock-jwt-token",
        "Content-Type": "application/json"
      },
      data: invalidData
    });

    expect(response.status()).toBe(400);

    const errorResponse = await response.json();
    expect(errorResponse).toHaveProperty("error");
    expect(errorResponse.message).toContain("trade_type");
  });

  test("should return 400 for invalid trade_type", async ({ request }) => {
    const invalidData = {
      ...validBuyTrade,
      trade_type: "invalid_type"
    };

    const response = await request.post(`/api/runs/${mockRunId}/trades`, {
      headers: {
        "Authorization": "Bearer mock-jwt-token",
        "Content-Type": "application/json"
      },
      data: invalidData
    });

    expect(response.status()).toBe(400);

    const errorResponse = await response.json();
    expect(errorResponse.error).toBe("Invalid input data");
    expect(errorResponse.message).toContain("trade_type");
  });

  test("should return 400 for negative quantity", async ({ request }) => {
    const invalidData = {
      ...validBuyTrade,
      quantity: -0.5
    };

    const response = await request.post(`/api/runs/${mockRunId}/trades`, {
      headers: {
        "Authorization": "Bearer mock-jwt-token",
        "Content-Type": "application/json"
      },
      data: invalidData
    });

    expect(response.status()).toBe(400);

    const errorResponse = await response.json();
    expect(errorResponse.error).toBe("Invalid input data");
    expect(errorResponse.message).toContain("quantity");
  });

  test("should return 400 for invalid trade_reason", async ({ request }) => {
    const invalidData = {
      ...validBuyTrade,
      trade_reason: "invalid_reason"
    };

    const response = await request.post(`/api/runs/${mockRunId}/trades`, {
      headers: {
        "Authorization": "Bearer mock-jwt-token",
        "Content-Type": "application/json"
      },
      data: invalidData
    });

    expect(response.status()).toBe(400);

    const errorResponse = await response.json();
    expect(errorResponse.error).toBe("Invalid input data");
    expect(errorResponse.message).toContain("trade_reason");
  });

  test("should return 400 for invalid ai_confidence range", async ({ request }) => {
    const invalidData = {
      ...validBuyTrade,
      ai_confidence: 1.5 // Must be between 0 and 1
    };

    const response = await request.post(`/api/runs/${mockRunId}/trades`, {
      headers: {
        "Authorization": "Bearer mock-jwt-token",
        "Content-Type": "application/json"
      },
      data: invalidData
    });

    expect(response.status()).toBe(400);

    const errorResponse = await response.json();
    expect(errorResponse.error).toBe("Invalid input data");
    expect(errorResponse.message).toContain("ai_confidence");
  });

  test("should return 400 for insufficient funds", async ({ request }) => {
    const largeTradeData = {
      ...validBuyTrade,
      quantity: 1000000 // Impossibly large quantity
    };

    const response = await request.post(`/api/runs/${mockRunId}/trades`, {
      headers: {
        "Authorization": "Bearer mock-jwt-token",
        "Content-Type": "application/json"
      },
      data: largeTradeData
    });

    expect(response.status()).toBe(400);

    const errorResponse = await response.json();
    expect(errorResponse.error).toBe("Invalid input data");
    expect(errorResponse.message).toContain("insufficient");
  });

  test("should return 404 for non-existent runId", async ({ request }) => {
    const nonExistentId = "00000000-0000-0000-0000-000000000000";

    const response = await request.post(`/api/runs/${nonExistentId}/trades`, {
      headers: {
        "Authorization": "Bearer mock-jwt-token",
        "Content-Type": "application/json"
      },
      data: validBuyTrade
    });

    expect(response.status()).toBe(404);

    const errorResponse = await response.json();
    expect(errorResponse).toHaveProperty("error");
    expect(errorResponse.message).toContain("not found");
  });

  test("should return 400 for invalid runId UUID format", async ({ request }) => {
    const invalidId = "invalid-uuid";

    const response = await request.post(`/api/runs/${invalidId}/trades`, {
      headers: {
        "Authorization": "Bearer mock-jwt-token",
        "Content-Type": "application/json"
      },
      data: validBuyTrade
    });

    expect(response.status()).toBe(400);

    const errorResponse = await response.json();
    expect(errorResponse).toHaveProperty("error");
    expect(errorResponse.message).toContain("Invalid");
  });

  test("should return 401 for unauthenticated user", async ({ request }) => {
    const response = await request.post(`/api/runs/${mockRunId}/trades`, {
      headers: { "Content-Type": "application/json" },
      data: validBuyTrade
    });

    expect(response.status()).toBe(401);

    const errorResponse = await response.json();
    expect(errorResponse).toHaveProperty("error");
    expect(errorResponse.error).toBe("Unauthorized");
  });

  test("should return 403 for unauthorized access to other user's run", async ({ request }) => {
    const response = await request.post(`/api/runs/${mockRunId}/trades`, {
      headers: {
        "Authorization": "Bearer other-user-jwt-token",
        "Content-Type": "application/json"
      },
      data: validBuyTrade
    });

    expect([403, 404]).toContain(response.status());

    const errorResponse = await response.json();
    expect(errorResponse).toHaveProperty("error");
  });

  test("should return 409 for completed trading run", async ({ request }) => {
    // Try to trade on a run that has already ended
    const completedRunId = "completed-run-id-example";

    const response = await request.post(`/api/runs/${completedRunId}/trades`, {
      headers: {
        "Authorization": "Bearer mock-jwt-token",
        "Content-Type": "application/json"
      },
      data: validBuyTrade
    });

    expect([409, 400]).toContain(response.status());

    const errorResponse = await response.json();
    expect(errorResponse).toHaveProperty("error");
    if (response.status() === 409) {
      expect(errorResponse.message).toContain("completed");
    }
  });
});