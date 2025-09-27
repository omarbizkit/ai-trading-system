/**
 * T078: Unit tests for AI prediction accuracy
 * Testing the accuracy calculation and validation logic
 */

import { describe, it, expect, beforeEach, afterEach, vi, type MockedFunction } from 'vitest';
import { AIPredictionService } from '../../src/lib/services/ai-prediction.service.js';
import type {
  AIPrediction,
  PredictedDirection,
  InputFeatures
} from '../../src/lib/types/ai-prediction.js';
import type { MarketData } from '../../src/lib/types/market-data.js';

// Mock model loader
vi.mock('../../src/lib/ml/model-loader.js', () => ({
  modelLoader: {
    predict: vi.fn()
  },
  createPredictionInput: vi.fn()
}));

// Mock Supabase
const mockSupabase = {
  from: vi.fn().mockReturnThis(),
  insert: vi.fn().mockReturnThis(),
  select: vi.fn().mockReturnThis(),
  update: vi.fn().mockReturnThis(),
  eq: vi.fn().mockReturnThis(),
  not: vi.fn().mockReturnThis(),
  is: vi.fn().mockReturnThis(),
  lt: vi.fn().mockReturnThis(),
  order: vi.fn().mockReturnThis(),
  limit: vi.fn().mockReturnThis(),
  single: vi.fn()
};

vi.mock('../../src/lib/supabase.js', () => ({
  supabase: mockSupabase,
  handleDatabaseError: vi.fn(),
  retryOperation: vi.fn((fn) => fn())
}));

describe('AIPredictionService - Accuracy Testing', () => {
  let service: AIPredictionService;
  let mockMarketData: MarketData;
  let mockPrediction: AIPrediction;

  beforeEach(() => {
    service = new AIPredictionService();
    vi.clearAllMocks();

    // Mock market data
    mockMarketData = {
      coin_symbol: 'BTC',
      current_price: 50000,
      price_change_24h: 2.0,
      volume_24h: 25000000000,
      market_cap: 950000000000,
      fear_greed_index: 65,
      sentiment_score: 0.2,
      price_source: 'coingecko',
      last_updated: '2025-01-01T12:00:00.000Z',
      historical_data: [
        { timestamp: '2025-01-01T11:00:00.000Z', price: 49500, volume: 1000000 },
        { timestamp: '2025-01-01T11:30:00.000Z', price: 49800, volume: 1200000 },
        { timestamp: '2025-01-01T12:00:00.000Z', price: 50000, volume: 1100000 }
      ]
    };

    // Mock prediction
    mockPrediction = {
      id: 'pred-123',
      coin_symbol: 'BTC',
      model_version: '1.0.0',
      input_features: {
        current_price: 50000,
        volume_24h: 25000000000,
        price_change_24h: 2.0,
        market_cap: 950000000000,
        sentiment_score: 0.2,
        fear_greed_index: 65,
        technical_indicators: {
          rsi: 45.0,
          macd: 120.5,
          bollinger_upper: 52000,
          bollinger_lower: 48000,
          moving_average_50: 48000,
          moving_average_200: 45000,
          support_level: 48000,
          resistance_level: 52000
        },
        external_factors: {
          news_sentiment: 0.3,
          social_media_mentions: 1250,
          institutional_flow: 50000000,
          correlation_btc: 1.0,
          market_volatility: 0.15
        }
      },
      predicted_price: 51000,
      predicted_direction: 'up' as PredictedDirection,
      confidence_score: 0.85,
      prediction_horizon: 60,
      created_at: '2025-01-01T12:00:00.000Z'
    };
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe('Accuracy Score Calculation', () => {
    it('should calculate perfect accuracy score for exact prediction', () => {
      // Access private method for testing
      const accuracyScore = (service as any).calculateAccuracyScore(50000, 50000);

      expect(accuracyScore).toBe(1.0); // Perfect accuracy
    });

    it('should calculate accuracy score for close prediction', () => {
      // 1% error should result in 0.99 accuracy
      const accuracyScore = (service as any).calculateAccuracyScore(50000, 50500);

      expect(accuracyScore).toBeCloseTo(0.99, 2);
    });

    it('should calculate accuracy score for poor prediction', () => {
      // 10% error should result in 0.90 accuracy
      const accuracyScore = (service as any).calculateAccuracyScore(50000, 55000);

      expect(accuracyScore).toBeCloseTo(0.9, 2);
    });

    it('should return zero accuracy for terrible prediction', () => {
      // 200% error should result in 0 accuracy (capped at 0)
      const accuracyScore = (service as any).calculateAccuracyScore(50000, 150000);

      expect(accuracyScore).toBe(0);
    });

    it('should handle zero actual price', () => {
      const accuracyScore = (service as any).calculateAccuracyScore(50000, 0);

      expect(accuracyScore).toBe(0);
    });
  });

  describe('Direction Prediction Accuracy', () => {
    it('should correctly identify upward direction prediction', () => {
      const upPrediction = {
        ...mockPrediction,
        predicted_price: 51000, // Up from 50000
        predicted_direction: 'up' as PredictedDirection
      };

      const isCorrect = (service as any).isDirectionCorrect(upPrediction, 51500); // Actually went up

      expect(isCorrect).toBe(true);
    });

    it('should correctly identify downward direction prediction', () => {
      const downPrediction = {
        ...mockPrediction,
        predicted_price: 49000, // Down from 50000
        predicted_direction: 'down' as PredictedDirection
      };

      const isCorrect = (service as any).isDirectionCorrect(downPrediction, 48500); // Actually went down

      expect(isCorrect).toBe(true);
    });

    it('should correctly identify hold direction prediction', () => {
      const holdPrediction = {
        ...mockPrediction,
        predicted_price: 50100, // Minimal change (within 0.5% threshold)
        predicted_direction: 'hold' as PredictedDirection
      };

      const isCorrect = (service as any).isDirectionCorrect(holdPrediction, 50050); // Minimal actual change

      expect(isCorrect).toBe(true);
    });

    it('should identify incorrect direction prediction', () => {
      const wrongPrediction = {
        ...mockPrediction,
        predicted_price: 51000, // Predicted up
        predicted_direction: 'up' as PredictedDirection
      };

      const isCorrect = (service as any).isDirectionCorrect(wrongPrediction, 48500); // Actually went down

      expect(isCorrect).toBe(false);
    });

    it('should handle edge cases near threshold', () => {
      const edgePrediction = {
        ...mockPrediction,
        predicted_price: 50250, // Just at the 0.5% threshold (50000 * 0.005 = 250)
        predicted_direction: 'up' as PredictedDirection
      };

      // Just below threshold - should be considered hold, not up
      const actualPrice = 50200; // 0.4% change
      const isCorrect = (service as any).isDirectionCorrect(edgePrediction, actualPrice);

      expect(isCorrect).toBe(false); // Predicted up, but actual is within hold threshold
    });
  });

  describe('Prediction Resolution', () => {
    beforeEach(() => {
      // Mock getPredictionById
      vi.spyOn(service, 'getPredictionById').mockResolvedValue(mockPrediction);
    });

    it('should resolve prediction with correct metrics', async () => {
      const actualPrice = 50500; // 1% higher than predicted 51000

      mockSupabase.single.mockResolvedValue({
        data: null,
        error: null
      });

      const validation = await service.resolvePrediction('pred-123', actualPrice);

      expect(validation).toMatchObject({
        prediction_id: 'pred-123',
        actual_price: 50500,
        predicted_price: 51000,
        price_difference: -500, // Predicted higher than actual
        percentage_error: expect.any(Number),
        direction_correct: expect.any(Boolean),
        confidence_score: 0.85,
        horizon_minutes: 60,
        resolved_at: expect.any(String)
      });

      expect(validation.percentage_error).toBeCloseTo(0.98, 2); // |-500/51000| * 100
    });

    it('should throw error for non-existent prediction', async () => {
      vi.spyOn(service, 'getPredictionById').mockResolvedValue(null);

      await expect(service.resolvePrediction('non-existent', 50000))
        .rejects.toThrow('Prediction not found');
    });

    it('should throw error for already resolved prediction', async () => {
      const resolvedPrediction = {
        ...mockPrediction,
        resolved_at: '2025-01-01T13:00:00.000Z',
        actual_price: 50500
      };

      vi.spyOn(service, 'getPredictionById').mockResolvedValue(resolvedPrediction);

      await expect(service.resolvePrediction('pred-123', 50000))
        .rejects.toThrow('Prediction already resolved');
    });
  });

  describe('Model Performance Calculation', () => {
    it('should calculate performance metrics correctly', () => {
      const resolvedPredictions: AIPrediction[] = [
        {
          ...mockPrediction,
          id: '1',
          predicted_price: 50000,
          actual_price: 50500,
          accuracy_score: 0.99,
          confidence_score: 0.8,
          predicted_direction: 'up',
          resolved_at: '2025-01-01T13:00:00.000Z'
        },
        {
          ...mockPrediction,
          id: '2',
          predicted_price: 49000,
          actual_price: 48500,
          accuracy_score: 0.98,
          confidence_score: 0.9,
          predicted_direction: 'down',
          resolved_at: '2025-01-01T13:00:00.000Z'
        },
        {
          ...mockPrediction,
          id: '3',
          predicted_price: 51000,
          actual_price: 45000,
          accuracy_score: 0.1,
          confidence_score: 0.7,
          predicted_direction: 'up',
          resolved_at: '2025-01-01T13:00:00.000Z'
        }
      ];

      const performance = (service as any).calculateModelPerformance(resolvedPredictions);

      expect(performance).toMatchObject({
        model_version: expect.any(String),
        total_predictions: 3,
        accurate_predictions: 2, // Only first 2 have accuracy > 0.8
        accuracy_rate: expect.closeTo(66.67, 1), // 2/3 * 100
        average_confidence: 0.8, // (0.8 + 0.9 + 0.7) / 3
        precision_by_direction: expect.any(Object),
        mean_absolute_error: expect.any(Number),
        sharpe_ratio: expect.any(Number)
      });
    });

    it('should handle empty predictions list', () => {
      const performance = (service as any).calculateModelPerformance([]);

      expect(performance).toMatchObject({
        total_predictions: 0,
        accurate_predictions: 0,
        accuracy_rate: 0,
        average_confidence: 0,
        precision_by_direction: { up: 0, down: 0, hold: 0 },
        mean_absolute_error: 0,
        sharpe_ratio: 0
      });
    });
  });

  describe('Technical Indicator Calculations', () => {
    it('should calculate RSI correctly', () => {
      // Create price series for RSI calculation
      const prices = [
        44.50, 44.25, 44.25, 43.50, 44.00, 44.25, 45.50, 47.50, 47.25,
        46.50, 46.75, 47.00, 46.50, 46.25, 47.50, 47.50, 48.00, 47.50,
        47.00, 46.50
      ];

      const rsi = (service as any).calculateRSI(prices);

      expect(rsi).toBeGreaterThan(0);
      expect(rsi).toBeLessThan(100);
      expect(typeof rsi).toBe('number');
    });

    it('should handle insufficient data for RSI', () => {
      const prices = [44.50, 44.25, 43.50]; // Less than 14 periods

      const rsi = (service as any).calculateRSI(prices);

      expect(rsi).toBe(50); // Default value
    });

    it('should calculate MACD correctly', () => {
      const prices = Array.from({ length: 30 }, (_, i) => 100 + Math.sin(i) * 5);

      const macd = (service as any).calculateMACD(prices);

      expect(typeof macd).toBe('number');
      expect(isFinite(macd)).toBe(true);
    });

    it('should handle insufficient data for MACD', () => {
      const prices = [100, 101, 102]; // Less than 26 periods

      const macd = (service as any).calculateMACD(prices);

      expect(macd).toBe(0); // Default value
    });

    it('should calculate moving average correctly', () => {
      const prices = [10, 11, 12, 13, 14];

      const ma = (service as any).calculateMovingAverage(prices, 3);

      expect(ma).toBe(13); // (12 + 13 + 14) / 3
    });

    it('should handle insufficient data for moving average', () => {
      const prices = [10, 11];

      const ma = (service as any).calculateMovingAverage(prices, 5);

      expect(ma).toBe(11); // Returns last price when insufficient data
    });
  });

  describe('Input Feature Validation', () => {
    it('should validate correct input features', () => {
      const validFeatures: InputFeatures = {
        current_price: 50000,
        volume_24h: 25000000000,
        price_change_24h: 2.0,
        market_cap: 950000000000,
        sentiment_score: 0.5,
        fear_greed_index: 65,
        technical_indicators: {
          rsi: 45,
          macd: 120,
          bollinger_upper: 52000,
          bollinger_lower: 48000,
          moving_average_50: 48000,
          moving_average_200: 45000,
          support_level: 48000,
          resistance_level: 52000
        },
        external_factors: {
          news_sentiment: 0.3,
          social_media_mentions: 1250,
          institutional_flow: 50000000,
          correlation_btc: 1.0,
          market_volatility: 0.15
        }
      };

      const isValid = (service as any).validateInputFeatures(validFeatures);

      expect(isValid).toBe(true);
    });

    it('should reject invalid price', () => {
      const invalidFeatures: InputFeatures = {
        ...mockPrediction.input_features,
        current_price: -100 // Invalid negative price
      };

      const isValid = (service as any).validateInputFeatures(invalidFeatures);

      expect(isValid).toBe(false);
    });

    it('should reject invalid sentiment score', () => {
      const invalidFeatures: InputFeatures = {
        ...mockPrediction.input_features,
        sentiment_score: 2.0 // Outside [-1, 1] range
      };

      const isValid = (service as any).validateInputFeatures(invalidFeatures);

      expect(isValid).toBe(false);
    });

    it('should reject invalid fear greed index', () => {
      const invalidFeatures: InputFeatures = {
        ...mockPrediction.input_features,
        fear_greed_index: 150 // Outside [0, 100] range
      };

      const isValid = (service as any).validateInputFeatures(invalidFeatures);

      expect(isValid).toBe(false);
    });
  });

  describe('Edge Cases and Error Handling', () => {
    it('should handle extreme price predictions', () => {
      const extremePrediction = {
        ...mockPrediction,
        predicted_price: 1000000, // 20x current price
        actual_price: 50000
      };

      const accuracyScore = (service as any).calculateAccuracyScore(
        extremePrediction.predicted_price,
        extremePrediction.actual_price!
      );

      expect(accuracyScore).toBe(0); // Should cap at 0 for terrible predictions
    });

    it('should handle very small price changes', () => {
      const microChangePrediction = {
        ...mockPrediction,
        predicted_price: 50000.01, // Tiny change
        predicted_direction: 'hold' as PredictedDirection
      };

      const isCorrect = (service as any).isDirectionCorrect(microChangePrediction, 50000.02);

      expect(isCorrect).toBe(true); // Should be considered 'hold'
    });

    it('should handle NaN and Infinity in calculations', () => {
      const accuracyScore = (service as any).calculateAccuracyScore(Infinity, 50000);
      expect(isFinite(accuracyScore)).toBe(true);
      expect(accuracyScore).toBeGreaterThanOrEqual(0);
    });
  });
});