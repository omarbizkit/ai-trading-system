/**
 * T070: Backtest service - manages Web Worker for backtesting computations
 * High-level service for running backtests using the web worker
 */

import type {
  BacktestConfig,
  BacktestData,
  BacktestResult,
  WorkerMessage
} from '../../workers/backtest-worker';

export interface BacktestJob {
  id: string;
  config: BacktestConfig;
  status: 'pending' | 'running' | 'completed' | 'error' | 'cancelled';
  progress: number;
  message: string;
  result?: BacktestResult;
  error?: string;
  startTime: number;
  endTime?: number;
}

export interface BacktestProgress {
  jobId: string;
  progress: number;
  message: string;
  estimatedTimeRemaining?: number;
}

class BacktestService {
  private worker: Worker | null = null;
  private jobs = new Map<string, BacktestJob>();
  private listeners = new Map<string, Array<(progress: BacktestProgress) => void>>();

  constructor() {
    this.initializeWorker();
  }

  /**
   * Initialize the web worker
   */
  private initializeWorker(): void {
    if (typeof window === 'undefined') return;

    try {
      this.worker = new Worker(
        new URL('../../workers/backtest-worker.ts', import.meta.url),
        { type: 'module' }
      );

      this.worker.onmessage = this.handleWorkerMessage.bind(this);
      this.worker.onerror = this.handleWorkerError.bind(this);

      console.log('Backtest worker initialized');
    } catch (error) {
      console.error('Failed to initialize backtest worker:', error);
    }
  }

  /**
   * Start a new backtest
   */
  async runBacktest(
    config: BacktestConfig,
    data: BacktestData,
    onProgress?: (progress: BacktestProgress) => void
  ): Promise<BacktestResult> {
    if (!this.worker) {
      throw new Error('Backtest worker not available');
    }

    const jobId = this.generateJobId();

    // Create job record
    const job: BacktestJob = {
      id: jobId,
      config,
      status: 'pending',
      progress: 0,
      message: 'Initializing backtest...',
      startTime: Date.now()
    };

    this.jobs.set(jobId, job);

    // Set up progress listener
    if (onProgress) {
      this.addProgressListener(jobId, onProgress);
    }

    // Start the backtest in worker
    const message: WorkerMessage = {
      id: jobId,
      type: 'start',
      payload: { config, data }
    };

    this.worker.postMessage(message);

    // Return promise that resolves when backtest completes
    return new Promise((resolve, reject) => {
      const checkStatus = () => {
        const currentJob = this.jobs.get(jobId);

        if (!currentJob) {
          reject(new Error('Job not found'));
          return;
        }

        switch (currentJob.status) {
          case 'completed':
            if (currentJob.result) {
              resolve(currentJob.result);
            } else {
              reject(new Error('Job completed but no result'));
            }
            break;

          case 'error':
            reject(new Error(currentJob.error || 'Unknown error'));
            break;

          case 'cancelled':
            reject(new Error('Backtest was cancelled'));
            break;

          default:
            // Still running, check again later
            setTimeout(checkStatus, 100);
            break;
        }
      };

      checkStatus();
    });
  }

  /**
   * Cancel a running backtest
   */
  cancelBacktest(jobId: string): void {
    const job = this.jobs.get(jobId);

    if (!job || job.status !== 'running') {
      console.warn(`Cannot cancel job ${jobId}: not found or not running`);
      return;
    }

    if (this.worker) {
      const message: WorkerMessage = {
        id: jobId,
        type: 'cancel'
      };

      this.worker.postMessage(message);
    }

    // Update job status
    job.status = 'cancelled';
    job.endTime = Date.now();
    this.jobs.set(jobId, job);

    console.log(`Backtest ${jobId} cancelled`);
  }

  /**
   * Get job status
   */
  getJobStatus(jobId: string): BacktestJob | null {
    return this.jobs.get(jobId) || null;
  }

  /**
   * Get all jobs
   */
  getAllJobs(): BacktestJob[] {
    return Array.from(this.jobs.values());
  }

  /**
   * Get running jobs
   */
  getRunningJobs(): BacktestJob[] {
    return this.getAllJobs().filter(job => job.status === 'running');
  }

  /**
   * Clear completed jobs
   */
  clearCompletedJobs(): void {
    for (const [jobId, job] of this.jobs.entries()) {
      if (job.status === 'completed' || job.status === 'error' || job.status === 'cancelled') {
        this.jobs.delete(jobId);
        this.listeners.delete(jobId);
      }
    }
  }

  /**
   * Add progress listener for a specific job
   */
  addProgressListener(jobId: string, callback: (progress: BacktestProgress) => void): void {
    const listeners = this.listeners.get(jobId) || [];
    listeners.push(callback);
    this.listeners.set(jobId, listeners);
  }

  /**
   * Remove progress listener
   */
  removeProgressListener(jobId: string, callback: (progress: BacktestProgress) => void): void {
    const listeners = this.listeners.get(jobId);
    if (listeners) {
      const index = listeners.indexOf(callback);
      if (index > -1) {
        listeners.splice(index, 1);
        this.listeners.set(jobId, listeners);
      }
    }
  }

  /**
   * Handle messages from the worker
   */
  private handleWorkerMessage(event: MessageEvent<WorkerMessage>): void {
    const { id: jobId, type, payload } = event.data;
    const job = this.jobs.get(jobId);

    if (!job) {
      console.warn(`Received message for unknown job: ${jobId}`);
      return;
    }

    switch (type) {
      case 'progress':
        this.handleProgress(jobId, job, payload);
        break;

      case 'result':
        this.handleResult(jobId, job, payload);
        break;

      case 'error':
        this.handleError(jobId, job, payload);
        break;

      case 'cancel':
        this.handleCancellation(jobId, job);
        break;

      default:
        console.warn(`Unknown worker message type: ${type}`);
    }
  }

  /**
   * Handle progress updates
   */
  private handleProgress(jobId: string, job: BacktestJob, payload: any): void {
    job.status = 'running';
    job.progress = payload.progress || 0;
    job.message = payload.message || 'Processing...';

    this.jobs.set(jobId, job);

    // Calculate estimated time remaining
    const elapsed = Date.now() - job.startTime;
    const estimatedTotal = job.progress > 0 ? (elapsed / job.progress) * 100 : 0;
    const estimatedTimeRemaining = estimatedTotal > elapsed ? estimatedTotal - elapsed : 0;

    // Notify progress listeners
    const listeners = this.listeners.get(jobId) || [];
    const progress: BacktestProgress = {
      jobId,
      progress: job.progress,
      message: job.message,
      estimatedTimeRemaining
    };

    listeners.forEach(callback => {
      try {
        callback(progress);
      } catch (error) {
        console.error('Error in progress listener:', error);
      }
    });
  }

  /**
   * Handle result completion
   */
  private handleResult(jobId: string, job: BacktestJob, result: BacktestResult): void {
    job.status = 'completed';
    job.progress = 100;
    job.message = 'Backtest completed';
    job.result = result;
    job.endTime = Date.now();

    this.jobs.set(jobId, job);

    console.log(`Backtest ${jobId} completed in ${job.endTime - job.startTime}ms`);

    // Final progress update
    this.handleProgress(jobId, job, {
      progress: 100,
      message: 'Backtest completed'
    });
  }

  /**
   * Handle error
   */
  private handleError(jobId: string, job: BacktestJob, payload: any): void {
    job.status = 'error';
    job.error = payload.error || 'Unknown error';
    job.endTime = Date.now();

    this.jobs.set(jobId, job);

    console.error(`Backtest ${jobId} failed:`, job.error);

    // Final progress update
    this.handleProgress(jobId, job, {
      progress: job.progress,
      message: `Error: ${job.error}`
    });
  }

  /**
   * Handle cancellation
   */
  private handleCancellation(jobId: string, job: BacktestJob): void {
    job.status = 'cancelled';
    job.message = 'Backtest cancelled';
    job.endTime = Date.now();

    this.jobs.set(jobId, job);

    console.log(`Backtest ${jobId} was cancelled`);

    // Final progress update
    this.handleProgress(jobId, job, {
      progress: job.progress,
      message: 'Backtest cancelled'
    });
  }

  /**
   * Handle worker errors
   */
  private handleWorkerError(error: ErrorEvent): void {
    console.error('Backtest worker error:', error);

    // Mark all running jobs as errored
    for (const [jobId, job] of this.jobs.entries()) {
      if (job.status === 'running' || job.status === 'pending') {
        job.status = 'error';
        job.error = 'Worker error occurred';
        job.endTime = Date.now();
        this.jobs.set(jobId, job);
      }
    }
  }

  /**
   * Generate unique job ID
   */
  private generateJobId(): string {
    return `backtest_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  /**
   * Get worker performance stats
   */
  getWorkerStats(): {
    isAvailable: boolean;
    totalJobs: number;
    completedJobs: number;
    runningJobs: number;
    errorJobs: number;
    averageExecutionTime: number;
  } {
    const jobs = this.getAllJobs();
    const completedJobs = jobs.filter(j => j.status === 'completed');
    const runningJobs = jobs.filter(j => j.status === 'running');
    const errorJobs = jobs.filter(j => j.status === 'error');

    const averageExecutionTime = completedJobs.length > 0
      ? completedJobs.reduce((sum, job) => {
          return sum + ((job.endTime || 0) - job.startTime);
        }, 0) / completedJobs.length
      : 0;

    return {
      isAvailable: this.worker !== null,
      totalJobs: jobs.length,
      completedJobs: completedJobs.length,
      runningJobs: runningJobs.length,
      errorJobs: errorJobs.length,
      averageExecutionTime
    };
  }

  /**
   * Cleanup resources
   */
  destroy(): void {
    if (this.worker) {
      this.worker.terminate();
      this.worker = null;
    }

    this.jobs.clear();
    this.listeners.clear();
  }
}

// Export singleton instance
export const backtestService = new BacktestService();
export default backtestService;

// Utility functions for creating backtest configurations
export const createBacktestConfig = (
  symbol: string,
  startDate: string,
  endDate: string,
  options: Partial<BacktestConfig> = {}
): BacktestConfig => ({
  symbol,
  startDate,
  endDate,
  initialCapital: 50000,
  strategy: {
    type: 'ai_prediction',
    parameters: {
      confidenceThreshold: 0.6,
      priceChangeThreshold: 0.02
    }
  },
  settings: {
    tradingFee: 0.001, // 0.1%
    maxPositionSize: 0.25, // 25% of portfolio
    stopLoss: 0.05, // 5% stop loss
    takeProfit: 0.15, // 15% take profit
    rebalanceFrequency: 'daily'
  },
  ...options
});

// Helper to generate sample backtest data (for testing)
export const generateSampleBacktestData = (
  symbol: string,
  startDate: string,
  endDate: string,
  basePrice: number = 50000
): BacktestData => {
  const start = new Date(startDate);
  const end = new Date(endDate);
  const days = Math.ceil((end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24));

  const prices: BacktestData['prices'] = [];
  const predictions: BacktestData['predictions'] = [];

  let currentPrice = basePrice;

  for (let i = 0; i < days; i++) {
    const date = new Date(start.getTime() + i * 24 * 60 * 60 * 1000);

    // Generate realistic price movement
    const volatility = 0.03; // 3% daily volatility
    const randomChange = (Math.random() - 0.5) * 2 * volatility;
    const trend = Math.sin(i / 30) * 0.001; // Long-term trend

    currentPrice *= (1 + randomChange + trend);

    const high = currentPrice * (1 + Math.random() * 0.02);
    const low = currentPrice * (1 - Math.random() * 0.02);
    const open = i === 0 ? currentPrice : prices[i-1].close;

    prices.push({
      timestamp: date.getTime(),
      open,
      high,
      low,
      close: currentPrice,
      volume: Math.random() * 1000000 + 500000
    });

    // Generate sample predictions (every few days)
    if (i % 3 === 0) {
      predictions.push({
        timestamp: date.getTime(),
        predicted_price: currentPrice * (1 + (Math.random() - 0.5) * 0.05),
        confidence: 0.5 + Math.random() * 0.4,
        direction: Math.random() > 0.5 ? 'up' : 'down'
      });
    }
  }

  return { prices, predictions };
};