/**
 * T077: Unit tests for TradingUserService
 * Comprehensive testing of CRUD operations and business logic
 */

import { describe, it, expect, beforeEach, afterEach, vi, MockedFunction } from 'vitest';
import { TradingUserService } from '../../src/lib/services/trading-user.service.js';
import type {
  TradingUser,
  CreateTradingUserRequest,
  UpdateTradingUserRequest,
  UserPreferences,
  NotificationSettings
} from '../../src/lib/types/trading-user.js';

// Mock Supabase client
const mockSupabase = {
  from: vi.fn().mockReturnThis(),
  insert: vi.fn().mockReturnThis(),
  select: vi.fn().mockReturnThis(),
  update: vi.fn().mockReturnThis(),
  delete: vi.fn().mockReturnThis(),
  eq: vi.fn().mockReturnThis(),
  not: vi.fn().mockReturnThis(),
  single: vi.fn(),
};

// Mock the imported modules
vi.mock('../../src/lib/supabase.js', () => ({
  supabase: mockSupabase,
  handleDatabaseError: vi.fn(),
  retryOperation: vi.fn((fn) => fn()),
}));

describe('TradingUserService', () => {
  let service: TradingUserService;
  let mockUser: TradingUser;
  let mockDbUser: any;

  beforeEach(() => {
    service = new TradingUserService();

    // Reset all mocks
    vi.clearAllMocks();

    // Mock user data
    mockUser = {
      id: 'test-user-id',
      display_name: 'Test User',
      default_capital: 10000,
      risk_tolerance: 'medium',
      preferred_coins: ['BTC', 'ETH'],
      notification_settings: {
        email_alerts: false,
        push_notifications: true,
        trade_confirmations: true,
        performance_reports: true,
        market_updates: false,
        ai_insights: true
      },
      created_at: '2025-01-01T00:00:00.000Z',
      updated_at: '2025-01-01T00:00:00.000Z'
    };

    mockDbUser = {
      id: mockUser.id,
      display_name: mockUser.display_name,
      default_capital: mockUser.default_capital,
      risk_tolerance: mockUser.risk_tolerance,
      preferred_coins: mockUser.preferred_coins,
      notification_settings: mockUser.notification_settings,
      created_at: mockUser.created_at,
      updated_at: mockUser.updated_at
    };
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe('createUser', () => {
    it('should create a user with valid data', async () => {
      const request: CreateTradingUserRequest = {
        id: 'new-user-id',
        display_name: 'New User',
        default_capital: 15000,
        risk_tolerance: 'high',
        preferred_coins: ['BTC'],
        notification_settings: {
          email_alerts: true,
          push_notifications: true,
          trade_confirmations: true,
          performance_reports: true,
          market_updates: true,
          ai_insights: true
        }
      };

      mockSupabase.single.mockResolvedValue({
        data: { ...mockDbUser, ...request },
        error: null
      });

      const result = await service.createUser(request);

      expect(mockSupabase.from).toHaveBeenCalledWith('trading_users');
      expect(mockSupabase.insert).toHaveBeenCalled();
      expect(mockSupabase.select).toHaveBeenCalled();
      expect(mockSupabase.single).toHaveBeenCalled();
      expect(result).toMatchObject({
        id: request.id,
        display_name: request.display_name,
        default_capital: request.default_capital,
        risk_tolerance: request.risk_tolerance,
        preferred_coins: request.preferred_coins
      });
    });

    it('should create user with default values when optional fields are missing', async () => {
      const request: CreateTradingUserRequest = {
        id: 'new-user-id',
        display_name: 'New User'
      };

      const expectedDbData = {
        id: request.id,
        display_name: request.display_name,
        default_capital: 10000, // Default value
        risk_tolerance: 'medium', // Default value
        preferred_coins: [], // Default empty array
        notification_settings: {
          email_alerts: false,
          push_notifications: true,
          trade_confirmations: true,
          performance_reports: true,
          market_updates: false,
          ai_insights: true
        }
      };

      mockSupabase.single.mockResolvedValue({
        data: { ...mockDbUser, ...expectedDbData },
        error: null
      });

      const result = await service.createUser(request);

      expect(result.default_capital).toBe(10000);
      expect(result.risk_tolerance).toBe('medium');
      expect(result.preferred_coins).toEqual([]);
    });

    it('should handle database errors', async () => {
      const request: CreateTradingUserRequest = {
        id: 'new-user-id',
        display_name: 'New User'
      };

      mockSupabase.single.mockResolvedValue({
        data: null,
        error: { code: 'UNIQUE_VIOLATION', message: 'User already exists' }
      });

      await expect(service.createUser(request)).rejects.toThrow();
    });
  });

  describe('getUserById', () => {
    it('should return user when found', async () => {
      mockSupabase.single.mockResolvedValue({
        data: mockDbUser,
        error: null
      });

      const result = await service.getUserById(mockUser.id);

      expect(mockSupabase.from).toHaveBeenCalledWith('trading_users');
      expect(mockSupabase.eq).toHaveBeenCalledWith('id', mockUser.id);
      expect(result).toMatchObject(mockUser);
    });

    it('should return null when user not found', async () => {
      mockSupabase.single.mockResolvedValue({
        data: null,
        error: { code: 'PGRST116' } // Not found error code
      });

      const result = await service.getUserById('non-existent-id');

      expect(result).toBeNull();
    });

    it('should handle other database errors', async () => {
      mockSupabase.single.mockResolvedValue({
        data: null,
        error: { code: 'NETWORK_ERROR', message: 'Connection failed' }
      });

      await expect(service.getUserById('user-id')).rejects.toThrow();
    });
  });

  describe('updateUser', () => {
    it('should update user successfully', async () => {
      const updates: UpdateTradingUserRequest = {
        display_name: 'Updated Name',
        default_capital: 20000
      };

      const updatedDbUser = { ...mockDbUser, ...updates };
      mockSupabase.single.mockResolvedValue({
        data: updatedDbUser,
        error: null
      });

      const result = await service.updateUser(mockUser.id, updates);

      expect(mockSupabase.from).toHaveBeenCalledWith('trading_users');
      expect(mockSupabase.update).toHaveBeenCalled();
      expect(mockSupabase.eq).toHaveBeenCalledWith('id', mockUser.id);
      expect(result.display_name).toBe('Updated Name');
      expect(result.default_capital).toBe(20000);
    });

    it('should handle user not found error', async () => {
      mockSupabase.single.mockResolvedValue({
        data: null,
        error: { code: 'PGRST116' } // Not found error
      });

      const updates: UpdateTradingUserRequest = {
        display_name: 'Updated Name'
      };

      await expect(service.updateUser('non-existent-id', updates)).rejects.toThrow('User not found');
    });
  });

  describe('deleteUser', () => {
    it('should delete user successfully', async () => {
      // Mock getUserById to return user (exists)
      vi.spyOn(service, 'getUserById').mockResolvedValue(mockUser);

      mockSupabase.delete.mockResolvedValue({
        error: null
      });

      await expect(service.deleteUser(mockUser.id)).resolves.not.toThrow();

      expect(mockSupabase.from).toHaveBeenCalledWith('trading_users');
      expect(mockSupabase.delete).toHaveBeenCalled();
      expect(mockSupabase.eq).toHaveBeenCalledWith('id', mockUser.id);
    });

    it('should handle user not found', async () => {
      // Mock getUserById to return null (doesn't exist)
      vi.spyOn(service, 'getUserById').mockResolvedValue(null);

      await expect(service.deleteUser('non-existent-id')).rejects.toThrow('User not found');
    });
  });

  describe('getUserPreferences', () => {
    it('should return user preferences when user exists', async () => {
      vi.spyOn(service, 'getUserById').mockResolvedValue(mockUser);

      const result = await service.getUserPreferences(mockUser.id);

      expect(result).toMatchObject({
        default_capital: mockUser.default_capital,
        risk_tolerance: mockUser.risk_tolerance,
        preferred_coins: mockUser.preferred_coins,
        notification_settings: mockUser.notification_settings
      });
    });

    it('should return null when user does not exist', async () => {
      vi.spyOn(service, 'getUserById').mockResolvedValue(null);

      const result = await service.getUserPreferences('non-existent-id');

      expect(result).toBeNull();
    });
  });

  describe('addPreferredCoin', () => {
    it('should add new coin to preferences', async () => {
      vi.spyOn(service, 'getUserById').mockResolvedValue(mockUser);
      vi.spyOn(service, 'updateUser').mockResolvedValue({ ...mockUser, preferred_coins: ['BTC', 'ETH', 'ADA'] });

      const result = await service.addPreferredCoin(mockUser.id, 'ada');

      expect(result).toContain('ADA');
      expect(result).toHaveLength(3);
    });

    it('should not add duplicate coin', async () => {
      vi.spyOn(service, 'getUserById').mockResolvedValue(mockUser);

      const result = await service.addPreferredCoin(mockUser.id, 'btc');

      expect(result).toEqual(['BTC', 'ETH']);
      expect(service.updateUser).not.toHaveBeenCalled();
    });

    it('should enforce maximum coins limit', async () => {
      const userWithMaxCoins = {
        ...mockUser,
        preferred_coins: ['BTC', 'ETH', 'ADA', 'DOT', 'SOL', 'MATIC', 'AVAX', 'LINK', 'UNI', 'ATOM'] // 10 coins (max)
      };
      vi.spyOn(service, 'getUserById').mockResolvedValue(userWithMaxCoins);

      await expect(service.addPreferredCoin(mockUser.id, 'XRP')).rejects.toThrow(/Cannot add more than 10/);
    });

    it('should handle user not found', async () => {
      vi.spyOn(service, 'getUserById').mockResolvedValue(null);

      await expect(service.addPreferredCoin('non-existent-id', 'BTC')).rejects.toThrow('User not found');
    });
  });

  describe('removePreferredCoin', () => {
    it('should remove coin from preferences', async () => {
      vi.spyOn(service, 'getUserById').mockResolvedValue(mockUser);
      vi.spyOn(service, 'updateUser').mockResolvedValue({ ...mockUser, preferred_coins: ['ETH'] });

      const result = await service.removePreferredCoin(mockUser.id, 'btc');

      expect(result).toEqual(['ETH']);
      expect(result).not.toContain('BTC');
    });

    it('should handle removing non-existent coin', async () => {
      vi.spyOn(service, 'getUserById').mockResolvedValue(mockUser);
      vi.spyOn(service, 'updateUser').mockResolvedValue(mockUser);

      const result = await service.removePreferredCoin(mockUser.id, 'XRP');

      expect(result).toEqual(['BTC', 'ETH']); // Unchanged
    });

    it('should handle user not found', async () => {
      vi.spyOn(service, 'getUserById').mockResolvedValue(null);

      await expect(service.removePreferredCoin('non-existent-id', 'BTC')).rejects.toThrow('User not found');
    });
  });

  describe('updateNotificationSettings', () => {
    it('should update notification settings', async () => {
      const newSettings: Partial<NotificationSettings> = {
        email_alerts: true,
        market_updates: true
      };

      vi.spyOn(service, 'getUserById').mockResolvedValue(mockUser);
      vi.spyOn(service, 'updateUser').mockResolvedValue({
        ...mockUser,
        notification_settings: { ...mockUser.notification_settings, ...newSettings }
      });

      const result = await service.updateNotificationSettings(mockUser.id, newSettings);

      expect(result.email_alerts).toBe(true);
      expect(result.market_updates).toBe(true);
      expect(result.push_notifications).toBe(true); // Unchanged
    });

    it('should handle user not found', async () => {
      vi.spyOn(service, 'getUserById').mockResolvedValue(null);

      const newSettings: Partial<NotificationSettings> = {
        email_alerts: true
      };

      await expect(service.updateNotificationSettings('non-existent-id', newSettings)).rejects.toThrow('User not found');
    });
  });

  describe('userExists', () => {
    it('should return true when user exists', async () => {
      vi.spyOn(service, 'getUserById').mockResolvedValue(mockUser);

      const result = await service.userExists(mockUser.id);

      expect(result).toBe(true);
    });

    it('should return false when user does not exist', async () => {
      vi.spyOn(service, 'getUserById').mockResolvedValue(null);

      const result = await service.userExists('non-existent-id');

      expect(result).toBe(false);
    });

    it('should return false on error', async () => {
      vi.spyOn(service, 'getUserById').mockRejectedValue(new Error('Database error'));

      const result = await service.userExists('user-id');

      expect(result).toBe(false);
    });
  });

  describe('getUserStatistics', () => {
    it('should return statistics when user has trading runs', async () => {
      const mockRunStats = [
        { final_capital: 11000, starting_capital: 10000, total_trades: 5, session_end: '2025-01-10T10:00:00.000Z' },
        { final_capital: 9500, starting_capital: 10000, total_trades: 3, session_end: '2025-01-15T10:00:00.000Z' },
        { final_capital: 12000, starting_capital: 10000, total_trades: 7, session_end: '2025-01-20T10:00:00.000Z' }
      ];

      mockSupabase.not.mockReturnThis();
      mockSupabase.single.mockResolvedValue({
        data: mockRunStats,
        error: null
      });

      const result = await service.getUserStatistics(mockUser.id);

      expect(result.total_runs).toBe(3);
      expect(result.total_trades).toBe(15);
      expect(result.average_return).toBeCloseTo(5, 1); // (10% - 5% + 20%) / 3
      expect(result.best_run_return).toBe(20);
      expect(result.last_activity).toBe('2025-01-20T10:00:00.000Z');
    });

    it('should return zero statistics when user has no runs', async () => {
      mockSupabase.not.mockReturnThis();
      mockSupabase.single.mockResolvedValue({
        data: [],
        error: null
      });

      const result = await service.getUserStatistics(mockUser.id);

      expect(result).toMatchObject({
        total_runs: 0,
        total_trades: 0,
        average_return: 0,
        best_run_return: 0,
        last_activity: null
      });
    });

    it('should handle database errors', async () => {
      mockSupabase.not.mockReturnThis();
      mockSupabase.single.mockResolvedValue({
        data: null,
        error: { code: 'NETWORK_ERROR', message: 'Connection failed' }
      });

      await expect(service.getUserStatistics(mockUser.id)).rejects.toThrow();
    });
  });

  describe('Private helper methods', () => {
    it('should return correct default notification settings', () => {
      const service = new TradingUserService();
      // Access private method via casting (for testing only)
      const defaultSettings = (service as any).getDefaultNotificationSettings();

      expect(defaultSettings).toMatchObject({
        email_alerts: false,
        push_notifications: true,
        trade_confirmations: true,
        performance_reports: true,
        market_updates: false,
        ai_insights: true
      });
    });

    it('should correctly map database user to TradingUser', () => {
      const service = new TradingUserService();
      // Access private method via casting (for testing only)
      const mappedUser = (service as any).mapDatabaseUserToTradingUser(mockDbUser);

      expect(mappedUser).toMatchObject(mockUser);
      expect(mappedUser).toEqual(mockUser);
    });
  });
});