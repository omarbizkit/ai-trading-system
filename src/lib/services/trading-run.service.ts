/**
 * T034: TradingRunService - CRUD operations for trading sessions
 * Service layer for managing trading runs (simulations and backtests)
 * Based on data-model.md specifications
 */

import { supabase, handleDatabaseError, retryOperation } from "../supabase.js";
import type { Database } from "../supabase.js";
import type {
  TradingRun,
  CreateTradingRunRequest,
  UpdateTradingRunRequest,
  TradingRunSummary,
  SessionType,
  RunStatus,
  RunParameters,
  TRADING_RUN_CONSTRAINTS
} from "../types/trading-run.js";

export class TradingRunService {
  /**
   * Create a new trading run
   */
  async createRun(request: CreateTradingRunRequest): Promise<TradingRun> {
    try {
      return await retryOperation(async () => {
        const runData: Database["public"]["Tables"]["trading_runs"]["Insert"] = {
          user_id: request.user_id,
          session_type: request.session_type,
          coin_symbol: request.coin_symbol.toUpperCase(),
          starting_capital: request.starting_capital,
          total_trades: 0,
          winning_trades: 0,
          session_start: new Date().toISOString(),
          time_period_start: request.time_period_start,
          time_period_end: request.time_period_end,
          ai_model_version: request.ai_model_version,
          parameters: request.parameters || this.getDefaultParameters()
        };

        const { data, error } = await supabase
          .from("trading_runs")
          .insert(runData)
          .select()
          .single();

        if (error) {
          handleDatabaseError(error, "create trading run");
        }

        return this.mapDatabaseRunToTradingRun(data);
      });
    } catch (error: any) {
      console.error("Failed to create trading run:", error);
      throw new Error(`Failed to create trading run: ${error.message}`);
    }
  }

  /**
   * Get run by ID
   */
  async getRunById(runId: string): Promise<TradingRun | null> {
    try {
      return await retryOperation(async () => {
        const { data, error } = await supabase
          .from("trading_runs")
          .select("*")
          .eq("id", runId)
          .single();

        if (error) {
          if (error.code === "PGRST116") {
            return null; // Run not found
          }
          handleDatabaseError(error, "get trading run");
        }

        return data ? this.mapDatabaseRunToTradingRun(data) : null;
      });
    } catch (error: any) {
      console.error("Failed to get trading run:", error);
      throw new Error(`Failed to retrieve trading run: ${error.message}`);
    }
  }

  /**
   * Get runs by user ID
   */
  async getRunsByUserId(userId: string, limit: number = 50, offset: number = 0): Promise<TradingRun[]> {
    try {
      return await retryOperation(async () => {
        const { data, error } = await supabase
          .from("trading_runs")
          .select("*")
          .eq("user_id", userId)
          .order("created_at", { ascending: false })
          .range(offset, offset + limit - 1);

        if (error) {
          handleDatabaseError(error, "get user trading runs");
        }

        return (data || []).map(run => this.mapDatabaseRunToTradingRun(run));
      });
    } catch (error: any) {
      console.error("Failed to get user trading runs:", error);
      throw new Error(`Failed to retrieve user trading runs: ${error.message}`);
    }
  }

  /**
   * Get active runs by user ID
   */
  async getActiveRunsByUserId(userId: string): Promise<TradingRun[]> {
    try {
      return await retryOperation(async () => {
        const { data, error } = await supabase
          .from("trading_runs")
          .select("*")
          .eq("user_id", userId)
          .is("session_end", null)
          .order("session_start", { ascending: false });

        if (error) {
          handleDatabaseError(error, "get active trading runs");
        }

        return (data || []).map(run => this.mapDatabaseRunToTradingRun(run));
      });
    } catch (error: any) {
      console.error("Failed to get active trading runs:", error);
      throw new Error(`Failed to retrieve active trading runs: ${error.message}`);
    }
  }

  /**
   * Update trading run
   */
  async updateRun(runId: string, updates: UpdateTradingRunRequest): Promise<TradingRun> {
    try {
      return await retryOperation(async () => {
        const updateData: Database["public"]["Tables"]["trading_runs"]["Update"] = updates;

        const { data, error } = await supabase
          .from("trading_runs")
          .update(updateData)
          .eq("id", runId)
          .select()
          .single();

        if (error) {
          if (error.code === "PGRST116") {
            throw new Error("Trading run not found");
          }
          handleDatabaseError(error, "update trading run");
        }

        return this.mapDatabaseRunToTradingRun(data);
      });
    } catch (error: any) {
      console.error("Failed to update trading run:", error);
      throw new Error(`Failed to update trading run: ${error.message}`);
    }
  }

  /**
   * End trading run with final results
   */
  async endRun(runId: string, finalCapital: number): Promise<TradingRun> {
    try {
      const run = await this.getRunById(runId);
      if (!run) {
        throw new Error("Trading run not found");
      }

      if (run.session_end) {
        throw new Error("Trading run is already ended");
      }

      const totalReturn = ((finalCapital - run.starting_capital) / run.starting_capital) * 100;
      const winRate = run.total_trades > 0 ? (run.winning_trades / run.total_trades) * 100 : 0;

      return await this.updateRun(runId, {
        final_capital: finalCapital,
        session_end: new Date().toISOString(),
        total_return: totalReturn,
        win_rate: winRate
      });
    } catch (error: any) {
      console.error("Failed to end trading run:", error);
      throw new Error(`Failed to end trading run: ${error.message}`);
    }
  }

  /**
   * Update run statistics after a trade
   */
  async updateRunStats(
    runId: string,
    isWinningTrade: boolean,
    newPortfolioValue: number,
    maxDrawdown?: number
  ): Promise<TradingRun> {
    try {
      const run = await this.getRunById(runId);
      if (!run) {
        throw new Error("Trading run not found");
      }

      const newTotalTrades = run.total_trades + 1;
      const newWinningTrades = run.winning_trades + (isWinningTrade ? 1 : 0);
      const newWinRate = (newWinningTrades / newTotalTrades) * 100;

      const updates: UpdateTradingRunRequest = {
        total_trades: newTotalTrades,
        winning_trades: newWinningTrades,
        win_rate: newWinRate
      };

      if (maxDrawdown !== undefined && (run.max_drawdown === null || maxDrawdown > run.max_drawdown)) {
        updates.max_drawdown = maxDrawdown;
      }

      return await this.updateRun(runId, updates);
    } catch (error: any) {
      console.error("Failed to update run statistics:", error);
      throw new Error(`Failed to update run statistics: ${error.message}`);
    }
  }

  /**
   * Delete trading run
   */
  async deleteRun(runId: string): Promise<void> {
    try {
      await retryOperation(async () => {
        // Check if run exists first
        const existingRun = await this.getRunById(runId);
        if (!existingRun) {
          throw new Error("Trading run not found");
        }

        // Delete associated trades first (cascade should handle this, but being explicit)
        const { error: tradesError } = await supabase
          .from("trading_trades")
          .delete()
          .eq("run_id", runId);

        if (tradesError) {
          handleDatabaseError(tradesError, "delete run trades");
        }

        // Delete the run
        const { error } = await supabase
          .from("trading_runs")
          .delete()
          .eq("id", runId);

        if (error) {
          handleDatabaseError(error, "delete trading run");
        }
      });
    } catch (error: any) {
      console.error("Failed to delete trading run:", error);
      throw new Error(`Failed to delete trading run: ${error.message}`);
    }
  }

  /**
   * Get run summary with aggregated data
   */
  async getRunSummary(runId: string): Promise<TradingRunSummary | null> {
    try {
      const run = await this.getRunById(runId);
      if (!run) return null;

      return {
        id: run.id,
        user_id: run.user_id,
        session_type: run.session_type,
        coin_symbol: run.coin_symbol,
        starting_capital: run.starting_capital,
        final_capital: run.final_capital,
        total_return: run.total_return,
        total_trades: run.total_trades,
        win_rate: run.win_rate,
        max_drawdown: run.max_drawdown,
        session_start: run.session_start,
        session_end: run.session_end,
        status: this.getRunStatus(run)
      };
    } catch (error: any) {
      console.error("Failed to get run summary:", error);
      throw new Error(`Failed to get run summary: ${error.message}`);
    }
  }

  /**
   * Get runs by coin symbol
   */
  async getRunsByCoinSymbol(coinSymbol: string, limit: number = 20): Promise<TradingRun[]> {
    try {
      return await retryOperation(async () => {
        const { data, error } = await supabase
          .from("trading_runs")
          .select("*")
          .eq("coin_symbol", coinSymbol.toUpperCase())
          .order("created_at", { ascending: false })
          .limit(limit);

        if (error) {
          handleDatabaseError(error, "get runs by coin symbol");
        }

        return (data || []).map(run => this.mapDatabaseRunToTradingRun(run));
      });
    } catch (error: any) {
      console.error("Failed to get runs by coin symbol:", error);
      throw new Error(`Failed to get runs by coin symbol: ${error.message}`);
    }
  }

  /**
   * Get performance statistics for a user
   */
  async getUserPerformanceStats(userId: string): Promise<{
    total_runs: number;
    completed_runs: number;
    average_return: number;
    best_return: number;
    worst_return: number;
    total_trades: number;
    overall_win_rate: number;
    favorite_coin: string | null;
  }> {
    try {
      return await retryOperation(async () => {
        const { data: runs, error } = await supabase
          .from("trading_runs")
          .select("*")
          .eq("user_id", userId);

        if (error) {
          handleDatabaseError(error, "get user performance stats");
        }

        const allRuns = runs || [];
        const completedRuns = allRuns.filter(run => run.session_end && run.final_capital !== null);

        if (completedRuns.length === 0) {
          return {
            total_runs: allRuns.length,
            completed_runs: 0,
            average_return: 0,
            best_return: 0,
            worst_return: 0,
            total_trades: 0,
            overall_win_rate: 0,
            favorite_coin: null
          };
        }

        const returns = completedRuns.map(run => run.total_return!);
        const averageReturn = returns.reduce((sum, ret) => sum + ret, 0) / returns.length;
        const bestReturn = Math.max(...returns);
        const worstReturn = Math.min(...returns);

        const totalTrades = allRuns.reduce((sum, run) => sum + run.total_trades, 0);
        const totalWinningTrades = allRuns.reduce((sum, run) => sum + run.winning_trades, 0);
        const overallWinRate = totalTrades > 0 ? (totalWinningTrades / totalTrades) * 100 : 0;

        // Find favorite coin (most traded)
        const coinCounts = allRuns.reduce((counts, run) => {
          counts[run.coin_symbol] = (counts[run.coin_symbol] || 0) + 1;
          return counts;
        }, {} as Record<string, number>);

        const favoriteCoin = Object.keys(coinCounts).length > 0
          ? Object.entries(coinCounts).sort(([, a], [, b]) => b - a)[0][0]
          : null;

        return {
          total_runs: allRuns.length,
          completed_runs: completedRuns.length,
          average_return: averageReturn,
          best_return: bestReturn,
          worst_return: worstReturn,
          total_trades: totalTrades,
          overall_win_rate: overallWinRate,
          favorite_coin: favoriteCoin
        };
      });
    } catch (error: any) {
      console.error("Failed to get user performance stats:", error);
      throw new Error(`Failed to get user performance stats: ${error.message}`);
    }
  }

  /**
   * Update run parameters
   */
  async updateRunParameters(runId: string, parameters: Partial<RunParameters>): Promise<TradingRun> {
    try {
      const run = await this.getRunById(runId);
      if (!run) {
        throw new Error("Trading run not found");
      }

      const currentParams = run.parameters as RunParameters;
      const newParams = { ...currentParams, ...parameters };

      return await this.updateRun(runId, { parameters: newParams });
    } catch (error: any) {
      console.error("Failed to update run parameters:", error);
      throw new Error(`Failed to update run parameters: ${error.message}`);
    }
  }

  /**
   * Helper: Get default run parameters
   */
  private getDefaultParameters(): RunParameters {
    return {
      max_trade_amount: 1000,
      stop_loss_percentage: 5,
      take_profit_percentage: 10,
      confidence_threshold: 0.7,
      max_open_positions: 3,
      enable_stop_loss: true,
      enable_take_profit: true,
      trading_hours: {
        start: "00:00",
        end: "23:59",
        timezone: "UTC"
      }
    };
  }

  /**
   * Helper: Determine run status
   */
  private getRunStatus(run: TradingRun): RunStatus {
    if (run.session_end) {
      return "completed";
    }

    // Check if run is within time period for backtests
    if (run.session_type === "backtest" && run.time_period_end) {
      const now = new Date();
      const endTime = new Date(run.time_period_end);
      if (now > endTime) {
        return "completed";
      }
    }

    return "active";
  }

  /**
   * Helper: Map database run to TradingRun type
   */
  private mapDatabaseRunToTradingRun(dbRun: Database["public"]["Tables"]["trading_runs"]["Row"]): TradingRun {
    return {
      id: dbRun.id,
      user_id: dbRun.user_id,
      session_type: dbRun.session_type,
      coin_symbol: dbRun.coin_symbol,
      starting_capital: dbRun.starting_capital,
      final_capital: dbRun.final_capital,
      total_trades: dbRun.total_trades,
      winning_trades: dbRun.winning_trades,
      win_rate: dbRun.win_rate,
      total_return: dbRun.total_return,
      max_drawdown: dbRun.max_drawdown,
      session_start: dbRun.session_start,
      session_end: dbRun.session_end,
      time_period_start: dbRun.time_period_start,
      time_period_end: dbRun.time_period_end,
      ai_model_version: dbRun.ai_model_version,
      parameters: dbRun.parameters as RunParameters,
      created_at: dbRun.created_at
    };
  }
}

// Export singleton instance
export const tradingRunService = new TradingRunService();
export default tradingRunService;