/**
 * T028: TradingRun model and types
 * TypeScript types for trading run/session data model
 * Based on data-model.md specifications
 */

export type SessionType = "simulation" | "backtest";
export type RunStatus = "ACTIVE" | "COMPLETED" | "STOPPED" | "ERROR";

export interface TradingRun {
  id: string; // UUID, Primary Key - Unique run identifier
  user_id: string | null; // UUID, Foreign Key - Links to trading_users.id (nullable for guest sessions)
  session_type: SessionType; // Type of trading session
  coin_symbol: string; // Primary cryptocurrency traded (e.g., 'BTC', 'ETH')
  starting_capital: number; // Initial capital for this session
  final_capital: number | null; // Ending capital after all trades
  total_trades: number; // Count of trades executed
  winning_trades: number; // Count of profitable trades
  win_rate: number | null; // Percentage of winning trades (calculated)
  total_return: number | null; // Overall return percentage
  max_drawdown: number | null; // Maximum loss from peak (negative percentage)
  session_start: string; // When trading session began (ISO string)
  session_end: string | null; // When trading session ended (ISO string)
  time_period_start: string | null; // Start of price data period (for backtests, ISO string)
  time_period_end: string | null; // End of price data period (for backtests, ISO string)
  ai_model_version: string; // Version identifier of ML model used
  parameters: TradingParameters; // Session configuration (stop loss %, take profit %, etc.)
  created_at: string; // Record creation timestamp (ISO string)
}

export interface TradingParameters {
  stop_loss_percent?: number; // Stop loss percentage (default: 2.0)
  take_profit_percent?: number; // Take profit percentage (default: 5.0)
  max_position_size?: number; // Maximum position size as percentage of portfolio
  trade_frequency?: "conservative" | "moderate" | "aggressive";
  risk_per_trade?: number; // Risk per trade as percentage of portfolio
  [key: string]: any; // Allow additional custom parameters
}

export interface CreateTradingRunRequest {
  session_type: SessionType;
  coin_symbol: string;
  starting_capital: number;
  time_period_start?: string; // Required for backtests
  time_period_end?: string; // Required for backtests
  parameters?: Partial<TradingParameters>;
}

export interface UpdateTradingRunRequest {
  session_end?: string;
  final_capital?: number;
  total_trades?: number;
  winning_trades?: number;
  win_rate?: number;
  total_return?: number;
  max_drawdown?: number;
}

export interface TradingRunSummary {
  id: string;
  session_type: SessionType;
  coin_symbol: string;
  starting_capital: number;
  final_capital: number | null;
  total_return: number | null;
  win_rate: number | null;
  total_trades: number;
  session_start: string;
  session_end: string | null;
  created_at: string;
}

export interface BacktestRequest {
  coin_symbol: string;
  start_date: string; // ISO date string
  end_date: string; // ISO date string
  starting_capital: number;
  parameters?: Partial<TradingParameters>;
}

// Default parameters
export const DEFAULT_TRADING_PARAMETERS: TradingParameters = {
  stop_loss_percent: 2.0,
  take_profit_percent: 5.0,
  max_position_size: 25.0,
  trade_frequency: "moderate",
  risk_per_trade: 2.0
};

// Validation constraints from data-model.md
export const TRADING_RUN_CONSTRAINTS = {
  STARTING_CAPITAL: {
    MIN: 0
  },
  FINAL_CAPITAL: {
    MIN: 0
  },
  WIN_RATE: {
    MIN: 0,
    MAX: 100
  },
  PARAMETERS: {
    STOP_LOSS_PERCENT: {
      MIN: 0.1,
      MAX: 50.0
    },
    TAKE_PROFIT_PERCENT: {
      MIN: 0.1,
      MAX: 100.0
    },
    MAX_POSITION_SIZE: {
      MIN: 1.0,
      MAX: 100.0
    },
    RISK_PER_TRADE: {
      MIN: 0.1,
      MAX: 10.0
    }
  }
} as const;

// Type guards
export function isValidSessionType(value: string): value is SessionType {
  return ["simulation", "backtest"].includes(value);
}

export function isValidRunStatus(value: string): value is RunStatus {
  return ["ACTIVE", "COMPLETED", "STOPPED", "ERROR"].includes(value);
}

export function isValidTradingRun(run: any): run is TradingRun {
  return (
    typeof run === "object" &&
    typeof run.id === "string" &&
    (typeof run.user_id === "string" || run.user_id === null) &&
    isValidSessionType(run.session_type) &&
    typeof run.coin_symbol === "string" &&
    typeof run.starting_capital === "number" &&
    run.starting_capital >= TRADING_RUN_CONSTRAINTS.STARTING_CAPITAL.MIN &&
    (typeof run.final_capital === "number" || run.final_capital === null) &&
    typeof run.total_trades === "number" &&
    run.total_trades >= 0 &&
    typeof run.winning_trades === "number" &&
    run.winning_trades >= 0 &&
    run.winning_trades <= run.total_trades &&
    (typeof run.win_rate === "number" || run.win_rate === null) &&
    typeof run.session_start === "string" &&
    (typeof run.session_end === "string" || run.session_end === null) &&
    typeof run.ai_model_version === "string" &&
    typeof run.parameters === "object"
  );
}

// Validation functions
export function validateStartingCapital(capital: number): string | null {
  if (typeof capital !== "number" || isNaN(capital)) {
    return "Starting capital must be a valid number";
  }

  if (capital < TRADING_RUN_CONSTRAINTS.STARTING_CAPITAL.MIN) {
    return "Starting capital must be greater than or equal to 0";
  }

  return null;
}

export function validateTradingParameters(params: Partial<TradingParameters>): string | null {
  if (params.stop_loss_percent !== undefined) {
    const { MIN, MAX } = TRADING_RUN_CONSTRAINTS.PARAMETERS.STOP_LOSS_PERCENT;
    if (params.stop_loss_percent < MIN || params.stop_loss_percent > MAX) {
      return `Stop loss percentage must be between ${MIN}% and ${MAX}%`;
    }
  }

  if (params.take_profit_percent !== undefined) {
    const { MIN, MAX } = TRADING_RUN_CONSTRAINTS.PARAMETERS.TAKE_PROFIT_PERCENT;
    if (params.take_profit_percent < MIN || params.take_profit_percent > MAX) {
      return `Take profit percentage must be between ${MIN}% and ${MAX}%`;
    }
  }

  if (params.stop_loss_percent && params.take_profit_percent) {
    if (params.take_profit_percent <= params.stop_loss_percent) {
      return "Take profit percentage must be greater than stop loss percentage";
    }
  }

  if (params.max_position_size !== undefined) {
    const { MIN, MAX } = TRADING_RUN_CONSTRAINTS.PARAMETERS.MAX_POSITION_SIZE;
    if (params.max_position_size < MIN || params.max_position_size > MAX) {
      return `Maximum position size must be between ${MIN}% and ${MAX}%`;
    }
  }

  if (params.risk_per_trade !== undefined) {
    const { MIN, MAX } = TRADING_RUN_CONSTRAINTS.PARAMETERS.RISK_PER_TRADE;
    if (params.risk_per_trade < MIN || params.risk_per_trade > MAX) {
      return `Risk per trade must be between ${MIN}% and ${MAX}%`;
    }
  }

  return null;
}

export function validateBacktestDates(startDate: string, endDate: string): string | null {
  const start = new Date(startDate);
  const end = new Date(endDate);
  const now = new Date();

  if (isNaN(start.getTime())) {
    return "Invalid start date format";
  }

  if (isNaN(end.getTime())) {
    return "Invalid end date format";
  }

  if (start >= end) {
    return "End date must be after start date";
  }

  if (start > now) {
    return "Start date cannot be in the future";
  }

  if (end > now) {
    return "End date cannot be in the future";
  }

  // Check maximum backtest period (e.g., 2 years)
  const maxPeriodMs = 2 * 365 * 24 * 60 * 60 * 1000; // 2 years in milliseconds
  if (end.getTime() - start.getTime() > maxPeriodMs) {
    return "Backtest period cannot exceed 2 years";
  }

  return null;
}

// Calculation functions
export function calculateWinRate(totalTrades: number, winningTrades: number): number {
  if (totalTrades === 0) return 0;
  return (winningTrades / totalTrades) * 100;
}

export function calculateTotalReturn(startingCapital: number, finalCapital: number): number {
  if (startingCapital === 0) return 0;
  return ((finalCapital - startingCapital) / startingCapital) * 100;
}

export function calculateMaxDrawdown(portfolioValues: number[]): number {
  if (portfolioValues.length === 0) return 0;

  let maxDrawdown = 0;
  let peak = portfolioValues[0];

  for (const value of portfolioValues) {
    if (value > peak) {
      peak = value;
    }

    const drawdown = ((value - peak) / peak) * 100;
    if (drawdown < maxDrawdown) {
      maxDrawdown = drawdown;
    }
  }

  return maxDrawdown;
}

// Utility functions
export function createTradingRun(
  request: CreateTradingRunRequest,
  userId: string | null,
  aiModelVersion: string
): Omit<TradingRun, "id" | "created_at"> {
  const now = new Date().toISOString();

  return {
    user_id: userId,
    session_type: request.session_type,
    coin_symbol: request.coin_symbol.toUpperCase(),
    starting_capital: request.starting_capital,
    final_capital: null,
    total_trades: 0,
    winning_trades: 0,
    win_rate: null,
    total_return: null,
    max_drawdown: null,
    session_start: now,
    session_end: null,
    time_period_start: request.time_period_start || null,
    time_period_end: request.time_period_end || null,
    ai_model_version: aiModelVersion,
    parameters: {
      ...DEFAULT_TRADING_PARAMETERS,
      ...request.parameters
    }
  };
}

export function finalizeTradingRun(
  run: TradingRun,
  finalCapital: number,
  totalTrades: number,
  winningTrades: number,
  maxDrawdown: number
): UpdateTradingRunRequest {
  const winRate = calculateWinRate(totalTrades, winningTrades);
  const totalReturn = calculateTotalReturn(run.starting_capital, finalCapital);

  return {
    session_end: new Date().toISOString(),
    final_capital: finalCapital,
    total_trades: totalTrades,
    winning_trades: winningTrades,
    win_rate: winRate,
    total_return: totalReturn,
    max_drawdown: maxDrawdown
  };
}

export function summarizeTradingRun(run: TradingRun): TradingRunSummary {
  return {
    id: run.id,
    session_type: run.session_type,
    coin_symbol: run.coin_symbol,
    starting_capital: run.starting_capital,
    final_capital: run.final_capital,
    total_return: run.total_return,
    win_rate: run.win_rate,
    total_trades: run.total_trades,
    session_start: run.session_start,
    session_end: run.session_end,
    created_at: run.created_at
  };
}