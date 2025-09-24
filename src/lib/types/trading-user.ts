/**
 * T027: TradingUser model and types
 * TypeScript types for trading user data model
 * Based on data-model.md specifications
 */

export type RiskTolerance = "low" | "medium" | "high";

export interface TradingUser {
  id: string; // UUID, Primary Key - Links to auth.users.id
  display_name: string; // User's display name for trading interface
  default_capital: number; // Starting capital for new simulations (default: 10000.00)
  risk_tolerance: RiskTolerance; // User's risk preference setting
  preferred_coins: string[]; // Array of favorite cryptocurrency symbols
  notification_settings: NotificationSettings; // User preference for alerts and notifications
  created_at: string; // Account creation timestamp (ISO string)
  updated_at: string; // Last profile update timestamp (ISO string)
}

export interface NotificationSettings {
  email_alerts: boolean;
  push_notifications: boolean;
  trade_confirmations: boolean;
  daily_summary: boolean;
  price_alerts: boolean;
}

export interface CreateTradingUserRequest {
  display_name: string;
  default_capital?: number;
  risk_tolerance?: RiskTolerance;
  preferred_coins?: string[];
  notification_settings?: Partial<NotificationSettings>;
}

export interface UpdateTradingUserRequest {
  display_name?: string;
  default_capital?: number;
  risk_tolerance?: RiskTolerance;
  preferred_coins?: string[];
  notification_settings?: Partial<NotificationSettings>;
}

// Validation constraints from data-model.md
export const TRADING_USER_CONSTRAINTS = {
  DEFAULT_CAPITAL: {
    MIN: 0,
    MAX: 1000000,
    DEFAULT: 10000.00
  },
  DISPLAY_NAME: {
    MIN_LENGTH: 3,
    MAX_LENGTH: 50
  },
  PREFERRED_COINS: {
    MAX_COUNT: 10
  }
} as const;

// Default notification settings
export const DEFAULT_NOTIFICATION_SETTINGS: NotificationSettings = {
  email_alerts: true,
  push_notifications: false,
  trade_confirmations: true,
  daily_summary: false,
  price_alerts: true
};

// Type guards
export function isValidRiskTolerance(value: string): value is RiskTolerance {
  return ["low", "medium", "high"].includes(value);
}

export function isValidTradingUser(user: any): user is TradingUser {
  return (
    typeof user === "object" &&
    typeof user.id === "string" &&
    typeof user.display_name === "string" &&
    user.display_name.length >= TRADING_USER_CONSTRAINTS.DISPLAY_NAME.MIN_LENGTH &&
    user.display_name.length <= TRADING_USER_CONSTRAINTS.DISPLAY_NAME.MAX_LENGTH &&
    typeof user.default_capital === "number" &&
    user.default_capital >= TRADING_USER_CONSTRAINTS.DEFAULT_CAPITAL.MIN &&
    user.default_capital <= TRADING_USER_CONSTRAINTS.DEFAULT_CAPITAL.MAX &&
    isValidRiskTolerance(user.risk_tolerance) &&
    Array.isArray(user.preferred_coins) &&
    user.preferred_coins.length <= TRADING_USER_CONSTRAINTS.PREFERRED_COINS.MAX_COUNT &&
    user.preferred_coins.every((coin: any) => typeof coin === "string") &&
    typeof user.notification_settings === "object" &&
    typeof user.created_at === "string" &&
    typeof user.updated_at === "string"
  );
}

// Validation functions
export function validateDisplayName(displayName: string): string | null {
  if (!displayName || typeof displayName !== "string") {
    return "Display name is required";
  }

  if (displayName.length < TRADING_USER_CONSTRAINTS.DISPLAY_NAME.MIN_LENGTH) {
    return `Display name must be at least ${TRADING_USER_CONSTRAINTS.DISPLAY_NAME.MIN_LENGTH} characters`;
  }

  if (displayName.length > TRADING_USER_CONSTRAINTS.DISPLAY_NAME.MAX_LENGTH) {
    return `Display name must not exceed ${TRADING_USER_CONSTRAINTS.DISPLAY_NAME.MAX_LENGTH} characters`;
  }

  return null;
}

export function validateDefaultCapital(capital: number): string | null {
  if (typeof capital !== "number" || isNaN(capital)) {
    return "Default capital must be a valid number";
  }

  if (capital < TRADING_USER_CONSTRAINTS.DEFAULT_CAPITAL.MIN) {
    return "Default capital must be greater than 0";
  }

  if (capital > TRADING_USER_CONSTRAINTS.DEFAULT_CAPITAL.MAX) {
    return `Default capital must not exceed ${TRADING_USER_CONSTRAINTS.DEFAULT_CAPITAL.MAX.toLocaleString()}`;
  }

  return null;
}

export function validatePreferredCoins(coins: string[]): string | null {
  if (!Array.isArray(coins)) {
    return "Preferred coins must be an array";
  }

  if (coins.length > TRADING_USER_CONSTRAINTS.PREFERRED_COINS.MAX_COUNT) {
    return `Cannot have more than ${TRADING_USER_CONSTRAINTS.PREFERRED_COINS.MAX_COUNT} preferred coins`;
  }

  const invalidCoins = coins.filter(coin => typeof coin !== "string" || !coin.trim());
  if (invalidCoins.length > 0) {
    return "All preferred coins must be valid coin symbols";
  }

  return null;
}

// Utility functions
export function createDefaultTradingUser(
  id: string,
  displayName: string,
  overrides?: Partial<TradingUser>
): TradingUser {
  const now = new Date().toISOString();

  return {
    id,
    display_name: displayName,
    default_capital: TRADING_USER_CONSTRAINTS.DEFAULT_CAPITAL.DEFAULT,
    risk_tolerance: "medium",
    preferred_coins: ["BTC", "ETH"],
    notification_settings: DEFAULT_NOTIFICATION_SETTINGS,
    created_at: now,
    updated_at: now,
    ...overrides
  };
}

export function sanitizeTradingUserInput(input: any): CreateTradingUserRequest {
  return {
    display_name: String(input.display_name || "").trim(),
    default_capital: typeof input.default_capital === "number"
      ? input.default_capital
      : TRADING_USER_CONSTRAINTS.DEFAULT_CAPITAL.DEFAULT,
    risk_tolerance: isValidRiskTolerance(input.risk_tolerance)
      ? input.risk_tolerance
      : "medium",
    preferred_coins: Array.isArray(input.preferred_coins)
      ? input.preferred_coins.filter((coin: any) => typeof coin === "string" && coin.trim())
      : [],
    notification_settings: {
      ...DEFAULT_NOTIFICATION_SETTINGS,
      ...(typeof input.notification_settings === "object" ? input.notification_settings : {})
    }
  };
}