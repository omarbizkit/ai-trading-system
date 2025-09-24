/**
 * T038: BacktestingService - Web Worker-based backtesting engine
 * Service layer for running historical trading simulations
 * Based on data-model.md specifications
 */

import { supabase, handleDatabaseError, retryOperation } from "../supabase.js";
import type { Database } from "../supabase.js";
import type {
  TradingRun,
  CreateTradingRunRequest,
  RunParameters
} from "../types/trading-run.js";
import type {
  Trade,
  CreateTradeRequest,
  TradeType,
  TradeReason
} from "../types/trade.js";
import type {
  MarketData,
  HistoricalDataRequest,
  HistoricalDataResponse,
  OHLCDataPoint
} from "../types/market-data.js";
import type {
  AIPrediction,
  InputFeatures,
  PredictedDirection
} from "../types/ai-prediction.js";

// Import services
import { tradingRunService } from "./trading-run.service.js";
import { tradeService } from "./trade.service.js";
import { marketDataService } from "./market-data.service.js";
import { aiPredictionService } from "./ai-prediction.service.js";

export interface BacktestRequest {
  coinSymbol: string;
  startDate: string;
  endDate: string;
  startingCapital: number;
  parameters: RunParameters;
  userId?: string;
}

export interface BacktestProgress {
  runId: string;
  progress: number; // 0-100
  currentDate: string;
  totalTrades: number;
  currentValue: number;
  status: "running" | "completed" | "failed" | "cancelled";
  message?: string;
}

export interface BacktestResult {
  run: TradingRun;
  trades: Trade[];
  performance: {
    totalReturn: number;
    annualizedReturn: number;
    maxDrawdown: number;
    sharpeRatio: number;
    winRate: number;
    profitFactor: number;
    totalTrades: number;
    avgTradeReturn: number;
  };
  timeline: Array<{
    date: string;
    portfolioValue: number;
    price: number;
    trades: number;
  }>;
}

export interface BacktestWorkerMessage {
  type: "start" | "progress" | "complete" | "error" | "cancel";
  data?: any;
}

export class BacktestingService {
  private activeBacktests = new Map<string, {
    worker?: Worker;
    startTime: number;
    progressCallback?: (progress: BacktestProgress) => void;
  }>();

  /**
   * Start a new backtest
   */
  async startBacktest(
    request: BacktestRequest,
    progressCallback?: (progress: BacktestProgress) => void
  ): Promise<string> {
    try {
      // Validate request
      this.validateBacktestRequest(request);

      // Create trading run
      const runRequest: CreateTradingRunRequest = {
        user_id: request.userId || null,
        session_type: "backtest",
        coin_symbol: request.coinSymbol,
        starting_capital: request.startingCapital,
        time_period_start: request.startDate,
        time_period_end: request.endDate,
        ai_model_version: "v1.2.3", // Use current model version
        parameters: request.parameters
      };

      const run = await tradingRunService.createRun(runRequest);

      // Initialize backtest tracking
      this.activeBacktests.set(run.id, {
        startTime: Date.now(),
        progressCallback
      });

      // Start backtest in web worker
      if (typeof Worker !== "undefined") {
        await this.startWorkerBacktest(run.id, request);
      } else {
        // Fallback to main thread for environments without Web Workers
        await this.startMainThreadBacktest(run.id, request);
      }

      return run.id;
    } catch (error: any) {
      console.error("Failed to start backtest:", error);
      throw new Error(`Failed to start backtest: ${error.message}`);
    }
  }

  /**
   * Get backtest progress
   */
  getBacktestProgress(runId: string): BacktestProgress | null {
    const backtest = this.activeBacktests.get(runId);
    if (!backtest) return null;

    // This would typically be updated by the worker
    return {
      runId,
      progress: 0,
      currentDate: new Date().toISOString(),
      totalTrades: 0,
      currentValue: 0,
      status: "running"
    };
  }

  /**
   * Cancel a running backtest
   */
  async cancelBacktest(runId: string): Promise<void> {
    const backtest = this.activeBacktests.get(runId);
    if (!backtest) return;

    if (backtest.worker) {
      backtest.worker.postMessage({ type: "cancel" });
      backtest.worker.terminate();
    }

    this.activeBacktests.delete(runId);

    // Update run status in database
    await tradingRunService.updateRun(runId, {
      session_end: new Date().toISOString()
    });
  }

  /**
   * Get backtest results
   */
  async getBacktestResults(runId: string): Promise<BacktestResult | null> {
    try {
      const run = await tradingRunService.getRunById(runId);
      if (!run) return null;

      const trades = await tradeService.getTradesByRunId(runId);
      const performance = await this.calculateBacktestPerformance(run, trades);
      const timeline = await this.generateBacktestTimeline(run, trades);

      return {
        run,
        trades,
        performance,
        timeline
      };
    } catch (error: any) {
      console.error("Failed to get backtest results:", error);
      throw new Error(`Failed to get backtest results: ${error.message}`);
    }
  }

  /**
   * Run quick backtest simulation (simplified, main thread)
   */
  async runQuickBacktest(request: BacktestRequest): Promise<BacktestResult> {
    try {
      // This is a simplified version for quick testing
      const runId = await this.startBacktest(request);

      // Simulate backtest completion
      await this.simulateBacktest(runId, request);

      const result = await this.getBacktestResults(runId);
      if (!result) {
        throw new Error("Failed to generate backtest results");
      }

      return result;
    } catch (error: any) {
      console.error("Failed to run quick backtest:", error);
      throw new Error(`Failed to run quick backtest: ${error.message}`);
    }
  }

  /**
   * Get historical backtests for a user
   */
  async getUserBacktests(userId: string, limit: number = 20): Promise<TradingRun[]> {
    try {
      const runs = await tradingRunService.getRunsByUserId(userId, limit);
      return runs.filter(run => run.session_type === "backtest");
    } catch (error: any) {
      console.error("Failed to get user backtests:", error);
      throw new Error(`Failed to get user backtests: ${error.message}`);
    }
  }

  /**
   * Compare multiple backtest results
   */
  async compareBacktests(runIds: string[]): Promise<{
    runs: TradingRun[];
    comparison: Array<{
      runId: string;
      coinSymbol: string;
      totalReturn: number;
      maxDrawdown: number;
      sharpeRatio: number;
      winRate: number;
      totalTrades: number;
    }>;
  }> {
    try {
      const runs = await Promise.all(
        runIds.map(id => tradingRunService.getRunById(id))
      );

      const validRuns = runs.filter((run): run is TradingRun => run !== null);

      const comparison = await Promise.all(
        validRuns.map(async run => {
          const trades = await tradeService.getTradesByRunId(run.id);
          const performance = await this.calculateBacktestPerformance(run, trades);

          return {
            runId: run.id,
            coinSymbol: run.coin_symbol,
            totalReturn: performance.totalReturn,
            maxDrawdown: performance.maxDrawdown,
            sharpeRatio: performance.sharpeRatio,
            winRate: performance.winRate,
            totalTrades: performance.totalTrades
          };
        })
      );

      return {
        runs: validRuns,
        comparison
      };
    } catch (error: any) {
      console.error("Failed to compare backtests:", error);
      throw new Error(`Failed to compare backtests: ${error.message}`);
    }
  }

  /**
   * Private: Start backtest in web worker
   */
  private async startWorkerBacktest(runId: string, request: BacktestRequest): Promise<void> {
    return new Promise((resolve, reject) => {
      const workerCode = this.generateWorkerCode();
      const blob = new Blob([workerCode], { type: "application/javascript" });
      const worker = new Worker(URL.createObjectURL(blob));

      const backtest = this.activeBacktests.get(runId);
      if (backtest) {
        backtest.worker = worker;
      }

      worker.onmessage = (event: MessageEvent<BacktestWorkerMessage>) => {
        const { type, data } = event.data;

        switch (type) {
          case "progress":
            if (backtest?.progressCallback) {
              backtest.progressCallback(data as BacktestProgress);
            }
            break;

          case "complete":
            this.activeBacktests.delete(runId);
            worker.terminate();
            URL.revokeObjectURL(blob);
            resolve();
            break;

          case "error":
            this.activeBacktests.delete(runId);
            worker.terminate();
            URL.revokeObjectURL(blob);
            reject(new Error(data.message || "Backtest failed"));
            break;
        }
      };

      worker.onerror = (error) => {
        this.activeBacktests.delete(runId);
        worker.terminate();
        URL.revokeObjectURL(blob);
        reject(new Error(`Worker error: ${error.message}`));
      };

      // Start the backtest
      worker.postMessage({
        type: "start",
        data: { runId, request }
      });
    });
  }

  /**
   * Private: Start backtest in main thread (fallback)
   */
  private async startMainThreadBacktest(runId: string, request: BacktestRequest): Promise<void> {
    await this.simulateBacktest(runId, request);
  }

  /**
   * Private: Simulate backtest execution
   */
  private async simulateBacktest(runId: string, request: BacktestRequest): Promise<void> {
    try {
      // Get historical data
      const historicalRequest: HistoricalDataRequest = {
        coin_symbol: request.coinSymbol,
        from: request.startDate,
        to: request.endDate,
        interval: "1d"
      };

      const historicalResponse = await marketDataService.getHistoricalData(historicalRequest);
      const historicalData = historicalResponse.data;

      // Initialize simulation state
      let portfolioValue = request.startingCapital;
      let cashBalance = request.startingCapital;
      let position = 0; // Amount of crypto held
      let totalTrades = 0;
      let winningTrades = 0;
      let maxDrawdown = 0;
      const allTrades: Trade[] = [];

      // Simulate trading for each day
      for (let i = 1; i < historicalData.length; i++) {
        const currentDay = historicalData[i];
        const previousDay = historicalData[i - 1];

        // Generate AI prediction (simplified)
        const prediction = await this.generateSimulatedPrediction(
          request.coinSymbol,
          currentDay,
          previousDay
        );

        // Make trading decisions based on prediction
        const tradeDecision = this.makeTradeDecision(
          prediction,
          portfolioValue,
          position,
          currentDay.close,
          request.parameters
        );

        if (tradeDecision) {
          const trade = await this.executeSimulatedTrade(
            runId,
            request.userId || null,
            tradeDecision,
            currentDay.close,
            portfolioValue
          );

          allTrades.push(trade);

          // Update portfolio state
          if (trade.trade_type === "buy") {
            cashBalance -= trade.net_value;
            position += trade.quantity;
          } else {
            cashBalance += trade.net_value;
            position -= trade.quantity;
          }

          portfolioValue = cashBalance + (position * currentDay.close);
          totalTrades++;

          if (trade.profit_loss && trade.profit_loss > 0) {
            winningTrades++;
          }

          // Calculate drawdown
          const peak = Math.max(...allTrades.map(t => t.portfolio_value_after));
          const drawdown = (peak - portfolioValue) / peak;
          maxDrawdown = Math.max(maxDrawdown, drawdown);
        }

        // Update progress
        const progress = (i / historicalData.length) * 100;
        const backtest = this.activeBacktests.get(runId);
        if (backtest?.progressCallback) {
          backtest.progressCallback({
            runId,
            progress,
            currentDate: currentDay.timestamp,
            totalTrades,
            currentValue: portfolioValue,
            status: "running"
          });
        }
      }

      // Finalize backtest
      await tradingRunService.endRun(runId, portfolioValue);

      // Update final statistics
      await tradingRunService.updateRunStats(runId, false, portfolioValue, maxDrawdown);

    } catch (error: any) {
      console.error("Failed to simulate backtest:", error);
      throw error;
    }
  }

  /**
   * Private: Generate simulated AI prediction
   */
  private async generateSimulatedPrediction(
    coinSymbol: string,
    currentDay: OHLCDataPoint,
    previousDay: OHLCDataPoint
  ): Promise<AIPrediction> {
    // Create simplified market data for prediction
    const marketData: MarketData = {
      coin_symbol: coinSymbol,
      price_source: "backtest",
      current_price: currentDay.close,
      price_change_24h: ((currentDay.close - previousDay.close) / previousDay.close) * 100,
      volume_24h: currentDay.volume,
      market_cap: currentDay.close * 1000000, // Mock market cap
      sentiment_score: 0,
      fear_greed_index: 50,
      last_updated: currentDay.timestamp,
      historical_data: [],
      created_at: currentDay.timestamp
    };

    // Generate prediction using AI service
    return await aiPredictionService.generatePrediction(coinSymbol, marketData, 1440); // 24 hours
  }

  /**
   * Private: Make trade decision based on prediction
   */
  private makeTradeDecision(
    prediction: AIPrediction,
    portfolioValue: number,
    currentPosition: number,
    currentPrice: number,
    parameters: RunParameters
  ): CreateTradeRequest | null {
    // Simple trading logic based on prediction confidence and direction
    if (prediction.confidence_score < parameters.confidence_threshold) {
      return null; // Not confident enough
    }

    const maxTradeValue = Math.min(parameters.max_trade_amount, portfolioValue * 0.1); // Max 10% of portfolio
    const maxQuantity = maxTradeValue / currentPrice;

    if (prediction.predicted_direction === "up" && currentPosition === 0) {
      // Buy signal
      return {
        trade_type: "buy",
        coin_symbol: prediction.coin_symbol,
        quantity: maxQuantity,
        trade_reason: "ai_signal",
        ai_confidence: prediction.confidence_score
      };
    } else if (prediction.predicted_direction === "down" && currentPosition > 0) {
      // Sell signal
      return {
        trade_type: "sell",
        coin_symbol: prediction.coin_symbol,
        quantity: Math.min(maxQuantity, currentPosition),
        trade_reason: "ai_signal",
        ai_confidence: prediction.confidence_score
      };
    }

    return null;
  }

  /**
   * Private: Execute simulated trade
   */
  private async executeSimulatedTrade(
    runId: string,
    userId: string | null,
    request: CreateTradeRequest,
    marketPrice: number,
    portfolioValueBefore: number
  ): Promise<Trade> {
    return await tradeService.executeTrade(
      request,
      runId,
      userId,
      marketPrice,
      portfolioValueBefore
    );
  }

  /**
   * Private: Calculate backtest performance metrics
   */
  private async calculateBacktestPerformance(run: TradingRun, trades: Trade[]): Promise<BacktestResult["performance"]> {
    const startingCapital = run.starting_capital;
    const finalCapital = run.final_capital || startingCapital;
    const totalReturn = ((finalCapital - startingCapital) / startingCapital) * 100;

    // Calculate annualized return
    const startDate = new Date(run.session_start);
    const endDate = new Date(run.session_end || new Date());
    const daysElapsed = (endDate.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24);
    const annualizedReturn = (Math.pow(finalCapital / startingCapital, 365 / daysElapsed) - 1) * 100;

    // Calculate performance metrics from trades
    const completedTrades = trades.filter(trade => trade.profit_loss !== null);
    const winningTrades = completedTrades.filter(trade => trade.profit_loss! > 0);
    const losingTrades = completedTrades.filter(trade => trade.profit_loss! < 0);

    const winRate = completedTrades.length > 0 ? (winningTrades.length / completedTrades.length) * 100 : 0;

    const totalProfits = winningTrades.reduce((sum, trade) => sum + trade.profit_loss!, 0);
    const totalLosses = Math.abs(losingTrades.reduce((sum, trade) => sum + trade.profit_loss!, 0));
    const profitFactor = totalLosses > 0 ? totalProfits / totalLosses : totalProfits > 0 ? Infinity : 0;

    const avgTradeReturn = completedTrades.length > 0
      ? completedTrades.reduce((sum, trade) => sum + trade.profit_loss!, 0) / completedTrades.length
      : 0;

    // Calculate Sharpe ratio (simplified)
    const returns = completedTrades.map(trade => (trade.profit_loss! / trade.total_value) * 100);
    const avgReturn = returns.reduce((sum, r) => sum + r, 0) / returns.length || 0;
    const returnStd = Math.sqrt(returns.reduce((sum, r) => sum + Math.pow(r - avgReturn, 2), 0) / returns.length) || 1;
    const sharpeRatio = avgReturn / returnStd;

    return {
      totalReturn,
      annualizedReturn,
      maxDrawdown: (run.max_drawdown || 0) * 100,
      sharpeRatio,
      winRate,
      profitFactor,
      totalTrades: trades.length,
      avgTradeReturn
    };
  }

  /**
   * Private: Generate backtest timeline
   */
  private async generateBacktestTimeline(run: TradingRun, trades: Trade[]): Promise<BacktestResult["timeline"]> {
    const timeline: BacktestResult["timeline"] = [];

    // Group trades by date
    const tradesByDate = new Map<string, Trade[]>();
    trades.forEach(trade => {
      const date = trade.execution_time.split("T")[0];
      if (!tradesByDate.has(date)) {
        tradesByDate.set(date, []);
      }
      tradesByDate.get(date)!.push(trade);
    });

    // Generate timeline points
    let currentValue = run.starting_capital;
    const startDate = new Date(run.session_start);
    const endDate = new Date(run.session_end || new Date());

    for (let d = new Date(startDate); d <= endDate; d.setDate(d.getDate() + 1)) {
      const dateStr = d.toISOString().split("T")[0];
      const dayTrades = tradesByDate.get(dateStr) || [];

      if (dayTrades.length > 0) {
        currentValue = dayTrades[dayTrades.length - 1].portfolio_value_after;
      }

      timeline.push({
        date: dateStr,
        portfolioValue: currentValue,
        price: 0, // Would need historical price data
        trades: dayTrades.length
      });
    }

    return timeline;
  }

  /**
   * Private: Validate backtest request
   */
  private validateBacktestRequest(request: BacktestRequest): void {
    if (!request.coinSymbol) {
      throw new Error("Coin symbol is required");
    }

    if (!request.startDate || !request.endDate) {
      throw new Error("Start and end dates are required");
    }

    const startDate = new Date(request.startDate);
    const endDate = new Date(request.endDate);

    if (startDate >= endDate) {
      throw new Error("Start date must be before end date");
    }

    if (endDate > new Date()) {
      throw new Error("End date cannot be in the future");
    }

    if (request.startingCapital <= 0) {
      throw new Error("Starting capital must be greater than 0");
    }

    // Check maximum backtest period (1 year)
    const maxPeriod = 365 * 24 * 60 * 60 * 1000; // 1 year in milliseconds
    if (endDate.getTime() - startDate.getTime() > maxPeriod) {
      throw new Error("Backtest period cannot exceed 1 year");
    }
  }

  /**
   * Private: Generate web worker code
   */
  private generateWorkerCode(): string {
    return `
      // Web Worker code for backtesting
      self.onmessage = function(event) {
        const { type, data } = event.data;

        if (type === 'start') {
          runBacktest(data.runId, data.request);
        } else if (type === 'cancel') {
          self.close();
        }
      };

      function runBacktest(runId, request) {
        try {
          // Simulate backtest progress
          let progress = 0;
          const interval = setInterval(() => {
            progress += 10;

            self.postMessage({
              type: 'progress',
              data: {
                runId,
                progress,
                currentDate: new Date().toISOString(),
                totalTrades: Math.floor(progress / 10),
                currentValue: request.startingCapital * (1 + (progress / 100) * 0.1),
                status: 'running'
              }
            });

            if (progress >= 100) {
              clearInterval(interval);
              self.postMessage({
                type: 'complete',
                data: { runId }
              });
            }
          }, 100);

        } catch (error) {
          self.postMessage({
            type: 'error',
            data: { message: error.message }
          });
        }
      }
    `;
  }
}

// Export singleton instance
export const backtestingService = new BacktestingService();
export default backtestingService;