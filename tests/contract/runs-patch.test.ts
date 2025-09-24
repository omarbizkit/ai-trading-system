import { test, expect } from "@playwright/test";

/**
 * T014: Contract test PATCH /api/runs/{runId}
 * Validates API contract compliance for updating trading run (typically to end session)
 * Must fail until implementation exists (TDD approach)
 */

test.describe("PATCH /api/runs/{runId} - Contract Test", () => {
  const mockRunId = "550e8400-e29b-41d4-a716-446655440000";

  test("should update run with session_end and final_capital", async ({ request }) => {
    // This test MUST FAIL initially (TDD approach)
    const updateData = {
      session_end: "2024-09-23T18:30:00Z",
      final_capital: 12500.75
    };

    const response = await request.patch(`/api/runs/${mockRunId}`, {
      headers: {
        "Authorization": "Bearer mock-jwt-token",
        "Content-Type": "application/json"
      },
      data: updateData
    });

    expect(response.status()).toBe(200);

    const updatedRun = await response.json();

    // Validate that the response contains updated values
    expect(updatedRun.session_end).toBe(updateData.session_end);
    expect(updatedRun.final_capital).toBe(updateData.final_capital);

    // Should maintain other properties
    expect(updatedRun).toHaveProperty("id");
    expect(updatedRun).toHaveProperty("user_id");
    expect(updatedRun).toHaveProperty("session_type");
    expect(updatedRun).toHaveProperty("coin_symbol");
    expect(updatedRun).toHaveProperty("starting_capital");
    expect(updatedRun).toHaveProperty("total_trades");
    expect(updatedRun).toHaveProperty("ai_model_version");
    expect(updatedRun).toHaveProperty("parameters");

    // Validate field constraints
    expect(updatedRun.final_capital).toBeGreaterThanOrEqual(0);
    expect(updatedRun.session_end).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/);

    // session_end should be after session_start
    expect(new Date(updatedRun.session_end).getTime()).toBeGreaterThan(
      new Date(updatedRun.session_start).getTime()
    );
  });

  test("should calculate and update performance metrics", async ({ request }) => {
    const updateData = {
      session_end: "2024-09-23T18:30:00Z",
      final_capital: 8500.00 // Loss scenario
    };

    const response = await request.patch(`/api/runs/${mockRunId}`, {
      headers: {
        "Authorization": "Bearer mock-jwt-token",
        "Content-Type": "application/json"
      },
      data: updateData
    });

    expect(response.status()).toBe(200);

    const updatedRun = await response.json();

    // Performance metrics should be calculated
    if (updatedRun.total_trades > 0) {
      expect(typeof updatedRun.win_rate).toBe("number");
      expect(updatedRun.win_rate).toBeGreaterThanOrEqual(0);
      expect(updatedRun.win_rate).toBeLessThanOrEqual(100);
    }

    if (updatedRun.starting_capital > 0) {
      expect(typeof updatedRun.total_return).toBe("number");
      const expectedReturn = ((updatedRun.final_capital - updatedRun.starting_capital) / updatedRun.starting_capital) * 100;
      expect(Math.abs(updatedRun.total_return - expectedReturn)).toBeLessThan(0.01); // Allow for rounding
    }

    if (updatedRun.max_drawdown !== null) {
      expect(typeof updatedRun.max_drawdown).toBe("number");
      expect(updatedRun.max_drawdown).toBeLessThanOrEqual(0); // Drawdown is negative
    }
  });

  test("should return 400 for invalid session_end format", async ({ request }) => {
    const invalidData = {
      session_end: "invalid-date-format",
      final_capital: 10000
    };

    const response = await request.patch(`/api/runs/${mockRunId}`, {
      headers: {
        "Authorization": "Bearer mock-jwt-token",
        "Content-Type": "application/json"
      },
      data: invalidData
    });

    expect(response.status()).toBe(400);

    const errorResponse = await response.json();
    expect(errorResponse).toHaveProperty("error");
    expect(errorResponse.message).toContain("session_end");
  });

  test("should return 400 for negative final_capital", async ({ request }) => {
    const invalidData = {
      session_end: "2024-09-23T18:30:00Z",
      final_capital: -500
    };

    const response = await request.patch(`/api/runs/${mockRunId}`, {
      headers: {
        "Authorization": "Bearer mock-jwt-token",
        "Content-Type": "application/json"
      },
      data: invalidData
    });

    expect(response.status()).toBe(400);

    const errorResponse = await response.json();
    expect(errorResponse).toHaveProperty("error");
    expect(errorResponse.message).toContain("final_capital");
  });

  test("should return 400 for session_end before session_start", async ({ request }) => {
    const invalidData = {
      session_end: "2020-01-01T00:00:00Z", // Past date, likely before session_start
      final_capital: 10000
    };

    const response = await request.patch(`/api/runs/${mockRunId}`, {
      headers: {
        "Authorization": "Bearer mock-jwt-token",
        "Content-Type": "application/json"
      },
      data: invalidData
    });

    expect(response.status()).toBe(400);

    const errorResponse = await response.json();
    expect(errorResponse).toHaveProperty("error");
    expect(errorResponse.message).toContain("session_end");
  });

  test("should return 404 for non-existent runId", async ({ request }) => {
    const nonExistentId = "00000000-0000-0000-0000-000000000000";
    const updateData = {
      session_end: "2024-09-23T18:30:00Z",
      final_capital: 10000
    };

    const response = await request.patch(`/api/runs/${nonExistentId}`, {
      headers: {
        "Authorization": "Bearer mock-jwt-token",
        "Content-Type": "application/json"
      },
      data: updateData
    });

    expect(response.status()).toBe(404);

    const errorResponse = await response.json();
    expect(errorResponse).toHaveProperty("error");
    expect(errorResponse.message).toContain("not found");
  });

  test("should return 400 for invalid UUID format", async ({ request }) => {
    const invalidId = "invalid-uuid";
    const updateData = {
      session_end: "2024-09-23T18:30:00Z",
      final_capital: 10000
    };

    const response = await request.patch(`/api/runs/${invalidId}`, {
      headers: {
        "Authorization": "Bearer mock-jwt-token",
        "Content-Type": "application/json"
      },
      data: updateData
    });

    expect(response.status()).toBe(400);

    const errorResponse = await response.json();
    expect(errorResponse).toHaveProperty("error");
    expect(errorResponse.message).toContain("Invalid");
  });

  test("should return 401 for unauthenticated user", async ({ request }) => {
    const updateData = {
      session_end: "2024-09-23T18:30:00Z",
      final_capital: 10000
    };

    const response = await request.patch(`/api/runs/${mockRunId}`, {
      headers: { "Content-Type": "application/json" },
      data: updateData
    });

    expect(response.status()).toBe(401);

    const errorResponse = await response.json();
    expect(errorResponse).toHaveProperty("error");
    expect(errorResponse.error).toBe("Unauthorized");
  });

  test("should return 403 for unauthorized access to other user's run", async ({ request }) => {
    const updateData = {
      session_end: "2024-09-23T18:30:00Z",
      final_capital: 10000
    };

    const response = await request.patch(`/api/runs/${mockRunId}`, {
      headers: {
        "Authorization": "Bearer other-user-jwt-token",
        "Content-Type": "application/json"
      },
      data: updateData
    });

    expect([403, 404]).toContain(response.status());

    const errorResponse = await response.json();
    expect(errorResponse).toHaveProperty("error");
  });

  test("should prevent updating already completed runs", async ({ request }) => {
    // Try to update a run that already has session_end set
    const updateData = {
      session_end: "2024-09-23T20:00:00Z",
      final_capital: 15000
    };

    const response = await request.patch(`/api/runs/${mockRunId}`, {
      headers: {
        "Authorization": "Bearer mock-jwt-token",
        "Content-Type": "application/json"
      },
      data: updateData
    });

    // Should either succeed (allow overwrites) or return 409 Conflict
    expect([200, 409]).toContain(response.status());

    if (response.status() === 409) {
      const errorResponse = await response.json();
      expect(errorResponse).toHaveProperty("error");
      expect(errorResponse.message).toContain("already completed");
    }
  });
});