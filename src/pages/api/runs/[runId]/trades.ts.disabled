/**
 * T045 & T046: Trading Trades API Endpoints
 * GET /api/runs/[runId]/trades - Get trades for a run
 * POST /api/runs/[runId]/trades - Execute new trade
 */

export const prerender = false;

import type { APIRoute } from "astro";
import { supabase } from "../../../../lib/supabase.js";
import { tradingRunService } from "../../../../lib/services/trading-run.service.js";
import { tradeService } from "../../../../lib/services/trade.service.js";
import { marketDataService } from "../../../../lib/services/market-data.service.js";
import type {
  Trade,
  CreateTradeRequest,
  TradeType,
  TradeReason
} from "../../../../lib/types/trade.js";
import type { TradingRun } from "../../../../lib/types/trading-run.js";

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

// GET /api/runs/[runId]/trades - Get trades for a run
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

    // Parse query parameters
    const limit = Math.min(parseInt(url.searchParams.get("limit") || "50"), 100);
    const offset = Math.max(parseInt(url.searchParams.get("offset") || "0"), 0);
    const trade_type = url.searchParams.get("trade_type") as TradeType | null;
    const include_summary = url.searchParams.get("include_summary") === "true";
    const include_performance = url.searchParams.get("include_performance") === "true";

    // Get trades
    let trades = await tradeService.getTradesByRunId(runId, limit, offset);

    // Apply trade type filter
    if (trade_type && ["buy", "sell"].includes(trade_type)) {
      trades = trades.filter(trade => trade.trade_type === trade_type);
    }

    // Get additional data if requested
    let summary = undefined;
    let performance = undefined;

    if (include_summary) {
      summary = await tradeService.getTradeSummariesByRunId(runId);
    }

    if (include_performance) {
      performance = await tradeService.getTradePerformance(runId);
    }

    return new Response(
      JSON.stringify({
        success: true,
        data: trades,
        meta: {
          total: trades.length,
          limit,
          offset,
          run_id: runId,
          filters: {
            trade_type
          }
        },
        ...(summary && { summary }),
        ...(performance && { performance })
      }),
      {
        status: 200,
        headers: { "Content-Type": "application/json" }
      }
    );

  } catch (error: any) {
    console.error("Failed to get trades:", error);
    return new Response(
      JSON.stringify({
        error: "Failed to retrieve trades",
        message: error.message
      }),
      {
        status: 500,
        headers: { "Content-Type": "application/json" }
      }
    );
  }
};

// POST /api/runs/[runId]/trades - Execute new trade
export const POST: APIRoute = async ({ params, request }) => {
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

    // Check if run is active
    if (run.session_end) {
      return new Response(
        JSON.stringify({ error: "Cannot execute trades on ended runs" }),
        {
          status: 400,
          headers: { "Content-Type": "application/json" }
        }
      );
    }

    // Parse request body
    const body = await request.json();

    // Validate required fields
    if (!body.trade_type || !["buy", "sell"].includes(body.trade_type)) {
      return new Response(
        JSON.stringify({ error: "trade_type is required and must be 'buy' or 'sell'" }),
        {
          status: 400,
          headers: { "Content-Type": "application/json" }
        }
      );
    }

    if (!body.quantity || typeof body.quantity !== "number" || body.quantity <= 0) {
      return new Response(
        JSON.stringify({ error: "quantity is required and must be a positive number" }),
        {
          status: 400,
          headers: { "Content-Type": "application/json" }
        }
      );
    }

    if (!body.trade_reason || typeof body.trade_reason !== "string") {
      return new Response(
        JSON.stringify({ error: "trade_reason is required" }),
        {
          status: 400,
          headers: { "Content-Type": "application/json" }
        }
      );
    }

    const validReasons: TradeReason[] = ["ai_signal", "manual", "stop_loss", "take_profit", "risk_management"];
    if (!validReasons.includes(body.trade_reason)) {
      return new Response(
        JSON.stringify({ 
          error: `trade_reason must be one of: ${validReasons.join(", ")}` 
        }),
        {
          status: 400,
          headers: { "Content-Type": "application/json" }
        }
      );
    }

    // Get current market price
    const marketData = await marketDataService.getMarketData({
      coin_symbol: run.coin_symbol,
      include_historical: false
    });

    const currentPrice = marketData.current_price;
    if (!currentPrice || currentPrice <= 0) {
      return new Response(
        JSON.stringify({ error: "Unable to get current market price" }),
        {
          status: 503,
          headers: { "Content-Type": "application/json" }
        }
      );
    }

    // Calculate trade value and validate against run parameters
    const tradeValue = body.quantity * currentPrice;
    const runParams = run.parameters as any;
    const maxTradeAmount = runParams?.max_trade_amount || run.starting_capital * 0.1;

    if (tradeValue > maxTradeAmount) {
      return new Response(
        JSON.stringify({ 
          error: `Trade value ($${tradeValue.toFixed(2)}) exceeds maximum allowed ($${maxTradeAmount.toFixed(2)})` 
        }),
        {
          status: 400,
          headers: { "Content-Type": "application/json" }
        }
      );
    }

    // Get current portfolio value (simplified - would need more complex calculation)
    const existingTrades = await tradeService.getTradesByRunId(runId, 1000); // Get all trades
    let currentPortfolioValue = run.starting_capital;
    
    // Calculate current portfolio value from trades
    let cashBalance = run.starting_capital;
    let position = 0;
    
    for (const trade of existingTrades) {
      if (trade.trade_type === "buy") {
        cashBalance -= trade.net_value;
        position += trade.quantity;
      } else {
        cashBalance += trade.net_value;
        position -= trade.quantity;
      }
    }
    
    currentPortfolioValue = cashBalance + (position * currentPrice);

    // Validate trade feasibility
    if (body.trade_type === "buy") {
      const requiredCash = tradeValue * 1.01; // Include 1% buffer for fees
      if (cashBalance < requiredCash) {
        return new Response(
          JSON.stringify({ 
            error: `Insufficient cash balance. Required: $${requiredCash.toFixed(2)}, Available: $${cashBalance.toFixed(2)}` 
          }),
          {
            status: 400,
            headers: { "Content-Type": "application/json" }
          }
        );
      }
    } else {
      // Sell trade
      if (position < body.quantity) {
        return new Response(
          JSON.stringify({ 
            error: `Insufficient position. Trying to sell ${body.quantity}, but only have ${position}` 
          }),
          {
            status: 400,
            headers: { "Content-Type": "application/json" }
          }
        );
      }
    }

    // Create trade request
    const tradeRequest: CreateTradeRequest = {
      trade_type: body.trade_type,
      coin_symbol: run.coin_symbol,
      quantity: body.quantity,
      trade_reason: body.trade_reason,
      ai_confidence: body.ai_confidence || null
    };

    // Execute the trade
    const executedTrade = await tradeService.executeTrade(
      tradeRequest,
      runId,
      user.id,
      currentPrice,
      currentPortfolioValue
    );

    // Update run statistics
    const isWinningTrade = executedTrade.profit_loss ? executedTrade.profit_loss > 0 : false;
    const newPortfolioValue = executedTrade.portfolio_value_after;
    
    await tradingRunService.updateRunStats(runId, isWinningTrade, newPortfolioValue);

    return new Response(
      JSON.stringify({
        success: true,
        data: executedTrade,
        meta: {
          market_price: currentPrice,
          portfolio_value_before: currentPortfolioValue,
          portfolio_value_after: newPortfolioValue
        },
        message: `${body.trade_type.toUpperCase()} order executed successfully`
      }),
      {
        status: 201,
        headers: { "Content-Type": "application/json" }
      }
    );

  } catch (error: any) {
    console.error("Failed to execute trade:", error);
    return new Response(
      JSON.stringify({
        error: "Failed to execute trade",
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