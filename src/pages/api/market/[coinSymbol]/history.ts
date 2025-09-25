/**
 * T048: Historical Market Data API Endpoint
 * GET /api/market/[coinSymbol]/history - Get historical price data for a cryptocurrency
 */

export const prerender = false;

import type { APIRoute } from "astro";
import { marketDataService } from "../../../../lib/services/market-data.service.js";
import type {
  HistoricalDataRequest,
  HistoricalDataResponse,
  OHLCDataPoint
} from "../../../../lib/types/market-data.js";

// GET /api/market/[coinSymbol]/history - Get historical price data
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

    // Parse and validate query parameters
    const from = url.searchParams.get("from");
    const to = url.searchParams.get("to");
    const interval = url.searchParams.get("interval") || "1d";
    const format = url.searchParams.get("format") || "ohlc"; // ohlc, simple

    // Validate required parameters
    if (!from || !to) {
      return new Response(
        JSON.stringify({ 
          error: "'from' and 'to' query parameters are required",
          example: "?from=2023-01-01&to=2023-01-31"
        }),
        {
          status: 400,
          headers: { "Content-Type": "application/json" }
        }
      );
    }

    // Validate date format
    const fromDate = new Date(from);
    const toDate = new Date(to);

    if (isNaN(fromDate.getTime()) || isNaN(toDate.getTime())) {
      return new Response(
        JSON.stringify({ 
          error: "Invalid date format. Use YYYY-MM-DD or ISO format",
          example: "?from=2023-01-01&to=2023-01-31"
        }),
        {
          status: 400,
          headers: { "Content-Type": "application/json" }
        }
      );
    }

    // Validate date range
    if (fromDate >= toDate) {
      return new Response(
        JSON.stringify({ error: "'from' date must be before 'to' date" }),
        {
          status: 400,
          headers: { "Content-Type": "application/json" }
        }
      );
    }

    if (toDate > new Date()) {
      return new Response(
        JSON.stringify({ error: "'to' date cannot be in the future" }),
        {
          status: 400,
          headers: { "Content-Type": "application/json" }
        }
      );
    }

    // Check maximum date range (1 year)
    const maxRange = 365 * 24 * 60 * 60 * 1000; // 1 year in milliseconds
    if (toDate.getTime() - fromDate.getTime() > maxRange) {
      return new Response(
        JSON.stringify({ error: "Date range cannot exceed 1 year" }),
        {
          status: 400,
          headers: { "Content-Type": "application/json" }
        }
      );
    }

    // Validate interval
    const validIntervals = ["1h", "4h", "1d"];
    if (!validIntervals.includes(interval)) {
      return new Response(
        JSON.stringify({ 
          error: `Invalid interval. Must be one of: ${validIntervals.join(", ")}`,
          provided: interval
        }),
        {
          status: 400,
          headers: { "Content-Type": "application/json" }
        }
      );
    }

    // Validate format
    const validFormats = ["ohlc", "simple"];
    if (!validFormats.includes(format)) {
      return new Response(
        JSON.stringify({ 
          error: `Invalid format. Must be one of: ${validFormats.join(", ")}`,
          provided: format
        }),
        {
          status: 400,
          headers: { "Content-Type": "application/json" }
        }
      );
    }

    // Create historical data request
    const request: HistoricalDataRequest = {
      coin_symbol: coinSymbol,
      from: fromDate.toISOString(),
      to: toDate.toISOString(),
      interval: interval as "1h" | "4h" | "1d"
    };

    // Get historical data
    let historicalData: HistoricalDataResponse;
    
    try {
      historicalData = await marketDataService.getHistoricalData(request);
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

    // Format response data based on format parameter
    let responseData: any;

    if (format === "simple") {
      // Return simplified format with just timestamp and close price
      responseData = historicalData.data.map(point => ({
        timestamp: point.timestamp,
        price: point.close,
        volume: point.volume
      }));
    } else {
      // Return full OHLC format
      responseData = historicalData.data;
    }

    // Calculate additional statistics
    const prices = historicalData.data.map(point => point.close);
    const volumes = historicalData.data.map(point => point.volume);
    
    const minPrice = Math.min(...prices);
    const maxPrice = Math.max(...prices);
    const avgPrice = prices.reduce((sum, price) => sum + price, 0) / prices.length;
    const totalVolume = volumes.reduce((sum, vol) => sum + vol, 0);
    const avgVolume = totalVolume / volumes.length;

    // Calculate price change
    const firstPrice = prices[0];
    const lastPrice = prices[prices.length - 1];
    const priceChange = lastPrice - firstPrice;
    const priceChangePercent = (priceChange / firstPrice) * 100;

    return new Response(
      JSON.stringify({
        success: true,
        data: responseData,
        meta: {
          coin_symbol: coinSymbol.toUpperCase(),
          interval,
          format,
          period: {
            from: fromDate.toISOString(),
            to: toDate.toISOString(),
            days: Math.ceil((toDate.getTime() - fromDate.getTime()) / (24 * 60 * 60 * 1000))
          },
          data_points: historicalData.data.length,
          statistics: {
            min_price: minPrice,
            max_price: maxPrice,
            avg_price: avgPrice,
            price_change: priceChange,
            price_change_percent: priceChangePercent,
            total_volume: totalVolume,
            avg_volume: avgVolume
          }
        }
      }),
      {
        status: 200,
        headers: { 
          "Content-Type": "application/json",
          "Cache-Control": "public, max-age=3600" // Cache for 1 hour
        }
      }
    );

  } catch (error: any) {
    console.error("Failed to get historical data:", error);
    return new Response(
      JSON.stringify({
        error: "Failed to retrieve historical market data",
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