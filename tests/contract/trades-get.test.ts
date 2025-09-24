import { test, expect } from "@playwright/test";

/**
 * T015: Contract test GET /api/runs/{runId}/trades
 * Validates API contract compliance for retrieving trades for a specific run
 * Must fail until implementation exists (TDD approach)
 */

test.describe("GET /api/runs/{runId}/trades - Contract Test", () => {
  const mockRunId = "550e8400-e29b-41d4-a716-446655440000";

  test("should return paginated list of trades for a run", async ({ request }) => {
    // This test MUST FAIL initially (TDD approach)
    const response = await request.get(`/api/runs/${mockRunId}/trades`, {
      headers: {
        "Authorization": "Bearer mock-jwt-token"
      }
    });

    expect(response.status()).toBe(200);

    const tradesResponse = await response.json();

    // Validate response structure
    expect(tradesResponse).toHaveProperty("trades");
    expect(tradesResponse).toHaveProperty("total");

    expect(Array.isArray(tradesResponse.trades)).toBe(true);
    expect(typeof tradesResponse.total).toBe("number");

    // If trades exist, validate Trade schema
    if (tradesResponse.trades.length > 0) {
      const trade = tradesResponse.trades[0];

      expect(trade).toHaveProperty("id");
      expect(trade).toHaveProperty("run_id");
      expect(trade).toHaveProperty("user_id");
      expect(trade).toHaveProperty("trade_type");
      expect(trade).toHaveProperty("coin_symbol");
      expect(trade).toHaveProperty("quantity");
      expect(trade).toHaveProperty("price");
      expect(trade).toHaveProperty("total_value");
      expect(trade).toHaveProperty("fee");
      expect(trade).toHaveProperty("net_value");
      expect(trade).toHaveProperty("portfolio_value_before");
      expect(trade).toHaveProperty("portfolio_value_after");
      expect(trade).toHaveProperty("profit_loss");
      expect(trade).toHaveProperty("trade_reason");
      expect(trade).toHaveProperty("ai_confidence");
      expect(trade).toHaveProperty("market_price");
      expect(trade).toHaveProperty("execution_time");
      expect(trade).toHaveProperty("created_at");

      // Validate field types and constraints
      expect(typeof trade.id).toBe("string");
      expect(trade.run_id).toBe(mockRunId);
      expect(["buy", "sell"]).toContain(trade.trade_type);
      expect(typeof trade.coin_symbol).toBe("string");
      expect(typeof trade.quantity).toBe("number");
      expect(trade.quantity).toBeGreaterThan(0);
      expect(typeof trade.price).toBe("number");
      expect(trade.price).toBeGreaterThan(0);
      expect(typeof trade.total_value).toBe("number");
      expect(typeof trade.fee).toBe("number");
      expect(trade.fee).toBeGreaterThanOrEqual(0);
      expect(typeof trade.net_value).toBe("number");
      expect(typeof trade.portfolio_value_before).toBe("number");
      expect(typeof trade.portfolio_value_after).toBe("number");

      // profit_loss is nullable for buy orders
      if (trade.profit_loss !== null) {
        expect(typeof trade.profit_loss).toBe("number");
      }

      expect(["ai_signal", "stop_loss", "take_profit", "manual"]).toContain(trade.trade_reason);
      expect(typeof trade.ai_confidence).toBe("number");
      expect(trade.ai_confidence).toBeGreaterThanOrEqual(0);
      expect(trade.ai_confidence).toBeLessThanOrEqual(1);
      expect(typeof trade.market_price).toBe("number");
      expect(trade.market_price).toBeGreaterThan(0);
      expect(trade.execution_time).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/);
      expect(trade.created_at).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/);

      // Validate UUID format
      const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
      expect(trade.id).toMatch(uuidRegex);
    }
  });

  test("should support pagination with limit parameter", async ({ request }) => {
    const response = await request.get(`/api/runs/${mockRunId}/trades?limit=10`, {
      headers: {
        "Authorization": "Bearer mock-jwt-token"
      }
    });

    expect(response.status()).toBe(200);

    const tradesResponse = await response.json();
    expect(tradesResponse.trades.length).toBeLessThanOrEqual(10);
  });

  test("should support pagination with offset parameter", async ({ request }) => {
    const response = await request.get(`/api/runs/${mockRunId}/trades?limit=5&offset=10`, {
      headers: {
        "Authorization": "Bearer mock-jwt-token"
      }
    });

    expect(response.status()).toBe(200);

    const tradesResponse = await response.json();
    expect(tradesResponse).toHaveProperty("trades");
    expect(tradesResponse).toHaveProperty("total");
  });

  test("should return trades ordered by execution_time DESC", async ({ request }) => {
    const response = await request.get(`/api/runs/${mockRunId}/trades`, {
      headers: {
        "Authorization": "Bearer mock-jwt-token"
      }
    });

    expect(response.status()).toBe(200);

    const tradesResponse = await response.json();

    if (tradesResponse.trades.length > 1) {
      // Verify trades are ordered by execution_time in descending order (newest first)
      for (let i = 0; i < tradesResponse.trades.length - 1; i++) {
        const currentTime = new Date(tradesResponse.trades[i].execution_time).getTime();
        const nextTime = new Date(tradesResponse.trades[i + 1].execution_time).getTime();
        expect(currentTime).toBeGreaterThanOrEqual(nextTime);
      }
    }
  });

  test("should return 400 for invalid limit parameter", async ({ request }) => {
    const response = await request.get(`/api/runs/${mockRunId}/trades?limit=200`, { // Exceeds maximum
      headers: {
        "Authorization": "Bearer mock-jwt-token"
      }
    });

    expect(response.status()).toBe(400);

    const errorResponse = await response.json();
    expect(errorResponse).toHaveProperty("error");
    expect(errorResponse.message).toContain("limit");
  });

  test("should return 400 for negative offset parameter", async ({ request }) => {
    const response = await request.get(`/api/runs/${mockRunId}/trades?offset=-5`, {
      headers: {
        "Authorization": "Bearer mock-jwt-token"
      }
    });

    expect(response.status()).toBe(400);

    const errorResponse = await response.json();
    expect(errorResponse).toHaveProperty("error");
    expect(errorResponse.message).toContain("offset");
  });

  test("should return 404 for non-existent runId", async ({ request }) => {
    const nonExistentId = "00000000-0000-0000-0000-000000000000";

    const response = await request.get(`/api/runs/${nonExistentId}/trades`, {
      headers: {
        "Authorization": "Bearer mock-jwt-token"
      }
    });

    expect(response.status()).toBe(404);

    const errorResponse = await response.json();
    expect(errorResponse).toHaveProperty("error");
    expect(errorResponse.message).toContain("not found");
  });

  test("should return 400 for invalid runId UUID format", async ({ request }) => {
    const invalidId = "invalid-uuid-format";

    const response = await request.get(`/api/runs/${invalidId}/trades`, {
      headers: {
        "Authorization": "Bearer mock-jwt-token"
      }
    });

    expect(response.status()).toBe(400);

    const errorResponse = await response.json();
    expect(errorResponse).toHaveProperty("error");
    expect(errorResponse.message).toContain("Invalid");
  });

  test("should return 401 for unauthenticated user", async ({ request }) => {
    const response = await request.get(`/api/runs/${mockRunId}/trades`);

    expect(response.status()).toBe(401);

    const errorResponse = await response.json();
    expect(errorResponse).toHaveProperty("error");
    expect(errorResponse.error).toBe("Unauthorized");
  });

  test("should return 403 for unauthorized access to other user's trades", async ({ request }) => {
    const response = await request.get(`/api/runs/${mockRunId}/trades`, {
      headers: {
        "Authorization": "Bearer other-user-jwt-token"
      }
    });

    expect([403, 404]).toContain(response.status());

    const errorResponse = await response.json();
    expect(errorResponse).toHaveProperty("error");
  });

  test("should return empty array for run with no trades", async ({ request }) => {
    const emptyRunId = "empty-run-id-example";

    const response = await request.get(`/api/runs/${emptyRunId}/trades`, {
      headers: {
        "Authorization": "Bearer mock-jwt-token"
      }
    });

    // Should return 200 with empty trades array or 404 if run doesn't exist
    expect([200, 404]).toContain(response.status());

    if (response.status() === 200) {
      const tradesResponse = await response.json();
      expect(tradesResponse.trades).toEqual([]);
      expect(tradesResponse.total).toBe(0);
    }
  });
});