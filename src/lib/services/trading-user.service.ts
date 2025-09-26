/**
 * T033: TradingUserService - CRUD operations for user profiles
 * Service layer for managing trading user data and preferences
 * Based on data-model.md specifications
 */

import { supabase, handleDatabaseError, retryOperation } from "../supabase.js";
import type { Database } from "../supabase.js";
import type {
  TradingUser,
  CreateTradingUserRequest,
  UpdateTradingUserRequest,
  UserPreferences,
  NotificationSettings
} from "../types/trading-user.js";
import { TRADING_USER_CONSTRAINTS } from "../types/trading-user.js";

export class TradingUserService {
  /**
   * Create a new trading user profile
   */
  async createUser(request: CreateTradingUserRequest): Promise<TradingUser> {
    try {
      return await retryOperation(async () => {
        const userData: Database["public"]["Tables"]["trading_users"]["Insert"] = {
          id: request.id,
          display_name: request.display_name,
          default_capital: request.default_capital || TRADING_USER_CONSTRAINTS.DEFAULT_CAPITAL.DEFAULT,
          risk_tolerance: request.risk_tolerance || "medium",
          preferred_coins: request.preferred_coins || [],
          notification_settings: request.notification_settings || this.getDefaultNotificationSettings()
        };

        const { data, error } = await supabase
          .from("trading_users")
          .insert(userData)
          .select()
          .single();

        if (error) {
          handleDatabaseError(error, "create trading user");
        }

        return this.mapDatabaseUserToTradingUser(data);
      });
    } catch (error: any) {
      console.error("Failed to create trading user:", error);
      throw new Error(`Failed to create user profile: ${error.message}`);
    }
  }

  /**
   * Get user by ID
   */
  async getUserById(userId: string): Promise<TradingUser | null> {
    try {
      return await retryOperation(async () => {
        const { data, error } = await supabase
          .from("trading_users")
          .select("*")
          .eq("id", userId)
          .single();

        if (error) {
          if (error.code === "PGRST116") {
            return null; // User not found
          }
          handleDatabaseError(error, "get trading user");
        }

        return data ? this.mapDatabaseUserToTradingUser(data) : null;
      });
    } catch (error: any) {
      console.error("Failed to get trading user:", error);
      throw new Error(`Failed to retrieve user profile: ${error.message}`);
    }
  }

  /**
   * Update user profile
   */
  async updateUser(userId: string, updates: UpdateTradingUserRequest): Promise<TradingUser> {
    try {
      return await retryOperation(async () => {
        const updateData: Database["public"]["Tables"]["trading_users"]["Update"] = {
          ...updates,
          updated_at: new Date().toISOString()
        };

        const { data, error } = await supabase
          .from("trading_users")
          .update(updateData)
          .eq("id", userId)
          .select()
          .single();

        if (error) {
          if (error.code === "PGRST116") {
            throw new Error("User not found");
          }
          handleDatabaseError(error, "update trading user");
        }

        return this.mapDatabaseUserToTradingUser(data);
      });
    } catch (error: any) {
      console.error("Failed to update trading user:", error);
      throw new Error(`Failed to update user profile: ${error.message}`);
    }
  }

  /**
   * Delete user profile (soft delete by setting deleted_at)
   */
  async deleteUser(userId: string): Promise<void> {
    try {
      await retryOperation(async () => {
        // Check if user exists first
        const existingUser = await this.getUserById(userId);
        if (!existingUser) {
          throw new Error("User not found");
        }

        // Instead of hard delete, we could implement soft delete
        // For now, we'll do a hard delete as per the schema
        const { error } = await supabase
          .from("trading_users")
          .delete()
          .eq("id", userId);

        if (error) {
          handleDatabaseError(error, "delete trading user");
        }
      });
    } catch (error: any) {
      console.error("Failed to delete trading user:", error);
      throw new Error(`Failed to delete user profile: ${error.message}`);
    }
  }

  /**
   * Get user preferences
   */
  async getUserPreferences(userId: string): Promise<UserPreferences | null> {
    try {
      const user = await this.getUserById(userId);
      if (!user) return null;

      return {
        default_capital: user.default_capital,
        risk_tolerance: user.risk_tolerance,
        preferred_coins: user.preferred_coins,
        notification_settings: user.notification_settings
      };
    } catch (error: any) {
      console.error("Failed to get user preferences:", error);
      throw new Error(`Failed to retrieve user preferences: ${error.message}`);
    }
  }

  /**
   * Update user preferences
   */
  async updateUserPreferences(userId: string, preferences: Partial<UserPreferences>): Promise<UserPreferences> {
    try {
      const updateData: UpdateTradingUserRequest = {};

      if (preferences.default_capital !== undefined) {
        updateData.default_capital = preferences.default_capital;
      }
      if (preferences.risk_tolerance !== undefined) {
        updateData.risk_tolerance = preferences.risk_tolerance;
      }
      if (preferences.preferred_coins !== undefined) {
        updateData.preferred_coins = preferences.preferred_coins;
      }
      if (preferences.notification_settings !== undefined) {
        updateData.notification_settings = preferences.notification_settings;
      }

      const updatedUser = await this.updateUser(userId, updateData);

      return {
        default_capital: updatedUser.default_capital,
        risk_tolerance: updatedUser.risk_tolerance,
        preferred_coins: updatedUser.preferred_coins,
        notification_settings: updatedUser.notification_settings
      };
    } catch (error: any) {
      console.error("Failed to update user preferences:", error);
      throw new Error(`Failed to update user preferences: ${error.message}`);
    }
  }

  /**
   * Add preferred coin to user's list
   */
  async addPreferredCoin(userId: string, coinSymbol: string): Promise<string[]> {
    try {
      const user = await this.getUserById(userId);
      if (!user) {
        throw new Error("User not found");
      }

      const upperCoinSymbol = coinSymbol.toUpperCase();
      const currentCoins = user.preferred_coins || [];

      if (currentCoins.includes(upperCoinSymbol)) {
        return currentCoins; // Already in the list
      }

      if (currentCoins.length >= TRADING_USER_CONSTRAINTS.PREFERRED_COINS.MAX_COINS) {
        throw new Error(`Cannot add more than ${TRADING_USER_CONSTRAINTS.PREFERRED_COINS.MAX_COINS} preferred coins`);
      }

      const newCoins = [...currentCoins, upperCoinSymbol];
      await this.updateUser(userId, { preferred_coins: newCoins });

      return newCoins;
    } catch (error: any) {
      console.error("Failed to add preferred coin:", error);
      throw new Error(`Failed to add preferred coin: ${error.message}`);
    }
  }

  /**
   * Remove preferred coin from user's list
   */
  async removePreferredCoin(userId: string, coinSymbol: string): Promise<string[]> {
    try {
      const user = await this.getUserById(userId);
      if (!user) {
        throw new Error("User not found");
      }

      const upperCoinSymbol = coinSymbol.toUpperCase();
      const currentCoins = user.preferred_coins || [];
      const newCoins = currentCoins.filter(coin => coin !== upperCoinSymbol);

      await this.updateUser(userId, { preferred_coins: newCoins });

      return newCoins;
    } catch (error: any) {
      console.error("Failed to remove preferred coin:", error);
      throw new Error(`Failed to remove preferred coin: ${error.message}`);
    }
  }

  /**
   * Update notification settings
   */
  async updateNotificationSettings(userId: string, settings: Partial<NotificationSettings>): Promise<NotificationSettings> {
    try {
      const user = await this.getUserById(userId);
      if (!user) {
        throw new Error("User not found");
      }

      const currentSettings = user.notification_settings as NotificationSettings;
      const newSettings = { ...currentSettings, ...settings };

      await this.updateUser(userId, { notification_settings: newSettings });

      return newSettings;
    } catch (error: any) {
      console.error("Failed to update notification settings:", error);
      throw new Error(`Failed to update notification settings: ${error.message}`);
    }
  }

  /**
   * Check if user exists and is active
   */
  async userExists(userId: string): Promise<boolean> {
    try {
      const user = await this.getUserById(userId);
      return user !== null;
    } catch (error) {
      return false;
    }
  }

  /**
   * Get user statistics (trading runs count, performance summary)
   */
  async getUserStatistics(userId: string): Promise<{
    total_runs: number;
    total_trades: number;
    average_return: number;
    best_run_return: number;
    last_activity: string | null;
  }> {
    try {
      return await retryOperation(async () => {
        // Get basic run statistics
        const { data: runStats, error: runError } = await supabase
          .from("trading_runs")
          .select("final_capital, starting_capital, total_trades, session_end")
          .eq("user_id", userId)
          .not("final_capital", "is", null);

        if (runError) {
          handleDatabaseError(runError, "get user run statistics");
        }

        const runs = runStats || [];
        const totalRuns = runs.length;

        if (totalRuns === 0) {
          return {
            total_runs: 0,
            total_trades: 0,
            average_return: 0,
            best_run_return: 0,
            last_activity: null
          };
        }

        const totalTrades = runs.reduce((sum, run) => sum + run.total_trades, 0);
        const returns = runs.map(run =>
          ((run.final_capital! - run.starting_capital) / run.starting_capital) * 100
        );
        const averageReturn = returns.reduce((sum, ret) => sum + ret, 0) / returns.length;
        const bestRunReturn = Math.max(...returns);

        // Get last activity
        const lastActivity = runs
          .filter(run => run.session_end)
          .map(run => run.session_end!)
          .sort()
          .pop() || null;

        return {
          total_runs: totalRuns,
          total_trades: totalTrades,
          average_return: averageReturn,
          best_run_return: bestRunReturn,
          last_activity: lastActivity
        };
      });
    } catch (error: any) {
      console.error("Failed to get user statistics:", error);
      throw new Error(`Failed to get user statistics: ${error.message}`);
    }
  }

  /**
   * Helper: Get default notification settings
   */
  private getDefaultNotificationSettings(): NotificationSettings {
    return {
      email_alerts: false,
      push_notifications: true,
      trade_confirmations: true,
      performance_reports: true,
      market_updates: false,
      ai_insights: true
    };
  }

  /**
   * Helper: Map database user to TradingUser type
   */
  private mapDatabaseUserToTradingUser(dbUser: Database["public"]["Tables"]["trading_users"]["Row"]): TradingUser {
    return {
      id: dbUser.id,
      display_name: dbUser.display_name,
      default_capital: dbUser.default_capital,
      risk_tolerance: dbUser.risk_tolerance,
      preferred_coins: dbUser.preferred_coins,
      notification_settings: dbUser.notification_settings as NotificationSettings,
      created_at: dbUser.created_at,
      updated_at: dbUser.updated_at
    };
  }
}

// Export singleton instance
export const tradingUserService = new TradingUserService();
export default tradingUserService;