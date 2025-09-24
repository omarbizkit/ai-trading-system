/**
 * T043 & T044: Trading Run Details API Endpoints
 * GET /api/runs/[runId] - Get run details
 * PATCH /api/runs/[runId] - Update run settings
 */

import type { APIRoute } from "astro";
import { supabase } from "../../../lib/supabase.js";
import { tradingRunService } from "../../../lib/services/trading-run.service.js";
import { tradeService } from "../../../lib/services/trade.service.js";
import type {
  TradingRun,
  UpdateTradingRunRequest,
  RunParameters
} from "../../../lib/types/trading-run.js";

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

// Helper function to validate run access
async function validateRunAccess(runId: string, userId: string) {
  const run = await tradingRunService.getRunById(runId);
  
  if (!run) {
    return { error: "Trading run not found", status: 404 };
  }

  if (run.user_id !== userId) {
    return { error: "Access denied. This run belongs to another user.", status: 403 };
  }

  return { run };
}

// GET /api/runs/[runId] - Get run details
export const GET: APIRoute = async ({ params, request, url }) => {
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
    const runId = params.runId;

    if (!runId) {
      return new Response(
        JSON.stringify({ error: "Run ID is required" }),
        {
          status: 400,
          headers: { "Content-Type": "application/json" }
        }
      );
    }

    const runAccess = await validateRunAccess(runId, user.id);
    if ("error" in runAccess) {
      return new Response(
        JSON.stringify({ error: runAccess.error }),
        {
          status: runAccess.status,
          headers: { "Content-Type": "application/json" }
        }
      );
    }

    const { run } = runAccess;

    // Parse query parameters for additional data
    const include_trades = url.searchParams.get("include_trades") === "true";
    const include_performance = url.searchParams.get("include_performance") === "true";
    const trades_limit = Math.min(parseInt(url.searchParams.get("trades_limit") || "50"), 100);

    let trades = undefined;
    let performance = undefined;

    if (include_trades) {
      trades = await tradeService.getTradesByRunId(runId, trades_limit);
    }

    if (include_performance) {
      performance = await tradeService.getTradePerformance(runId);
    }

    // Get run summary
    const summary = await tradingRunService.getRunSummary(runId);

    return new Response(
      JSON.stringify({
        success: true,
        data: {
          ...run,
          summary,
          ...(trades && { trades }),
          ...(performance && { performance })
        }
      }),
      {
        status: 200,
        headers: { "Content-Type": "application/json" }
      }
    );

  } catch (error: any) {
    console.error("Failed to get run details:", error);
    return new Response(
      JSON.stringify({
        error: "Failed to retrieve run details",
        message: error.message
      }),
      {
        status: 500,
        headers: { "Content-Type": "application/json" }
      }
    );
  }
};

// PATCH /api/runs/[runId] - Update run settings
export const PATCH: APIRoute = async ({ params, request }) => {
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
    const runId = params.runId;

    if (!runId) {
      return new Response(
        JSON.stringify({ error: "Run ID is required" }),
        {
          status: 400,
          headers: { "Content-Type": "application/json" }
        }
      );
    }

    const runAccess = await validateRunAccess(runId, user.id);
    if ("error" in runAccess) {
      return new Response(
        JSON.stringify({ error: runAccess.error }),
        {
          status: runAccess.status,
          headers: { "Content-Type": "application/json" }
        }
      );
    }

    const { run } = runAccess;

    // Parse request body
    const body = await request.json();
    const updates: UpdateTradingRunRequest = {};

    // Handle different update operations
    if (body.action) {
      switch (body.action) {
        case "end_run":
          if (run.session_end) {
            return new Response(
              JSON.stringify({ error: "Run is already ended" }),
              {
                status: 400,
                headers: { "Content-Type": "application/json" }
              }
            );
          }

          const finalCapital = body.final_capital;
          if (typeof finalCapital !== "number" || finalCapital < 0) {
            return new Response(
              JSON.stringify({ error: "final_capital is required and must be a positive number" }),
              {
                status: 400,
                headers: { "Content-Type": "application/json" }
              }
            );
          }

          const endedRun = await tradingRunService.endRun(runId, finalCapital);
          return new Response(
            JSON.stringify({
              success: true,
              data: endedRun,
              message: "Trading run ended successfully"
            }),
            {
              status: 200,
              headers: { "Content-Type": "application/json" }
            }
          );

        case "update_parameters":
          if (run.session_end) {
            return new Response(
              JSON.stringify({ error: "Cannot update parameters for ended runs" }),
              {
                status: 400,
                headers: { "Content-Type": "application/json" }
              }
            );
          }

          if (!body.parameters || typeof body.parameters !== "object") {
            return new Response(
              JSON.stringify({ error: "parameters object is required" }),
              {
                status: 400,
                headers: { "Content-Type": "application/json" }
              }
            );
          }

          // Validate and sanitize parameters
          const currentParams = run.parameters as RunParameters;
          const newParams: Partial<RunParameters> = {};

          if (body.parameters.max_trade_amount !== undefined) {
            if (typeof body.parameters.max_trade_amount !== "number" || body.parameters.max_trade_amount <= 0) {
              return new Response(
                JSON.stringify({ error: "max_trade_amount must be a positive number" }),
                {
                  status: 400,
                  headers: { "Content-Type": "application/json" }
                }
              );
            }
            newParams.max_trade_amount = Math.min(body.parameters.max_trade_amount, run.starting_capital * 0.5);
          }

          if (body.parameters.stop_loss_percentage !== undefined) {
            if (typeof body.parameters.stop_loss_percentage !== "number" || 
                body.parameters.stop_loss_percentage < 0 || 
                body.parameters.stop_loss_percentage > 50) {
              return new Response(
                JSON.stringify({ error: "stop_loss_percentage must be between 0 and 50" }),
                {
                  status: 400,
                  headers: { "Content-Type": "application/json" }
                }
              );
            }
            newParams.stop_loss_percentage = body.parameters.stop_loss_percentage;
          }

          if (body.parameters.take_profit_percentage !== undefined) {
            if (typeof body.parameters.take_profit_percentage !== "number" || 
                body.parameters.take_profit_percentage < 0 || 
                body.parameters.take_profit_percentage > 200) {
              return new Response(
                JSON.stringify({ error: "take_profit_percentage must be between 0 and 200" }),
                {
                  status: 400,
                  headers: { "Content-Type": "application/json" }
                }
              );
            }
            newParams.take_profit_percentage = body.parameters.take_profit_percentage;
          }

          if (body.parameters.confidence_threshold !== undefined) {
            if (typeof body.parameters.confidence_threshold !== "number" || 
                body.parameters.confidence_threshold < 0.1 || 
                body.parameters.confidence_threshold > 1.0) {
              return new Response(
                JSON.stringify({ error: "confidence_threshold must be between 0.1 and 1.0" }),
                {
                  status: 400,
                  headers: { "Content-Type": "application/json" }
                }
              );
            }
            newParams.confidence_threshold = body.parameters.confidence_threshold;
          }

          if (body.parameters.max_open_positions !== undefined) {
            if (!Number.isInteger(body.parameters.max_open_positions) || 
                body.parameters.max_open_positions < 1 || 
                body.parameters.max_open_positions > 10) {
              return new Response(
                JSON.stringify({ error: "max_open_positions must be an integer between 1 and 10" }),
                {
                  status: 400,
                  headers: { "Content-Type": "application/json" }
                }
              );
            }
            newParams.max_open_positions = body.parameters.max_open_positions;
          }

          if (body.parameters.enable_stop_loss !== undefined) {
            newParams.enable_stop_loss = Boolean(body.parameters.enable_stop_loss);
          }

          if (body.parameters.enable_take_profit !== undefined) {
            newParams.enable_take_profit = Boolean(body.parameters.enable_take_profit);
          }

          const updatedRun = await tradingRunService.updateRunParameters(runId, newParams);
          return new Response(
            JSON.stringify({
              success: true,
              data: updatedRun,
              message: "Run parameters updated successfully"
            }),
            {
              status: 200,
              headers: { "Content-Type": "application/json" }
            }
          );

        default:
          return new Response(
            JSON.stringify({ error: "Invalid action. Supported actions: end_run, update_parameters" }),
            {
              status: 400,
              headers: { "Content-Type": "application/json" }
            }
          );
      }
    }

    // Direct field updates (legacy support)
    if (body.final_capital !== undefined) {
      updates.final_capital = body.final_capital;
      updates.session_end = new Date().toISOString();
    }

    if (Object.keys(updates).length === 0) {
      return new Response(
        JSON.stringify({ error: "No valid updates provided. Use action parameter for specific operations." }),
        {
          status: 400,
          headers: { "Content-Type": "application/json" }
        }
      );
    }

    const updatedRun = await tradingRunService.updateRun(runId, updates);

    return new Response(
      JSON.stringify({
        success: true,
        data: updatedRun,
        message: "Trading run updated successfully"
      }),
      {
        status: 200,
        headers: { "Content-Type": "application/json" }
      }
    );

  } catch (error: any) {
    console.error("Failed to update run:", error);
    return new Response(
      JSON.stringify({
        error: "Failed to update trading run",
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
      "Access-Control-Allow-Methods": "GET, PATCH, OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type, Authorization"
    }
  });
};