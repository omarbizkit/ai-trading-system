/**
 * T066: Client-side state management for trading session
 * Global state management for trading simulation with local persistence
 */

import type {
  TradingSession,
  Trade,
  Portfolio,
  Position
} from '../types/trading';

export interface TradingState {
  // Session state
  session: TradingSession | null;
  isActive: boolean;
  isPaused: boolean;

  // Portfolio state
  portfolio: Portfolio | null;
  positions: Position[];
  totalValue: number;
  availableCash: number;

  // Trade state
  pendingTrades: Trade[];
  tradeHistory: Trade[];

  // UI state
  selectedSymbol: string;
  selectedTimeframe: '1m' | '5m' | '15m' | '1h' | '4h' | '1d';
  showAdvancedControls: boolean;

  // Settings
  tradingSettings: {
    maxPositionSize: number;
    stopLossPercentage: number;
    takeProfitPercentage: number;
    allowShortSelling: boolean;
    paperTradingOnly: boolean;
  };

  // Real-time data
  marketData: Record<string, {
    price: number;
    change_24h: number;
    volume: number;
    last_updated: string;
  }>;

  // Predictions
  predictions: Record<string, {
    predicted_price: number;
    confidence: number;
    direction: 'up' | 'down' | 'hold';
    timestamp: string;
  }>;
}

class TradingStore {
  private state: TradingState;
  private listeners: Array<(state: TradingState) => void> = [];
  private storageKey = 'ai-trading-session';
  private autosaveInterval: number | null = null;

  constructor() {
    this.state = this.getInitialState();
    this.loadFromStorage();
    this.setupAutosave();
  }

  /**
   * Get current trading state
   */
  getState(): TradingState {
    return { ...this.state };
  }

  /**
   * Subscribe to state changes
   */
  subscribe(callback: (state: TradingState) => void): () => void {
    this.listeners.push(callback);

    // Return unsubscribe function
    return () => {
      const index = this.listeners.indexOf(callback);
      if (index > -1) {
        this.listeners.splice(index, 1);
      }
    };
  }

  /**
   * Start new trading session
   */
  startSession(initialCapital: number = 50000, symbol: string = 'btc'): void {
    const session: TradingSession = {
      id: this.generateSessionId(),
      user_id: this.getUserId(),
      start_time: new Date().toISOString(),
      initial_capital: initialCapital,
      current_capital: initialCapital,
      status: 'active',
      settings: this.state.tradingSettings
    };

    const portfolio: Portfolio = {
      id: this.generatePortfolioId(),
      session_id: session.id,
      total_value: initialCapital,
      cash_balance: initialCapital,
      positions_value: 0,
      profit_loss: 0,
      profit_loss_percentage: 0,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    };

    this.updateState({
      session,
      portfolio,
      positions: [],
      totalValue: initialCapital,
      availableCash: initialCapital,
      isActive: true,
      isPaused: false,
      selectedSymbol: symbol,
      pendingTrades: [],
      tradeHistory: []
    });

    console.log('Trading session started:', session.id);
  }

  /**
   * Pause/Resume trading session
   */
  toggleSession(): void {
    if (!this.state.session) return;

    this.updateState({
      isPaused: !this.state.isPaused
    });

    console.log('Trading session', this.state.isPaused ? 'paused' : 'resumed');
  }

  /**
   * End trading session
   */
  endSession(): void {
    if (!this.state.session) return;

    const finalSession = {
      ...this.state.session,
      end_time: new Date().toISOString(),
      final_capital: this.state.totalValue,
      status: 'completed' as const
    };

    this.updateState({
      session: finalSession,
      isActive: false,
      isPaused: false
    });

    // Save final session to database if authenticated
    this.saveFinalSession(finalSession);

    console.log('Trading session ended:', finalSession.id);
  }

  /**
   * Execute a trade
   */
  executeTrade(
    symbol: string,
    type: 'buy' | 'sell',
    amount: number,
    price: number
  ): Trade | null {
    if (!this.state.session || this.state.isPaused) {
      console.warn('Cannot execute trade: session not active');
      return null;
    }

    const totalCost = amount * price;
    const fee = totalCost * 0.001; // 0.1% trading fee

    // Validate trade
    if (type === 'buy' && (totalCost + fee) > this.state.availableCash) {
      console.warn('Insufficient funds for buy order');
      return null;
    }

    const existingPosition = this.state.positions.find(p => p.symbol === symbol);
    if (type === 'sell' && (!existingPosition || existingPosition.quantity < amount)) {
      console.warn('Insufficient position for sell order');
      return null;
    }

    // Create trade
    const trade: Trade = {
      id: this.generateTradeId(),
      session_id: this.state.session.id,
      symbol: symbol.toUpperCase(),
      type,
      quantity: amount,
      price,
      total_value: totalCost,
      fee,
      status: 'completed',
      executed_at: new Date().toISOString(),
      created_at: new Date().toISOString()
    };

    // Update portfolio
    this.processTrade(trade);

    console.log('Trade executed:', trade);
    return trade;
  }

  /**
   * Update market data
   */
  updateMarketData(symbol: string, data: {
    price: number;
    change_24h: number;
    volume: number;
  }): void {
    const marketData = {
      ...this.state.marketData,
      [symbol.toLowerCase()]: {
        ...data,
        last_updated: new Date().toISOString()
      }
    };

    this.updateState({ marketData });

    // Update portfolio value based on new prices
    this.updatePortfolioValue();
  }

  /**
   * Update AI prediction
   */
  updatePrediction(symbol: string, prediction: {
    predicted_price: number;
    confidence: number;
    direction: 'up' | 'down' | 'hold';
  }): void {
    const predictions = {
      ...this.state.predictions,
      [symbol.toLowerCase()]: {
        ...prediction,
        timestamp: new Date().toISOString()
      }
    };

    this.updateState({ predictions });
  }

  /**
   * Change selected symbol
   */
  setSelectedSymbol(symbol: string): void {
    this.updateState({ selectedSymbol: symbol.toLowerCase() });
  }

  /**
   * Change selected timeframe
   */
  setSelectedTimeframe(timeframe: '1m' | '5m' | '15m' | '1h' | '4h' | '1d'): void {
    this.updateState({ selectedTimeframe: timeframe });
  }

  /**
   * Update trading settings
   */
  updateTradingSettings(settings: Partial<TradingState['tradingSettings']>): void {
    const tradingSettings = {
      ...this.state.tradingSettings,
      ...settings
    };

    this.updateState({ tradingSettings });
  }

  /**
   * Get current position for symbol
   */
  getPosition(symbol: string): Position | null {
    return this.state.positions.find(p =>
      p.symbol.toLowerCase() === symbol.toLowerCase()
    ) || null;
  }

  /**
   * Get market data for symbol
   */
  getMarketData(symbol: string): TradingState['marketData'][string] | null {
    return this.state.marketData[symbol.toLowerCase()] || null;
  }

  /**
   * Get prediction for symbol
   */
  getPrediction(symbol: string): TradingState['predictions'][string] | null {
    return this.state.predictions[symbol.toLowerCase()] || null;
  }

  /**
   * Get trading performance metrics
   */
  getPerformanceMetrics(): {
    totalReturn: number;
    totalReturnPercentage: number;
    totalTrades: number;
    winningTrades: number;
    losingTrades: number;
    winRate: number;
    averageWin: number;
    averageLoss: number;
    profitFactor: number;
  } {
    const trades = this.state.tradeHistory.filter(t => t.status === 'completed');
    const totalTrades = trades.length;

    if (totalTrades === 0 || !this.state.session) {
      return {
        totalReturn: 0,
        totalReturnPercentage: 0,
        totalTrades: 0,
        winningTrades: 0,
        losingTrades: 0,
        winRate: 0,
        averageWin: 0,
        averageLoss: 0,
        profitFactor: 1
      };
    }

    const totalReturn = this.state.totalValue - this.state.session.initial_capital;
    const totalReturnPercentage = (totalReturn / this.state.session.initial_capital) * 100;

    // Calculate trade-level profits (simplified)
    const tradeProfits = trades.map(trade => {
      // This is a simplified calculation - real implementation would track position P&L
      return trade.type === 'buy' ? -trade.total_value : trade.total_value;
    });

    const winningTrades = tradeProfits.filter(p => p > 0).length;
    const losingTrades = tradeProfits.filter(p => p < 0).length;
    const winRate = totalTrades > 0 ? (winningTrades / totalTrades) * 100 : 0;

    const wins = tradeProfits.filter(p => p > 0);
    const losses = tradeProfits.filter(p => p < 0);

    const averageWin = wins.length > 0 ? wins.reduce((sum, p) => sum + p, 0) / wins.length : 0;
    const averageLoss = losses.length > 0 ? Math.abs(losses.reduce((sum, p) => sum + p, 0) / losses.length) : 0;

    const grossProfit = wins.reduce((sum, p) => sum + p, 0);
    const grossLoss = Math.abs(losses.reduce((sum, p) => sum + p, 0));
    const profitFactor = grossLoss > 0 ? grossProfit / grossLoss : grossProfit > 0 ? 999 : 1;

    return {
      totalReturn,
      totalReturnPercentage,
      totalTrades,
      winningTrades,
      losingTrades,
      winRate,
      averageWin,
      averageLoss,
      profitFactor
    };
  }

  /**
   * Reset to initial state
   */
  reset(): void {
    this.state = this.getInitialState();
    this.clearStorage();
    this.notifyListeners();
  }

  /**
   * Private: Get initial state
   */
  private getInitialState(): TradingState {
    return {
      session: null,
      isActive: false,
      isPaused: false,
      portfolio: null,
      positions: [],
      totalValue: 0,
      availableCash: 0,
      pendingTrades: [],
      tradeHistory: [],
      selectedSymbol: 'btc',
      selectedTimeframe: '15m',
      showAdvancedControls: false,
      tradingSettings: {
        maxPositionSize: 0.1, // 10% of portfolio per position
        stopLossPercentage: 5, // 5% stop loss
        takeProfitPercentage: 15, // 15% take profit
        allowShortSelling: false,
        paperTradingOnly: true
      },
      marketData: {},
      predictions: {}
    };
  }

  /**
   * Private: Update state and notify listeners
   */
  private updateState(partial: Partial<TradingState>): void {
    this.state = { ...this.state, ...partial };
    this.notifyListeners();
  }

  /**
   * Private: Notify all listeners
   */
  private notifyListeners(): void {
    this.listeners.forEach(callback => {
      try {
        callback(this.getState());
      } catch (error) {
        console.error('Error in trading store listener:', error);
      }
    });
  }

  /**
   * Private: Process trade and update positions
   */
  private processTrade(trade: Trade): void {
    const positions = [...this.state.positions];
    let availableCash = this.state.availableCash;

    const existingPositionIndex = positions.findIndex(p => p.symbol === trade.symbol);

    if (trade.type === 'buy') {
      availableCash -= (trade.total_value + trade.fee);

      if (existingPositionIndex >= 0) {
        // Update existing position
        const position = positions[existingPositionIndex];
        const newQuantity = position.quantity + trade.quantity;
        const newAverageCost = ((position.average_cost * position.quantity) + trade.total_value) / newQuantity;

        positions[existingPositionIndex] = {
          ...position,
          quantity: newQuantity,
          average_cost: newAverageCost,
          current_value: newQuantity * trade.price,
          updated_at: trade.executed_at
        };
      } else {
        // Create new position
        const newPosition: Position = {
          id: this.generatePositionId(),
          session_id: trade.session_id,
          symbol: trade.symbol,
          quantity: trade.quantity,
          average_cost: trade.price,
          current_price: trade.price,
          current_value: trade.total_value,
          unrealized_pnl: 0,
          unrealized_pnl_percentage: 0,
          created_at: trade.executed_at,
          updated_at: trade.executed_at
        };

        positions.push(newPosition);
      }
    } else {
      // Sell trade
      availableCash += (trade.total_value - trade.fee);

      if (existingPositionIndex >= 0) {
        const position = positions[existingPositionIndex];
        const newQuantity = position.quantity - trade.quantity;

        if (newQuantity <= 0) {
          // Close position completely
          positions.splice(existingPositionIndex, 1);
        } else {
          // Reduce position size
          positions[existingPositionIndex] = {
            ...position,
            quantity: newQuantity,
            current_value: newQuantity * trade.price,
            updated_at: trade.executed_at
          };
        }
      }
    }

    // Update trade history
    const tradeHistory = [trade, ...this.state.tradeHistory];

    this.updateState({
      positions,
      availableCash,
      tradeHistory
    });

    this.updatePortfolioValue();
  }

  /**
   * Private: Update portfolio value based on current prices
   */
  private updatePortfolioValue(): void {
    if (!this.state.portfolio) return;

    let positionsValue = 0;

    // Calculate current value of all positions
    this.state.positions.forEach(position => {
      const marketData = this.getMarketData(position.symbol);
      const currentPrice = marketData?.price || position.current_price;

      position.current_price = currentPrice;
      position.current_value = position.quantity * currentPrice;
      position.unrealized_pnl = position.current_value - (position.quantity * position.average_cost);
      position.unrealized_pnl_percentage = ((currentPrice - position.average_cost) / position.average_cost) * 100;

      positionsValue += position.current_value;
    });

    const totalValue = this.state.availableCash + positionsValue;
    const profit_loss = totalValue - this.state.portfolio.total_value;
    const profit_loss_percentage = (profit_loss / this.state.portfolio.total_value) * 100;

    const updatedPortfolio: Portfolio = {
      ...this.state.portfolio,
      total_value: totalValue,
      positions_value: positionsValue,
      profit_loss,
      profit_loss_percentage,
      updated_at: new Date().toISOString()
    };

    this.updateState({
      portfolio: updatedPortfolio,
      totalValue,
      positions: [...this.state.positions] // Trigger update
    });
  }

  /**
   * Private: Setup autosave to localStorage
   */
  private setupAutosave(): void {
    if (typeof window === 'undefined') return;

    this.autosaveInterval = window.setInterval(() => {
      this.saveToStorage();
    }, 10000); // Autosave every 10 seconds
  }

  /**
   * Private: Save state to localStorage
   */
  private saveToStorage(): void {
    if (typeof window === 'undefined') return;

    try {
      const serializedState = JSON.stringify({
        ...this.state,
        lastSaved: new Date().toISOString()
      });

      localStorage.setItem(this.storageKey, serializedState);
    } catch (error) {
      console.warn('Failed to save trading state to storage:', error);
    }
  }

  /**
   * Private: Load state from localStorage
   */
  private loadFromStorage(): void {
    if (typeof window === 'undefined') return;

    try {
      const serializedState = localStorage.getItem(this.storageKey);

      if (serializedState) {
        const savedState = JSON.parse(serializedState);

        // Only restore if session is still recent (within 24 hours)
        if (savedState.lastSaved) {
          const lastSaved = new Date(savedState.lastSaved);
          const hoursSinceLastSave = (Date.now() - lastSaved.getTime()) / (1000 * 60 * 60);

          if (hoursSinceLastSave < 24) {
            const { lastSaved: _, ...stateToRestore } = savedState;
            this.state = { ...this.state, ...stateToRestore };
            console.log('Trading state restored from storage');
          }
        }
      }
    } catch (error) {
      console.warn('Failed to load trading state from storage:', error);
    }
  }

  /**
   * Private: Clear storage
   */
  private clearStorage(): void {
    if (typeof window === 'undefined') return;

    try {
      localStorage.removeItem(this.storageKey);
    } catch (error) {
      console.warn('Failed to clear trading state storage:', error);
    }
  }

  /**
   * Private: Save final session to database
   */
  private async saveFinalSession(session: TradingSession): Promise<void> {
    // TODO: Implement API call to save session to database
    console.log('Final session saved:', session);
  }

  /**
   * Private: Generate unique IDs
   */
  private generateSessionId(): string {
    return `session_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  private generatePortfolioId(): string {
    return `portfolio_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  private generateTradeId(): string {
    return `trade_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  private generatePositionId(): string {
    return `position_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  /**
   * Private: Get current user ID (from auth or generate guest ID)
   */
  private getUserId(): string | null {
    // TODO: Get from auth service
    return null; // Null for guest users
  }

  /**
   * Cleanup resources
   */
  destroy(): void {
    if (this.autosaveInterval) {
      clearInterval(this.autosaveInterval);
      this.autosaveInterval = null;
    }

    this.saveToStorage();
    this.listeners.length = 0;
  }
}

// Export singleton instance
export const tradingStore = new TradingStore();
export default tradingStore;

// Hook for React-like usage in Astro components
export const useTradingStore = () => {
  return {
    getState: () => tradingStore.getState(),
    subscribe: (callback: (state: TradingState) => void) => tradingStore.subscribe(callback),
    startSession: (capital?: number, symbol?: string) => tradingStore.startSession(capital, symbol),
    endSession: () => tradingStore.endSession(),
    toggleSession: () => tradingStore.toggleSession(),
    executeTrade: (symbol: string, type: 'buy' | 'sell', amount: number, price: number) =>
      tradingStore.executeTrade(symbol, type, amount, price),
    updateMarketData: (symbol: string, data: any) => tradingStore.updateMarketData(symbol, data),
    updatePrediction: (symbol: string, prediction: any) => tradingStore.updatePrediction(symbol, prediction),
    setSelectedSymbol: (symbol: string) => tradingStore.setSelectedSymbol(symbol),
    setSelectedTimeframe: (timeframe: any) => tradingStore.setSelectedTimeframe(timeframe),
    updateTradingSettings: (settings: any) => tradingStore.updateTradingSettings(settings),
    getPosition: (symbol: string) => tradingStore.getPosition(symbol),
    getMarketData: (symbol: string) => tradingStore.getMarketData(symbol),
    getPrediction: (symbol: string) => tradingStore.getPrediction(symbol),
    getPerformanceMetrics: () => tradingStore.getPerformanceMetrics(),
    reset: () => tradingStore.reset()
  };
};