/**
 * T037: AIPredictionService - TensorFlow.js integration for AI predictions
 * Service layer for AI/ML prediction generation and management
 * Based on data-model.md specifications
 */

import { supabase, supabaseServer, handleDatabaseError, retryOperation } from "../supabase.js";
import type { Database } from "../supabase.js";
import type {
  AIPrediction,
  PredictedDirection,
  PredictionResponse,
  InputFeatures,
  TechnicalIndicators,
  ExternalFactors,
  ModelPerformance,
  PredictionValidation,
  ModelConfig
} from "../types/ai-prediction.js";
import {
  DEFAULT_MODEL_CONFIG,
  AI_PREDICTION_CONSTRAINTS
} from "../types/ai-prediction.js";
import type { MarketData } from "../types/market-data.js";
import { modelLoader, createPredictionInput } from "../ml/model-loader.js";
import type { PredictionOutput } from "../ml/model-loader.js";

export class AIPredictionService {
  private modelConfig: ModelConfig;

  constructor(config: ModelConfig = DEFAULT_MODEL_CONFIG) {
    this.modelConfig = config;
  }

  /**
   * Generate AI prediction for a cryptocurrency
   */
  async generatePrediction(
    coinSymbol: string,
    marketData: MarketData,
    horizon: number = AI_PREDICTION_CONSTRAINTS.PREDICTION_HORIZON.DEFAULT
  ): Promise<AIPrediction> {
    try {
      // Prepare input features
      const inputFeatures = await this.prepareInputFeatures(marketData);

      // Validate input features
      if (!this.validateInputFeatures(inputFeatures)) {
        throw new Error("Invalid input features for prediction");
      }

      // Create prediction input for model loader
      const priceData = marketData.historical_data.map(d => d.price);
      const volumeData = marketData.historical_data.map(d => d.volume);
      const predictionInput = createPredictionInput(priceData, volumeData, coinSymbol);

      // Generate prediction using the model loader
      const modelPrediction = await modelLoader.predict(predictionInput);

      if (!modelPrediction) {
        throw new Error("Failed to generate prediction from model");
      }

      // Map model prediction to our format
      const prediction = this.mapModelPrediction(modelPrediction);

      // Create prediction object
      const aiPrediction: Omit<AIPrediction, "id"> = {
        coin_symbol: coinSymbol.toUpperCase(),
        model_version: modelPrediction.model_version,
        input_features: inputFeatures,
        predicted_price: prediction.price,
        predicted_direction: prediction.direction,
        confidence_score: prediction.confidence,
        prediction_horizon: horizon,
        created_at: new Date().toISOString()
      };

      // Store prediction in database
      return await this.storePrediction(aiPrediction);
    } catch (error: any) {
      console.error("Failed to generate prediction:", error);
      throw new Error(`Failed to generate prediction: ${error.message}`);
    }
  }

  /**
   * Get prediction by ID
   */
  async getPredictionById(predictionId: string): Promise<AIPrediction | null> {
    try {
      return await retryOperation(async () => {
        const { data, error } = await supabase
          .from("ai_predictions")
          .select("*")
          .eq("id", predictionId)
          .single();

        if (error) {
          if (error.code === "PGRST116") {
            return null; // Prediction not found
          }
          handleDatabaseError(error, "get prediction");
        }

        return data ? this.mapDatabasePredictionToAIPrediction(data) : null;
      });
    } catch (error: any) {
      console.error("Failed to get prediction:", error);
      throw new Error(`Failed to retrieve prediction: ${error.message}`);
    }
  }

  /**
   * Get recent predictions for a coin
   */
  async getRecentPredictions(coinSymbol: string, limit: number = 10): Promise<AIPrediction[]> {
    try {
      return await retryOperation(async () => {
        const { data, error } = await supabase
          .from("ai_predictions")
          .select("*")
          .eq("coin_symbol", coinSymbol.toUpperCase())
          .order("created_at", { ascending: false })
          .limit(limit);

        if (error) {
          handleDatabaseError(error, "get recent predictions");
        }

        return (data || []).map(pred => this.mapDatabasePredictionToAIPrediction(pred));
      });
    } catch (error: any) {
      console.error("Failed to get recent predictions:", error);
      throw new Error(`Failed to get recent predictions: ${error.message}`);
    }
  }

  /**
   * Resolve prediction with actual outcome
   */
  async resolvePrediction(predictionId: string, actualPrice: number): Promise<PredictionValidation> {
    try {
      const prediction = await this.getPredictionById(predictionId);
      if (!prediction) {
        throw new Error("Prediction not found");
      }

      if (prediction.resolved_at) {
        throw new Error("Prediction already resolved");
      }

      // Calculate accuracy metrics
      const priceDifference = actualPrice - prediction.predicted_price;
      const percentageError = (priceDifference / prediction.predicted_price) * 100;
      const accuracyScore = this.calculateAccuracyScore(prediction.predicted_price, actualPrice);

      // Note: Direction correctness would need previous price for proper calculation
      // For now, we'll use a simplified approach
      const directionCorrect = this.isDirectionCorrect(prediction, actualPrice);

      // Update prediction in database (use server client for write operations)
      await retryOperation(async () => {
        const { error } = await (supabaseServer
          .from("ai_predictions") as any)
          .update({
            actual_price: actualPrice,
            accuracy_score: accuracyScore,
            resolved_at: new Date().toISOString()
          })
          .eq("id", predictionId);

        if (error) {
          handleDatabaseError(error, "resolve prediction");
        }
      });

      return {
        prediction_id: predictionId,
        actual_price: actualPrice,
        predicted_price: prediction.predicted_price,
        price_difference: priceDifference,
        percentage_error: Math.abs(percentageError),
        direction_correct: directionCorrect,
        confidence_score: prediction.confidence_score,
        horizon_minutes: prediction.prediction_horizon,
        resolved_at: new Date().toISOString()
      };
    } catch (error: any) {
      console.error("Failed to resolve prediction:", error);
      throw new Error(`Failed to resolve prediction: ${error.message}`);
    }
  }

  /**
   * Get model performance metrics
   */
  async getModelPerformance(modelVersion?: string): Promise<ModelPerformance> {
    try {
      const version = modelVersion || this.modelConfig.version;

      return await retryOperation(async () => {
        const { data: predictions, error } = await supabase
          .from("ai_predictions")
          .select("*")
          .eq("model_version", version)
          .not("resolved_at", "is", null);

        if (error) {
          handleDatabaseError(error, "get model performance");
        }

        const resolvedPredictions = (predictions || []).map(pred =>
          this.mapDatabasePredictionToAIPrediction(pred)
        );

        return this.calculateModelPerformance(resolvedPredictions);
      });
    } catch (error: any) {
      console.error("Failed to get model performance:", error);
      throw new Error(`Failed to get model performance: ${error.message}`);
    }
  }

  /**
   * Get predictions that need resolution
   */
  async getPendingPredictions(olderThanMinutes: number = 60): Promise<AIPrediction[]> {
    try {
      const cutoffTime = new Date(Date.now() - olderThanMinutes * 60 * 1000).toISOString();

      return await retryOperation(async () => {
        const { data, error } = await supabase
          .from("ai_predictions")
          .select("*")
          .is("resolved_at", null)
          .lt("created_at", cutoffTime)
          .order("created_at", { ascending: true });

        if (error) {
          handleDatabaseError(error, "get pending predictions");
        }

        return (data || []).map(pred => this.mapDatabasePredictionToAIPrediction(pred));
      });
    } catch (error: any) {
      console.error("Failed to get pending predictions:", error);
      throw new Error(`Failed to get pending predictions: ${error.message}`);
    }
  }

  /**
   * Create prediction response for API
   */
  createPredictionResponse(prediction: AIPrediction, includeFeatures: boolean = false): PredictionResponse {
    const response: PredictionResponse = {
      coin_symbol: prediction.coin_symbol,
      predicted_price: prediction.predicted_price,
      predicted_direction: prediction.predicted_direction,
      confidence_score: prediction.confidence_score,
      prediction_horizon: prediction.prediction_horizon,
      created_at: prediction.created_at
    };

    if (includeFeatures) {
      response.model_version = prediction.model_version;
      response.input_features = prediction.input_features;
    }

    return response;
  }

  /**
   * Update model configuration
   */
  updateModelConfig(config: Partial<ModelConfig>): void {
    this.modelConfig = { ...this.modelConfig, ...config };
  }

  /**
   * Private: Map model loader prediction to internal format
   */
  private mapModelPrediction(
    modelPrediction: PredictionOutput
  ): {
    price: number;
    direction: PredictedDirection;
    confidence: number;
  } {
    // Map direction from model to our enum
    let direction: PredictedDirection;
    switch (modelPrediction.direction) {
      case 'up':
        direction = 'up';
        break;
      case 'down':
        direction = 'down';
        break;
      default:
        direction = 'hold';
        break;
    }

    return {
      price: modelPrediction.predicted_price,
      direction,
      confidence: modelPrediction.confidence
    };
  }

  /**
   * Clean up model resources
   */
  clearModelCache(): void {
    // Model cleanup is handled by the model loader singleton
    modelLoader.clearCache();
  }

  /**
   * Private: Prepare input features from market data
   */
  private async prepareInputFeatures(marketData: MarketData): Promise<InputFeatures> {
    // Calculate technical indicators
    const technicalIndicators = await this.calculateTechnicalIndicators(marketData);

    // Get external factors (mock for now)
    const externalFactors = this.getExternalFactors();

    return {
      current_price: marketData.current_price,
      volume_24h: marketData.volume_24h,
      price_change_24h: marketData.price_change_24h,
      market_cap: marketData.market_cap,
      sentiment_score: marketData.sentiment_score,
      fear_greed_index: marketData.fear_greed_index,
      technical_indicators: technicalIndicators,
      external_factors: externalFactors
    };
  }

  /**
   * Private: Calculate technical indicators
   */
  private async calculateTechnicalIndicators(marketData: MarketData): Promise<TechnicalIndicators> {
    // This is a simplified implementation
    // In production, you would use proper technical analysis libraries
    const price = marketData.current_price;
    const historicalPrices = marketData.historical_data.map(d => d.price);

    // Mock calculations (replace with real technical analysis)
    return {
      rsi: this.calculateRSI(historicalPrices),
      macd: this.calculateMACD(historicalPrices),
      bollinger_upper: price * 1.02,
      bollinger_lower: price * 0.98,
      moving_average_50: this.calculateMovingAverage(historicalPrices, 50),
      moving_average_200: this.calculateMovingAverage(historicalPrices, 200),
      support_level: price * 0.95,
      resistance_level: price * 1.05
    };
  }

  /**
   * Private: Get external factors
   */
  private getExternalFactors(): ExternalFactors {
    // Mock external factors - in production, these would come from various APIs
    return {
      news_sentiment: 0.1,
      social_media_mentions: 1000,
      institutional_flow: 0.05,
      correlation_btc: 0.8,
      market_volatility: 0.3
    };
  }

  /**
   * Get model memory statistics
   */
  getModelMemoryStats(): any {
    return modelLoader.getMemoryStats();
  }


  /**
   * Private: Store prediction in database
   */
  private async storePrediction(prediction: Omit<AIPrediction, "id">): Promise<AIPrediction> {
    return await retryOperation(async () => {
      // Use server client for write operations (bypasses RLS)
      const { data, error} = await (supabaseServer
        .from("ai_predictions") as any)
        .insert({
          coin_symbol: prediction.coin_symbol,
          model_version: prediction.model_version,
          input_features: prediction.input_features,
          predicted_price: prediction.predicted_price,
          predicted_direction: prediction.predicted_direction,
          confidence_score: prediction.confidence_score,
          prediction_horizon: prediction.prediction_horizon,
          created_at: prediction.created_at
        })
        .select()
        .single();

      if (error) {
        handleDatabaseError(error, "store prediction");
      }

      return this.mapDatabasePredictionToAIPrediction(data);
    });
  }

  /**
   * Private: Helper functions for technical indicators
   */
  private calculateRSI(prices: number[]): number {
    if (prices.length < 14) return 50; // Default RSI when insufficient data

    const changes = prices.slice(1).map((price, i) => price - (prices[i] || 0));
    const gains = changes.map(change => change > 0 ? change : 0);
    const losses = changes.map(change => change < 0 ? Math.abs(change) : 0);

    const avgGain = gains.slice(-14).reduce((sum, gain) => sum + gain, 0) / 14;
    const avgLoss = losses.slice(-14).reduce((sum, loss) => sum + loss, 0) / 14;

    if (avgLoss === 0) return 100;
    const rs = avgGain / avgLoss;
    return 100 - (100 / (1 + rs));
  }

  private calculateMACD(prices: number[]): number {
    if (prices.length < 26) return 0;

    const ema12 = this.calculateEMA(prices, 12);
    const ema26 = this.calculateEMA(prices, 26);
    return ema12 - ema26;
  }

  private calculateEMA(prices: number[], period: number): number {
    if (prices.length === 0) return 0;

    const k = 2 / (period + 1);
    let ema = prices[0] || 0;

    for (let i = 1; i < prices.length; i++) {
      ema = (prices[i] || 0) * k + ema * (1 - k);
    }

    return ema;
  }

  private calculateMovingAverage(prices: number[], period: number): number {
    if (prices.length < period) return prices[prices.length - 1] || 0;

    const recentPrices = prices.slice(-period);
    return recentPrices.reduce((sum, price) => sum + price, 0) / period;
  }

  private validateInputFeatures(features: InputFeatures): boolean {
    return (
      typeof features.current_price === "number" && features.current_price > 0 &&
      typeof features.volume_24h === "number" && features.volume_24h >= 0 &&
      typeof features.market_cap === "number" && features.market_cap >= 0 &&
      typeof features.sentiment_score === "number" &&
      features.sentiment_score >= -1 && features.sentiment_score <= 1 &&
      typeof features.fear_greed_index === "number" &&
      features.fear_greed_index >= 0 && features.fear_greed_index <= 100
    );
  }

  private calculateAccuracyScore(predictedPrice: number, actualPrice: number): number {
    if (actualPrice === 0) return 0;
    const error = Math.abs(predictedPrice - actualPrice);
    return Math.max(0, 1 - (error / actualPrice));
  }

  private isDirectionCorrect(prediction: AIPrediction, actualPrice: number): boolean {
    // Simplified direction check - in production, would need previous price
    const predictedChange = prediction.predicted_price - prediction.input_features.current_price;
    const actualChange = actualPrice - prediction.input_features.current_price;

    const threshold = prediction.input_features.current_price * 0.005; // 0.5% threshold

    if (Math.abs(predictedChange) < threshold && Math.abs(actualChange) < threshold) {
      return prediction.predicted_direction === "hold";
    }

    if (predictedChange > threshold && actualChange > threshold) {
      return prediction.predicted_direction === "up";
    }

    if (predictedChange < -threshold && actualChange < -threshold) {
      return prediction.predicted_direction === "down";
    }

    return false;
  }

  private calculateModelPerformance(predictions: AIPrediction[]): ModelPerformance {
    const resolvedPredictions = predictions.filter(p => p.resolved_at && p.actual_price !== null);
    const totalPredictions = resolvedPredictions.length;

    if (totalPredictions === 0) {
      return {
        model_version: this.modelConfig.version,
        total_predictions: 0,
        accurate_predictions: 0,
        accuracy_rate: 0,
        average_confidence: 0,
        precision_by_direction: { up: 0, down: 0, hold: 0 },
        mean_absolute_error: 0,
        sharpe_ratio: 0
      };
    }

    // Calculate basic metrics
    const accuratePredictions = resolvedPredictions.filter(p =>
      p.accuracy_score && p.accuracy_score > 0.8
    ).length;

    const accuracyRate = (accuratePredictions / totalPredictions) * 100;
    const averageConfidence = resolvedPredictions.reduce((sum, p) => sum + p.confidence_score, 0) / totalPredictions;

    // Calculate precision by direction
    const directionCounts = { up: 0, down: 0, hold: 0 };
    const directionCorrect = { up: 0, down: 0, hold: 0 };

    resolvedPredictions.forEach(prediction => {
      directionCounts[prediction.predicted_direction]++;
      if (this.isDirectionCorrect(prediction, prediction.actual_price!)) {
        directionCorrect[prediction.predicted_direction]++;
      }
    });

    const precisionByDirection = {
      up: directionCounts.up > 0 ? directionCorrect.up / directionCounts.up : 0,
      down: directionCounts.down > 0 ? directionCorrect.down / directionCounts.down : 0,
      hold: directionCounts.hold > 0 ? directionCorrect.hold / directionCounts.hold : 0
    };

    // Calculate MAE
    const meanAbsoluteError = resolvedPredictions.reduce((sum, p) => {
      const error = Math.abs(p.predicted_price - p.actual_price!) / p.actual_price!;
      return sum + error;
    }, 0) / totalPredictions;

    // Simplified Sharpe ratio
    const returns = resolvedPredictions.map(p => {
      return ((p.actual_price! - p.input_features.current_price) / p.input_features.current_price) * 100;
    });
    const avgReturn = returns.reduce((sum, r) => sum + r, 0) / returns.length;
    const returnStd = Math.sqrt(returns.reduce((sum, r) => sum + Math.pow(r - avgReturn, 2), 0) / returns.length);
    const sharpeRatio = returnStd > 0 ? avgReturn / returnStd : 0;

    return {
      model_version: this.modelConfig.version,
      total_predictions: totalPredictions,
      accurate_predictions: accuratePredictions,
      accuracy_rate: accuracyRate,
      average_confidence: averageConfidence,
      precision_by_direction: precisionByDirection,
      mean_absolute_error: meanAbsoluteError,
      sharpe_ratio: sharpeRatio
    };
  }

  /**
   * Private: Map database prediction to AIPrediction type
   */
  private mapDatabasePredictionToAIPrediction(dbPred: Database["public"]["Tables"]["ai_predictions"]["Row"]): AIPrediction {
    const result: AIPrediction = {
      id: dbPred.id,
      coin_symbol: dbPred.coin_symbol,
      model_version: dbPred.model_version,
      input_features: dbPred.input_features as InputFeatures,
      predicted_price: dbPred.predicted_price,
      predicted_direction: dbPred.predicted_direction as PredictedDirection,
      confidence_score: dbPred.confidence_score,
      prediction_horizon: dbPred.prediction_horizon,
      created_at: dbPred.created_at
    };

    if (dbPred.actual_price !== null) {
      result.actual_price = dbPred.actual_price;
    }
    if (dbPred.accuracy_score !== null) {
      result.accuracy_score = dbPred.accuracy_score;
    }
    if (dbPred.resolved_at !== null) {
      result.resolved_at = dbPred.resolved_at;
    }

    return result;
  }
}

// Export singleton instance
export const aiPredictionService = new AIPredictionService();
export default aiPredictionService;