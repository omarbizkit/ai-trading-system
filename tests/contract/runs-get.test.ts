import { test, expect } from "@playwright/test";

/**
 * Contract Test: GET /api/runs
 *
 * This test validates the API contract for retrieving trading runs.
 * It should FAIL until the endpoint is implemented.
 */

test.describe("GET /api/runs - Contract Test", () => {
  test("should return paginated list of trading runs", async ({ request }) => {
    // This test MUST FAIL initially (TDD approach)
    const response = await request.get("/api/runs", {
      headers: {
        "Authorization": "Bearer mock-jwt-token"
      }
    });

    expect(response.status()).toBe(200);

    const runsResponse = await response.json();

    // Validate response structure
    expect(runsResponse).toHaveProperty("runs");
    expect(runsResponse).toHaveProperty("total");
    expect(runsResponse).toHaveProperty("has_more");

    expect(Array.isArray(runsResponse.runs)).toBe(true);
    expect(typeof runsResponse.total).toBe("number");
    expect(typeof runsResponse.has_more).toBe("boolean");

    // If runs exist, validate TradingRun schema
    if (runsResponse.runs.length > 0) {
      const run = runsResponse.runs[0];

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
      expect(run).toHaveProperty("ai_model_version");
      expect(run).toHaveProperty("parameters");
      expect(run).toHaveProperty("created_at");

      // Validate field types and constraints
      expect(typeof run.id).toBe("string");
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
    }
  });

  test("should support pagination with limit parameter", async ({ request }) => {
    const response = await request.get("/api/runs?limit=5", {
      headers: {
        "Authorization": "Bearer mock-jwt-token"
      }
    });

    expect(response.status()).toBe(200);

    const runsResponse = await response.json();
    expect(runsResponse.runs.length).toBeLessThanOrEqual(5);
  });

  test("should support pagination with offset parameter", async ({ request }) => {
    const response = await request.get("/api/runs?limit=10&offset=5", {
      headers: {
        "Authorization": "Bearer mock-jwt-token"
      }
    });

    expect(response.status()).toBe(200);

    const runsResponse = await response.json();
    expect(runsResponse).toHaveProperty("runs");
    expect(runsResponse).toHaveProperty("total");
    expect(runsResponse).toHaveProperty("has_more");
  });

  test("should filter by session_type parameter", async ({ request }) => {
    const response = await request.get("/api/runs?session_type=simulation", {
      headers: {
        "Authorization": "Bearer mock-jwt-token"
      }
    });

    expect(response.status()).toBe(200);

    const runsResponse = await response.json();

    // All returned runs should be simulations
    runsResponse.runs.forEach((run: any) => {
      expect(run.session_type).toBe("simulation");
    });
  });

  test("should return 400 for invalid limit parameter", async ({ request }) => {
    const response = await request.get("/api/runs?limit=150", { // Exceeds maximum of 100
      headers: {
        "Authorization": "Bearer mock-jwt-token"
      }
    });

    expect(response.status()).toBe(400);

    const errorResponse = await response.json();
    expect(errorResponse).toHaveProperty("error");
    expect(errorResponse.message).toContain("limit");
  });

  test("should return 400 for invalid session_type parameter", async ({ request }) => {
    const response = await request.get("/api/runs?session_type=invalid", {
      headers: {
        "Authorization": "Bearer mock-jwt-token"
      }
    });

    expect(response.status()).toBe(400);

    const errorResponse = await response.json();
    expect(errorResponse).toHaveProperty("error");
    expect(errorResponse.message).toContain("session_type");
  });

  test("should return 401 for unauthenticated user", async ({ request }) => {
    const response = await request.get("/api/runs");

    expect(response.status()).toBe(401);

    const errorResponse = await response.json();
    expect(errorResponse).toHaveProperty("error");
    expect(errorResponse.error).toBe("Unauthorized");
  });
});