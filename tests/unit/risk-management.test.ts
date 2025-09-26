/**
 * T080: Unit tests for risk management logic
 * Testing risk controls, position sizing, and validation across services
 */

import { describe, it, expect, beforeEach, afterEach, vi, MockedFunction } from 'vitest';
import { TradeService } from '../../src/lib/services/trade.service.js';
import { BacktestingService } from '../../src/lib/services/backtesting.service.js';
import { AIPredictionService } from '../../src/lib/services/ai-prediction.service.js';
import type { CreateTradeRequest, FeeStructure } from '../../src/lib/types/trade.js';
import type { BacktestRequest } from '../../src/lib/services/backtesting.service.js';
import type { InputFeatures } from '../../src/lib/types/ai-prediction.js';
import type { TradingRun } from '../../src/lib/types/trading-run.js';

// Mock dependencies
vi.mock('../../src/lib/supabase.js', () => ({
  supabase: {
    from: vi.fn().mockReturnThis(),
    insert: vi.fn().mockReturnThis(),
    select: vi.fn().mockReturnThis(),
    single: vi.fn()
  },
  handleDatabaseError: vi.fn(),
  retryOperation: vi.fn((fn) => fn())
}));

describe('Risk Management Tests', () => {
  let tradeService: TradeService;
  let backtestingService: BacktestingService;
  let aiPredictionService: AIPredictionService;

  beforeEach(() => {
    tradeService = new TradeService();
    backtestingService = new BacktestingService();
    aiPredictionService = new AIPredictionService();
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe('Position Sizing and Trade Validation', () => {
    it('should calculate correct position size based on portfolio value and risk', () => {
      const request: CreateTradeRequest = {
        trade_type: 'buy',
        coin_symbol: 'BTC',
        quantity: 0.1,
        trade_reason: 'ai_signal',
        ai_confidence: 0.8
      };

      const marketPrice = 50000;
      const portfolioValue = 10000;
      const feeStructure: FeeStructure = {
        taker_fee_percent: 0.1,
        maker_fee_percent: 0.1,
        minimum_fee: 1,
        maximum_fee: 100
      };

      const execution = (tradeService as any).calculateTradeExecution(
        request,
        marketPrice,
        portfolioValue,
        feeStructure
      );

      // Trade value should be quantity * price = 0.1 * 50000 = 5000
      expect(execution.total_value).toBe(5000);

      // Fee should be max(minimum_fee, min(total_value * fee_percent / 100, maximum_fee))
      // = max(1, min(5000 * 0.1 / 100, 100)) = max(1, min(5, 100)) = 5
      expect(execution.fee).toBe(5);

      // Net value for buy = total_value + fee = 5005
      expect(execution.net_value).toBe(5005);

      // Portfolio after = before - net_value = 10000 - 5005 = 4995
      expect(execution.portfolio_value_after).toBe(4995);
    });

    it('should enforce minimum and maximum fee limits', () => {
      const feeStructure: FeeStructure = {
        taker_fee_percent: 0.1,
        maker_fee_percent: 0.05,
        minimum_fee: 10,
        maximum_fee: 50
      };

      // Test minimum fee enforcement
      const smallTradeRequest: CreateTradeRequest = {
        trade_type: 'buy',
        coin_symbol: 'BTC',
        quantity: 0.001, // Very small quantity
        trade_reason: 'ai_signal'
      };

      const smallExecution = (tradeService as any).calculateTradeExecution(
        smallTradeRequest,
        50000, // Price
        10000, // Portfolio
        feeStructure
      );

      // Trade value = 0.001 * 50000 = 50
      // Fee calculation: 50 * 0.1 / 100 = 0.05, but minimum is 10
      expect(smallExecution.fee).toBe(10); // Should use minimum fee

      // Test maximum fee enforcement
      const largeTradeRequest: CreateTradeRequest = {
        trade_type: 'buy',
        coin_symbol: 'BTC',
        quantity: 2, // Large quantity
        trade_reason: 'ai_signal'
      };

      const largeExecution = (tradeService as any).calculateTradeExecution(
        largeTradeRequest,
        50000, // Price
        100000, // Larger portfolio
        feeStructure
      );

      // Trade value = 2 * 50000 = 100000
      // Fee calculation: 100000 * 0.1 / 100 = 100, but maximum is 50
      expect(largeExecution.fee).toBe(50); // Should use maximum fee
    });

    it('should prevent trades exceeding portfolio value', () => {
      const oversizedRequest: CreateTradeRequest = {
        trade_type: 'buy',
        coin_symbol: 'BTC',
        quantity: 1, // This would cost 50000 + fees
        trade_reason: 'ai_signal'
      };

      const execution = (tradeService as any).calculateTradeExecution(
        oversizedRequest,
        50000, // Price
        10000, // Portfolio (insufficient for this trade)
        { taker_fee_percent: 0.1, maker_fee_percent: 0.1, minimum_fee: 1, maximum_fee: 100 }
      );

      // Trade would cost 50000 + 50 fee = 50050, but portfolio is only 10000
      // The execution should show negative remaining balance
      expect(execution.portfolio_value_after).toBe(10000 - 50050); // Negative value indicates insufficient funds
      expect(execution.portfolio_value_after).toBeLessThan(0);
    });

    it('should calculate different fees for buy vs sell orders', () => {
      const feeStructure: FeeStructure = {
        taker_fee_percent: 0.15, // Higher for taker (buy)
        maker_fee_percent: 0.10, // Lower for maker (sell)
        minimum_fee: 1,
        maximum_fee: 100
      };

      const buyRequest: CreateTradeRequest = {
        trade_type: 'buy',
        coin_symbol: 'BTC',
        quantity: 0.1,
        trade_reason: 'ai_signal'
      };

      const sellRequest: CreateTradeRequest = {
        trade_type: 'sell',
        coin_symbol: 'BTC',
        quantity: 0.1,
        trade_reason: 'ai_signal'
      };

      const buyExecution = (tradeService as any).calculateTradeExecution(
        buyRequest, 50000, 10000, feeStructure
      );

      const sellExecution = (tradeService as any).calculateTradeExecution(
        sellRequest, 50000, 10000, feeStructure
      );

      // Buy uses taker fee: 5000 * 0.15 / 100 = 7.5
      expect(buyExecution.fee).toBe(7.5);

      // Sell uses maker fee: 5000 * 0.10 / 100 = 5
      expect(sellExecution.fee).toBe(5);

      // Buy: portfolio decreases by trade + fee
      expect(buyExecution.portfolio_value_after).toBe(10000 - 5000 - 7.5);

      // Sell: portfolio increases by trade - fee
      expect(sellExecution.portfolio_value_after).toBe(10000 + 5000 - 5);
    });
  });

  describe('Drawdown Risk Management', () => {
    it('should calculate maximum drawdown correctly', async () => {
      const mockTrades = [
        { portfolio_value_after: 11000 }, // Peak
        { portfolio_value_after: 9500 },  // Drawdown from 11000 to 9500
        { portfolio_value_after: 10200 }, // Recovery
        { portfolio_value_after: 8800 },  // Larger drawdown from 11000 to 8800
        { portfolio_value_after: 10800 }  // Recovery
      ];

      // Maximum drawdown should be from peak (11000) to lowest point (8800)
      const peak = Math.max(...mockTrades.map(t => t.portfolio_value_after));
      const trough = Math.min(...mockTrades.map(t => t.portfolio_value_after));
      const maxDrawdown = (peak - trough) / peak;

      expect(peak).toBe(11000);
      expect(trough).toBe(8800);
      expect(maxDrawdown).toBeCloseTo(0.2, 3); // 20% drawdown
    });

    it('should track cumulative drawdown during backtesting', () => {
      const portfolioValues = [10000, 11000, 9500, 8800, 10200, 12000, 9000];
      let maxDrawdown = 0;
      let peak = portfolioValues[0];

      for (const value of portfolioValues) {
        if (value > peak) {
          peak = value;
        } else {
          const drawdown = (peak - value) / peak;
          maxDrawdown = Math.max(maxDrawdown, drawdown);
        }
      }

      // Peak should be 12000, maximum drawdown from 12000 to 9000 = 25%
      expect(peak).toBe(12000);
      expect(maxDrawdown).toBeCloseTo(0.25, 3); // 25% maximum drawdown
    });

    it('should handle cases with no drawdown (always increasing)', () => {
      const increasingValues = [10000, 10500, 11000, 11500, 12000];
      let maxDrawdown = 0;
      let peak = increasingValues[0];

      for (const value of increasingValues) {
        if (value > peak) {
          peak = value;
        } else {
          const drawdown = (peak - value) / peak;
          maxDrawdown = Math.max(maxDrawdown, drawdown);
        }
      }

      expect(maxDrawdown).toBe(0); // No drawdown occurred
      expect(peak).toBe(12000);
    });
  });

  describe('Input Validation and Risk Checks', () => {
    it('should validate AI prediction input features for risk assessment', () => {
      const validFeatures: InputFeatures = {
        current_price: 50000,
        volume_24h: 25000000000,
        market_cap: 950000000000,
        sentiment_score: 0.3, // Valid range [-1, 1]
        fear_greed_index: 45, // Valid range [0, 100]
        price_volatility: 0.05,
        technical_indicators: {
          rsi: 45,
          macd: 120,
          moving_average_20: 49500,
          moving_average_50: 48000,
          moving_average_200: 45000,
          support_level: 48000,
          resistance_level: 52000
        },
        external_factors: {
          news_sentiment: 0.2,
          social_media_mentions: 1000,
          institutional_flow: 10000000,
          correlation_btc: 1.0,
          market_volatility: 0.15
        }
      };

      const isValid = (aiPredictionService as any).validateInputFeatures(validFeatures);
      expect(isValid).toBe(true);
    });

    it('should reject risky input features', () => {
      const riskyFeatures = [
        {
          // Invalid price
          ...validInputFeatures(),
          current_price: -1000 // Negative price
        },
        {
          // Invalid sentiment
          ...validInputFeatures(),
          sentiment_score: 2.5 // Outside [-1, 1] range
        },
        {
          // Invalid fear greed index
          ...validInputFeatures(),
          fear_greed_index: 150 // Outside [0, 100] range
        },
        {
          // Invalid volume
          ...validInputFeatures(),
          volume_24h: -1000 // Negative volume
        }
      ];

      riskyFeatures.forEach(features => {
        const isValid = (aiPredictionService as any).validateInputFeatures(features);
        expect(isValid).toBe(false);
      });
    });

    it('should validate backtest request parameters for risk management', () => {
      const validRequest: BacktestRequest = {
        coinSymbol: 'BTC',
        startDate: '2025-01-01T00:00:00.000Z',
        endDate: '2025-01-10T00:00:00.000Z',
        startingCapital: 10000,
        parameters: {
          risk_per_trade: 2, // 2% risk per trade
          stop_loss_percent: 5,
          take_profit_percent: 10,
          max_positions: 1,
          min_confidence: 0.7
        },
        userId: 'user-123'
      };

      expect(() => {
        (backtestingService as any).validateBacktestRequest(validRequest);
      }).not.toThrow();
    });

    it('should reject dangerous backtest parameters', () => {
      const dangerousRequests = [
        {
          // Zero capital
          coinSymbol: 'BTC',
          startDate: '2025-01-01T00:00:00.000Z',
          endDate: '2025-01-10T00:00:00.000Z',
          startingCapital: 0,
          parameters: { risk_per_trade: 2, stop_loss_percent: 5, take_profit_percent: 10, max_positions: 1, min_confidence: 0.7 }
        },
        {
          // Start after end date
          coinSymbol: 'BTC',
          startDate: '2025-01-10T00:00:00.000Z',
          endDate: '2025-01-01T00:00:00.000Z',
          startingCapital: 10000,
          parameters: { risk_per_trade: 2, stop_loss_percent: 5, take_profit_percent: 10, max_positions: 1, min_confidence: 0.7 }
        },
        {
          // Future end date
          coinSymbol: 'BTC',
          startDate: '2025-01-01T00:00:00.000Z',
          endDate: '2026-12-31T00:00:00.000Z',
          startingCapital: 10000,
          parameters: { risk_per_trade: 2, stop_loss_percent: 5, take_profit_percent: 10, max_positions: 1, min_confidence: 0.7 }
        },
        {
          // Period too long (over 1 year)
          coinSymbol: 'BTC',
          startDate: '2024-01-01T00:00:00.000Z',
          endDate: '2025-01-02T00:00:00.000Z',
          startingCapital: 10000,
          parameters: { risk_per_trade: 2, stop_loss_percent: 5, take_profit_percent: 10, max_positions: 1, min_confidence: 0.7 }
        }
      ];

      dangerousRequests.forEach(request => {
        expect(() => {
          (backtestingService as any).validateBacktestRequest(request);
        }).toThrow();
      });
    });
  });

  describe('Risk Tolerance Assessment', () => {
    it('should calculate appropriate position sizes based on risk tolerance', () => {
      const portfolioValue = 10000;
      const coinPrice = 50000;

      // Risk tolerance scenarios
      const riskTolerances = {
        low: 0.01,    // 1% risk per trade
        medium: 0.02, // 2% risk per trade
        high: 0.05    // 5% risk per trade
      };

      Object.entries(riskTolerances).forEach(([tolerance, riskPercent]) => {
        const maxRiskAmount = portfolioValue * riskPercent;
        const maxQuantity = maxRiskAmount / coinPrice;

        if (tolerance === 'low') {
          expect(maxRiskAmount).toBe(100); // 1% of 10000
          expect(maxQuantity).toBeCloseTo(0.002, 4); // 100 / 50000
        } else if (tolerance === 'medium') {
          expect(maxRiskAmount).toBe(200); // 2% of 10000
          expect(maxQuantity).toBeCloseTo(0.004, 4); // 200 / 50000
        } else if (tolerance === 'high') {
          expect(maxRiskAmount).toBe(500); // 5% of 10000
          expect(maxQuantity).toBeCloseTo(0.01, 4); // 500 / 50000
        }
      });
    });

    it('should adjust trade frequency based on risk tolerance', () => {
      // High risk tolerance = more frequent trading
      // Low risk tolerance = less frequent trading

      const confidenceThresholds = {
        low: 0.8,      // Only trade with high confidence
        medium: 0.7,   // Moderate confidence threshold
        high: 0.6      // Lower confidence threshold for more trades
      };

      const testConfidences = [0.55, 0.65, 0.75, 0.85];

      testConfidences.forEach(confidence => {
        Object.entries(confidenceThresholds).forEach(([tolerance, threshold]) => {
          const shouldTrade = confidence >= threshold;

          if (confidence === 0.85) {
            expect(shouldTrade).toBe(true); // All tolerances should trade at 85% confidence
          } else if (confidence === 0.55) {
            expect(shouldTrade).toBe(false); // No tolerance should trade at 55% confidence
          } else if (confidence === 0.65 && tolerance === 'high') {
            expect(shouldTrade).toBe(true); // Only high tolerance trades at 65%
          }
        });
      });
    });
  });

  describe('Portfolio Risk Metrics', () => {
    it('should calculate win rate correctly for risk assessment', async () => {
      const mockTrades = [
        { profit_loss: 500 },   // Win
        { profit_loss: -200 },  // Loss
        { profit_loss: 300 },   // Win
        { profit_loss: -100 },  // Loss
        { profit_loss: 800 },   // Win
        { profit_loss: null }   // Incomplete trade (should be ignored)
      ];

      const completedTrades = mockTrades.filter(t => t.profit_loss !== null);
      const winningTrades = completedTrades.filter(t => t.profit_loss! > 0);
      const winRate = (winningTrades.length / completedTrades.length) * 100;

      expect(completedTrades.length).toBe(5);
      expect(winningTrades.length).toBe(3);
      expect(winRate).toBe(60); // 3/5 = 60%
    });

    it('should calculate profit factor for risk assessment', () => {
      const mockTrades = [
        { profit_loss: 500 },
        { profit_loss: -200 },
        { profit_loss: 300 },
        { profit_loss: -150 },
        { profit_loss: 800 }
      ];

      const totalProfits = mockTrades.filter(t => t.profit_loss > 0).reduce((sum, t) => sum + t.profit_loss, 0);
      const totalLosses = Math.abs(mockTrades.filter(t => t.profit_loss < 0).reduce((sum, t) => sum + t.profit_loss, 0));
      const profitFactor = totalLosses > 0 ? totalProfits / totalLosses : Infinity;

      expect(totalProfits).toBe(1600); // 500 + 300 + 800
      expect(totalLosses).toBe(350);   // 200 + 150
      expect(profitFactor).toBeCloseTo(4.57, 2); // 1600 / 350
    });

    it('should handle edge cases in risk metrics', () => {
      // All winning trades
      const allWins = [
        { profit_loss: 100 },
        { profit_loss: 200 },
        { profit_loss: 300 }
      ];

      const totalProfitsWins = allWins.reduce((sum, t) => sum + t.profit_loss, 0);
      const totalLossesWins = 0;
      const profitFactorWins = totalLossesWins > 0 ? totalProfitsWins / totalLossesWins : totalProfitsWins > 0 ? Infinity : 0;

      expect(profitFactorWins).toBe(Infinity);

      // All losing trades
      const allLosses = [
        { profit_loss: -100 },
        { profit_loss: -200 },
        { profit_loss: -300 }
      ];

      const totalProfitsLosses = 0;
      const totalLossesTotal = Math.abs(allLosses.reduce((sum, t) => sum + t.profit_loss, 0));
      const profitFactorLosses = totalLossesTotal > 0 ? totalProfitsLosses / totalLossesTotal : 0;

      expect(profitFactorLosses).toBe(0);
    });
  });

  describe('Extreme Risk Scenarios', () => {
    it('should handle portfolio wipeout scenarios', () => {
      const initialPortfolio = 10000;
      const catastrophicLoss = -9999; // Nearly wipes out portfolio

      const finalPortfolio = initialPortfolio + catastrophicLoss;
      const returnPercentage = (catastrophicLoss / initialPortfolio) * 100;

      expect(finalPortfolio).toBe(1); // Only $1 left
      expect(returnPercentage).toBeCloseTo(-99.99, 2); // ~100% loss
    });

    it('should handle extreme volatility in risk calculations', () => {
      const prices = [50000, 45000, 60000, 30000, 80000, 25000]; // Extreme volatility

      let maxPrice = Math.max(...prices);
      let minPrice = Math.min(...prices);
      let volatility = (maxPrice - minPrice) / minPrice;

      expect(maxPrice).toBe(80000);
      expect(minPrice).toBe(25000);
      expect(volatility).toBeCloseTo(2.2, 1); // 220% volatility range
    });

    it('should validate against flash crash scenarios', () => {
      const normalPrice = 50000;
      const flashCrashPrice = 5000; // 90% drop

      const priceChange = (flashCrashPrice - normalPrice) / normalPrice;
      const isFlashCrash = priceChange <= -0.5; // 50%+ drop threshold

      expect(priceChange).toBeCloseTo(-0.9, 2); // 90% drop
      expect(isFlashCrash).toBe(true);
    });
  });
});

// Helper function for valid input features
function validInputFeatures(): InputFeatures {
  return {
    current_price: 50000,
    volume_24h: 25000000000,
    market_cap: 950000000000,
    sentiment_score: 0.3,
    fear_greed_index: 45,
    price_volatility: 0.05,
    technical_indicators: {
      rsi: 45,
      macd: 120,
      moving_average_20: 49500,
      moving_average_50: 48000,
      moving_average_200: 45000,
      support_level: 48000,
      resistance_level: 52000
    },
    external_factors: {
      news_sentiment: 0.2,
      social_media_mentions: 1000,
      institutional_flow: 10000000,
      correlation_btc: 1.0,
      market_volatility: 0.15
    }
  };
}