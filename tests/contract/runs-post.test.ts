import { test, expect } from "@playwright/test";

/**
 * T012: Contract test POST /api/runs
 * Validates API contract compliance for creating new trading runs
 * Must fail until implementation exists (TDD approach)
 */

test.describe("POST /api/runs - Contract Test", () => {
  const validRunData = {
    session_type: "simulation",
    coin_symbol: "BTC",
    starting_capital: 10000,
    parameters: {
      stop_loss_percent: 2.0,
      take_profit_percent: 5.0
    }
  };

  const validBacktestData = {
    session_type: "backtest",
    coin_symbol: "ETH",
    starting_capital: 15000,
    time_period_start: "2024-01-01T00:00:00Z",
    time_period_end: "2024-01-31T23:59:59Z",
    parameters: {
      stop_loss_percent: 3.0,
      take_profit_percent: 7.0
    }
  };

  test("should create simulation run successfully", async ({ request }) => {
    // This test MUST FAIL initially (TDD approach)
    const response = await request.post("/api/runs", {
      headers: {
        "Authorization": "Bearer mock-jwt-token",
        "Content-Type": "application/json"
      },
      data: validRunData
    });

    expect(response.status()).toBe(201);

    const newRun = await response.json();

    // Validate response schema matches TradingRun type
    expect(newRun).toHaveProperty("id");
    expect(newRun).toHaveProperty("user_id");
    expect(newRun.session_type).toBe(validRunData.session_type);
    expect(newRun.coin_symbol).toBe(validRunData.coin_symbol);
    expect(newRun.starting_capital).toBe(validRunData.starting_capital);
    expect(newRun.final_capital).toBeNull(); // Should be null for new run
    expect(newRun.total_trades).toBe(0);
    expect(newRun.winning_trades).toBe(0);
    expect(newRun.win_rate).toBeNull();
    expect(newRun.total_return).toBeNull();
    expect(newRun.max_drawdown).toBeNull();
    expect(newRun.session_start).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/);
    expect(newRun.session_end).toBeNull();
    expect(newRun.time_period_start).toBeNull(); // Null for simulation
    expect(newRun.time_period_end).toBeNull(); // Null for simulation
    expect(newRun.ai_model_version).toBeTruthy();
    expect(newRun.parameters).toEqual(validRunData.parameters);
    expect(newRun.created_at).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/);

    // Validate UUID format
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    expect(newRun.id).toMatch(uuidRegex);
  });

  test("should create backtest run successfully", async ({ request }) => {
    const response = await request.post("/api/runs", {
      headers: {
        "Authorization": "Bearer mock-jwt-token",
        "Content-Type": "application/json"
      },
      data: validBacktestData
    });

    expect(response.status()).toBe(201);

    const newRun = await response.json();

    expect(newRun.session_type).toBe("backtest");
    expect(newRun.time_period_start).toBe(validBacktestData.time_period_start);
    expect(newRun.time_period_end).toBe(validBacktestData.time_period_end);
  });

  test("should return 400 for missing required fields", async ({ request }) => {
    const invalidData = {
      coin_symbol: "BTC"
      // Missing session_type and starting_capital
    };

    const response = await request.post("/api/runs", {
      headers: {
        "Authorization": "Bearer mock-jwt-token",
        "Content-Type": "application/json"
      },
      data: invalidData
    });

    expect(response.status()).toBe(400);

    const errorResponse = await response.json();
    expect(errorResponse).toHaveProperty("error");
    expect(errorResponse.message).toContain("session_type");
  });

  test("should return 400 for invalid session_type", async ({ request }) => {
    const invalidData = {
      ...validRunData,
      session_type: "invalid_type"
    };

    const response = await request.post("/api/runs", {
      headers: {
        "Authorization": "Bearer mock-jwt-token",
        "Content-Type": "application/json"
      },
      data: invalidData
    });

    expect(response.status()).toBe(400);

    const errorResponse = await response.json();
    expect(errorResponse.error).toBe("Invalid input data");
    expect(errorResponse.message).toContain("session_type");
  });

  test("should return 400 for negative starting_capital", async ({ request }) => {
    const invalidData = {
      ...validRunData,
      starting_capital: -1000
    };

    const response = await request.post("/api/runs", {
      headers: {
        "Authorization": "Bearer mock-jwt-token",
        "Content-Type": "application/json"
      },
      data: invalidData
    });

    expect(response.status()).toBe(400);

    const errorResponse = await response.json();
    expect(errorResponse.error).toBe("Invalid input data");
    expect(errorResponse.message).toContain("starting_capital");
  });

  test("should return 400 for backtest without time periods", async ({ request }) => {
    const invalidData = {
      session_type: "backtest",
      coin_symbol: "ETH",
      starting_capital: 10000
      // Missing time_period_start and time_period_end
    };

    const response = await request.post("/api/runs", {
      headers: {
        "Authorization": "Bearer mock-jwt-token",
        "Content-Type": "application/json"
      },
      data: invalidData
    });

    expect(response.status()).toBe(400);

    const errorResponse = await response.json();
    expect(errorResponse.error).toBe("Invalid input data");
    expect(errorResponse.message).toContain("time_period");
  });

  test("should return 401 for unauthenticated user", async ({ request }) => {
    const response = await request.post("/api/runs", {
      headers: { "Content-Type": "application/json" },
      data: validRunData
    });

    expect(response.status()).toBe(401);

    const errorResponse = await response.json();
    expect(errorResponse).toHaveProperty("error");
    expect(errorResponse.error).toBe("Unauthorized");
  });

  test("should allow guest users (no auth header)", async ({ request }) => {
    const response = await request.post("/api/runs", {
      headers: { "Content-Type": "application/json" },
      data: validRunData
    });

    // For guest users, should either succeed (201) or require auth (401)
    // Implementation decision depends on requirements
    expect([201, 401]).toContain(response.status());

    if (response.status() === 201) {
      const guestRun = await response.json();
      expect(guestRun.user_id).toBeNull(); // Guest sessions have null user_id
    }
  });
});