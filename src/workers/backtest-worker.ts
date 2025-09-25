/**
 * T070: Web Worker for backtesting computations
 * High-performance backtesting calculations running in a separate thread
 */

// Type definitions for worker communication
export interface BacktestConfig {
  symbol: string;
  startDate: string;
  endDate: string;
  initialCapital: number;
  strategy: {
    type: 'ai_prediction' | 'technical_analysis' | 'buy_and_hold';
    parameters: Record<string, any>;
  };
  settings: {
    tradingFee: number;
    maxPositionSize: number;
    stopLoss?: number;
    takeProfit?: number;
    rebalanceFrequency?: 'daily' | 'weekly' | 'monthly';
  };
}

export interface BacktestData {
  prices: Array<{
    timestamp: number;
    open: number;
    high: number;
    low: number;
    close: number;
    volume: number;
  }>;
  predictions?: Array<{
    timestamp: number;
    predicted_price: number;
    confidence: number;
    direction: 'up' | 'down' | 'hold';
  }>;
}

export interface BacktestTrade {
  timestamp: number;
  type: 'buy' | 'sell';
  price: number;
  quantity: number;
  value: number;
  fee: number;
  reason: string;
  portfolioValue: number;
  cash: number;
}

export interface BacktestResult {
  config: BacktestConfig;
  performance: {
    totalReturn: number;
    totalReturnPercentage: number;
    annualizedReturn: number;
    sharpeRatio: number;
    maxDrawdown: number;
    maxDrawdownDuration: number;
    winRate: number;
    profitFactor: number;
    sortino: number;
    calmar: number;
  };
  trades: BacktestTrade[];
  dailyReturns: Array<{
    date: string;
    portfolioValue: number;
    return: number;
    drawdown: number;
  }>;
  statistics: {
    totalTrades: number;
    winningTrades: number;
    losingTrades: number;
    averageWin: number;
    averageLoss: number;
    averageTradeDuration: number;
    largestWin: number;
    largestLoss: number;
  };
  benchmark?: {
    totalReturn: number;
    totalReturnPercentage: number;
    sharpeRatio: number;
  };
}

export interface WorkerMessage {
  id: string;
  type: 'start' | 'progress' | 'result' | 'error' | 'cancel';
  payload?: any;
}

class BacktestWorker {
  private currentJob: string | null = null;
  private isCancelled = false;

  constructor() {
    // Listen for messages from main thread
    self.addEventListener('message', this.handleMessage.bind(this));
  }

  /**
   * Handle messages from main thread
   */
  private handleMessage(event: MessageEvent<WorkerMessage>): void {
    const { id, type, payload } = event.data;

    switch (type) {
      case 'start':
        this.startBacktest(id, payload.config, payload.data);
        break;
      case 'cancel':
        this.cancelBacktest(id);
        break;
      default:
        this.postError(id, `Unknown message type: ${type}`);
    }
  }

  /**
   * Start backtesting process
   */
  private async startBacktest(
    jobId: string,
    config: BacktestConfig,
    data: BacktestData
  ): Promise<void> {
    this.currentJob = jobId;
    this.isCancelled = false;

    try {
      this.postProgress(jobId, 'Initializing backtest...', 0);

      // Validate inputs
      this.validateConfig(config);
      this.validateData(data);

      this.postProgress(jobId, 'Running backtest simulation...', 10);

      // Run the backtest
      const result = await this.runBacktest(config, data, jobId);

      if (!this.isCancelled) {
        this.postResult(jobId, result);
      }

    } catch (error) {
      if (!this.isCancelled) {
        this.postError(jobId, error instanceof Error ? error.message : 'Unknown error');
      }
    } finally {
      this.currentJob = null;
    }
  }

  /**
   * Cancel current backtest
   */
  private cancelBacktest(jobId: string): void {
    if (this.currentJob === jobId) {
      this.isCancelled = true;
      this.currentJob = null;
      this.postMessage(jobId, 'cancel', 'Backtest cancelled');
    }
  }

  /**
   * Run the actual backtest simulation
   */
  private async runBacktest(
    config: BacktestConfig,
    data: BacktestData,
    jobId: string
  ): Promise<BacktestResult> {
    const trades: BacktestTrade[] = [];
    const dailyReturns: BacktestResult['dailyReturns'] = [];

    let cash = config.initialCapital;
    let position = 0; // Current position size
    let portfolioValue = config.initialCapital;

    const { prices } = data;
    const totalDays = prices.length;
    let progressCounter = 0;

    // Initialize tracking variables
    let maxPortfolioValue = config.initialCapital;
    let maxDrawdown = 0;
    let drawdownStart = 0;
    let maxDrawdownDuration = 0;

    // Process each trading day
    for (let i = 1; i < prices.length; i++) {
      if (this.isCancelled) return {} as BacktestResult;

      const currentPrice = prices[i];
      const previousPrice = prices[i - 1];

      // Update progress periodically
      if (progressCounter % 100 === 0) {
        const progress = 10 + (progressCounter / totalDays) * 80;
        this.postProgress(jobId, `Processing day ${progressCounter + 1} of ${totalDays}...`, progress);
      }
      progressCounter++;

      // Calculate current portfolio value
      portfolioValue = cash + (position * currentPrice.close);

      // Execute trading strategy
      const signal = this.generateTradingSignal(
        config.strategy,
        prices.slice(0, i + 1),
        data.predictions?.filter(p => p.timestamp <= currentPrice.timestamp) || [],
        i
      );

      // Process trading signal
      if (signal !== 'hold') {
        const trade = this.executeTrade(
          signal,
          currentPrice,
          position,
          cash,
          portfolioValue,
          config.settings
        );

        if (trade) {
          trades.push(trade);
          cash = trade.cash;
          position = trade.type === 'buy'
            ? position + trade.quantity
            : position - trade.quantity;
          portfolioValue = trade.portfolioValue;
        }
      }

      // Track drawdown
      if (portfolioValue > maxPortfolioValue) {
        maxPortfolioValue = portfolioValue;
        drawdownStart = i;
      } else {
        const currentDrawdown = (maxPortfolioValue - portfolioValue) / maxPortfolioValue;
        if (currentDrawdown > maxDrawdown) {
          maxDrawdown = currentDrawdown;
          maxDrawdownDuration = Math.max(maxDrawdownDuration, i - drawdownStart);
        }
      }

      // Record daily return
      const dailyReturn = i > 0
        ? (portfolioValue / (cash + (position * previousPrice.close)) - 1)
        : 0;

      dailyReturns.push({
        date: new Date(currentPrice.timestamp).toISOString().split('T')[0],
        portfolioValue,
        return: dailyReturn,
        drawdown: (maxPortfolioValue - portfolioValue) / maxPortfolioValue
      });
    }

    this.postProgress(jobId, 'Calculating performance metrics...', 95);

    // Calculate performance metrics
    const performance = this.calculatePerformanceMetrics(
      config.initialCapital,
      portfolioValue,
      dailyReturns,
      trades,
      maxDrawdown,
      maxDrawdownDuration
    );

    // Calculate trade statistics
    const statistics = this.calculateTradeStatistics(trades);

    // Calculate benchmark (buy and hold)
    const benchmark = this.calculateBenchmark(
      config.initialCapital,
      prices[0].close,
      prices[prices.length - 1].close,
      dailyReturns.length
    );

    return {
      config,
      performance,
      trades,
      dailyReturns,
      statistics,
      benchmark
    };
  }

  /**
   * Generate trading signal based on strategy
   */
  private generateTradingSignal(
    strategy: BacktestConfig['strategy'],
    prices: BacktestData['prices'],
    predictions: NonNullable<BacktestData['predictions']>,
    currentIndex: number
  ): 'buy' | 'sell' | 'hold' {
    const currentPrice = prices[currentIndex];

    switch (strategy.type) {
      case 'ai_prediction':
        return this.generateAIPredictionSignal(currentPrice, predictions, strategy.parameters);

      case 'technical_analysis':
        return this.generateTechnicalSignal(prices, currentIndex, strategy.parameters);

      case 'buy_and_hold':
        // Only buy on first day, then hold
        return currentIndex === 1 ? 'buy' : 'hold';

      default:
        return 'hold';
    }
  }

  /**
   * Generate signal based on AI predictions
   */
  private generateAIPredictionSignal(
    currentPrice: BacktestData['prices'][0],
    predictions: NonNullable<BacktestData['predictions']>,
    parameters: Record<string, any>
  ): 'buy' | 'sell' | 'hold' {
    // Find most recent prediction
    const recentPrediction = predictions
      .filter(p => p.timestamp <= currentPrice.timestamp)
      .sort((a, b) => b.timestamp - a.timestamp)[0];

    if (!recentPrediction) return 'hold';

    const confidenceThreshold = parameters.confidenceThreshold || 0.6;
    const priceChangeThreshold = parameters.priceChangeThreshold || 0.02; // 2%

    // Check if prediction meets confidence threshold
    if (recentPrediction.confidence < confidenceThreshold) return 'hold';

    // Calculate expected price change
    const expectedChange = (recentPrediction.predicted_price - currentPrice.close) / currentPrice.close;

    if (Math.abs(expectedChange) < priceChangeThreshold) return 'hold';

    return expectedChange > 0 ? 'buy' : 'sell';
  }

  /**
   * Generate signal based on technical analysis
   */
  private generateTechnicalSignal(
    prices: BacktestData['prices'],
    currentIndex: number,
    parameters: Record<string, any>
  ): 'buy' | 'sell' | 'hold' {
    const lookback = parameters.lookback || 20;
    const rsiPeriod = parameters.rsiPeriod || 14;

    if (currentIndex < Math.max(lookback, rsiPeriod)) return 'hold';

    const recentPrices = prices.slice(currentIndex - lookback, currentIndex + 1);
    const currentPrice = prices[currentIndex];

    // Simple moving average crossover
    const shortMA = this.calculateSMA(recentPrices.slice(-10), 'close');
    const longMA = this.calculateSMA(recentPrices, 'close');

    // RSI
    const rsi = this.calculateRSI(prices.slice(currentIndex - rsiPeriod, currentIndex + 1));

    // Generate signal
    const maSignal = shortMA > longMA ? 'bullish' : 'bearish';
    const rsiOverbought = rsi > 70;
    const rsiOversold = rsi < 30;

    if (maSignal === 'bullish' && !rsiOverbought) return 'buy';
    if (maSignal === 'bearish' && !rsiOversold) return 'sell';

    return 'hold';
  }

  /**
   * Execute a trade
   */
  private executeTrade(
    signal: 'buy' | 'sell',
    currentPrice: BacktestData['prices'][0],
    currentPosition: number,
    currentCash: number,
    portfolioValue: number,
    settings: BacktestConfig['settings']
  ): BacktestTrade | null {
    const { tradingFee, maxPositionSize } = settings;
    const price = currentPrice.close;

    if (signal === 'buy') {
      // Calculate maximum buy amount
      const maxBuyValue = portfolioValue * maxPositionSize;
      const availableCash = currentCash;
      const buyValue = Math.min(maxBuyValue, availableCash * 0.95); // Leave 5% cash buffer

      if (buyValue < price) return null; // Not enough cash

      const quantity = Math.floor(buyValue / price);
      const totalCost = quantity * price;
      const fee = totalCost * tradingFee;

      return {
        timestamp: currentPrice.timestamp,
        type: 'buy',
        price,
        quantity,
        value: totalCost,
        fee,
        reason: 'Strategy signal',
        portfolioValue: portfolioValue - totalCost - fee,
        cash: currentCash - totalCost - fee
      };

    } else if (signal === 'sell' && currentPosition > 0) {
      // Sell all or partial position
      const sellQuantity = Math.min(currentPosition, Math.floor(currentPosition));
      const totalValue = sellQuantity * price;
      const fee = totalValue * tradingFee;

      return {
        timestamp: currentPrice.timestamp,
        type: 'sell',
        price,
        quantity: sellQuantity,
        value: totalValue,
        fee,
        reason: 'Strategy signal',
        portfolioValue: portfolioValue + totalValue - fee,
        cash: currentCash + totalValue - fee
      };
    }

    return null;
  }

  /**
   * Calculate performance metrics
   */
  private calculatePerformanceMetrics(
    initialCapital: number,
    finalValue: number,
    dailyReturns: BacktestResult['dailyReturns'],
    trades: BacktestTrade[],
    maxDrawdown: number,
    maxDrawdownDuration: number
  ): BacktestResult['performance'] {
    const totalReturn = finalValue - initialCapital;
    const totalReturnPercentage = (totalReturn / initialCapital) * 100;

    const tradingDays = dailyReturns.length;
    const annualizedReturn = Math.pow(finalValue / initialCapital, 365 / tradingDays) - 1;

    // Calculate Sharpe ratio
    const returns = dailyReturns.map(d => d.return);
    const avgReturn = returns.reduce((sum, r) => sum + r, 0) / returns.length;
    const returnStd = Math.sqrt(
      returns.reduce((sum, r) => sum + Math.pow(r - avgReturn, 2), 0) / returns.length
    );
    const sharpeRatio = returnStd > 0 ? (avgReturn * Math.sqrt(365)) / (returnStd * Math.sqrt(365)) : 0;

    // Calculate win rate
    const winningTrades = trades.filter((trade, i) => {
      if (i === 0 || trade.type !== 'sell') return false;
      const buyTrade = trades[i - 1];
      return trade.price > buyTrade.price;
    }).length;
    const totalTrades = Math.floor(trades.length / 2); // Assuming buy-sell pairs
    const winRate = totalTrades > 0 ? (winningTrades / totalTrades) * 100 : 0;

    // Calculate profit factor
    const wins = trades.filter((trade, i) => {
      if (i === 0 || trade.type !== 'sell') return false;
      const buyTrade = trades[i - 1];
      return trade.value > buyTrade.value;
    });
    const losses = trades.filter((trade, i) => {
      if (i === 0 || trade.type !== 'sell') return false;
      const buyTrade = trades[i - 1];
      return trade.value < buyTrade.value;
    });

    const grossProfit = wins.reduce((sum, trade, i) => {
      const buyTrade = trades[i - 1];
      return sum + (trade.value - buyTrade.value);
    }, 0);
    const grossLoss = losses.reduce((sum, trade, i) => {
      const buyTrade = trades[i - 1];
      return sum + Math.abs(trade.value - buyTrade.value);
    }, 0);
    const profitFactor = grossLoss > 0 ? grossProfit / grossLoss : grossProfit > 0 ? 999 : 1;

    // Sortino ratio (similar to Sharpe but uses downside deviation)
    const negativeReturns = returns.filter(r => r < 0);
    const downsideStd = negativeReturns.length > 0 ? Math.sqrt(
      negativeReturns.reduce((sum, r) => sum + Math.pow(r, 2), 0) / negativeReturns.length
    ) : 0;
    const sortino = downsideStd > 0 ? (avgReturn * Math.sqrt(365)) / (downsideStd * Math.sqrt(365)) : 0;

    // Calmar ratio
    const calmar = maxDrawdown > 0 ? annualizedReturn / maxDrawdown : 0;

    return {
      totalReturn,
      totalReturnPercentage,
      annualizedReturn: annualizedReturn * 100,
      sharpeRatio,
      maxDrawdown: maxDrawdown * 100,
      maxDrawdownDuration,
      winRate,
      profitFactor,
      sortino,
      calmar
    };
  }

  /**
   * Calculate trade statistics
   */
  private calculateTradeStatistics(trades: BacktestTrade[]): BacktestResult['statistics'] {
    const sellTrades = trades.filter(t => t.type === 'sell');
    const totalTrades = sellTrades.length;

    if (totalTrades === 0) {
      return {
        totalTrades: 0,
        winningTrades: 0,
        losingTrades: 0,
        averageWin: 0,
        averageLoss: 0,
        averageTradeDuration: 0,
        largestWin: 0,
        largestLoss: 0
      };
    }

    // Calculate P&L for each trade (simplified)
    const tradePnLs = sellTrades.map((sellTrade, i) => {
      const buyTradeIndex = trades.findIndex((t, idx) =>
        idx < trades.indexOf(sellTrade) && t.type === 'buy'
      );

      if (buyTradeIndex === -1) return 0;

      const buyTrade = trades[buyTradeIndex];
      return sellTrade.value - buyTrade.value - sellTrade.fee - buyTrade.fee;
    });

    const winningTrades = tradePnLs.filter(pnl => pnl > 0).length;
    const losingTrades = tradePnLs.filter(pnl => pnl < 0).length;

    const wins = tradePnLs.filter(pnl => pnl > 0);
    const losses = tradePnLs.filter(pnl => pnl < 0);

    const averageWin = wins.length > 0 ? wins.reduce((sum, pnl) => sum + pnl, 0) / wins.length : 0;
    const averageLoss = losses.length > 0 ? Math.abs(losses.reduce((sum, pnl) => sum + pnl, 0) / losses.length) : 0;

    const largestWin = wins.length > 0 ? Math.max(...wins) : 0;
    const largestLoss = losses.length > 0 ? Math.abs(Math.min(...losses)) : 0;

    // Calculate average trade duration (simplified)
    const averageTradeDuration = 1; // In days, simplified calculation

    return {
      totalTrades,
      winningTrades,
      losingTrades,
      averageWin,
      averageLoss,
      averageTradeDuration,
      largestWin,
      largestLoss
    };
  }

  /**
   * Calculate benchmark performance (buy and hold)
   */
  private calculateBenchmark(
    initialCapital: number,
    startPrice: number,
    endPrice: number,
    tradingDays: number
  ): BacktestResult['benchmark'] {
    const shares = initialCapital / startPrice;
    const finalValue = shares * endPrice;
    const totalReturn = finalValue - initialCapital;
    const totalReturnPercentage = (totalReturn / initialCapital) * 100;

    const annualizedReturn = Math.pow(finalValue / initialCapital, 365 / tradingDays) - 1;
    const sharpeRatio = annualizedReturn > 0 ? annualizedReturn / 0.16 : 0; // Assuming 16% volatility

    return {
      totalReturn,
      totalReturnPercentage,
      sharpeRatio
    };
  }

  /**
   * Technical analysis helper functions
   */
  private calculateSMA(prices: BacktestData['prices'], field: 'open' | 'high' | 'low' | 'close' = 'close'): number {
    if (prices.length === 0) return 0;
    const sum = prices.reduce((total, price) => total + price[field], 0);
    return sum / prices.length;
  }

  private calculateRSI(prices: BacktestData['prices']): number {
    if (prices.length < 2) return 50;

    const changes = prices.slice(1).map((price, i) => price.close - prices[i].close);
    const gains = changes.map(change => change > 0 ? change : 0);
    const losses = changes.map(change => change < 0 ? Math.abs(change) : 0);

    const avgGain = gains.reduce((sum, gain) => sum + gain, 0) / gains.length;
    const avgLoss = losses.reduce((sum, loss) => sum + loss, 0) / losses.length;

    if (avgLoss === 0) return 100;
    const rs = avgGain / avgLoss;
    return 100 - (100 / (1 + rs));
  }

  /**
   * Validation functions
   */
  private validateConfig(config: BacktestConfig): void {
    if (!config.symbol || !config.startDate || !config.endDate) {
      throw new Error('Missing required config fields');
    }

    if (new Date(config.startDate) >= new Date(config.endDate)) {
      throw new Error('Start date must be before end date');
    }

    if (config.initialCapital <= 0) {
      throw new Error('Initial capital must be positive');
    }
  }

  private validateData(data: BacktestData): void {
    if (!data.prices || data.prices.length < 2) {
      throw new Error('Insufficient price data');
    }

    // Validate price data structure
    const samplePrice = data.prices[0];
    if (!samplePrice.timestamp || !samplePrice.close) {
      throw new Error('Invalid price data structure');
    }
  }

  /**
   * Utility functions for worker communication
   */
  private postMessage(jobId: string, type: WorkerMessage['type'], payload?: any): void {
    const message: WorkerMessage = { id: jobId, type, payload };
    self.postMessage(message);
  }

  private postProgress(jobId: string, message: string, progress: number): void {
    this.postMessage(jobId, 'progress', { message, progress });
  }

  private postResult(jobId: string, result: BacktestResult): void {
    this.postMessage(jobId, 'result', result);
  }

  private postError(jobId: string, error: string): void {
    this.postMessage(jobId, 'error', { error });
  }
}

// Initialize worker
new BacktestWorker();

// Export types for use in main thread
export type { BacktestConfig, BacktestData, BacktestResult, BacktestTrade, WorkerMessage };