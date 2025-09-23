import { test, expect } from "@playwright/test";

/**
 * Contract Test: GET /api/user/profile
 *
 * This test validates the API contract for retrieving user trading profiles.
 * It should FAIL until the endpoint is implemented.
 */

test.describe("GET /api/user/profile - Contract Test", () => {
  test("should return user profile for authenticated user", async ({ request }) => {
    // This test MUST FAIL initially (TDD approach)
    const response = await request.get("/api/user/profile", {
      headers: {
        "Authorization": "Bearer mock-jwt-token"
      }
    });

    expect(response.status()).toBe(200);

    const userProfile = await response.json();

    // Validate response schema matches TradingUser type
    expect(userProfile).toHaveProperty("id");
    expect(userProfile).toHaveProperty("display_name");
    expect(userProfile).toHaveProperty("default_capital");
    expect(userProfile).toHaveProperty("risk_tolerance");
    expect(userProfile).toHaveProperty("preferred_coins");
    expect(userProfile).toHaveProperty("notification_settings");
    expect(userProfile).toHaveProperty("created_at");
    expect(userProfile).toHaveProperty("updated_at");

    // Validate field types and constraints
    expect(typeof userProfile.id).toBe("string");
    expect(typeof userProfile.display_name).toBe("string");
    expect(userProfile.display_name.length).toBeGreaterThanOrEqual(3);
    expect(userProfile.display_name.length).toBeLessThanOrEqual(50);

    expect(typeof userProfile.default_capital).toBe("number");
    expect(userProfile.default_capital).toBeGreaterThan(0);
    expect(userProfile.default_capital).toBeLessThanOrEqual(1000000);

    expect(["low", "medium", "high"]).toContain(userProfile.risk_tolerance);
    expect(Array.isArray(userProfile.preferred_coins)).toBe(true);
    expect(userProfile.preferred_coins.length).toBeLessThanOrEqual(10);

    expect(typeof userProfile.notification_settings).toBe("object");
    expect(userProfile.created_at).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/);
    expect(userProfile.updated_at).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/);
  });

  test("should return 401 for unauthenticated user", async ({ request }) => {
    const response = await request.get("/api/user/profile");

    expect(response.status()).toBe(401);

    const errorResponse = await response.json();
    expect(errorResponse).toHaveProperty("error");
    expect(errorResponse).toHaveProperty("message");
  });

  test("should return 401 for invalid token", async ({ request }) => {
    const response = await request.get("/api/user/profile", {
      headers: {
        "Authorization": "Bearer invalid-token"
      }
    });

    expect(response.status()).toBe(401);

    const errorResponse = await response.json();
    expect(errorResponse).toHaveProperty("error");
    expect(errorResponse.error).toBe("Unauthorized");
  });
});