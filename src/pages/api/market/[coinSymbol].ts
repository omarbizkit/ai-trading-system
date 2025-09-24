/**
 * T047: Market Data API Endpoint
 * GET /api/market/[coinSymbol] - Get current market data for a cryptocurrency
 */

import type { APIRoute } from "astro";
import { marketDataService } from "../../../lib/services/market-data.service.js";
import type {
  MarketData,
  MarketDataRequest,
  MarketSummary
} from "../../../lib/types/market-data.js";

// GET /api/market/[coinSymbol] - Get current market data
export const GET: APIRoute = async ({ params, url }) => {
  try {
    const coinSymbol = params.coinSymbol;

    if (!coinSymbol) {
      return new Response(
        JSON.stringify({ error: "Coin symbol is required" }),
        {
          status: 400,
          headers: { "Content-Type": "application/json" }
        }
      );
    }

    // Validate coin symbol format
    if (!/^[A-Za-z0-9]{2,10}$/.test(coinSymbol)) {
      return new Response(
        JSON.stringify({ error: "Invalid coin symbol format. Must be 2-10 alphanumeric characters." }),
        {
          status: 400,
          headers: { "Content-Type": "application/json" }
        }
      );
    }

    // Parse query parameters
    const include_historical = url.searchParams.get("include_historical") === "true";
    const use_cache = url.searchParams.get("use_cache") !== "false"; // Default to true
    const format = url.searchParams.get("format") || "full"; // full, summary

    // Create market data request
    const request: MarketDataRequest = {
      coin_symbol: coinSymbol,
      include_historical
    };

    // Get market data
    let marketData: MarketData;
    
    try {
      if (use_cache) {
        marketData = await marketDataService.getMarketData(request);
      } else {
        // Force refresh by updating market data
        marketData = await marketDataService.updateMarketData(coinSymbol);
      }
    } catch (error: any) {
      // Handle specific errors
      if (error.message.includes("not found")) {
        return new Response(
          JSON.stringify({ 
            error: `Cryptocurrency '${coinSymbol.toUpperCase()}' not found`,
            message: "Please check the coin symbol and try again"
          }),
          {
            status: 404,
            headers: { "Content-Type": "application/json" }
          }
        );
      }

      if (error.message.includes("rate limit")) {
        return new Response(
          JSON.stringify({ 
            error: "Rate limit exceeded",
            message: "Please wait a moment before making another request"
          }),
          {
            status: 429,
            headers: { 
              "Content-Type": "application/json",
              "Retry-After": "60"
            }
          }
        );
      }

      throw error; // Re-throw if not a specific error
    }

    // Format response based on request
    let responseData: any;

    if (format === "summary") {
      // Return simplified summary format
      const summary: MarketSummary = {
        coin_symbol: marketData.coin_symbol,
        current_price: marketData.current_price,
        price_change_24h: marketData.price_change_24h,
        market_cap: marketData.market_cap,
        volume_24h: marketData.volume_24h,
        last_updated: marketData.last_updated
      };
      responseData = summary;
    } else {
      // Return full market data
      responseData = marketData;
    }

    // Calculate cache info
    const now = new Date();
    const lastUpdated = new Date(marketData.last_updated);
    const cacheAge = Math.floor((now.getTime() - lastUpdated.getTime()) / 1000);
    const isStale = cacheAge > 300; // 5 minutes

    return new Response(
      JSON.stringify({
        success: true,
        data: responseData,
        meta: {
          coin_symbol: coinSymbol.toUpperCase(),
          price_source: marketData.price_source,
          cache_age_seconds: cacheAge,
          is_stale: isStale,
          format,
          last_updated: marketData.last_updated
        }
      }),
      {
        status: 200,
        headers: { 
          "Content-Type": "application/json",
          "Cache-Control": isStale ? "no-cache" : "public, max-age=300" // 5 minutes
        }
      }
    );

  } catch (error: any) {
    console.error("Failed to get market data:", error);
    return new Response(
      JSON.stringify({
        error: "Failed to retrieve market data",
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
      "Access-Control-Allow-Methods": "GET, OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type"
    }
  });
};