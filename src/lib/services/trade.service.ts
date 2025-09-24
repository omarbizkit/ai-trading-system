/**
 * T035: TradeService - CRUD operations for individual trades
 * Service layer for managing trade execution and tracking
 * Based on data-model.md specifications
 */

import { supabase, handleDatabaseError, retryOperation } from "../supabase.js";
import type { Database } from "../supabase.js";
import type {
  Trade,
  CreateTradeRequest,
  TradeExecution,
  TradeSummary,
  TradePerformance,
  TradeType,
  TradeReason,
  FeeStructure,
  DEFAULT_FEE_STRUCTURE,
  TRADE_CONSTRAINTS
} from "../types/trade.js";

export class TradeService {
  /**
   * Execute a trade and store it in the database
   */
  async executeTrade(
    request: CreateTradeRequest,
    runId: string,
    userId: string | null,
    marketPrice: number,
    portfolioValueBefore: number,
    feeStructure: FeeStructure = DEFAULT_FEE_STRUCTURE
  ): Promise<Trade> {
    try {
      return await retryOperation(async () => {
        // Calculate trade execution details
        const execution = this.calculateTradeExecution(
          request,
          marketPrice,
          portfolioValueBefore,
          feeStructure
        );

        // Create trade data
        const tradeData: Database["public"]["Tables"]["trading_trades"]["Insert"] = {
          run_id: runId,
          user_id: userId,
          trade_type: request.trade_type,
          coin_symbol: request.coin_symbol.toUpperCase(),
          quantity: request.quantity,
          price: execution.price,
          total_value: execution.total_value,
          fee: execution.fee,
          net_value: execution.net_value,
          portfolio_value_before: execution.portfolio_value_before,
          portfolio_value_after: execution.portfolio_value_after,
          profit_loss: execution.profit_loss || null,
          trade_reason: request.trade_reason,
          ai_confidence: request.ai_confidence || 0,
          market_price: execution.market_price,
          execution_time: new Date().toISOString()
        };

        const { data, error } = await supabase
          .from("trading_trades")
          .insert(tradeData)
          .select()
          .single();

        if (error) {
          handleDatabaseError(error, "execute trade");
        }

        return this.mapDatabaseTradeToTrade(data);
      });
    } catch (error: any) {
      console.error("Failed to execute trade:", error);
      throw new Error(`Failed to execute trade: ${error.message}`);
    }
  }

  /**
   * Get trade by ID
   */
  async getTradeById(tradeId: string): Promise<Trade | null> {
    try {
      return await retryOperation(async () => {
        const { data, error } = await supabase
          .from("trading_trades")
          .select("*")
          .eq("id", tradeId)
          .single();

        if (error) {
          if (error.code === "PGRST116") {
            return null; // Trade not found
          }
          handleDatabaseError(error, "get trade");
        }

        return data ? this.mapDatabaseTradeToTrade(data) : null;
      });
    } catch (error: any) {
      console.error("Failed to get trade:", error);
      throw new Error(`Failed to retrieve trade: ${error.message}`);
    }
  }

  /**
   * Get trades by run ID
   */
  async getTradesByRunId(runId: string, limit: number = 100, offset: number = 0): Promise<Trade[]> {
    try {
      return await retryOperation(async () => {
        const { data, error } = await supabase
          .from("trading_trades")
          .select("*")
          .eq("run_id", runId)
          .order("execution_time", { ascending: false })
          .range(offset, offset + limit - 1);

        if (error) {
          handleDatabaseError(error, "get trades by run");
        }

        return (data || []).map(trade => this.mapDatabaseTradeToTrade(trade));
      });
    } catch (error: any) {
      console.error("Failed to get trades by run:", error);
      throw new Error(`Failed to retrieve trades by run: ${error.message}`);
    }
  }

  /**
   * Get trades by user ID
   */
  async getTradesByUserId(userId: string, limit: number = 100, offset: number = 0): Promise<Trade[]> {
    try {
      return await retryOperation(async () => {
        const { data, error } = await supabase
          .from("trading_trades")
          .select("*")
          .eq("user_id", userId)
          .order("execution_time", { ascending: false })
          .range(offset, offset + limit - 1);

        if (error) {
          handleDatabaseError(error, "get trades by user");
        }

        return (data || []).map(trade => this.mapDatabaseTradeToTrade(trade));
      });
    } catch (error: any) {
      console.error("Failed to get trades by user:", error);
      throw new Error(`Failed to retrieve trades by user: ${error.message}`);
    }
  }

  /**
   * Get recent trades across all runs
   */
  async getRecentTrades(limit: number = 20): Promise<Trade[]> {
    try {
      return await retryOperation(async () => {
        const { data, error } = await supabase
          .from("trading_trades")
          .select("*")
          .order("execution_time", { ascending: false })
          .limit(limit);

        if (error) {
          handleDatabaseError(error, "get recent trades");
        }

        return (data || []).map(trade => this.mapDatabaseTradeToTrade(trade));
      });
    } catch (error: any) {
      console.error("Failed to get recent trades:", error);
      throw new Error(`Failed to retrieve recent trades: ${error.message}`);
    }
  }

  /**
   * Update trade profit/loss (for sell trades)
   */
  async updateTradeProfitLoss(tradeId: string, profitLoss: number): Promise<Trade> {
    try {
      return await retryOperation(async () => {
        const { data, error } = await supabase
          .from("trading_trades")
          .update({ profit_loss: profitLoss })
          .eq("id", tradeId)
          .select()
          .single();

        if (error) {
          if (error.code === "PGRST116") {
            throw new Error("Trade not found");
          }
          handleDatabaseError(error, "update trade profit/loss");
        }

        return this.mapDatabaseTradeToTrade(data);
      });
    } catch (error: any) {
      console.error("Failed to update trade profit/loss:", error);
      throw new Error(`Failed to update trade profit/loss: ${error.message}`);
    }
  }

  /**
   * Delete trade (admin function)
   */
  async deleteTrade(tradeId: string): Promise<void> {
    try {
      await retryOperation(async () => {
        const { error } = await supabase
          .from("trading_trades")
          .delete()
          .eq("id", tradeId);

        if (error) {
          handleDatabaseError(error, "delete trade");
        }
      });
    } catch (error: any) {
      console.error("Failed to delete trade:", error);
      throw new Error(`Failed to delete trade: ${error.message}`);
    }
  }

  /**
   * Get trade summaries for a run
   */
  async getTradeSummariesByRunId(runId: string): Promise<TradeSummary[]> {
    try {
      const trades = await this.getTradesByRunId(runId);
      return trades.map(trade => ({
        id: trade.id,
        trade_type: trade.trade_type,
        coin_symbol: trade.coin_symbol,
        quantity: trade.quantity,
        price: trade.price,
        total_value: trade.total_value,
        profit_loss: trade.profit_loss,
        trade_reason: trade.trade_reason,
        execution_time: trade.execution_time
      }));
    } catch (error: any) {
      console.error("Failed to get trade summaries:", error);
      throw new Error(`Failed to get trade summaries: ${error.message}`);
    }
  }

  /**
   * Calculate performance metrics for a set of trades
   */
  async getTradePerformance(runId: string): Promise<TradePerformance> {
    try {
      const trades = await this.getTradesByRunId(runId);
      return this.calculatePerformanceMetrics(trades);
    } catch (error: any) {
      console.error("Failed to get trade performance:", error);
      throw new Error(`Failed to get trade performance: ${error.message}`);
    }
  }

  /**
   * Get trades by coin symbol
   */
  async getTradesByCoinSymbol(coinSymbol: string, limit: number = 50): Promise<Trade[]> {
    try {
      return await retryOperation(async () => {
        const { data, error } = await supabase
          .from("trading_trades")
          .select("*")
          .eq("coin_symbol", coinSymbol.toUpperCase())
          .order("execution_time", { ascending: false })
          .limit(limit);

        if (error) {
          handleDatabaseError(error, "get trades by coin symbol");
        }

        return (data || []).map(trade => this.mapDatabaseTradeToTrade(trade));
      });
    } catch (error: any) {
      console.error("Failed to get trades by coin symbol:", error);
      throw new Error(`Failed to get trades by coin symbol: ${error.message}`);
    }
  }

  /**
   * Get trading statistics for a user
   */
  async getUserTradingStats(userId: string): Promise<{
    total_trades: number;
    total_volume: number;
    total_profit_loss: number;
    best_trade: number;
    worst_trade: number;
    average_trade_size: number;
    most_traded_coin: string | null;
    win_rate: number;
  }> {
    try {
      return await retryOperation(async () => {
        const { data: trades, error } = await supabase
          .from("trading_trades")
          .select("*")
          .eq("user_id", userId);

        if (error) {
          handleDatabaseError(error, "get user trading stats");
        }

        const allTrades = trades || [];
        const completedTrades = allTrades.filter(trade => trade.profit_loss !== null);

        if (allTrades.length === 0) {
          return {
            total_trades: 0,
            total_volume: 0,
            total_profit_loss: 0,
            best_trade: 0,
            worst_trade: 0,
            average_trade_size: 0,
            most_traded_coin: null,
            win_rate: 0
          };
        }

        const totalVolume = allTrades.reduce((sum, trade) => sum + trade.total_value, 0);
        const totalProfitLoss = completedTrades.reduce((sum, trade) => sum + (trade.profit_loss || 0), 0);
        const averageTradeSize = totalVolume / allTrades.length;

        const profitLosses = completedTrades.map(trade => trade.profit_loss!);
        const bestTrade = profitLosses.length > 0 ? Math.max(...profitLosses) : 0;
        const worstTrade = profitLosses.length > 0 ? Math.min(...profitLosses) : 0;

        // Find most traded coin
        const coinCounts = allTrades.reduce((counts, trade) => {
          counts[trade.coin_symbol] = (counts[trade.coin_symbol] || 0) + 1;
          return counts;
        }, {} as Record<string, number>);

        const mostTradedCoin = Object.keys(coinCounts).length > 0
          ? Object.entries(coinCounts).sort(([, a], [, b]) => b - a)[0][0]
          : null;

        const winningTrades = completedTrades.filter(trade => trade.profit_loss! > 0).length;
        const winRate = completedTrades.length > 0 ? (winningTrades / completedTrades.length) * 100 : 0;

        return {
          total_trades: allTrades.length,
          total_volume: totalVolume,
          total_profit_loss: totalProfitLoss,
          best_trade: bestTrade,
          worst_trade: worstTrade,
          average_trade_size: averageTradeSize,
          most_traded_coin: mostTradedCoin,
          win_rate: winRate
        };
      });
    } catch (error: any) {
      console.error("Failed to get user trading stats:", error);
      throw new Error(`Failed to get user trading stats: ${error.message}`);
    }
  }

  /**
   * Calculate trade execution details
   */
  private calculateTradeExecution(
    request: CreateTradeRequest,
    marketPrice: number,
    portfolioValueBefore: number,
    feeStructure: FeeStructure
  ): TradeExecution {
    const price = marketPrice; // In simulation, we use market price
    const totalValue = request.quantity * price;

    // Calculate fees
    const feePercent = request.trade_type === "buy"
      ? feeStructure.taker_fee_percent
      : feeStructure.maker_fee_percent;

    const fee = Math.max(
      feeStructure.minimum_fee,
      Math.min((totalValue * feePercent) / 100, feeStructure.maximum_fee)
    );

    // Calculate net value
    const netValue = request.trade_type === "buy"
      ? totalValue + fee  // Fees add to buy cost
      : totalValue - fee; // Fees subtract from sell proceeds

    // Calculate portfolio value after trade
    const portfolioValueAfter = request.trade_type === "buy"
      ? portfolioValueBefore - netValue
      : portfolioValueBefore + netValue;

    return {
      price,
      market_price: marketPrice,
      fee,
      total_value: totalValue,
      net_value: netValue,
      portfolio_value_before: portfolioValueBefore,
      portfolio_value_after: portfolioValueAfter,
      profit_loss: request.trade_type === "sell" ? undefined : undefined // P/L calculated later for matched trades
    };
  }

  /**
   * Calculate performance metrics from trades
   */
  private calculatePerformanceMetrics(trades: Trade[]): TradePerformance {
    const completedTrades = trades.filter(trade => trade.profit_loss !== null);
    const totalTrades = completedTrades.length;

    if (totalTrades === 0) {
      return {
        total_trades: 0,
        winning_trades: 0,
        losing_trades: 0,
        win_rate: 0,
        total_profit_loss: 0,
        average_profit: 0,
        average_loss: 0,
        largest_win: 0,
        largest_loss: 0,
        profit_factor: 0
      };
    }

    const winningTrades = completedTrades.filter(trade => trade.profit_loss! > 0);
    const losingTrades = completedTrades.filter(trade => trade.profit_loss! < 0);

    const totalProfitLoss = completedTrades.reduce((sum, trade) => sum + trade.profit_loss!, 0);
    const totalProfits = winningTrades.reduce((sum, trade) => sum + trade.profit_loss!, 0);
    const totalLosses = Math.abs(losingTrades.reduce((sum, trade) => sum + trade.profit_loss!, 0));

    const averageProfit = winningTrades.length > 0 ? totalProfits / winningTrades.length : 0;
    const averageLoss = losingTrades.length > 0 ? totalLosses / losingTrades.length : 0;

    const largestWin = winningTrades.length > 0
      ? Math.max(...winningTrades.map(trade => trade.profit_loss!))
      : 0;

    const largestLoss = losingTrades.length > 0
      ? Math.min(...losingTrades.map(trade => trade.profit_loss!))
      : 0;

    const profitFactor = totalLosses > 0 ? totalProfits / totalLosses : totalProfits > 0 ? Infinity : 0;

    return {
      total_trades: totalTrades,
      winning_trades: winningTrades.length,
      losing_trades: losingTrades.length,
      win_rate: (winningTrades.length / totalTrades) * 100,
      total_profit_loss: totalProfitLoss,
      average_profit: averageProfit,
      average_loss: averageLoss,
      largest_win: largestWin,
      largest_loss: largestLoss,
      profit_factor: profitFactor
    };
  }

  /**
   * Helper: Map database trade to Trade type
   */
  private mapDatabaseTradeToTrade(dbTrade: Database["public"]["Tables"]["trading_trades"]["Row"]): Trade {
    return {
      id: dbTrade.id,
      run_id: dbTrade.run_id,
      user_id: dbTrade.user_id,
      trade_type: dbTrade.trade_type as TradeType,
      coin_symbol: dbTrade.coin_symbol,
      quantity: dbTrade.quantity,
      price: dbTrade.price,
      total_value: dbTrade.total_value,
      fee: dbTrade.fee,
      net_value: dbTrade.net_value,
      portfolio_value_before: dbTrade.portfolio_value_before,
      portfolio_value_after: dbTrade.portfolio_value_after,
      profit_loss: dbTrade.profit_loss,
      trade_reason: dbTrade.trade_reason as TradeReason,
      ai_confidence: dbTrade.ai_confidence,
      market_price: dbTrade.market_price,
      execution_time: dbTrade.execution_time,
      created_at: dbTrade.created_at
    };
  }
}

// Export singleton instance
export const tradeService = new TradeService();
export default tradeService;