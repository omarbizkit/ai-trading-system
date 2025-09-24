/**
 * T031: AIPrediction model and types
 * TypeScript types for AI/ML prediction data model
 * Based on data-model.md specifications
 */

export type PredictedDirection = "up" | "down" | "hold";

export interface AIPrediction {
  id?: string; // UUID, Primary Key - Unique prediction identifier (optional for requests)
  coin_symbol: string; // Cryptocurrency predicted
  model_version: string; // ML model version used
  input_features: InputFeatures; // Feature vector used for prediction
  predicted_price: number; // Model's price prediction
  predicted_direction: PredictedDirection; // Predicted price movement
  confidence_score: number; // Model confidence (0-1)
  prediction_horizon: number; // Minutes ahead predicted
  actual_price?: number; // Actual price at prediction time (nullable)
  accuracy_score?: number; // Prediction accuracy when resolved (nullable)
  created_at: string; // When prediction was made (ISO string)
  resolved_at?: string; // When actual outcome was recorded (ISO string)
}

export interface InputFeatures {
  current_price: number; // Current market price
  volume_24h: number; // 24-hour trading volume
  price_change_24h: number; // 24-hour price change percentage
  market_cap: number; // Current market capitalization
  sentiment_score: number; // Market sentiment (-1 to 1)
  fear_greed_index: number; // Fear & Greed index (0-100)
  technical_indicators: TechnicalIndicators; // Technical analysis indicators
  external_factors?: ExternalFactors; // Optional external factors
}

export interface TechnicalIndicators {
  rsi: number; // Relative Strength Index (0-100)
  macd: number; // MACD indicator
  bollinger_upper: number; // Bollinger Band upper bound
  bollinger_lower: number; // Bollinger Band lower bound
  moving_average_50: number; // 50-period moving average
  moving_average_200: number; // 200-period moving average
  support_level: number; // Support price level
  resistance_level: number; // Resistance price level
}

export interface ExternalFactors {
  news_sentiment: number; // News sentiment score (-1 to 1)
  social_media_mentions: number; // Social media mention count
  institutional_flow: number; // Institutional money flow
  correlation_btc: number; // Correlation with Bitcoin (-1 to 1)
  market_volatility: number; // VIX-like volatility index
}

export interface PredictionRequest {
  coin_symbol: string;
  horizon?: number; // Prediction horizon in minutes (default: 15)
  include_features?: boolean; // Include input features in response
}

export interface PredictionResponse {
  coin_symbol: string;
  predicted_price: number;
  predicted_direction: PredictedDirection;
  confidence_score: number;
  prediction_horizon: number;
  model_version?: string;
  input_features?: InputFeatures;
  created_at: string;
}

export interface ModelPerformance {
  model_version: string;
  total_predictions: number;
  accurate_predictions: number;
  accuracy_rate: number; // Percentage of accurate predictions
  average_confidence: number;
  precision_by_direction: {
    up: number;
    down: number;
    hold: number;
  };
  mean_absolute_error: number; // Average price prediction error
  sharpe_ratio: number; // Risk-adjusted return metric
}

export interface PredictionValidation {
  prediction_id: string;
  actual_price: number;
  predicted_price: number;
  price_difference: number;
  percentage_error: number;
  direction_correct: boolean;
  confidence_score: number;
  horizon_minutes: number;
  resolved_at: string;
}

// Model configuration
export interface ModelConfig {
  version: string;
  model_type: "lstm" | "transformer" | "ensemble";
  features_count: number;
  training_data_days: number;
  update_frequency_hours: number;
  confidence_threshold: number; // Minimum confidence for trading signals
}

export const DEFAULT_MODEL_CONFIG: ModelConfig = {
  version: "v1.2.3",
  model_type: "lstm",
  features_count: 20,
  training_data_days: 365,
  update_frequency_hours: 24,
  confidence_threshold: 0.6
};

// Validation constraints from data-model.md
export const AI_PREDICTION_CONSTRAINTS = {
  PREDICTED_PRICE: {
    MIN: 0.00000001 // Minimum predicted price
  },
  CONFIDENCE_SCORE: {
    MIN: 0,
    MAX: 1
  },
  PREDICTION_HORIZON: {
    MIN: 1,
    MAX: 60, // Maximum 60 minutes
    DEFAULT: 15
  },
  ACCURACY_SCORE: {
    MIN: 0,
    MAX: 1
  }
} as const;

// Type guards
export function isValidPredictedDirection(value: string): value is PredictedDirection {
  return ["up", "down", "hold"].includes(value);
}

export function isValidAIPrediction(prediction: any): prediction is AIPrediction {
  return (
    typeof prediction === "object" &&
    typeof prediction.coin_symbol === "string" &&
    typeof prediction.model_version === "string" &&
    typeof prediction.input_features === "object" &&
    typeof prediction.predicted_price === "number" &&
    prediction.predicted_price > AI_PREDICTION_CONSTRAINTS.PREDICTED_PRICE.MIN &&
    isValidPredictedDirection(prediction.predicted_direction) &&
    typeof prediction.confidence_score === "number" &&
    prediction.confidence_score >= AI_PREDICTION_CONSTRAINTS.CONFIDENCE_SCORE.MIN &&
    prediction.confidence_score <= AI_PREDICTION_CONSTRAINTS.CONFIDENCE_SCORE.MAX &&
    typeof prediction.prediction_horizon === "number" &&
    prediction.prediction_horizon >= AI_PREDICTION_CONSTRAINTS.PREDICTION_HORIZON.MIN &&
    prediction.prediction_horizon <= AI_PREDICTION_CONSTRAINTS.PREDICTION_HORIZON.MAX &&
    typeof prediction.created_at === "string"
  );
}

export function isValidInputFeatures(features: any): features is InputFeatures {
  return (
    typeof features === "object" &&
    typeof features.current_price === "number" &&
    features.current_price > 0 &&
    typeof features.volume_24h === "number" &&
    features.volume_24h >= 0 &&
    typeof features.price_change_24h === "number" &&
    typeof features.market_cap === "number" &&
    features.market_cap >= 0 &&
    typeof features.sentiment_score === "number" &&
    features.sentiment_score >= -1 &&
    features.sentiment_score <= 1 &&
    typeof features.fear_greed_index === "number" &&
    features.fear_greed_index >= 0 &&
    features.fear_greed_index <= 100 &&
    typeof features.technical_indicators === "object"
  );
}

// Validation functions
export function validatePredictionRequest(request: PredictionRequest): string | null {
  if (!request.coin_symbol || typeof request.coin_symbol !== "string") {
    return "Coin symbol is required";
  }

  if (request.horizon !== undefined) {
    const { MIN, MAX } = AI_PREDICTION_CONSTRAINTS.PREDICTION_HORIZON;
    if (typeof request.horizon !== "number" || request.horizon < MIN || request.horizon > MAX) {
      return `Prediction horizon must be between ${MIN} and ${MAX} minutes`;
    }
  }

  return null;
}

export function validateConfidenceScore(confidence: number): string | null {
  if (typeof confidence !== "number" || isNaN(confidence)) {
    return "Confidence score must be a valid number";
  }

  const { MIN, MAX } = AI_PREDICTION_CONSTRAINTS.CONFIDENCE_SCORE;
  if (confidence < MIN || confidence > MAX) {
    return `Confidence score must be between ${MIN} and ${MAX}`;
  }

  return null;
}

export function validatePredictedPrice(price: number): string | null {
  if (typeof price !== "number" || isNaN(price)) {
    return "Predicted price must be a valid number";
  }

  if (price <= AI_PREDICTION_CONSTRAINTS.PREDICTED_PRICE.MIN) {
    return "Predicted price must be greater than 0";
  }

  return null;
}

// Calculation functions
export function calculatePredictionAccuracy(
  predictedPrice: number,
  actualPrice: number
): number {
  if (actualPrice === 0) return 0;

  const error = Math.abs(predictedPrice - actualPrice);
  const accuracy = Math.max(0, 1 - (error / actualPrice));
  return accuracy;
}

export function calculateDirectionAccuracy(
  predictedDirection: PredictedDirection,
  previousPrice: number,
  actualPrice: number
): boolean {
  const actualDirection = getActualDirection(previousPrice, actualPrice);
  return predictedDirection === actualDirection;
}

export function getActualDirection(
  previousPrice: number,
  currentPrice: number,
  threshold: number = 0.5 // 0.5% threshold for "hold"
): PredictedDirection {
  const changePercent = ((currentPrice - previousPrice) / previousPrice) * 100;

  if (changePercent > threshold) return "up";
  if (changePercent < -threshold) return "down";
  return "hold";
}

export function calculateModelPerformance(
  predictions: AIPrediction[],
  validations: PredictionValidation[]
): ModelPerformance {
  const resolvedPredictions = predictions.filter(p => p.resolved_at);
  const totalPredictions = resolvedPredictions.length;

  if (totalPredictions === 0) {
    return {
      model_version: predictions[0]?.model_version || "unknown",
      total_predictions: 0,
      accurate_predictions: 0,
      accuracy_rate: 0,
      average_confidence: 0,
      precision_by_direction: { up: 0, down: 0, hold: 0 },
      mean_absolute_error: 0,
      sharpe_ratio: 0
    };
  }

  const accurateCount = validations.filter(v => v.direction_correct).length;
  const accuracyRate = (accurateCount / totalPredictions) * 100;

  const averageConfidence = resolvedPredictions.reduce(
    (sum, p) => sum + p.confidence_score, 0
  ) / totalPredictions;

  // Calculate precision by direction
  const directionCounts = { up: 0, down: 0, hold: 0 };
  const directionCorrect = { up: 0, down: 0, hold: 0 };

  resolvedPredictions.forEach(prediction => {
    directionCounts[prediction.predicted_direction]++;
    const validation = validations.find(v => v.prediction_id === prediction.id);
    if (validation?.direction_correct) {
      directionCorrect[prediction.predicted_direction]++;
    }
  });

  const precisionByDirection = {
    up: directionCounts.up > 0 ? directionCorrect.up / directionCounts.up : 0,
    down: directionCounts.down > 0 ? directionCorrect.down / directionCounts.down : 0,
    hold: directionCounts.hold > 0 ? directionCorrect.hold / directionCounts.hold : 0
  };

  // Calculate mean absolute error
  const meanAbsoluteError = validations.reduce(
    (sum, v) => sum + Math.abs(v.percentage_error), 0
  ) / validations.length;

  // Simplified Sharpe ratio calculation
  const returns = validations.map(v => v.percentage_error);
  const averageReturn = returns.reduce((sum, r) => sum + r, 0) / returns.length;
  const returnVariance = returns.reduce((sum, r) => sum + Math.pow(r - averageReturn, 2), 0) / returns.length;
  const sharpeRatio = returnVariance > 0 ? averageReturn / Math.sqrt(returnVariance) : 0;

  return {
    model_version: resolvedPredictions[0].model_version,
    total_predictions: totalPredictions,
    accurate_predictions: accurateCount,
    accuracy_rate: accuracyRate,
    average_confidence: averageConfidence,
    precision_by_direction: precisionByDirection,
    mean_absolute_error: meanAbsoluteError,
    sharpe_ratio: sharpeRatio
  };
}

// Utility functions
export function createAIPrediction(
  coinSymbol: string,
  modelVersion: string,
  inputFeatures: InputFeatures,
  predictedPrice: number,
  predictedDirection: PredictedDirection,
  confidenceScore: number,
  predictionHorizon: number = AI_PREDICTION_CONSTRAINTS.PREDICTION_HORIZON.DEFAULT
): Omit<AIPrediction, "id"> {
  return {
    coin_symbol: coinSymbol.toUpperCase(),
    model_version: modelVersion,
    input_features: inputFeatures,
    predicted_price: predictedPrice,
    predicted_direction: predictedDirection,
    confidence_score: confidenceScore,
    prediction_horizon: predictionHorizon,
    created_at: new Date().toISOString()
  };
}

export function createPredictionResponse(
  prediction: AIPrediction,
  includeFeatures: boolean = false
): PredictionResponse {
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

export function resolvePrediction(
  prediction: AIPrediction,
  actualPrice: number
): Omit<PredictionValidation, "prediction_id"> {
  const priceDifference = actualPrice - prediction.predicted_price;
  const percentageError = (priceDifference / prediction.predicted_price) * 100;

  // Determine if direction was correct (need previous price for comparison)
  // This would typically come from the context where this function is called
  const directionCorrect = true; // Placeholder - would be calculated with context

  const accuracyScore = calculatePredictionAccuracy(prediction.predicted_price, actualPrice);

  return {
    actual_price: actualPrice,
    predicted_price: prediction.predicted_price,
    price_difference: priceDifference,
    percentage_error: percentageError,
    direction_correct: directionCorrect,
    confidence_score: prediction.confidence_score,
    horizon_minutes: prediction.prediction_horizon,
    resolved_at: new Date().toISOString()
  };
}

export function formatPredictionForDisplay(prediction: AIPrediction): {
  symbol: string;
  direction: string;
  price: string;
  confidence: string;
  horizon: string;
  timestamp: string;
} {
  const confidencePercent = Math.round(prediction.confidence_score * 100);
  const directionEmoji = {
    up: "📈",
    down: "📉",
    hold: "➡️"
  };

  return {
    symbol: prediction.coin_symbol,
    direction: `${directionEmoji[prediction.predicted_direction]} ${prediction.predicted_direction.toUpperCase()}`,
    price: `$${prediction.predicted_price.toFixed(2)}`,
    confidence: `${confidencePercent}%`,
    horizon: `${prediction.prediction_horizon}m`,
    timestamp: new Date(prediction.created_at).toLocaleTimeString()
  };
}

export function isHighConfidencePrediction(
  prediction: AIPrediction,
  threshold: number = DEFAULT_MODEL_CONFIG.confidence_threshold
): boolean {
  return prediction.confidence_score >= threshold;
}

export function shouldTradeBased

OnPrediction(
  prediction: AIPrediction,
  minConfidence: number = 0.7,
  allowedDirections: PredictedDirection[] = ["up", "down"]
): boolean {
  return (
    prediction.confidence_score >= minConfidence &&
    allowedDirections.includes(prediction.predicted_direction)
  );
}