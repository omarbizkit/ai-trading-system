/**
 * T039 & T040: User Profile API Endpoints
 * GET /api/user/profile - Get user profile
 * PUT /api/user/profile - Update user profile
 */

export const prerender = false;

import type { APIRoute } from "astro";
import { supabase } from "../../../lib/supabase.js";
import { tradingUserService } from "../../../lib/services/trading-user.service.js";
import type {
  TradingUser,
  UpdateTradingUserRequest,
  UserPreferences
} from "../../../lib/types/trading-user.js";

// GET /api/user/profile - Get user profile
export const GET: APIRoute = async ({ request }) => {
  try {
    // Get user from Supabase Auth
    const authorization = request.headers.get("Authorization");
    if (!authorization?.startsWith("Bearer ")) {
      return new Response(
        JSON.stringify({ error: "Missing or invalid authorization header" }),
        {
          status: 401,
          headers: { "Content-Type": "application/json" }
        }
      );
    }

    const token = authorization.replace("Bearer ", "");
    const { data: { user }, error: authError } = await supabase.auth.getUser(token);

    if (authError || !user) {
      return new Response(
        JSON.stringify({ error: "Invalid or expired token" }),
        {
          status: 401,
          headers: { "Content-Type": "application/json" }
        }
      );
    }

    // Get or create user profile
    let tradingUser = await tradingUserService.getUserById(user.id);
    
    if (!tradingUser) {
      // Create new user profile with defaults
      tradingUser = await tradingUserService.createUser({
        id: user.id,
        display_name: user.user_metadata?.display_name || user.email?.split("@")[0] || "Anonymous",
        default_capital: 10000, // Default $10k virtual capital
        risk_tolerance: "medium",
        preferred_coins: ["BTC", "ETH"],
        notification_settings: {
          email_alerts: false,
          push_notifications: true,
          trade_confirmations: true,
          performance_reports: true,
          market_updates: false,
          ai_insights: true
        }
      });
    }

    return new Response(
      JSON.stringify({
        success: true,
        data: tradingUser
      }),
      {
        status: 200,
        headers: { "Content-Type": "application/json" }
      }
    );

  } catch (error: any) {
    console.error("Failed to get user profile:", error);
    return new Response(
      JSON.stringify({
        error: "Failed to retrieve user profile",
        message: error.message
      }),
      {
        status: 500,
        headers: { "Content-Type": "application/json" }
      }
    );
  }
};

// PUT /api/user/profile - Update user profile
export const PUT: APIRoute = async ({ request }) => {
  try {
    // Get user from Supabase Auth
    const authorization = request.headers.get("Authorization");
    if (!authorization?.startsWith("Bearer ")) {
      return new Response(
        JSON.stringify({ error: "Missing or invalid authorization header" }),
        {
          status: 401,
          headers: { "Content-Type": "application/json" }
        }
      );
    }

    const token = authorization.replace("Bearer ", "");
    const { data: { user }, error: authError } = await supabase.auth.getUser(token);

    if (authError || !user) {
      return new Response(
        JSON.stringify({ error: "Invalid or expired token" }),
        {
          status: 401,
          headers: { "Content-Type": "application/json" }
        }
      );
    }

    // Parse request body
    const body = await request.json();
    const updates: UpdateTradingUserRequest = {};

    // Validate and sanitize updates
    if (body.display_name !== undefined) {
      if (typeof body.display_name !== "string" || body.display_name.length < 1 || body.display_name.length > 50) {
        return new Response(
          JSON.stringify({ error: "Display name must be between 1 and 50 characters" }),
          {
            status: 400,
            headers: { "Content-Type": "application/json" }
          }
        );
      }
      updates.display_name = body.display_name.trim();
    }

    if (body.default_capital !== undefined) {
      if (typeof body.default_capital !== "number" || body.default_capital < 100 || body.default_capital > 1000000) {
        return new Response(
          JSON.stringify({ error: "Default capital must be between $100 and $1,000,000" }),
          {
            status: 400,
            headers: { "Content-Type": "application/json" }
          }
        );
      }
      updates.default_capital = body.default_capital;
    }

    if (body.risk_tolerance !== undefined) {
      if (!["low", "medium", "high"].includes(body.risk_tolerance)) {
        return new Response(
          JSON.stringify({ error: "Risk tolerance must be 'low', 'medium', or 'high'" }),
          {
            status: 400,
            headers: { "Content-Type": "application/json" }
          }
        );
      }
      updates.risk_tolerance = body.risk_tolerance;
    }

    if (body.preferred_coins !== undefined) {
      if (!Array.isArray(body.preferred_coins) || body.preferred_coins.length > 10) {
        return new Response(
          JSON.stringify({ error: "Preferred coins must be an array with max 10 items" }),
          {
            status: 400,
            headers: { "Content-Type": "application/json" }
          }
        );
      }
      // Validate coin symbols (uppercase, 2-10 chars)
      const validCoins = body.preferred_coins.filter((coin: any) => 
        typeof coin === "string" && /^[A-Z]{2,10}$/.test(coin)
      );
      updates.preferred_coins = validCoins;
    }

    if (body.notification_settings !== undefined) {
      if (typeof body.notification_settings !== "object") {
        return new Response(
          JSON.stringify({ error: "Notification settings must be an object" }),
          {
            status: 400,
            headers: { "Content-Type": "application/json" }
          }
        );
      }
      updates.notification_settings = body.notification_settings;
    }

    // Check if user exists, create if not
    let existingUser = await tradingUserService.getUserById(user.id);
    if (!existingUser) {
      existingUser = await tradingUserService.createUser({
        id: user.id,
        display_name: updates.display_name || user.user_metadata?.display_name || user.email?.split("@")[0] || "Anonymous",
        default_capital: updates.default_capital || 10000,
        risk_tolerance: updates.risk_tolerance || "medium",
        preferred_coins: updates.preferred_coins || ["BTC", "ETH"],
        notification_settings: updates.notification_settings || {
          email_alerts: false,
          push_notifications: true,
          trade_confirmations: true,
          performance_reports: true,
          market_updates: false,
          ai_insights: true
        }
      });
    } else {
      existingUser = await tradingUserService.updateUser(user.id, updates);
    }

    return new Response(
      JSON.stringify({
        success: true,
        data: existingUser
      }),
      {
        status: 200,
        headers: { "Content-Type": "application/json" }
      }
    );

  } catch (error: any) {
    console.error("Failed to update user profile:", error);
    return new Response(
      JSON.stringify({
        error: "Failed to update user profile",
        message: error.message
      }),
      {
        status: 500,
        headers: { "Content-Type": "application/json" }
      }
    );
  }
};

// OPTIONS for CORS
export const OPTIONS: APIRoute = async () => {
  return new Response(null, {
    status: 200,
    headers: {
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Methods": "GET, PUT, OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type, Authorization"
    }
  });
};