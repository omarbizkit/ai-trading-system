/// <reference path="../.astro/types.d.ts" />
/// <reference types="astro/client" />

// Auth types for middleware locals
declare namespace App {
  interface Locals {
    user: {
      id: string;
      email?: string | undefined;
      user_metadata?: any | undefined;
      app_metadata?: any | undefined;
    } | null;
    session: {
      access_token: string;
      user: any;
    } | null;
    isAuthenticated: boolean;
    isGuest?: boolean;
  }
}

// Environment variables
interface ImportMetaEnv {
  readonly PUBLIC_SUPABASE_URL: string;
  readonly PUBLIC_SUPABASE_ANON_KEY: string;
  readonly PUBLIC_APP_URL: string;
  readonly COINGECKO_API_KEY?: string;
  readonly AI_MODEL_VERSION?: string;
  readonly AI_CONFIDENCE_THRESHOLD?: string;
  readonly TENSORFLOW_JS_BACKEND?: string;
  readonly ENABLE_REAL_API_CALLS?: string;
  readonly MOCK_DATA_ENABLED?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}

// Window interface extensions
interface Window {
  AIPrediction?: {
    refresh: () => void;
    setSymbol: (symbol: string) => void;
  };
  BacktestingForm?: {
    [key: string]: any;
  };
}