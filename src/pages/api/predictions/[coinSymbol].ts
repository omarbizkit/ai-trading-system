/**
 * T049: AI Predictions API Endpoint
 * GET /api/predictions/[coinSymbol] - Get AI predictions for a cryptocurrency
 */

export const prerender = false;

import type { APIRoute } from "astro";
import { aiPredictionService } from "../../../lib/services/ai-prediction.service.js";
import { marketDataService } from "../../../lib/services/market-data.service.js";
import type {
  AIPrediction,
  PredictionResponse,
  ModelPerformance
} from "../../../lib/types/ai-prediction.js";
import type { MarketData } from "../../../lib/types/market-data.js";

// GET /api/predictions/[coinSymbol] - Get AI predictions
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
    const generate_new = url.searchParams.get("generate_new") === "true";
    const horizon = parseInt(url.searchParams.get("horizon") || "60"); // Default 1 hour
    const include_recent = url.searchParams.get("include_recent") === "true";
    const include_performance = url.searchParams.get("include_performance") === "true";
    const include_features = url.searchParams.get("include_features") === "true";
    const format = url.searchParams.get("format") || "full"; // full, simple

    // Validate horizon
    if (horizon < 5 || horizon > 1440) {
      return new Response(
        JSON.stringify({ 
          error: "Prediction horizon must be between 5 and 1440 minutes (1 day)",
          provided: horizon
        }),
        {
          status: 400,
          headers: { "Content-Type": "application/json" }
        }
      );
    }

    let prediction: AIPrediction | null = null;
    let recentPredictions: AIPrediction[] = [];
    let performance: ModelPerformance | undefined;

    // Check for recent predictions first (unless generating new)
    if (!generate_new) {
      const recent = await aiPredictionService.getRecentPredictions(coinSymbol, 1);
      if (recent.length > 0) {
        const latestPrediction = recent[0];
        const predictionAge = Date.now() - new Date(latestPrediction.created_at).getTime();
        
        // Use recent prediction if less than 15 minutes old
        if (predictionAge < 15 * 60 * 1000) {
          prediction = latestPrediction;
        }
      }
    }

    // Generate new prediction if needed
    if (!prediction) {
      try {
        // Get current market data
        const marketData = await marketDataService.getMarketData({
          coin_symbol: coinSymbol,
          include_historical: true
        });

        // Generate new prediction
        prediction = await aiPredictionService.generatePrediction(
          coinSymbol,
          marketData,
          horizon
        );
      } catch (error: any) {
        // Handle specific market data errors
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
              error: "Rate limit exceeded for market data",
              message: "Please wait a moment before requesting new predictions"
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
    }

    // Get additional data if requested
    if (include_recent) {
      recentPredictions = await aiPredictionService.getRecentPredictions(coinSymbol, 10);
      // Exclude the current prediction from recent list to avoid duplication
      recentPredictions = recentPredictions.filter(p => p.id !== prediction?.id);
    }

    if (include_performance) {
      try {
        performance = await aiPredictionService.getModelPerformance();
      } catch (error) {
        console.warn("Failed to get model performance:", error);
        // Don't fail the request if performance data is unavailable
      }
    }

    // Format the main prediction response
    const predictionResponse = aiPredictionService.createPredictionResponse(
      prediction,
      include_features
    );

    // Format response based on format parameter
    let responseData: any;

    if (format === "simple") {
      // Return simplified format
      responseData = {
        coin_symbol: predictionResponse.coin_symbol,
        predicted_price: predictionResponse.predicted_price,
        predicted_direction: predictionResponse.predicted_direction,
        confidence_score: predictionResponse.confidence_score,
        created_at: predictionResponse.created_at
      };
    } else {
      // Return full prediction response
      responseData = predictionResponse;
    }

    // Calculate prediction freshness
    const predictionAge = Date.now() - new Date(prediction.created_at).getTime();
    const isExpired = predictionAge > horizon * 60 * 1000; // Prediction horizon in ms

    return new Response(
      JSON.stringify({
        success: true,
        data: responseData,
        meta: {
          coin_symbol: coinSymbol.toUpperCase(),
          prediction_horizon_minutes: horizon,
          format,
          generated_new: generate_new || predictionAge < 1000, // Just generated if very fresh
          prediction_age_minutes: Math.floor(predictionAge / (60 * 1000)),
          is_expired: isExpired,
          model_version: prediction.model_version
        },
        ...(recentPredictions.length > 0 && { recent_predictions: recentPredictions }),
        ...(performance && { model_performance: performance })
      }),
      {
        status: 200,
        headers: { 
          "Content-Type": "application/json",
          "Cache-Control": isExpired ? "no-cache" : "public, max-age=900" // 15 minutes
        }
      }
    );

  } catch (error: any) {
    console.error("Failed to get AI predictions:", error);
    
    // Handle AI service specific errors
    if (error.message.includes("model")) {
      return new Response(
        JSON.stringify({
          error: "AI prediction service temporarily unavailable",
          message: "The AI model is currently being updated. Please try again in a few minutes."
        }),
        {
          status: 503,
          headers: { 
            "Content-Type": "application/json",
            "Retry-After": "300" // 5 minutes
          }
        }
      );
    }

    return new Response(
      JSON.stringify({
        error: "Failed to retrieve AI predictions",
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