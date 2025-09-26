/**
 * T079: Unit tests for backtesting calculations
 * Testing performance metrics, timeline generation, and trade logic
 */

import { describe, it, expect, beforeEach, afterEach, vi, MockedFunction } from 'vitest';
import { BacktestingService, type BacktestRequest, type BacktestResult } from '../../src/lib/services/backtesting.service.js';
import type { TradingRun } from '../../src/lib/types/trading-run.js';
import type { Trade } from '../../src/lib/types/trade.js';

// Mock dependencies
vi.mock('../../src/lib/services/trading-run.service.js', () => ({
  tradingRunService: {
    createRun: vi.fn(),
    updateRun: vi.fn(),
    getRunById: vi.fn(),
    getRunsByUserId: vi.fn()
  }
}));

vi.mock('../../src/lib/services/trade.service.js', () => ({
  tradeService: {
    executeTrade: vi.fn(),
    getTradesByRunId: vi.fn()
  }
}));

vi.mock('../../src/lib/services/market-data.service.js', () => ({
  marketDataService: {
    getHistoricalData: vi.fn()
  }
}));

vi.mock('../../src/lib/services/ai-prediction.service.js', () => ({
  aiPredictionService: {
    generatePrediction: vi.fn()
  }
}));

vi.mock('../../src/lib/supabase.js', () => ({
  supabase: {},
  handleDatabaseError: vi.fn(),
  retryOperation: vi.fn((fn) => fn())
}));

describe('BacktestingService - Calculation Tests', () => {
  let service: BacktestingService;
  let mockTradingRun: TradingRun;
  let mockTrades: Trade[];

  beforeEach(() => {
    service = new BacktestingService();
    vi.clearAllMocks();

    // Mock trading run
    mockTradingRun = {
      id: 'run-123',
      user_id: 'user-123',
      coin_symbol: 'BTC',
      session_type: 'backtest',
      session_start: '2025-01-01T00:00:00.000Z',
      session_end: '2025-01-10T00:00:00.000Z',
      starting_capital: 10000,
      final_capital: 11500,
      total_trades: 5,
      successful_trades: 3,
      max_drawdown: 0.05,
      parameters: {
        risk_per_trade: 2,
        stop_loss_percent: 5,
        take_profit_percent: 10,
        max_positions: 1,
        min_confidence: 0.7
      },
      created_at: '2025-01-01T00:00:00.000Z'
    };

    // Mock trades with various scenarios
    mockTrades = [
      {
        id: 'trade-1',
        run_id: 'run-123',
        user_id: 'user-123',
        trade_type: 'buy',
        coin_symbol: 'BTC',
        quantity: 0.2,
        price_per_unit: 50000,
        total_value: 10000,
        fee_amount: 10,
        profit_loss: 500,
        portfolio_value_before: 10000,
        portfolio_value_after: 10500,
        execution_time: '2025-01-02T10:00:00.000Z',
        trade_reason: 'ai_signal',
        ai_confidence: 0.8
      },
      {
        id: 'trade-2',
        run_id: 'run-123',
        user_id: 'user-123',
        trade_type: 'sell',
        coin_symbol: 'BTC',
        quantity: 0.1,
        price_per_unit: 51000,
        total_value: 5100,
        fee_amount: 5,
        profit_loss: -200,
        portfolio_value_before: 10500,
        portfolio_value_after: 10300,
        execution_time: '2025-01-03T14:00:00.000Z',
        trade_reason: 'ai_signal',
        ai_confidence: 0.6
      },
      {
        id: 'trade-3',
        run_id: 'run-123',
        user_id: 'user-123',
        trade_type: 'buy',
        coin_symbol: 'BTC',
        quantity: 0.15,
        price_per_unit: 49000,
        total_value: 7350,
        fee_amount: 7,
        profit_loss: 800,
        portfolio_value_before: 10300,
        portfolio_value_after: 11100,
        execution_time: '2025-01-05T09:00:00.000Z',
        trade_reason: 'ai_signal',
        ai_confidence: 0.9
      },
      {
        id: 'trade-4',
        run_id: 'run-123',
        user_id: 'user-123',
        trade_type: 'sell',
        coin_symbol: 'BTC',
        quantity: 0.25,
        price_per_unit: 52000,
        total_value: 13000,
        fee_amount: 13,
        profit_loss: 400,
        portfolio_value_before: 11100,
        portfolio_value_after: 11500,
        execution_time: '2025-01-08T16:00:00.000Z',
        trade_reason: 'ai_signal',
        ai_confidence: 0.75
      }
    ];
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe('Performance Metrics Calculation', () => {
    it('should calculate total return correctly', async () => {
      const performance = await (service as any).calculateBacktestPerformance(mockTradingRun, mockTrades);

      // (11500 - 10000) / 10000 * 100 = 15%
      expect(performance.totalReturn).toBeCloseTo(15, 2);
    });

    it('should calculate annualized return correctly', async () => {
      const performance = await (service as any).calculateBacktestPerformance(mockTradingRun, mockTrades);

      // For a 9-day period, annualized return should be much higher
      expect(performance.annualizedReturn).toBeGreaterThan(100); // Much higher than 15% due to short time period
      expect(typeof performance.annualizedReturn).toBe('number');
      expect(isFinite(performance.annualizedReturn)).toBe(true);
    });

    it('should calculate win rate correctly', async () => {
      const performance = await (service as any).calculateBacktestPerformance(mockTradingRun, mockTrades);

      // 3 winning trades out of 4 total = 75%
      const winningTrades = mockTrades.filter(t => t.profit_loss! > 0).length;
      const expectedWinRate = (winningTrades / mockTrades.length) * 100;

      expect(performance.winRate).toBeCloseTo(expectedWinRate, 2);
    });

    it('should calculate profit factor correctly', async () => {
      const performance = await (service as any).calculateBacktestPerformance(mockTradingRun, mockTrades);

      // Total profits: 500 + 800 + 400 = 1700
      // Total losses: 200 (absolute value)
      // Profit factor: 1700 / 200 = 8.5
      expect(performance.profitFactor).toBeCloseTo(8.5, 2);
    });

    it('should handle case with no losing trades (infinite profit factor)', async () => {
      const allWinningTrades = mockTrades.map(trade => ({
        ...trade,
        profit_loss: Math.abs(trade.profit_loss!) // Make all trades profitable
      }));

      const performance = await (service as any).calculateBacktestPerformance(mockTradingRun, allWinningTrades);

      expect(performance.profitFactor).toBe(Infinity);
    });

    it('should calculate Sharpe ratio correctly', async () => {
      const performance = await (service as any).calculateBacktestPerformance(mockTradingRun, mockTrades);

      expect(typeof performance.sharpeRatio).toBe('number');
      expect(isFinite(performance.sharpeRatio)).toBe(true);
    });

    it('should calculate average trade return', async () => {
      const performance = await (service as any).calculateBacktestPerformance(mockTradingRun, mockTrades);

      // (500 - 200 + 800 + 400) / 4 = 375
      const expectedAvgReturn = (500 - 200 + 800 + 400) / 4;
      expect(performance.avgTradeReturn).toBeCloseTo(expectedAvgReturn, 2);
    });

    it('should handle empty trades array', async () => {
      const performance = await (service as any).calculateBacktestPerformance(mockTradingRun, []);

      expect(performance).toMatchObject({
        winRate: 0,
        profitFactor: 0,
        avgTradeReturn: 0,
        totalTrades: 0
      });
      expect(typeof performance.sharpeRatio).toBe('number');
    });

    it('should handle trades with null profit_loss', async () => {
      const tradesWithNulls = [
        ...mockTrades,
        {
          ...mockTrades[0],
          id: 'trade-incomplete',
          profit_loss: null // Incomplete trade
        }
      ];

      const performance = await (service as any).calculateBacktestPerformance(mockTradingRun, tradesWithNulls);

      // Should only count completed trades (4 out of 5)
      expect(performance.totalTrades).toBe(5); // Total trades
      expect(performance.winRate).toBeCloseTo(75, 2); // Only based on completed trades
    });
  });

  describe('Timeline Generation', () => {
    it('should generate correct timeline structure', async () => {
      const timeline = await (service as any).generateBacktestTimeline(mockTradingRun, mockTrades);

      expect(Array.isArray(timeline)).toBe(true);
      expect(timeline.length).toBeGreaterThan(0);

      timeline.forEach((point: any) => {
        expect(point).toHaveProperty('date');
        expect(point).toHaveProperty('portfolioValue');
        expect(point).toHaveProperty('price');
        expect(point).toHaveProperty('trades');
        expect(typeof point.portfolioValue).toBe('number');
        expect(typeof point.trades).toBe('number');
      });
    });

    it('should track portfolio value changes over time', async () => {
      const timeline = await (service as any).generateBacktestTimeline(mockTradingRun, mockTrades);

      // First point should start with initial capital
      expect(timeline[0].portfolioValue).toBe(10000);

      // Timeline should reflect trade impacts
      const pointsWithTrades = timeline.filter((p: any) => p.trades > 0);
      expect(pointsWithTrades.length).toBeGreaterThan(0);
    });

    it('should handle timeline across multiple days', async () => {
      const timeline = await (service as any).generateBacktestTimeline(mockTradingRun, mockTrades);

      // Should cover the full date range (Jan 1-10 = 10 days)
      expect(timeline.length).toBeGreaterThanOrEqual(9); // At least 9 days

      // Dates should be in chronological order
      for (let i = 1; i < timeline.length; i++) {
        expect(new Date(timeline[i].date).getTime()).toBeGreaterThan(
          new Date(timeline[i - 1].date).getTime()
        );
      }
    });

    it('should group trades by date correctly', async () => {
      const timeline = await (service as any).generateBacktestTimeline(mockTradingRun, mockTrades);

      // Find points that should have trades
      const jan2Point = timeline.find((p: any) => p.date === '2025-01-02');
      const jan3Point = timeline.find((p: any) => p.date === '2025-01-03');

      expect(jan2Point?.trades).toBe(1); // trade-1 on Jan 2
      expect(jan3Point?.trades).toBe(1); // trade-2 on Jan 3
    });
  });

  describe('Request Validation', () => {
    let validRequest: BacktestRequest;

    beforeEach(() => {
      validRequest = {
        coinSymbol: 'BTC',
        startDate: '2025-01-01T00:00:00.000Z',
        endDate: '2025-01-10T00:00:00.000Z',
        startingCapital: 10000,
        parameters: {
          risk_per_trade: 2,
          stop_loss_percent: 5,
          take_profit_percent: 10,
          max_positions: 1,
          min_confidence: 0.7
        },
        userId: 'user-123'
      };
    });

    it('should validate valid request', () => {
      expect(() => (service as any).validateBacktestRequest(validRequest)).not.toThrow();
    });

    it('should reject request without coin symbol', () => {
      validRequest.coinSymbol = '';

      expect(() => (service as any).validateBacktestRequest(validRequest))
        .toThrow('Coin symbol is required');
    });

    it('should reject request without dates', () => {
      validRequest.startDate = '';

      expect(() => (service as any).validateBacktestRequest(validRequest))
        .toThrow('Start and end dates are required');
    });

    it('should reject request with start date after end date', () => {
      validRequest.startDate = '2025-01-10T00:00:00.000Z';
      validRequest.endDate = '2025-01-01T00:00:00.000Z';

      expect(() => (service as any).validateBacktestRequest(validRequest))
        .toThrow('Start date must be before end date');
    });

    it('should reject request with future end date', () => {
      const futureDate = new Date();
      futureDate.setFullYear(futureDate.getFullYear() + 1);
      validRequest.endDate = futureDate.toISOString();

      expect(() => (service as any).validateBacktestRequest(validRequest))
        .toThrow('End date cannot be in the future');
    });

    it('should reject request with zero or negative capital', () => {
      validRequest.startingCapital = 0;

      expect(() => (service as any).validateBacktestRequest(validRequest))
        .toThrow('Starting capital must be greater than 0');

      validRequest.startingCapital = -1000;

      expect(() => (service as any).validateBacktestRequest(validRequest))
        .toThrow('Starting capital must be greater than 0');
    });

    it('should reject request with period exceeding 1 year', () => {
      validRequest.startDate = '2024-01-01T00:00:00.000Z';
      validRequest.endDate = '2025-01-02T00:00:00.000Z'; // Just over 1 year

      expect(() => (service as any).validateBacktestRequest(validRequest))
        .toThrow('Backtest period cannot exceed 1 year');
    });
  });

  describe('Edge Cases and Error Handling', () => {
    it('should handle very short trading periods', async () => {
      const shortPeriodRun = {
        ...mockTradingRun,
        session_start: '2025-01-01T00:00:00.000Z',
        session_end: '2025-01-01T23:59:59.999Z' // Same day
      };

      const performance = await (service as any).calculateBacktestPerformance(shortPeriodRun, mockTrades);

      expect(typeof performance.annualizedReturn).toBe('number');
      expect(isFinite(performance.annualizedReturn)).toBe(true);
    });

    it('should handle extreme returns', async () => {
      const extremeRun = {
        ...mockTradingRun,
        starting_capital: 1000,
        final_capital: 100000 // 10,000% return
      };

      const performance = await (service as any).calculateBacktestPerformance(extremeRun, mockTrades);

      expect(performance.totalReturn).toBeCloseTo(9900, 0); // 9900% return
      expect(isFinite(performance.annualizedReturn)).toBe(true);
    });

    it('should handle all losing trades', async () => {
      const allLosingTrades = mockTrades.map(trade => ({
        ...trade,
        profit_loss: -Math.abs(trade.profit_loss!) // Make all trades losses
      }));

      const performance = await (service as any).calculateBacktestPerformance(mockTradingRun, allLosingTrades);

      expect(performance.winRate).toBe(0);
      expect(performance.profitFactor).toBe(0);
    });

    it('should handle trades with zero values', async () => {
      const zeroValueTrades = [
        {
          ...mockTrades[0],
          profit_loss: 0,
          total_value: 0
        }
      ];

      const performance = await (service as any).calculateBacktestPerformance(mockTradingRun, zeroValueTrades);

      expect(typeof performance.sharpeRatio).toBe('number');
      expect(isFinite(performance.sharpeRatio)).toBe(true);
    });

    it('should handle timeline with no trades', async () => {
      const timeline = await (service as any).generateBacktestTimeline(mockTradingRun, []);

      expect(Array.isArray(timeline)).toBe(true);
      expect(timeline.length).toBeGreaterThan(0);

      timeline.forEach((point: any) => {
        expect(point.trades).toBe(0);
        expect(point.portfolioValue).toBe(10000); // Should remain at starting capital
      });
    });

    it('should handle missing session end date', async () => {
      const runWithoutEndDate = {
        ...mockTradingRun,
        session_end: null
      };

      // Should use current date as fallback
      const timeline = await (service as any).generateBacktestTimeline(runWithoutEndDate, mockTrades);

      expect(Array.isArray(timeline)).toBe(true);
      expect(timeline.length).toBeGreaterThan(0);
    });
  });

  describe('Complex Calculation Scenarios', () => {
    it('should handle compound returns correctly', async () => {
      // Create trades that compound over time
      const compoundingTrades: Trade[] = [
        {
          ...mockTrades[0],
          portfolio_value_before: 10000,
          portfolio_value_after: 11000,
          profit_loss: 1000
        },
        {
          ...mockTrades[1],
          portfolio_value_before: 11000,
          portfolio_value_after: 12100,
          profit_loss: 1100
        },
        {
          ...mockTrades[2],
          portfolio_value_before: 12100,
          portfolio_value_after: 13310,
          profit_loss: 1210
        }
      ];

      const performance = await (service as any).calculateBacktestPerformance(
        { ...mockTradingRun, final_capital: 13310 },
        compoundingTrades
      );

      expect(performance.totalReturn).toBeCloseTo(33.1, 1); // 33.1% total return
      expect(performance.avgTradeReturn).toBeCloseTo(1103.33, 2);
    });

    it('should calculate drawdown impact correctly', async () => {
      const runWithDrawdown = {
        ...mockTradingRun,
        max_drawdown: 0.15 // 15% drawdown
      };

      const performance = await (service as any).calculateBacktestPerformance(runWithDrawdown, mockTrades);

      expect(performance.maxDrawdown).toBeCloseTo(15, 2); // Should convert to percentage
    });
  });
});