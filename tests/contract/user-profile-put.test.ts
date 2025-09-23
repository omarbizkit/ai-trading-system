import { test, expect } from "@playwright/test";

/**
 * Contract Test: PUT /api/user/profile
 *
 * This test validates the API contract for updating user trading profiles.
 * It should FAIL until the endpoint is implemented.
 */

test.describe("PUT /api/user/profile - Contract Test", () => {
  test("should update user profile with valid data", async ({ request }) => {
    const updateData = {
      display_name: "Test Trader",
      default_capital: 15000,
      risk_tolerance: "medium",
      preferred_coins: ["BTC", "ETH", "ADA"],
      notification_settings: {
        email_alerts: true,
        trade_confirmations: true,
        daily_summary: false
      }
    };

    // This test MUST FAIL initially (TDD approach)
    const response = await request.put("/api/user/profile", {
      headers: {
        "Authorization": "Bearer mock-jwt-token",
        "Content-Type": "application/json"
      },
      data: updateData
    });

    expect(response.status()).toBe(200);

    const updatedProfile = await response.json();

    // Validate that the response contains updated values
    expect(updatedProfile.display_name).toBe(updateData.display_name);
    expect(updatedProfile.default_capital).toBe(updateData.default_capital);
    expect(updatedProfile.risk_tolerance).toBe(updateData.risk_tolerance);
    expect(updatedProfile.preferred_coins).toEqual(updateData.preferred_coins);
    expect(updatedProfile.notification_settings).toEqual(updateData.notification_settings);

    // Validate that updated_at timestamp has changed
    expect(updatedProfile.updated_at).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/);
  });

  test("should return 400 for invalid display_name (too short)", async ({ request }) => {
    const invalidData = {
      display_name: "ab", // Too short (minimum 3 characters)
      default_capital: 10000
    };

    const response = await request.put("/api/user/profile", {
      headers: {
        "Authorization": "Bearer mock-jwt-token",
        "Content-Type": "application/json"
      },
      data: invalidData
    });

    expect(response.status()).toBe(400);

    const errorResponse = await response.json();
    expect(errorResponse).toHaveProperty("error");
    expect(errorResponse.message).toContain("display_name");
  });

  test("should return 400 for invalid default_capital (too high)", async ({ request }) => {
    const invalidData = {
      display_name: "Valid Name",
      default_capital: 1500000 // Exceeds maximum of 1,000,000
    };

    const response = await request.put("/api/user/profile", {
      headers: {
        "Authorization": "Bearer mock-jwt-token",
        "Content-Type": "application/json"
      },
      data: invalidData
    });

    expect(response.status()).toBe(400);

    const errorResponse = await response.json();
    expect(errorResponse).toHaveProperty("error");
    expect(errorResponse.message).toContain("default_capital");
  });

  test("should return 400 for invalid risk_tolerance", async ({ request }) => {
    const invalidData = {
      display_name: "Valid Name",
      risk_tolerance: "extreme" // Invalid enum value
    };

    const response = await request.put("/api/user/profile", {
      headers: {
        "Authorization": "Bearer mock-jwt-token",
        "Content-Type": "application/json"
      },
      data: invalidData
    });

    expect(response.status()).toBe(400);

    const errorResponse = await response.json();
    expect(errorResponse).toHaveProperty("error");
    expect(errorResponse.message).toContain("risk_tolerance");
  });

  test("should return 400 for too many preferred_coins", async ({ request }) => {
    const invalidData = {
      display_name: "Valid Name",
      preferred_coins: ["BTC", "ETH", "ADA", "DOT", "LINK", "MATIC", "SOL", "AVAX", "ATOM", "ALGO", "XRP"] // 11 items, max is 10
    };

    const response = await request.put("/api/user/profile", {
      headers: {
        "Authorization": "Bearer mock-jwt-token",
        "Content-Type": "application/json"
      },
      data: invalidData
    });

    expect(response.status()).toBe(400);

    const errorResponse = await response.json();
    expect(errorResponse).toHaveProperty("error");
    expect(errorResponse.message).toContain("preferred_coins");
  });

  test("should return 401 for unauthenticated user", async ({ request }) => {
    const updateData = {
      display_name: "Test Trader",
      default_capital: 15000
    };

    const response = await request.put("/api/user/profile", {
      headers: {
        "Content-Type": "application/json"
      },
      data: updateData
    });

    expect(response.status()).toBe(401);

    const errorResponse = await response.json();
    expect(errorResponse).toHaveProperty("error");
    expect(errorResponse.error).toBe("Unauthorized");
  });
});