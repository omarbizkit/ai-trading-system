/**
 * T041 & T042: Trading Runs API Endpoints
 * GET /api/runs - Get user's trading runs
 * POST /api/runs - Create new trading run
 */

import type { APIRoute } from "astro";
import { supabase } from "../../lib/supabase.js";
import { tradingRunService } from "../../lib/services/trading-run.service.js";
import { tradingUserService } from "../../lib/services/trading-user.service.js";
import type {
  TradingRun,
  CreateTradingRunRequest,
  RunParameters
} from "../../lib/types/trading-run.js";

// Helper function to authenticate user
async function authenticateUser(request: Request) {
  const authorization = request.headers.get("Authorization");
  if (!authorization?.startsWith("Bearer ")) {
    return { error: "Missing or invalid authorization header", status: 401 };
  }

  const token = authorization.replace("Bearer ", "");
  const { data: { user }, error: authError } = await supabase.auth.getUser(token);

  if (authError || !user) {
    return { error: "Invalid or expired token", status: 401 };
  }

  return { user };
}

// GET /api/runs - Get user's trading runs
export const GET: APIRoute = async ({ request, url }) => {
  try {
    const auth = await authenticateUser(request);
    if ("error" in auth) {
      return new Response(
        JSON.stringify({ error: auth.error }),
        {
          status: auth.status,
          headers: { "Content-Type": "application/json" }
        }
      );
    }

    const { user } = auth;

    // Parse query parameters
    const limit = Math.min(parseInt(url.searchParams.get("limit") || "20"), 100);
    const offset = Math.max(parseInt(url.searchParams.get("offset") || "0"), 0);
    const session_type = url.searchParams.get("session_type"); // "simulation" or "backtest"
    const coin_symbol = url.searchParams.get("coin_symbol");
    const active_only = url.searchParams.get("active_only") === "true";

    let runs: TradingRun[];

    if (active_only) {
      runs = await tradingRunService.getActiveRunsByUserId(user.id);
    } else {
      runs = await tradingRunService.getRunsByUserId(user.id, limit, offset);
    }

    // Apply additional filters
    if (session_type) {
      runs = runs.filter(run => run.session_type === session_type);
    }

    if (coin_symbol) {
      runs = runs.filter(run => run.coin_symbol.toUpperCase() === coin_symbol.toUpperCase());
    }

    // Get additional statistics if requested
    const include_stats = url.searchParams.get("include_stats") === "true";
    let stats = undefined;

    if (include_stats) {
      stats = await tradingRunService.getUserPerformanceStats(user.id);
    }

    return new Response(
      JSON.stringify({
        success: true,
        data: runs,
        meta: {
          total: runs.length,
          limit,
          offset,
          filters: {
            session_type,
            coin_symbol,
            active_only
          }
        },
        ...(stats && { stats })
      }),
      {
        status: 200,
        headers: { "Content-Type": "application/json" }
      }
    );

  } catch (error: any) {
    console.error("Failed to get trading runs:", error);
    return new Response(
      JSON.stringify({
        error: "Failed to retrieve trading runs",
        message: error.message
      }),
      {
        status: 500,
        headers: { "Content-Type": "application/json" }
      }
    );
  }
};

// POST /api/runs - Create new trading run
export const POST: APIRoute = async ({ request }) => {
  try {
    const auth = await authenticateUser(request);
    if ("error" in auth) {
      return new Response(
        JSON.stringify({ error: auth.error }),
        {
          status: auth.status,
          headers: { "Content-Type": "application/json" }
        }
      );
    }

    const { user } = auth;

    // Parse request body
    const body = await request.json();

    // Validate required fields
    if (!body.session_type || !["simulation", "backtest"].includes(body.session_type)) {
      return new Response(
        JSON.stringify({ error: "session_type is required and must be 'simulation' or 'backtest'" }),
        {
          status: 400,
          headers: { "Content-Type": "application/json" }
        }
      );
    }

    if (!body.coin_symbol || typeof body.coin_symbol !== "string") {
      return new Response(
        JSON.stringify({ error: "coin_symbol is required and must be a string" }),
        {
          status: 400,
          headers: { "Content-Type": "application/json" }
        }
      );
    }

    // Get user preferences for default capital
    const userProfile = await tradingUserService.getUserById(user.id);
    let startingCapital = body.starting_capital;

    if (!startingCapital) {
      startingCapital = userProfile?.default_capital || 10000;
    }

    // Validate starting capital
    if (typeof startingCapital !== "number" || startingCapital < 100 || startingCapital > 1000000) {
      return new Response(
        JSON.stringify({ error: "starting_capital must be between $100 and $1,000,000" }),
        {
          status: 400,
          headers: { "Content-Type": "application/json" }
        }
      );
    }

    // Validate time period for backtests
    if (body.session_type === "backtest") {
      if (!body.time_period_start || !body.time_period_end) {
        return new Response(
          JSON.stringify({ error: "time_period_start and time_period_end are required for backtests" }),
          {
            status: 400,
            headers: { "Content-Type": "application/json" }
          }
        );
      }

      const startDate = new Date(body.time_period_start);
      const endDate = new Date(body.time_period_end);

      if (startDate >= endDate) {
        return new Response(
          JSON.stringify({ error: "time_period_start must be before time_period_end" }),
          {
            status: 400,
            headers: { "Content-Type": "application/json" }
          }
        );
      }

      if (endDate > new Date()) {
        return new Response(
          JSON.stringify({ error: "time_period_end cannot be in the future" }),
          {
            status: 400,
            headers: { "Content-Type": "application/json" }
          }
        );
      }

      // Check maximum backtest period (1 year)
      const maxPeriod = 365 * 24 * 60 * 60 * 1000;
      if (endDate.getTime() - startDate.getTime() > maxPeriod) {
        return new Response(
          JSON.stringify({ error: "Backtest period cannot exceed 1 year" }),
          {
            status: 400,
            headers: { "Content-Type": "application/json" }
          }
        );
      }
    }

    // Validate and set default parameters
    const defaultParams: RunParameters = {
      max_trade_amount: Math.min(body.parameters?.max_trade_amount || 1000, startingCapital * 0.1),
      stop_loss_percentage: body.parameters?.stop_loss_percentage || 5,
      take_profit_percentage: body.parameters?.take_profit_percentage || 10,
      confidence_threshold: body.parameters?.confidence_threshold || 0.7,
      max_open_positions: body.parameters?.max_open_positions || 3,
      enable_stop_loss: body.parameters?.enable_stop_loss ?? true,
      enable_take_profit: body.parameters?.enable_take_profit ?? true,
      trading_hours: body.parameters?.trading_hours || {
        start: "00:00",
        end: "23:59",
        timezone: "UTC"
      }
    };

    // Check user's active run limit (max 5 active runs)
    const activeRuns = await tradingRunService.getActiveRunsByUserId(user.id);
    if (activeRuns.length >= 5) {
      return new Response(
        JSON.stringify({ error: "Maximum of 5 active trading runs allowed. Please end a run before starting a new one." }),
        {
          status: 400,
          headers: { "Content-Type": "application/json" }
        }
      );
    }

    // Create trading run request
    const runRequest: CreateTradingRunRequest = {
      user_id: user.id,
      session_type: body.session_type,
      coin_symbol: body.coin_symbol.toUpperCase(),
      starting_capital: startingCapital,
      time_period_start: body.time_period_start || null,
      time_period_end: body.time_period_end || null,
      ai_model_version: "v1.2.3", // Current model version
      parameters: defaultParams
    };

    // Create the trading run
    const newRun = await tradingRunService.createRun(runRequest);

    return new Response(
      JSON.stringify({
        success: true,
        data: newRun,
        message: `${body.session_type === "simulation" ? "Simulation" : "Backtest"} started successfully`
      }),
      {
        status: 201,
        headers: { "Content-Type": "application/json" }
      }
    );

  } catch (error: any) {
    console.error("Failed to create trading run:", error);
    return new Response(
      JSON.stringify({
        error: "Failed to create trading run",
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
      "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type, Authorization"
    }
  });
};