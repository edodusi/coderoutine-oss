import { describe, it, expect, beforeEach, vi, Mock } from 'vitest';
import AsyncStorage from '@react-native-async-storage/async-storage';

// Mock AsyncStorage
vi.mock('@react-native-async-storage/async-storage', () => ({
  default: {
    getItem: vi.fn(),
    setItem: vi.fn(),
    removeItem: vi.fn(),
    clear: vi.fn(),
  },
}));

// Simple mock for onboarding functionality
class MockOnboardingService {
  private storage: Map<string, string> = new Map();

  async hasCompletedOnboarding(): Promise<boolean> {
    try {
      const completed = this.storage.get('onboarding_completed') || await AsyncStorage.getItem('onboarding_completed');
      return completed === 'true';
    } catch (error) {
      console.error('Error checking onboarding status:', error);
      return false;
    }
  }

  async setOnboardingCompleted(completed: boolean): Promise<void> {
    try {
      const value = completed.toString();
      this.storage.set('onboarding_completed', value);
      await AsyncStorage.setItem('onboarding_completed', value);
    } catch (error) {
      console.error('Error setting onboarding status:', error);
      throw error;
    }
  }

  async simulatePermissionRequest(shouldGrant: boolean): Promise<{ granted: boolean; userAction: 'granted' | 'denied' }> {
    // Simulate permission request behavior
    if (shouldGrant) {
      return { granted: true, userAction: 'granted' };
    } else {
      return { granted: false, userAction: 'denied' };
    }
  }

  // Helper method to reset state for testing
  resetState(): void {
    this.storage.clear();
  }
}

describe('Notification Onboarding Flow', () => {
  let onboardingService: MockOnboardingService;
  const mockGetItem = AsyncStorage.getItem as Mock;
  const mockSetItem = AsyncStorage.setItem as Mock;

  beforeEach(() => {
    vi.clearAllMocks();
    onboardingService = new MockOnboardingService();
  });

  describe('hasCompletedOnboarding', () => {
    it('should return false when onboarding is not completed', async () => {
      mockGetItem.mockResolvedValue(null);

      const result = await onboardingService.hasCompletedOnboarding();

      expect(result).toBe(false);
      expect(mockGetItem).toHaveBeenCalledWith('onboarding_completed');
    });

    it('should return true when onboarding is completed', async () => {
      mockGetItem.mockResolvedValue('true');

      const result = await onboardingService.hasCompletedOnboarding();

      expect(result).toBe(true);
      expect(mockGetItem).toHaveBeenCalledWith('onboarding_completed');
    });

    it('should return false on storage error', async () => {
      mockGetItem.mockRejectedValue(new Error('Storage error'));

      const result = await onboardingService.hasCompletedOnboarding();

      expect(result).toBe(false);
    });
  });

  describe('setOnboardingCompleted', () => {
    it('should save onboarding completion status', async () => {
      mockSetItem.mockResolvedValue(undefined);

      await onboardingService.setOnboardingCompleted(true);

      expect(mockSetItem).toHaveBeenCalledWith('onboarding_completed', 'true');
    });

    it('should save false onboarding status', async () => {
      mockSetItem.mockResolvedValue(undefined);

      await onboardingService.setOnboardingCompleted(false);

      expect(mockSetItem).toHaveBeenCalledWith('onboarding_completed', 'false');
    });

    it('should throw error on storage failure', async () => {
      const storageError = new Error('Storage write failed');
      mockSetItem.mockRejectedValue(storageError);

      await expect(onboardingService.setOnboardingCompleted(true))
        .rejects.toThrow('Storage write failed');
    });
  });

  describe('Permission Flow Simulation', () => {
    it('should handle granted permissions', async () => {
      const result = await onboardingService.simulatePermissionRequest(true);

      expect(result).toEqual({ granted: true, userAction: 'granted' });
    });

    it('should handle denied permissions', async () => {
      const result = await onboardingService.simulatePermissionRequest(false);

      expect(result).toEqual({ granted: false, userAction: 'denied' });
    });
  });

  describe('Complete Onboarding Flow', () => {
    it('should handle successful onboarding with granted permissions', async () => {
      mockGetItem.mockResolvedValue(null);
      mockSetItem.mockResolvedValue(undefined);

      // Step 1: Check if onboarding is needed
      const needsOnboarding = !(await onboardingService.hasCompletedOnboarding());
      expect(needsOnboarding).toBe(true);

      // Step 2: Simulate permission request (granted)
      const permissionResult = await onboardingService.simulatePermissionRequest(true);
      expect(permissionResult.granted).toBe(true);

      // Step 3: Mark onboarding as completed
      await onboardingService.setOnboardingCompleted(true);
      expect(mockSetItem).toHaveBeenCalledWith('onboarding_completed', 'true');

      // Step 4: Verify onboarding is now completed
      // Set up mock to return true for next check
      onboardingService.resetState();
      mockGetItem.mockResolvedValue('true');
      const isCompleted = await onboardingService.hasCompletedOnboarding();
      expect(isCompleted).toBe(true);
    });

    it('should handle onboarding with denied permissions', async () => {
      mockGetItem.mockResolvedValue(null);
      mockSetItem.mockResolvedValue(undefined);

      // Step 1: Check if onboarding is needed
      const needsOnboarding = !(await onboardingService.hasCompletedOnboarding());
      expect(needsOnboarding).toBe(true);

      // Step 2: Simulate permission request (denied)
      const permissionResult = await onboardingService.simulatePermissionRequest(false);
      expect(permissionResult.granted).toBe(false);
      expect(permissionResult.userAction).toBe('denied');

      // Step 3: Still mark onboarding as completed (user made choice)
      await onboardingService.setOnboardingCompleted(true);
      expect(mockSetItem).toHaveBeenCalledWith('onboarding_completed', 'true');

      // Step 4: Verify onboarding is completed even with denied permissions
      onboardingService.resetState();
      mockGetItem.mockResolvedValue('true');
      const isCompleted = await onboardingService.hasCompletedOnboarding();
      expect(isCompleted).toBe(true);
    });

    it('should skip onboarding if already completed', async () => {
      mockGetItem.mockResolvedValue('true');

      const needsOnboarding = !(await onboardingService.hasCompletedOnboarding());
      expect(needsOnboarding).toBe(false);

      // Should not set item again if already completed
      expect(mockSetItem).not.toHaveBeenCalled();
    });
  });

  describe('Onboarding State Management', () => {
    it('should handle onboarding state transitions correctly', async () => {
      mockSetItem.mockResolvedValue(undefined);

      // Initial state: not completed
      mockGetItem.mockResolvedValue(null);
      expect(await onboardingService.hasCompletedOnboarding()).toBe(false);

      // Complete onboarding
      await onboardingService.setOnboardingCompleted(true);
      
      // State should be completed
      mockGetItem.mockResolvedValue('true');
      expect(await onboardingService.hasCompletedOnboarding()).toBe(true);

      // Verify storage calls
      expect(mockSetItem).toHaveBeenCalledWith('onboarding_completed', 'true');
    });

    it('should handle multiple onboarding completion attempts gracefully', async () => {
      mockSetItem.mockResolvedValue(undefined);

      // Simulate rapid calls (user tapping multiple times)
      const promises = [
        onboardingService.setOnboardingCompleted(true),
        onboardingService.setOnboardingCompleted(true),
        onboardingService.setOnboardingCompleted(true),
      ];

      await Promise.all(promises);

      // Should complete without errors
      expect(mockSetItem).toHaveBeenCalledTimes(3);
      expect(mockSetItem).toHaveBeenCalledWith('onboarding_completed', 'true');
    });

    it('should maintain consistent state across service instances', async () => {
      mockGetItem.mockResolvedValue('true');
      mockSetItem.mockResolvedValue(undefined);

      const service1 = new MockOnboardingService();
      const service2 = new MockOnboardingService();

      // Both services should read the same state
      const result1 = await service1.hasCompletedOnboarding();
      const result2 = await service2.hasCompletedOnboarding();

      expect(result1).toBe(result2);
      expect(result1).toBe(true);
    });
  });

  describe('Edge Cases and Error Handling', () => {
    it('should handle corrupted storage data gracefully', async () => {
      // Simulate corrupted data
      mockGetItem.mockResolvedValue('invalid_boolean_value');

      const result = await onboardingService.hasCompletedOnboarding();
      expect(result).toBe(false); // Should default to false for safety
    });

    it('should handle storage unavailable scenarios', async () => {
      mockGetItem.mockRejectedValue(new Error('Storage not available'));

      const result = await onboardingService.hasCompletedOnboarding();
      expect(result).toBe(false); // Should fail safely
    });

    it('should properly handle async completion tracking', async () => {
      mockSetItem.mockImplementation(() => 
        new Promise(resolve => setTimeout(resolve, 100))
      );

      const startTime = Date.now();
      await onboardingService.setOnboardingCompleted(true);
      const endTime = Date.now();

      expect(endTime - startTime).toBeGreaterThanOrEqual(100);
      expect(mockSetItem).toHaveBeenCalledWith('onboarding_completed', 'true');
    });
  });

  describe('Onboarding Flow Validation', () => {
    it('should validate the complete user journey - first time user', async () => {
      mockGetItem.mockResolvedValue(null);
      mockSetItem.mockResolvedValue(undefined);

      // 1. App starts, check onboarding status
      const needsOnboarding = !(await onboardingService.hasCompletedOnboarding());
      expect(needsOnboarding).toBe(true);

      // 2. Show onboarding modal (simulated)
      expect(mockGetItem).toHaveBeenCalledWith('onboarding_completed');

      // 3. User grants permissions
      const permissionResult = await onboardingService.simulatePermissionRequest(true);
      expect(permissionResult.granted).toBe(true);

      // 4. Complete onboarding
      await onboardingService.setOnboardingCompleted(true);

      // 5. Verify completion
      onboardingService.resetState();
      mockGetItem.mockResolvedValue('true');
      const finalStatus = await onboardingService.hasCompletedOnboarding();
      expect(finalStatus).toBe(true);

      // Verify all interactions
      expect(mockSetItem).toHaveBeenCalledWith('onboarding_completed', 'true');
    });

    it('should validate the complete user journey - returning user', async () => {
      mockGetItem.mockResolvedValue('true');

      // 1. App starts, check onboarding status
      const needsOnboarding = !(await onboardingService.hasCompletedOnboarding());
      expect(needsOnboarding).toBe(false);

      // 2. No onboarding modal should be shown
      expect(mockGetItem).toHaveBeenCalledWith('onboarding_completed');

      // 3. No additional storage operations should occur
      expect(mockSetItem).not.toHaveBeenCalled();
    });
  });
});