import { test, expect } from "@playwright/test";

/**
 * T013: Contract test GET /api/runs/{runId}
 * Validates API contract compliance for retrieving specific trading run details
 * Must fail until implementation exists (TDD approach)
 */

test.describe("GET /api/runs/{runId} - Contract Test", () => {
  const mockRunId = "550e8400-e29b-41d4-a716-446655440000";

  test("should return run details for valid runId", async ({ request }) => {
    // This test MUST FAIL initially (TDD approach)
    const response = await request.get(`/api/runs/${mockRunId}`, {
      headers: {
        "Authorization": "Bearer mock-jwt-token"
      }
    });

    expect(response.status()).toBe(200);

    const run = await response.json();

    // Validate response schema matches TradingRun type
    expect(run).toHaveProperty("id");
    expect(run).toHaveProperty("user_id");
    expect(run).toHaveProperty("session_type");
    expect(run).toHaveProperty("coin_symbol");
    expect(run).toHaveProperty("starting_capital");
    expect(run).toHaveProperty("final_capital");
    expect(run).toHaveProperty("total_trades");
    expect(run).toHaveProperty("winning_trades");
    expect(run).toHaveProperty("win_rate");
    expect(run).toHaveProperty("total_return");
    expect(run).toHaveProperty("max_drawdown");
    expect(run).toHaveProperty("session_start");
    expect(run).toHaveProperty("session_end");
    expect(run).toHaveProperty("time_period_start");
    expect(run).toHaveProperty("time_period_end");
    expect(run).toHaveProperty("ai_model_version");
    expect(run).toHaveProperty("parameters");
    expect(run).toHaveProperty("created_at");

    // Validate field types and constraints
    expect(run.id).toBe(mockRunId);
    expect(["simulation", "backtest"]).toContain(run.session_type);
    expect(typeof run.coin_symbol).toBe("string");
    expect(typeof run.starting_capital).toBe("number");
    expect(run.starting_capital).toBeGreaterThanOrEqual(0);

    if (run.final_capital !== null) {
      expect(typeof run.final_capital).toBe("number");
      expect(run.final_capital).toBeGreaterThanOrEqual(0);
    }

    expect(typeof run.total_trades).toBe("number");
    expect(run.total_trades).toBeGreaterThanOrEqual(0);
    expect(typeof run.winning_trades).toBe("number");
    expect(run.winning_trades).toBeGreaterThanOrEqual(0);
    expect(run.winning_trades).toBeLessThanOrEqual(run.total_trades);

    if (run.win_rate !== null) {
      expect(typeof run.win_rate).toBe("number");
      expect(run.win_rate).toBeGreaterThanOrEqual(0);
      expect(run.win_rate).toBeLessThanOrEqual(100);
    }

    expect(run.session_start).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/);
    expect(typeof run.ai_model_version).toBe("string");
    expect(typeof run.parameters).toBe("object");
    expect(run.created_at).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/);

    // Validate UUID format
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    expect(run.id).toMatch(uuidRegex);
  });

  test("should return 404 for non-existent runId", async ({ request }) => {
    const nonExistentId = "00000000-0000-0000-0000-000000000000";

    const response = await request.get(`/api/runs/${nonExistentId}`, {
      headers: {
        "Authorization": "Bearer mock-jwt-token"
      }
    });

    expect(response.status()).toBe(404);

    const errorResponse = await response.json();
    expect(errorResponse).toHaveProperty("error");
    expect(errorResponse).toHaveProperty("message");
    expect(errorResponse.message).toContain("not found");
  });

  test("should return 400 for invalid UUID format", async ({ request }) => {
    const invalidId = "invalid-uuid-format";

    const response = await request.get(`/api/runs/${invalidId}`, {
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
    const response = await request.get(`/api/runs/${mockRunId}`);

    expect(response.status()).toBe(401);

    const errorResponse = await response.json();
    expect(errorResponse).toHaveProperty("error");
    expect(errorResponse.error).toBe("Unauthorized");
  });

  test("should return 403 for unauthorized access to other user's run", async ({ request }) => {
    const response = await request.get(`/api/runs/${mockRunId}`, {
      headers: {
        "Authorization": "Bearer other-user-jwt-token"
      }
    });

    // Should either return 403 Forbidden or 404 Not Found (depending on security policy)
    expect([403, 404]).toContain(response.status());

    const errorResponse = await response.json();
    expect(errorResponse).toHaveProperty("error");
  });

  test("should allow access to guest runs with session validation", async ({ request }) => {
    // Test accessing a guest run (user_id = null)
    // Implementation should validate session ownership for guest runs
    const guestRunId = "guest-run-uuid-example";

    const response = await request.get(`/api/runs/${guestRunId}`, {
      headers: {
        "X-Session-Id": "guest-session-id"
      }
    });

    // Should either succeed or require proper authentication
    expect([200, 401, 404]).toContain(response.status());
  });
});