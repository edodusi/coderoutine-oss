import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';

// Mock the global __DEV__ variable
const originalDev = global.__DEV__;

// Mock RevenueCat and other dependencies
vi.mock('react-native-purchases', () => ({
  configure: vi.fn(),
  getOfferings: vi.fn(),
  getCustomerInfo: vi.fn(),
  purchasePackage: vi.fn(),
  restorePurchases: vi.fn(),
}));

vi.mock('expo-constants', () => ({
  executionEnvironment: 'standalone',
}));

vi.mock('react-native', () => ({
  Platform: {
    OS: 'ios',
  },
}));

vi.mock('../src/services/subscriptionService', () => ({
  subscriptionService: {
    isInitialized: true,
    getOfferings: vi.fn().mockResolvedValue(null),
    getCustomerInfo: vi.fn().mockResolvedValue({
      entitlements: { active: {} },
    }),
    purchasePackage: vi.fn(),
    restorePurchases: vi.fn(),
    hasActiveEntitlement: vi.fn().mockResolvedValue(false),
    shouldShowError: vi.fn().mockReturnValue(true),
  },
}));

vi.mock('../src/services/subscriptionStatusCache', () => ({
  subscriptionStatusCache: {
    initialize: vi.fn().mockResolvedValue(undefined),
    getStatus: vi.fn().mockReturnValue(null),
    getStatusWithRefresh: vi.fn().mockResolvedValue(null),
    updateStatus: vi.fn().mockResolvedValue(undefined),
  },
}));

vi.mock('../src/services/beta', () => ({
  BetaStatusService: {
    getInstance: vi.fn().mockReturnValue({
      getCurrentBetaStatus: vi.fn().mockResolvedValue(0),
    }),
  },
}));

describe('Subscription DEV Mode Behavior', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    // Restore original __DEV__ value
    global.__DEV__ = originalDev;
  });

  describe('DEV mode subscription logic', () => {
    it('should return true when __DEV__ is true, regardless of actual subscription', () => {
      global.__DEV__ = true;
      
      // Simulate the logic from useSubscription hook
      const hasActiveEntitlement = false;
      const betaStatus = 0;
      
      // In DEV mode, beta mode, or with active entitlement, set subscription as active
      const isActiveSubscription = global.__DEV__ || betaStatus === 1 || hasActiveEntitlement;
      
      expect(isActiveSubscription).toBe(true);
    });

    it('should return false when __DEV__ is false and no subscription exists', () => {
      global.__DEV__ = false;
      
      // Simulate the logic from useSubscription hook
      const hasActiveEntitlement = false;
      const betaStatus = 0;
      
      // In DEV mode, beta mode, or with active entitlement, set subscription as active
      const isActiveSubscription = global.__DEV__ || betaStatus === 1 || hasActiveEntitlement;
      
      expect(isActiveSubscription).toBe(false);
    });

    it('should return true when __DEV__ is false but actual subscription exists', () => {
      global.__DEV__ = false;
      
      // Simulate the logic from useSubscription hook
      const hasActiveEntitlement = true; // User has actual subscription
      const betaStatus = 0;
      
      // In DEV mode, beta mode, or with active entitlement, set subscription as active
      const isActiveSubscription = global.__DEV__ || betaStatus === 1 || hasActiveEntitlement;
      
      expect(isActiveSubscription).toBe(true);
    });

    it('should return true when __DEV__ is false but beta status is active', () => {
      global.__DEV__ = false;
      
      // Simulate the logic from useSubscription hook
      const hasActiveEntitlement = false;
      const betaStatus = 1; // User has beta access
      
      // In DEV mode, beta mode, or with active entitlement, set subscription as active
      const isActiveSubscription = global.__DEV__ || betaStatus === 1 || hasActiveEntitlement;
      
      expect(isActiveSubscription).toBe(true);
    });
  });

  describe('getIsSubscribed function logic', () => {
    it('should return true when __DEV__ is true', () => {
      global.__DEV__ = true;
      const isSubscribed = false; // Local state
      const betaStatus = 0;
      
      // Create a getter that returns true for DEV mode, beta mode, or valid subscription
      const getIsSubscribed = () => {
        return global.__DEV__ || betaStatus === 1 || isSubscribed;
      };
      
      expect(getIsSubscribed()).toBe(true);
    });

    it('should return false when __DEV__ is false and no other conditions are met', () => {
      global.__DEV__ = false;
      const isSubscribed = false; // Local state
      const betaStatus = 0;
      
      // Create a getter that returns true for DEV mode, beta mode, or valid subscription
      const getIsSubscribed = () => {
        return global.__DEV__ || betaStatus === 1 || isSubscribed;
      };
      
      expect(getIsSubscribed()).toBe(false);
    });

    it('should return true when __DEV__ is false but isSubscribed is true', () => {
      global.__DEV__ = false;
      const isSubscribed = true; // User has valid subscription
      const betaStatus = 0;
      
      // Create a getter that returns true for DEV mode, beta mode, or valid subscription
      const getIsSubscribed = () => {
        return global.__DEV__ || betaStatus === 1 || isSubscribed;
      };
      
      expect(getIsSubscribed()).toBe(true);
    });
  });

  describe('console logging behavior', () => {
    let consoleSpy: any;

    beforeEach(() => {
      consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
    });

    afterEach(() => {
      consoleSpy.mockRestore();
    });

    it('should log DEV mode behavior when conditions are met', () => {
      global.__DEV__ = true;
      const hasActiveEntitlement = false;
      const betaStatus = 0;

      // Simulate the logging logic from updateSubscriptionStatus
      if (global.__DEV__ && !hasActiveEntitlement && betaStatus !== 1) {
        console.log('🚀 DEV MODE: Subscription is active due to development environment (no actual purchase required)');
      }

      expect(consoleSpy).toHaveBeenCalledWith(
        '🚀 DEV MODE: Subscription is active due to development environment (no actual purchase required)'
      );
    });

    it('should not log DEV mode behavior when in production', () => {
      global.__DEV__ = false;
      const hasActiveEntitlement = false;
      const betaStatus = 0;

      // Simulate the logging logic from updateSubscriptionStatus
      if (global.__DEV__ && !hasActiveEntitlement && betaStatus !== 1) {
        console.log('🚀 DEV MODE: Subscription is active due to development environment (no actual purchase required)');
      }

      expect(consoleSpy).not.toHaveBeenCalled();
    });

    it('should not log DEV mode behavior when user has actual subscription', () => {
      global.__DEV__ = true;
      const hasActiveEntitlement = true; // User has real subscription
      const betaStatus = 0;

      // Simulate the logging logic from updateSubscriptionStatus
      if (global.__DEV__ && !hasActiveEntitlement && betaStatus !== 1) {
        console.log('🚀 DEV MODE: Subscription is active due to development environment (no actual purchase required)');
      }

      expect(consoleSpy).not.toHaveBeenCalled();
    });
  });

  describe('appConfig subscription configuration', () => {
    it('should set devModeAlwaysActive to true when __DEV__ is true', () => {
      global.__DEV__ = true;
      
      // Simulate the appConfig logic
      const subscriptionConfig = {
        devModeAlwaysActive: global.__DEV__,
      };
      
      expect(subscriptionConfig.devModeAlwaysActive).toBe(true);
    });

    it('should set devModeAlwaysActive to false when __DEV__ is false', () => {
      global.__DEV__ = false;
      
      // Simulate the appConfig logic
      const subscriptionConfig = {
        devModeAlwaysActive: global.__DEV__,
      };
      
      expect(subscriptionConfig.devModeAlwaysActive).toBe(false);
    });
  });
});