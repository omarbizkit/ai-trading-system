/**
 * T029: Trade model and types
 * TypeScript types for individual trade data model
 * Based on data-model.md specifications
 */

export type TradeType = "buy" | "sell";
export type TradeReason = "ai_signal" | "stop_loss" | "take_profit" | "manual";

export interface Trade {
  id: string; // UUID, Primary Key - Unique trade identifier
  run_id: string; // UUID, Foreign Key - Links to trading_runs.id
  user_id: string | null; // UUID, Foreign Key - Links to trading_users.id (nullable for guest)
  trade_type: TradeType; // Type of transaction
  coin_symbol: string; // Cryptocurrency symbol traded
  quantity: number; // Amount of cryptocurrency traded
  price: number; // Price per unit at time of trade
  total_value: number; // Total trade value (quantity × price)
  fee: number; // Trading fee applied (simulated)
  net_value: number; // Total value after fees
  portfolio_value_before: number; // Portfolio value before this trade
  portfolio_value_after: number; // Portfolio value after this trade
  profit_loss: number | null; // P/L for this specific trade (nullable for buy orders)
  trade_reason: TradeReason; // Why trade was executed
  ai_confidence: number; // ML model confidence score (0-1)
  market_price: number; // Actual market price at trade time
  execution_time: string; // When trade was executed (ISO string)
  created_at: string; // Record creation timestamp (ISO string)
}

export interface CreateTradeRequest {
  trade_type: TradeType;
  coin_symbol: string;
  quantity: number;
  trade_reason: TradeReason;
  ai_confidence?: number;
}

export interface TradeExecution {
  price: number; // Execution price
  market_price: number; // Current market price
  fee: number; // Calculated fee
  total_value: number; // Total trade value
  net_value: number; // Value after fees
  portfolio_value_before: number;
  portfolio_value_after: number;
  profit_loss?: number; // Only for sell trades
}

export interface TradeSummary {
  id: string;
  trade_type: TradeType;
  coin_symbol: string;
  quantity: number;
  price: number;
  total_value: number;
  profit_loss: number | null;
  trade_reason: TradeReason;
  execution_time: string;
}

export interface TradePerformance {
  total_trades: number;
  winning_trades: number;
  losing_trades: number;
  win_rate: number;
  total_profit_loss: number;
  average_profit: number;
  average_loss: number;
  largest_win: number;
  largest_loss: number;
  profit_factor: number; // Total profits / Total losses
}

// Fee configuration
export interface FeeStructure {
  maker_fee_percent: number; // Fee for providing liquidity
  taker_fee_percent: number; // Fee for taking liquidity
  minimum_fee: number; // Minimum fee amount
  maximum_fee: number; // Maximum fee amount
}

// Default fee structure (simulated trading fees)
export const DEFAULT_FEE_STRUCTURE: FeeStructure = {
  maker_fee_percent: 0.1, // 0.1%
  taker_fee_percent: 0.15, // 0.15%
  minimum_fee: 0.01, // $0.01
  maximum_fee: 100.0 // $100
};

// Validation constraints from data-model.md
export const TRADE_CONSTRAINTS = {
  QUANTITY: {
    MIN: 0.00000001, // Minimum trade quantity
    MAX: 1000000 // Maximum trade quantity
  },
  PRICE: {
    MIN: 0.00000001 // Minimum price
  },
  AI_CONFIDENCE: {
    MIN: 0,
    MAX: 1
  },
  FEE: {
    MIN: 0
  }
} as const;

// Type guards
export function isValidTradeType(value: string): value is TradeType {
  return ["buy", "sell"].includes(value);
}

export function isValidTradeReason(value: string): value is TradeReason {
  return ["ai_signal", "stop_loss", "take_profit", "manual"].includes(value);
}

export function isValidTrade(trade: any): trade is Trade {
  return (
    typeof trade === "object" &&
    typeof trade.id === "string" &&
    typeof trade.run_id === "string" &&
    (typeof trade.user_id === "string" || trade.user_id === null) &&
    isValidTradeType(trade.trade_type) &&
    typeof trade.coin_symbol === "string" &&
    typeof trade.quantity === "number" &&
    trade.quantity > TRADE_CONSTRAINTS.QUANTITY.MIN &&
    typeof trade.price === "number" &&
    trade.price > TRADE_CONSTRAINTS.PRICE.MIN &&
    typeof trade.total_value === "number" &&
    typeof trade.fee === "number" &&
    trade.fee >= TRADE_CONSTRAINTS.FEE.MIN &&
    typeof trade.net_value === "number" &&
    typeof trade.portfolio_value_before === "number" &&
    typeof trade.portfolio_value_after === "number" &&
    (typeof trade.profit_loss === "number" || trade.profit_loss === null) &&
    isValidTradeReason(trade.trade_reason) &&
    typeof trade.ai_confidence === "number" &&
    trade.ai_confidence >= TRADE_CONSTRAINTS.AI_CONFIDENCE.MIN &&
    trade.ai_confidence <= TRADE_CONSTRAINTS.AI_CONFIDENCE.MAX &&
    typeof trade.market_price === "number" &&
    trade.market_price > TRADE_CONSTRAINTS.PRICE.MIN &&
    typeof trade.execution_time === "string" &&
    typeof trade.created_at === "string"
  );
}

// Validation functions
export function validateTradeQuantity(quantity: number): string | null {
  if (typeof quantity !== "number" || isNaN(quantity)) {
    return "Quantity must be a valid number";
  }

  if (quantity <= TRADE_CONSTRAINTS.QUANTITY.MIN) {
    return `Quantity must be greater than ${TRADE_CONSTRAINTS.QUANTITY.MIN}`;
  }

  if (quantity > TRADE_CONSTRAINTS.QUANTITY.MAX) {
    return `Quantity cannot exceed ${TRADE_CONSTRAINTS.QUANTITY.MAX.toLocaleString()}`;
  }

  return null;
}

export function validateTradePrice(price: number): string | null {
  if (typeof price !== "number" || isNaN(price)) {
    return "Price must be a valid number";
  }

  if (price <= TRADE_CONSTRAINTS.PRICE.MIN) {
    return "Price must be greater than 0";
  }

  return null;
}

export function validateAIConfidence(confidence: number): string | null {
  if (typeof confidence !== "number" || isNaN(confidence)) {
    return "AI confidence must be a valid number";
  }

  if (confidence < TRADE_CONSTRAINTS.AI_CONFIDENCE.MIN || confidence > TRADE_CONSTRAINTS.AI_CONFIDENCE.MAX) {
    return `AI confidence must be between ${TRADE_CONSTRAINTS.AI_CONFIDENCE.MIN} and ${TRADE_CONSTRAINTS.AI_CONFIDENCE.MAX}`;
  }

  return null;
}

export function validateCreateTradeRequest(request: CreateTradeRequest): string | null {
  if (!isValidTradeType(request.trade_type)) {
    return "Invalid trade type";
  }

  if (!request.coin_symbol || typeof request.coin_symbol !== "string") {
    return "Coin symbol is required";
  }

  const quantityError = validateTradeQuantity(request.quantity);
  if (quantityError) return quantityError;

  if (!isValidTradeReason(request.trade_reason)) {
    return "Invalid trade reason";
  }

  if (request.ai_confidence !== undefined) {
    const confidenceError = validateAIConfidence(request.ai_confidence);
    if (confidenceError) return confidenceError;
  }

  return null;
}

// Calculation functions
export function calculateTotalValue(quantity: number, price: number): number {
  return quantity * price;
}

export function calculateFee(
  totalValue: number,
  feePercent: number,
  feeStructure: FeeStructure = DEFAULT_FEE_STRUCTURE
): number {
  const fee = (totalValue * feePercent) / 100;
  return Math.max(
    feeStructure.minimum_fee,
    Math.min(fee, feeStructure.maximum_fee)
  );
}

export function calculateNetValue(
  totalValue: number,
  fee: number,
  tradeType: TradeType
): number {
  // For buy trades, fees are added to cost
  // For sell trades, fees are subtracted from proceeds
  return tradeType === "buy" ? totalValue + fee : totalValue - fee;
}

export function calculateProfitLoss(
  sellPrice: number,
  buyPrice: number,
  quantity: number,
  sellFee: number,
  buyFee: number
): number {
  const sellProceeds = (sellPrice * quantity) - sellFee;
  const buyCost = (buyPrice * quantity) + buyFee;
  return sellProceeds - buyCost;
}

export function calculatePerformanceMetrics(trades: Trade[]): TradePerformance {
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

// Utility functions
export function createTrade(
  request: CreateTradeRequest,
  runId: string,
  userId: string | null,
  execution: TradeExecution
): Omit<Trade, "id" | "created_at"> {
  const now = new Date().toISOString();

  return {
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
    execution_time: now
  };
}

export function summarizeTrade(trade: Trade): TradeSummary {
  return {
    id: trade.id,
    trade_type: trade.trade_type,
    coin_symbol: trade.coin_symbol,
    quantity: trade.quantity,
    price: trade.price,
    total_value: trade.total_value,
    profit_loss: trade.profit_loss,
    trade_reason: trade.trade_reason,
    execution_time: trade.execution_time
  };
}

export function formatTradeForDisplay(trade: Trade): {
  type: string;
  symbol: string;
  amount: string;
  price: string;
  value: string;
  pnl: string;
  time: string;
  reason: string;
} {
  return {
    type: trade.trade_type.toUpperCase(),
    symbol: trade.coin_symbol,
    amount: trade.quantity.toFixed(8),
    price: `$${trade.price.toFixed(2)}`,
    value: `$${trade.total_value.toFixed(2)}`,
    pnl: trade.profit_loss
      ? `${trade.profit_loss >= 0 ? '+' : ''}$${trade.profit_loss.toFixed(2)}`
      : "N/A",
    time: new Date(trade.execution_time).toLocaleString(),
    reason: trade.trade_reason.replace("_", " ").toUpperCase()
  };
}