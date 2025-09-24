/**
 * T050: Backtesting API Endpoint
 * POST /api/backtest - Start a new backtest or get backtest results
 */

import type { APIRoute } from "astro";
import { supabase } from "../../lib/supabase.js";
import { backtestingService, type BacktestRequest } from "../../lib/services/backtesting.service.js";
import { tradingUserService } from "../../lib/services/trading-user.service.js";
import type { RunParameters } from "../../lib/types/trading-run.js";

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

// POST /api/backtest - Start a new backtest
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
    if (!body.coin_symbol || typeof body.coin_symbol !== "string") {
      return new Response(
        JSON.stringify({ error: "coin_symbol is required and must be a string" }),
        {
          status: 400,
          headers: { "Content-Type": "application/json" }
        }
      );
    }

    if (!body.start_date || !body.end_date) {
      return new Response(
        JSON.stringify({ 
          error: "start_date and end_date are required",
          example: { start_date: "2023-01-01", end_date: "2023-03-31" }
        }),
        {
          status: 400,
          headers: { "Content-Type": "application/json" }
        }
      );
    }

    // Validate dates
    const startDate = new Date(body.start_date);
    const endDate = new Date(body.end_date);

    if (isNaN(startDate.getTime()) || isNaN(endDate.getTime())) {
      return new Response(
        JSON.stringify({ 
          error: "Invalid date format. Use YYYY-MM-DD or ISO format",
          example: { start_date: "2023-01-01", end_date: "2023-03-31" }
        }),
        {
          status: 400,
          headers: { "Content-Type": "application/json" }
        }
      );
    }

    if (startDate >= endDate) {
      return new Response(
        JSON.stringify({ error: "start_date must be before end_date" }),
        {
          status: 400,
          headers: { "Content-Type": "application/json" }
        }
      );
    }

    if (endDate > new Date()) {
      return new Response(
        JSON.stringify({ error: "end_date cannot be in the future" }),
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

    // Validate and set parameters
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

    // Validate parameters
    if (defaultParams.stop_loss_percentage < 0 || defaultParams.stop_loss_percentage > 50) {
      return new Response(
        JSON.stringify({ error: "stop_loss_percentage must be between 0 and 50" }),
        {
          status: 400,
          headers: { "Content-Type": "application/json" }
        }
      );
    }

    if (defaultParams.take_profit_percentage < 0 || defaultParams.take_profit_percentage > 200) {
      return new Response(
        JSON.stringify({ error: "take_profit_percentage must be between 0 and 200" }),
        {
          status: 400,
          headers: { "Content-Type": "application/json" }
        }
      );
    }

    if (defaultParams.confidence_threshold < 0.1 || defaultParams.confidence_threshold > 1.0) {
      return new Response(
        JSON.stringify({ error: "confidence_threshold must be between 0.1 and 1.0" }),
        {
          status: 400,
          headers: { "Content-Type": "application/json" }
        }
      );
    }

    if (defaultParams.max_open_positions < 1 || defaultParams.max_open_positions > 10) {
      return new Response(
        JSON.stringify({ error: "max_open_positions must be between 1 and 10" }),
        {
          status: 400,
          headers: { "Content-Type": "application/json" }
        }
      );
    }

    // Check user's active backtest limit (max 3 concurrent)
    const activeRuns = await backtestingService.getUserBacktests(user.id, 100);
    const activeBacktests = activeRuns.filter(run => !run.session_end);
    
    if (activeBacktests.length >= 3) {
      return new Response(
        JSON.stringify({ 
          error: "Maximum of 3 active backtests allowed. Please wait for current backtests to complete.",
          active_backtests: activeBacktests.length
        }),
        {
          status: 400,
          headers: { "Content-Type": "application/json" }
        }
      );
    }

    // Determine backtest mode
    const mode = body.mode || "full"; // full, quick
    
    if (!["full", "quick"].includes(mode)) {
      return new Response(
        JSON.stringify({ error: "mode must be 'full' or 'quick'" }),
        {
          status: 400,
          headers: { "Content-Type": "application/json" }
        }
      );
    }

    // Create backtest request
    const backtestRequest: BacktestRequest = {
      coinSymbol: body.coin_symbol.toUpperCase(),
      startDate: startDate.toISOString(),
      endDate: endDate.toISOString(),
      startingCapital,
      parameters: defaultParams,
      userId: user.id
    };

    try {
      let result;
      
      if (mode === "quick") {
        // Run quick backtest (synchronous, simplified)
        result = await backtestingService.runQuickBacktest(backtestRequest);
        
        return new Response(
          JSON.stringify({
            success: true,
            mode: "quick",
            data: {
              run: result.run,
              performance: result.performance,
              timeline: result.timeline.slice(-30), // Last 30 data points
              trade_count: result.trades.length
            },
            message: "Quick backtest completed successfully"
          }),
          {
            status: 200,
            headers: { "Content-Type": "application/json" }
          }
        );
      } else {
        // Start full backtest (asynchronous)
        const runId = await backtestingService.startBacktest(backtestRequest);
        
        return new Response(
          JSON.stringify({
            success: true,
            mode: "full",
            data: {
              run_id: runId,
              status: "started",
              estimated_completion: new Date(Date.now() + 5 * 60 * 1000).toISOString() // ~5 minutes
            },
            message: "Backtest started successfully. Use the run_id to check progress.",
            progress_endpoint: `/api/runs/${runId}`
          }),
          {
            status: 202, // Accepted
            headers: { "Content-Type": "application/json" }
          }
        );
      }
    } catch (error: any) {
      console.error("Backtest execution failed:", error);
      
      // Handle specific backtest errors
      if (error.message.includes("rate limit")) {
        return new Response(
          JSON.stringify({ 
            error: "Rate limit exceeded for market data",
            message: "Please wait before starting another backtest"
          }),
          {
            status: 429,
            headers: { 
              "Content-Type": "application/json",
              "Retry-After": "300" // 5 minutes
            }
          }
        );
      }

      if (error.message.includes("not found")) {
        return new Response(
          JSON.stringify({ 
            error: `Cryptocurrency '${body.coin_symbol.toUpperCase()}' not found`,
            message: "Please check the coin symbol and try again"
          }),
          {
            status: 404,
            headers: { "Content-Type": "application/json" }
          }
        );
      }

      return new Response(
        JSON.stringify({
          error: "Failed to start backtest",
          message: error.message
        }),
        {
          status: 500,
          headers: { "Content-Type": "application/json" }
        }
      );
    }

  } catch (error: any) {
    console.error("Failed to process backtest request:", error);
    return new Response(
      JSON.stringify({
        error: "Failed to process backtest request",
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
      "Access-Control-Allow-Methods": "POST, OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type, Authorization"
    }
  });
};