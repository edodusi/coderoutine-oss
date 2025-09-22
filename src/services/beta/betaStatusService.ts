import AsyncStorage from '@react-native-async-storage/async-storage';
import { firebaseService, BetaUserData } from '../firebaseService';
import { getUniqueDeviceId } from '../../utils/deviceId';

export interface LocalBetaStatus {
  betaStatus: number;
  lastChecked: number;
  appId: string;
}

class BetaStatusService {
  private static instance: BetaStatusService;
  private readonly STORAGE_KEY = '@coderoutine_beta_status';
  private readonly COLLECTION_NAME = 'beta_users';
  private readonly CACHE_DURATION = 5 * 60 * 1000; // 5 minutes in milliseconds

  private constructor() {}

  static getInstance(): BetaStatusService {
    if (!BetaStatusService.instance) {
      BetaStatusService.instance = new BetaStatusService();
    }
    return BetaStatusService.instance;
  }

  /**
   * Get the unique device ID for this installation
   */
  private async getAppId(): Promise<string> {
    return await getUniqueDeviceId();
  }

  /**
   * Check if we need to refresh beta status from server
   */
  private shouldRefreshFromServer(lastChecked: number): boolean {
    const now = Date.now();
    return (now - lastChecked) > this.CACHE_DURATION;
  }

  /**
   * Get beta status from local storage
   */
  private async getLocalBetaStatus(): Promise<LocalBetaStatus | null> {
    try {
      const stored = await AsyncStorage.getItem(this.STORAGE_KEY);
      if (!stored) return null;

      const parsed: LocalBetaStatus = JSON.parse(stored);

      // Validate the stored data
      if (typeof parsed.betaStatus !== 'number' ||
          typeof parsed.lastChecked !== 'number' ||
          typeof parsed.appId !== 'string') {
        console.warn('Invalid beta status data in storage, clearing...');
        await AsyncStorage.removeItem(this.STORAGE_KEY);
        return null;
      }

      return parsed;
    } catch (error) {
      console.error('Error reading beta status from storage:', error);
      return null;
    }
  }

  /**
   * Save beta status to local storage
   */
  private async saveLocalBetaStatus(betaStatus: number): Promise<void> {
    try {
      const data: LocalBetaStatus = {
        betaStatus,
        lastChecked: Date.now(),
        appId: await this.getAppId(),
      };

      await AsyncStorage.setItem(this.STORAGE_KEY, JSON.stringify(data));
      console.log('🔒 Beta status saved to local storage:', { betaStatus });
    } catch (error) {
      console.error('Error saving beta status to storage:', error);
    }
  }

  /**
   * Create or update user record in Firestore
   */
  private async createOrUpdateUserRecord(betaData: Partial<BetaUserData>): Promise<void> {
    try {
      const success = await firebaseService.createOrUpdateBetaUser(betaData);
      if (!success) {
        throw new Error('Failed to create or update user record');
      }
    } catch (error) {
      console.error('Error creating/updating user record:', error);

      // Check if it's a permission error
      if (error instanceof Error && error.message.includes('permission-denied')) {
        console.warn('⚠️ Firestore permission denied - this is expected for new users without proper rules');
        // Don't throw for permission errors during user creation
        return;
      }

      throw error;
    }
  }

  /**
   * Fetch beta status from Firestore
   */
  private async fetchBetaStatusFromFirestore(): Promise<number> {
    try {
      const userData = await firebaseService.getBetaUserData();

      if (userData) {
        console.log('📥 Fetched beta status from Firestore:', {
          betaStatus: userData.betaStatus,
          appId: userData.appId
        });
        return userData.betaStatus || 0;
      } else {
        // User record doesn't exist, try to create it
        console.log('📝 User record not found, attempting to create new one...');
        try {
          await this.createOrUpdateUserRecord({});
        } catch (createError) {
          console.warn('⚠️ Could not create user record (permission denied) - continuing with default beta status');
        }
        return 0; // Default to not beta
      }
    } catch (error) {
      console.error('Error fetching beta status from Firestore:', error);

      // Check if it's a permission error
      if (error instanceof Error && error.message.includes('permission-denied')) {
        console.warn('⚠️ Firestore read permission denied - continuing with default beta status');
        return 0; // Return default status instead of throwing
      }

      throw error;
    }
  }

  /**
   * Initialize beta status on app startup
   * This should be called during splash screen
   */
  async initializeBetaStatus(): Promise<number> {
    try {
      console.log('🚀 Initializing beta status...');



      // First, try to get cached status
      const localStatus = await this.getLocalBetaStatus();

      if (localStatus && !this.shouldRefreshFromServer(localStatus.lastChecked)) {
        console.log('✅ Using cached beta status:', {
          betaStatus: localStatus.betaStatus,
          age: Date.now() - localStatus.lastChecked
        });
        return localStatus.betaStatus;
      }

      // Need to fetch from server
      console.log('🌐 Fetching fresh beta status from server...');
      const betaStatus = await this.fetchBetaStatusFromFirestore();

      // Cache the result
      await this.saveLocalBetaStatus(betaStatus);

      console.log('✅ Beta status initialized:', { betaStatus });
      return betaStatus;

    } catch (error) {
      console.error('❌ Error initializing beta status:', error);

      // Check if it's a permission error
      if (error instanceof Error && error.message.includes('permission-denied')) {
        console.warn('⚠️ Firestore permission denied - using default beta status (0)');
        await this.saveLocalBetaStatus(0);
        return 0;
      }

      // Fallback to cached status if available
      const localStatus = await this.getLocalBetaStatus();
      if (localStatus) {
        console.log('⚠️ Using stale cached beta status due to error');
        return localStatus.betaStatus;
      }

      // Final fallback
      console.log('⚠️ No cached status available, defaulting to 0');
      await this.saveLocalBetaStatus(0);
      return 0;
    }
  }

  /**
   * Get current beta status (synchronous, from cache)
   */
  async getCurrentBetaStatus(): Promise<number> {
    const localStatus = await this.getLocalBetaStatus();
    return localStatus?.betaStatus || 0;
  }

  /**
   * Check if current user has beta access
   */
  async hasBetaAccess(): Promise<boolean> {
    const betaStatus = await this.getCurrentBetaStatus();
    return betaStatus === 1;
  }

  /**
   * Force refresh beta status from server
   */
  async refreshBetaStatus(): Promise<number> {
    try {


      console.log('🔄 Force refreshing beta status from server...');
      const betaStatus = await this.fetchBetaStatusFromFirestore();
      await this.saveLocalBetaStatus(betaStatus);
      console.log('✅ Beta status refreshed:', { betaStatus });
      return betaStatus;
    } catch (error) {
      console.error('❌ Error refreshing beta status:', error);
      
      // Check if it's a permission error
      if (error instanceof Error && error.message.includes('permission-denied')) {
        console.warn('⚠️ Firestore permission denied during refresh - keeping cached status');
        const localStatus = await this.getLocalBetaStatus();
        return localStatus?.betaStatus || 0;
      }

      throw error;
    }
  }

  /**
   * Update subscription analytics in Firestore
   * This can be called when subscription status changes
   */
  async updateSubscriptionAnalytics(data: {
    subscriptionStatus: 'free' | 'premium' | 'beta';
    subscriptionStart?: number;
    subscriptionEnd?: number;
  }): Promise<void> {
    try {
      const success = await firebaseService.updateBetaUserSubscriptionAnalytics(data);
      if (success) {
        console.log('📊 Updated subscription analytics');
      } else {
        console.warn('⚠️ Failed to update subscription analytics');
      }
    } catch (error) {
      // Check if it's a permission error
      if (error instanceof Error && error.message.includes('permission-denied')) {
        console.warn('⚠️ Analytics update permission denied - this is expected without proper Firestore rules');
        return; // Don't log error for permission issues
      }
      
      console.error('Error updating subscription analytics:', error);
      // Don't throw here as this is for analytics only
    }
  }

  /**
   * Clear local beta status cache
   * Useful for testing or when user logs out
   */
  async clearCache(): Promise<void> {
    try {
      await AsyncStorage.removeItem(this.STORAGE_KEY);
      console.log('🗑️ Beta status cache cleared');
    } catch (error) {
      console.error('Error clearing beta status cache:', error);
    }
  }

  /**
   * Get debug information about beta status
   */
  async getDebugInfo(): Promise<{
    localStatus: LocalBetaStatus | null;
    appId: string;
    cacheAge?: number;
    shouldRefresh?: boolean;
  }> {
    const localStatus = await this.getLocalBetaStatus();
    const appId = await this.getAppId();

    return {
      localStatus,
      appId,
      cacheAge: localStatus ? Date.now() - localStatus.lastChecked : undefined,
      shouldRefresh: localStatus ? this.shouldRefreshFromServer(localStatus.lastChecked) : true,
    };
  }

  /**
   * Test method to verify beta status integration (DEV mode only)
   */
  async testBetaStatusIntegration(): Promise<{
    success: boolean;
    betaStatus: number;
    cached: boolean;
    firebaseConnected: boolean;
    error?: string;
  }> {
    if (!__DEV__) {
      return {
        success: false,
        betaStatus: 0,
        cached: false,
        firebaseConnected: false,
        error: 'Test method only available in DEV mode'
      };
    }

    try {
      console.log('🧪 Testing beta status integration...');

      // Test local cache
      const localStatus = await this.getLocalBetaStatus();
      const cached = localStatus !== null;

      // Test Firebase connection and beta status fetch
      let firebaseConnected = false;
      let betaStatus = 0;

      try {
        betaStatus = await this.fetchBetaStatusFromFirestore();
        firebaseConnected = true;
      } catch (error) {
        console.warn('Firebase test failed:', error);
      }

      console.log('🧪 Beta status integration test results:', {
        betaStatus,
        cached,
        firebaseConnected
      });

      return {
        success: true,
        betaStatus,
        cached,
        firebaseConnected
      };
    } catch (error) {
      console.error('🧪 Beta status integration test failed:', error);
      return {
        success: false,
        betaStatus: 0,
        cached: false,
        firebaseConnected: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  }
}

export default BetaStatusService;
