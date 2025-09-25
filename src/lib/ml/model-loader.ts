/**
 * T068: TensorFlow.js model loading and inference
 * ML model service for cryptocurrency price prediction
 */

import * as tf from '@tensorflow/tfjs';

export interface PredictionInput {
  price_data: number[];
  volume_data: number[];
  timestamp: number;
  symbol: string;
}

export interface PredictionOutput {
  predicted_price: number;
  confidence: number;
  direction: 'up' | 'down' | 'neutral';
  probability: number;
  timestamp: number;
  model_version: string;
}

export interface ModelConfig {
  model_url: string;
  sequence_length: number;
  features: string[];
  confidence_threshold: number;
  cache_duration: number;
}

interface ModelCache {
  model: tf.LayersModel | null;
  version: string;
  loaded_at: number;
  config: ModelConfig;
}

class ModelLoader {
  private cache: Map<string, ModelCache> = new Map();
  private loading: Map<string, Promise<tf.LayersModel>> = new Map();
  private isInitialized = false;

  constructor() {
    this.initializeTensorFlow();
  }

  /**
   * Initialize TensorFlow.js with optimal backend
   */
  private async initializeTensorFlow(): Promise<void> {
    try {
      // Set backend preference (CPU for reliability on free hosting)
      const backend = import.meta.env.TENSORFLOW_JS_BACKEND || 'cpu';

      if (backend === 'webgl' && typeof window !== 'undefined') {
        await tf.setBackend('webgl');
      } else {
        await tf.setBackend('cpu');
      }

      await tf.ready();

      console.log('TensorFlow.js initialized:', {
        backend: tf.getBackend(),
        version: tf.version.tfjs,
        memory: tf.memory()
      });

      this.isInitialized = true;
    } catch (error) {
      console.error('Failed to initialize TensorFlow.js:', error);
      // Fallback to CPU backend
      try {
        await tf.setBackend('cpu');
        await tf.ready();
        this.isInitialized = true;
        console.log('Fallback to CPU backend successful');
      } catch (fallbackError) {
        console.error('Failed to initialize TensorFlow.js with CPU backend:', fallbackError);
        this.isInitialized = false;
      }
    }
  }

  /**
   * Load ML model for cryptocurrency price prediction
   */
  async loadModel(symbol: string): Promise<tf.LayersModel | null> {
    if (!this.isInitialized) {
      await this.initializeTensorFlow();
      if (!this.isInitialized) {
        return null;
      }
    }

    const modelKey = `crypto_${symbol.toLowerCase()}`;

    // Check cache first
    const cached = this.cache.get(modelKey);
    if (cached && this.isModelCacheValid(cached)) {
      console.log(`Using cached model for ${symbol}`);
      return cached.model;
    }

    // Check if already loading
    const loadingPromise = this.loading.get(modelKey);
    if (loadingPromise) {
      console.log(`Waiting for model loading to complete: ${symbol}`);
      return await loadingPromise;
    }

    // Start loading
    const config = this.getModelConfig(symbol);
    const loadPromise = this.loadModelFromSource(config);
    this.loading.set(modelKey, loadPromise);

    try {
      const model = await loadPromise;

      // Cache the loaded model
      this.cache.set(modelKey, {
        model,
        version: import.meta.env.AI_MODEL_VERSION || 'v1.0.0',
        loaded_at: Date.now(),
        config
      });

      this.loading.delete(modelKey);
      console.log(`Model loaded successfully for ${symbol}`);

      return model;
    } catch (error) {
      this.loading.delete(modelKey);
      console.error(`Failed to load model for ${symbol}:`, error);
      return null;
    }
  }

  /**
   * Load model from source (URL or IndexedDB)
   */
  private async loadModelFromSource(config: ModelConfig): Promise<tf.LayersModel> {
    // Try to load from IndexedDB cache first
    try {
      const cachedModel = await this.loadFromIndexedDB(config.model_url);
      if (cachedModel) {
        console.log('Loaded model from IndexedDB cache');
        return cachedModel;
      }
    } catch (error) {
      console.warn('Failed to load from IndexedDB, loading from URL');
    }

    // Load from URL
    try {
      const model = await tf.loadLayersModel(config.model_url);

      // Save to IndexedDB for next time
      try {
        await this.saveToIndexedDB(config.model_url, model);
      } catch (cacheError) {
        console.warn('Failed to cache model in IndexedDB:', cacheError);
      }

      return model;
    } catch (error) {
      console.error('Failed to load model from URL:', error);
      // Return mock model for development
      return this.createMockModel(config);
    }
  }

  /**
   * Make price prediction using loaded model
   */
  async predict(input: PredictionInput): Promise<PredictionOutput | null> {
    try {
      const model = await this.loadModel(input.symbol);
      if (!model) {
        return this.getMockPrediction(input);
      }

      // Prepare input tensor
      const inputTensor = this.prepareInput(input);

      // Make prediction
      const prediction = model.predict(inputTensor) as tf.Tensor;
      const predictionData = await prediction.data();

      // Clean up tensors
      inputTensor.dispose();
      prediction.dispose();

      // Process prediction results
      const result = this.processPrediction(predictionData, input);

      console.log('Prediction made:', {
        symbol: input.symbol,
        predicted_price: result.predicted_price,
        confidence: result.confidence,
        direction: result.direction
      });

      return result;

    } catch (error) {
      console.error('Prediction failed:', error);
      return this.getMockPrediction(input);
    }
  }

  /**
   * Batch predict multiple cryptocurrencies
   */
  async batchPredict(inputs: PredictionInput[]): Promise<PredictionOutput[]> {
    const results: PredictionOutput[] = [];

    // Process in batches to avoid memory issues
    const batchSize = 5;
    for (let i = 0; i < inputs.length; i += batchSize) {
      const batch = inputs.slice(i, i + batchSize);
      const batchPromises = batch.map(input => this.predict(input));
      const batchResults = await Promise.all(batchPromises);

      results.push(...batchResults.filter(result => result !== null) as PredictionOutput[]);
    }

    return results;
  }

  /**
   * Get model configuration for a symbol
   */
  private getModelConfig(symbol: string): ModelConfig {
    const baseConfig = {
      sequence_length: 60, // 60 data points for time series
      features: ['price', 'volume', 'high', 'low', 'market_cap'],
      confidence_threshold: parseFloat(import.meta.env.AI_CONFIDENCE_THRESHOLD || '0.6'),
      cache_duration: 24 * 60 * 60 * 1000, // 24 hours
    };

    // Symbol-specific model URLs
    const modelUrls: Record<string, string> = {
      btc: '/models/btc-prediction-v1.json',
      eth: '/models/eth-prediction-v1.json',
      ada: '/models/ada-prediction-v1.json',
      sol: '/models/sol-prediction-v1.json',
    };

    return {
      ...baseConfig,
      model_url: modelUrls[symbol.toLowerCase()] || '/models/generic-crypto-v1.json'
    };
  }

  /**
   * Prepare input data for model
   */
  private prepareInput(input: PredictionInput): tf.Tensor {
    // Normalize price and volume data
    const priceData = this.normalizeArray(input.price_data);
    const volumeData = this.normalizeArray(input.volume_data);

    // Create sequence tensor [batch_size, sequence_length, features]
    const sequenceLength = Math.min(priceData.length, 60);
    const features = 2; // price + volume

    const tensorData = new Float32Array(sequenceLength * features);

    for (let i = 0; i < sequenceLength; i++) {
      tensorData[i * features] = priceData[i] || 0;
      tensorData[i * features + 1] = volumeData[i] || 0;
    }

    return tf.tensor3d([tensorData], [1, sequenceLength, features]);
  }

  /**
   * Process raw prediction output
   */
  private processPrediction(predictionData: Float32Array | Int32Array | Uint8Array, input: PredictionInput): PredictionOutput {
    const prediction = Array.from(predictionData);
    const predictedPrice = prediction[0] || input.price_data[input.price_data.length - 1];
    const confidence = Math.min(Math.abs(prediction[1] || 0.5), 1.0);

    // Determine direction
    const currentPrice = input.price_data[input.price_data.length - 1];
    const priceDiff = predictedPrice - currentPrice;
    const percentChange = Math.abs(priceDiff / currentPrice);

    let direction: 'up' | 'down' | 'neutral' = 'neutral';
    if (percentChange > 0.01) { // > 1% change
      direction = priceDiff > 0 ? 'up' : 'down';
    }

    return {
      predicted_price: predictedPrice,
      confidence,
      direction,
      probability: confidence,
      timestamp: Date.now(),
      model_version: import.meta.env.AI_MODEL_VERSION || 'v1.0.0'
    };
  }

  /**
   * Create mock model for development/fallback
   */
  private createMockModel(config: ModelConfig): tf.LayersModel {
    const model = tf.sequential({
      layers: [
        tf.layers.dense({
          units: 50,
          activation: 'relu',
          inputShape: [config.sequence_length, config.features.length]
        }),
        tf.layers.dense({
          units: 25,
          activation: 'relu'
        }),
        tf.layers.dense({
          units: 2, // [predicted_price, confidence]
          activation: 'linear'
        })
      ]
    });

    console.log('Created mock model for development');
    return model;
  }

  /**
   * Generate mock prediction for development/fallback
   */
  private getMockPrediction(input: PredictionInput): PredictionOutput {
    const currentPrice = input.price_data[input.price_data.length - 1];
    const randomFactor = (Math.random() - 0.5) * 0.1; // ±5% random change
    const predictedPrice = currentPrice * (1 + randomFactor);

    return {
      predicted_price: predictedPrice,
      confidence: 0.5 + Math.random() * 0.3, // 0.5-0.8 confidence
      direction: predictedPrice > currentPrice ? 'up' : 'down',
      probability: 0.5 + Math.abs(randomFactor) * 2, // Based on change magnitude
      timestamp: Date.now(),
      model_version: 'mock-v1.0.0'
    };
  }

  /**
   * Normalize array values to 0-1 range
   */
  private normalizeArray(data: number[]): number[] {
    if (data.length === 0) return [];

    const min = Math.min(...data);
    const max = Math.max(...data);
    const range = max - min;

    if (range === 0) return data.map(() => 0.5);

    return data.map(value => (value - min) / range);
  }

  /**
   * Check if cached model is still valid
   */
  private isModelCacheValid(cache: ModelCache): boolean {
    const now = Date.now();
    const age = now - cache.loaded_at;
    return age < cache.config.cache_duration;
  }

  /**
   * Load model from IndexedDB cache
   */
  private async loadFromIndexedDB(modelUrl: string): Promise<tf.LayersModel | null> {
    try {
      if (typeof window === 'undefined') return null;

      const modelKey = `tfjs_model_${btoa(modelUrl)}`;
      const model = await tf.loadLayersModel(`indexeddb://${modelKey}`);
      return model;
    } catch (error) {
      return null;
    }
  }

  /**
   * Save model to IndexedDB cache
   */
  private async saveToIndexedDB(modelUrl: string, model: tf.LayersModel): Promise<void> {
    try {
      if (typeof window === 'undefined') return;

      const modelKey = `tfjs_model_${btoa(modelUrl)}`;
      await model.save(`indexeddb://${modelKey}`);
      console.log('Model cached in IndexedDB');
    } catch (error) {
      console.warn('Failed to cache model in IndexedDB:', error);
    }
  }

  /**
   * Clear model cache and free memory
   */
  clearCache(): void {
    this.cache.forEach((cache, key) => {
      if (cache.model) {
        cache.model.dispose();
      }
    });

    this.cache.clear();
    this.loading.clear();

    // Run TensorFlow.js garbage collection
    if (this.isInitialized) {
      tf.disposeVariables();
      console.log('Model cache cleared, memory freed');
    }
  }

  /**
   * Get memory usage statistics
   */
  getMemoryStats(): any {
    if (!this.isInitialized) {
      return { error: 'TensorFlow.js not initialized' };
    }

    return {
      ...tf.memory(),
      cached_models: this.cache.size,
      loading_models: this.loading.size
    };
  }
}

// Export singleton instance
export const modelLoader = new ModelLoader();
export default modelLoader;

// Utility functions
export const createPredictionInput = (
  priceData: number[],
  volumeData: number[],
  symbol: string
): PredictionInput => ({
  price_data: priceData.slice(-60), // Last 60 data points
  volume_data: volumeData.slice(-60),
  timestamp: Date.now(),
  symbol: symbol.toLowerCase()
});

export const formatPrediction = (prediction: PredictionOutput): string => {
  const direction = prediction.direction.toUpperCase();
  const confidence = (prediction.confidence * 100).toFixed(1);
  return `${direction} - $${prediction.predicted_price.toFixed(2)} (${confidence}% confidence)`;
};