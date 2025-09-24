import { test, expect } from "@playwright/test";

/**
 * T020: Contract test POST /api/backtest
 * Validates API contract compliance for running backtesting simulations
 * Must fail until implementation exists (TDD approach)
 */

test.describe("POST /api/backtest - Contract Test", () => {
  const validBacktestData = {
    coin_symbol: "BTC",
    start_date: "2024-01-01T00:00:00Z",
    end_date: "2024-01-31T23:59:59Z",
    starting_capital: 10000,
    parameters: {
      stop_loss_percent: 2.0,
      take_profit_percent: 5.0,
      ai_model_version: "v1.2.3"
    }
  };

  test("should run backtest successfully", async ({ request }) => {
    // This test MUST FAIL initially (TDD approach)
    const response = await request.post("/api/backtest", {
      headers: {
        "Content-Type": "application/json"
      },
      data: validBacktestData
    });

    expect(response.status()).toBe(200);

    const backtestResult = await response.json();

    // Validate response schema matches TradingRun type
    expect(backtestResult).toHaveProperty("id");
    expect(backtestResult).toHaveProperty("user_id");
    expect(backtestResult).toHaveProperty("session_type");
    expect(backtestResult).toHaveProperty("coin_symbol");
    expect(backtestResult).toHaveProperty("starting_capital");
    expect(backtestResult).toHaveProperty("final_capital");
    expect(backtestResult).toHaveProperty("total_trades");
    expect(backtestResult).toHaveProperty("winning_trades");
    expect(backtestResult).toHaveProperty("win_rate");
    expect(backtestResult).toHaveProperty("total_return");
    expect(backtestResult).toHaveProperty("max_drawdown");
    expect(backtestResult).toHaveProperty("session_start");
    expect(backtestResult).toHaveProperty("session_end");
    expect(backtestResult).toHaveProperty("time_period_start");
    expect(backtestResult).toHaveProperty("time_period_end");
    expect(backtestResult).toHaveProperty("ai_model_version");
    expect(backtestResult).toHaveProperty("parameters");
    expect(backtestResult).toHaveProperty("created_at");

    // Validate backtest-specific values
    expect(backtestResult.session_type).toBe("backtest");
    expect(backtestResult.coin_symbol).toBe(validBacktestData.coin_symbol);
    expect(backtestResult.starting_capital).toBe(validBacktestData.starting_capital);
    expect(backtestResult.time_period_start).toBe(validBacktestData.start_date);
    expect(backtestResult.time_period_end).toBe(validBacktestData.end_date);
    expect(backtestResult.ai_model_version).toBe(validBacktestData.parameters.ai_model_version);
    expect(backtestResult.parameters).toMatchObject(validBacktestData.parameters);

    // Validate completed backtest values
    expect(backtestResult.session_end).not.toBeNull();
    expect(typeof backtestResult.final_capital).toBe("number");
    expect(backtestResult.final_capital).toBeGreaterThanOrEqual(0);
    expect(typeof backtestResult.total_trades).toBe("number");
    expect(backtestResult.total_trades).toBeGreaterThanOrEqual(0);
    expect(typeof backtestResult.winning_trades).toBe("number");
    expect(backtestResult.winning_trades).toBeGreaterThanOrEqual(0);
    expect(backtestResult.winning_trades).toBeLessThanOrEqual(backtestResult.total_trades);

    // Validate calculated metrics
    if (backtestResult.total_trades > 0) {
      expect(typeof backtestResult.win_rate).toBe("number");
      expect(backtestResult.win_rate).toBeGreaterThanOrEqual(0);
      expect(backtestResult.win_rate).toBeLessThanOrEqual(100);

      const expectedWinRate = (backtestResult.winning_trades / backtestResult.total_trades) * 100;
      expect(Math.abs(backtestResult.win_rate - expectedWinRate)).toBeLessThan(0.01);
    }

    if (backtestResult.starting_capital > 0) {
      expect(typeof backtestResult.total_return).toBe("number");
      const expectedReturn = ((backtestResult.final_capital - backtestResult.starting_capital) / backtestResult.starting_capital) * 100;
      expect(Math.abs(backtestResult.total_return - expectedReturn)).toBeLessThan(0.01);
    }

    if (backtestResult.max_drawdown !== null) {
      expect(typeof backtestResult.max_drawdown).toBe("number");
      expect(backtestResult.max_drawdown).toBeLessThanOrEqual(0); // Drawdown is negative
    }

    // Validate timestamps
    expect(backtestResult.session_start).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/);
    expect(backtestResult.session_end).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/);
    expect(backtestResult.created_at).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/);

    // session_end should be after session_start
    expect(new Date(backtestResult.session_end).getTime()).toBeGreaterThan(
      new Date(backtestResult.session_start).getTime()
    );

    // Validate UUID format
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    expect(backtestResult.id).toMatch(uuidRegex);
  });

  test("should run backtest for different coin symbols", async ({ request }) => {
    const ethBacktestData = {
      ...validBacktestData,
      coin_symbol: "ETH"
    };

    const response = await request.post("/api/backtest", {
      headers: { "Content-Type": "application/json" },
      data: ethBacktestData
    });

    expect(response.status()).toBe(200);

    const backtestResult = await response.json();
    expect(backtestResult.coin_symbol).toBe("ETH");
  });

  test("should handle different time periods", async ({ request }) => {
    const shortPeriodData = {
      ...validBacktestData,
      start_date: "2024-01-01T00:00:00Z",
      end_date: "2024-01-07T23:59:59Z" // 1 week
    };

    const response = await request.post("/api/backtest", {
      headers: { "Content-Type": "application/json" },
      data: shortPeriodData
    });

    expect(response.status()).toBe(200);

    const backtestResult = await response.json();
    expect(backtestResult.time_period_start).toBe(shortPeriodData.start_date);
    expect(backtestResult.time_period_end).toBe(shortPeriodData.end_date);
  });

  test("should handle different risk parameters", async ({ request }) => {
    const conservativeParams = {
      ...validBacktestData,
      parameters: {
        stop_loss_percent: 1.0, // More conservative
        take_profit_percent: 3.0,
        ai_model_version: "v1.2.3"
      }
    };

    const response = await request.post("/api/backtest", {
      headers: { "Content-Type": "application/json" },
      data: conservativeParams
    });

    expect(response.status()).toBe(200);

    const backtestResult = await response.json();
    expect(backtestResult.parameters.stop_loss_percent).toBe(1.0);
    expect(backtestResult.parameters.take_profit_percent).toBe(3.0);
  });

  test("should return 400 for missing required fields", async ({ request }) => {
    const invalidData = {
      coin_symbol: "BTC"
      // Missing start_date, end_date, starting_capital
    };

    const response = await request.post("/api/backtest", {
      headers: { "Content-Type": "application/json" },
      data: invalidData
    });

    expect(response.status()).toBe(400);

    const errorResponse = await response.json();
    expect(errorResponse).toHaveProperty("error");
    expect(errorResponse.message).toContain("start_date");
  });

  test("should return 400 for invalid date format", async ({ request }) => {
    const invalidData = {
      ...validBacktestData,
      start_date: "invalid-date-format"
    };

    const response = await request.post("/api/backtest", {
      headers: { "Content-Type": "application/json" },
      data: invalidData
    });

    expect(response.status()).toBe(400);

    const errorResponse = await response.json();
    expect(errorResponse.error).toBe("Invalid input data");
    expect(errorResponse.message).toContain("start_date");
  });

  test("should return 400 for start_date after end_date", async ({ request }) => {
    const invalidData = {
      ...validBacktestData,
      start_date: "2024-02-01T00:00:00Z",
      end_date: "2024-01-15T00:00:00Z" // Earlier than start_date
    };

    const response = await request.post("/api/backtest", {
      headers: { "Content-Type": "application/json" },
      data: invalidData
    });

    expect(response.status()).toBe(400);

    const errorResponse = await response.json();
    expect(errorResponse.error).toBe("Invalid input data");
    expect(errorResponse.message).toContain("end_date");
  });

  test("should return 400 for negative starting_capital", async ({ request }) => {
    const invalidData = {
      ...validBacktestData,
      starting_capital: -1000
    };

    const response = await request.post("/api/backtest", {
      headers: { "Content-Type": "application/json" },
      data: invalidData
    });

    expect(response.status()).toBe(400);

    const errorResponse = await response.json();
    expect(errorResponse.error).toBe("Invalid input data");
    expect(errorResponse.message).toContain("starting_capital");
  });

  test("should return 400 for future dates", async ({ request }) => {
    const futureData = {
      ...validBacktestData,
      start_date: "2030-01-01T00:00:00Z",
      end_date: "2030-01-31T23:59:59Z"
    };

    const response = await request.post("/api/backtest", {
      headers: { "Content-Type": "application/json" },
      data: futureData
    });

    expect(response.status()).toBe(400);

    const errorResponse = await response.json();
    expect(errorResponse.error).toBe("Invalid input data");
    expect(errorResponse.message).toContain("future");
  });

  test("should return 400 for unsupported coin symbol", async ({ request }) => {
    const invalidData = {
      ...validBacktestData,
      coin_symbol: "INVALID"
    };

    const response = await request.post("/api/backtest", {
      headers: { "Content-Type": "application/json" },
      data: invalidData
    });

    expect(response.status()).toBe(400);

    const errorResponse = await response.json();
    expect(errorResponse.error).toBe("Invalid input data");
    expect(errorResponse.message).toContain("coin_symbol");
  });

  test("should respect performance requirements", async ({ request }) => {
    const startTime = Date.now();
    const response = await request.post("/api/backtest", {
      headers: { "Content-Type": "application/json" },
      data: validBacktestData
    });
    const endTime = Date.now();

    expect(response.status()).toBe(200);

    const responseTime = endTime - startTime;
    // Backtest should complete within 30 seconds (performance requirement)
    expect(responseTime).toBeLessThan(30000);
  });

  test("should handle large time periods efficiently", async ({ request }) => {
    const largeRangeData = {
      ...validBacktestData,
      start_date: "2023-01-01T00:00:00Z",
      end_date: "2023-12-31T23:59:59Z" // Full year
    };

    const startTime = Date.now();
    const response = await request.post("/api/backtest", {
      headers: { "Content-Type": "application/json" },
      data: largeRangeData
    });
    const endTime = Date.now();

    expect(response.status()).toBe(200);

    const responseTime = endTime - startTime;
    // Even large backtests should complete within reasonable time
    expect(responseTime).toBeLessThan(60000); // 1 minute max

    const backtestResult = await response.json();
    expect(backtestResult.total_trades).toBeGreaterThan(0); // Should have executed trades
  });

  test("should allow authenticated user backtests", async ({ request }) => {
    const response = await request.post("/api/backtest", {
      headers: {
        "Authorization": "Bearer mock-jwt-token",
        "Content-Type": "application/json"
      },
      data: validBacktestData
    });

    expect(response.status()).toBe(200);

    const backtestResult = await response.json();
    // For authenticated users, should link to user_id
    expect(backtestResult.user_id).not.toBeNull();
  });
});