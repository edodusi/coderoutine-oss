/**
 * Subscription Status Cache
 * 
 * This service manages subscription status in memory for the current session.
 * It reduces the number of API calls to RevenueCat and provides quick access
 * to subscription information throughout the app.
 */

import { CustomerInfo } from 'react-native-purchases';
import Constants from 'expo-constants';
import { PREMIUM_ENTITLEMENT_ID } from '../config/iapProducts';
import { BetaStatusService } from './beta';
import { subscriptionService } from './subscriptionService';

export interface CachedSubscriptionStatus {
  isSubscribed: boolean;
  customerInfo: CustomerInfo | null;
  lastUpdated: Date;
  productId: string | null;
  expirationDate: string | null;
  originalPurchaseDate: string | null;
}

class SubscriptionStatusCache {
  private static instance: SubscriptionStatusCache;
  private cache: CachedSubscriptionStatus | null = null;
  private isInitializing = false;
  private initializePromise: Promise<void> | null = null;

  private constructor() {}

  static getInstance(): SubscriptionStatusCache {
    if (!SubscriptionStatusCache.instance) {
      SubscriptionStatusCache.instance = new SubscriptionStatusCache();
    }
    return SubscriptionStatusCache.instance;
  }

  /**
   * Get cached subscription status
   */
  getStatus(): CachedSubscriptionStatus | null {
    return this.cache;
  }

  /**
   * Check if user has active subscription (from cache)
   */
  isSubscribed(): boolean {
    return this.cache?.isSubscribed || false;
  }

  /**
   * Get customer info from cache
   */
  getCustomerInfo(): CustomerInfo | null {
    return this.cache?.customerInfo || null;
  }

  /**
   * Update cached subscription status
   */
  async updateStatus(customerInfo: CustomerInfo): Promise<void> {
    const activeEntitlement = customerInfo.entitlements.active[PREMIUM_ENTITLEMENT_ID];
    
    // Check beta status
    let hasBetaAccess = false;
    try {
      const betaStatusService = BetaStatusService.getInstance();
      hasBetaAccess = await betaStatusService.hasBetaAccess();
    } catch (error) {
      console.error('Error checking beta status in cache update:', error);
    }
    
    // In beta mode or with active entitlement, set subscription as active
    const isSubscribed = hasBetaAccess || activeEntitlement !== undefined;
    
    this.cache = {
      isSubscribed,
      customerInfo,
      lastUpdated: new Date(),
      productId: activeEntitlement?.productIdentifier || null,
      expirationDate: activeEntitlement?.expirationDate || null,
      originalPurchaseDate: activeEntitlement?.originalPurchaseDate || null,
    };

    console.log('📦 Subscription status cached:', {
      isSubscribed: this.cache.isSubscribed,
      productId: this.cache.productId,
      lastUpdated: this.cache.lastUpdated.toISOString(),
    });
  }

  /**
   * Clear cached subscription status
   */
  clearCache(): void {
    this.cache = null;
    console.log('🗑️ Subscription cache cleared');
  }

  /**
   * Check if cache is stale (older than specified minutes)
   */
  isCacheStale(maxAgeMinutes: number = 30): boolean {
    if (!this.cache) {
      return true;
    }

    const now = new Date();
    const ageInMinutes = (now.getTime() - this.cache.lastUpdated.getTime()) / (1000 * 60);
    return ageInMinutes > maxAgeMinutes;
  }

  /**
   * Initialize cache with subscription status from RevenueCat
   */
  async initialize(): Promise<void> {
    // Prevent multiple simultaneous initializations
    if (this.isInitializing && this.initializePromise) {
      return this.initializePromise;
    }

    if (this.isInitializing) {
      return;
    }

    this.isInitializing = true;
    
    this.initializePromise = this.performInitialization();
    
    try {
      await this.initializePromise;
    } finally {
      this.isInitializing = false;
      this.initializePromise = null;
    }
  }

  /**
   * Perform the actual initialization
   */
  private async performInitialization(): Promise<void> {
    try {
      // Skip initialization in Expo Go development environment
      if (Constants.executionEnvironment === 'storeClient') {
        console.warn('Subscription status cache skipped in Expo Go - this is normal in development');
        return;
      }
      
      console.log('🔄 Initializing subscription status cache...');
      
      // Initialize RevenueCat if needed
      await subscriptionService.initialize();
      
      if (subscriptionService.isInitialized) {
        // Get customer info and cache it
        const customerInfo = await subscriptionService.getCustomerInfo();
        await this.updateStatus(customerInfo);
        console.log('✅ Subscription status cache initialized successfully');
      } else {
        console.log('⚠️ RevenueCat not configured - cache remains empty');
      }
    } catch (error) {
      // Suppress billing errors in Expo Go development environment
      if (Constants.executionEnvironment === 'storeClient') {
        console.warn('Subscription status cache unavailable in Expo Go - this is normal in development');
        return;
      }
      console.error('❌ Failed to initialize subscription status cache:', error);
      // Don't throw - allow app to continue without subscription cache
    }
  }

  /**
   * Refresh cache from RevenueCat
   */
  async refresh(): Promise<void> {
    try {
      // Skip refresh in Expo Go development environment
      if (Constants.executionEnvironment === 'storeClient') {
        console.warn('Subscription status cache refresh skipped in Expo Go - this is normal in development');
        return;
      }

      console.log('🔄 Refreshing subscription status cache...');

      if (!subscriptionService.isInitialized) {
        console.log('⚠️ RevenueCat not initialized - skipping refresh');
        return;
      }

      const customerInfo = await subscriptionService.getCustomerInfo();
      await this.updateStatus(customerInfo);
      console.log('✅ Subscription status cache refreshed');
    } catch (error) {
      // Suppress billing errors in Expo Go development environment
      if (Constants.executionEnvironment === 'storeClient') {
        console.warn('Subscription status cache refresh unavailable in Expo Go - this is normal in development');
        return;
      }
      console.error('❌ Failed to refresh subscription status cache:', error);
      // Don't clear cache on error - keep existing data
    }
  }

  /**
   * Get subscription status with automatic refresh if stale
   */
  async getStatusWithRefresh(maxAgeMinutes: number = 30): Promise<CachedSubscriptionStatus | null> {
    if (this.isCacheStale(maxAgeMinutes)) {
      await this.refresh();
    }
    return this.getStatus();
  }

  /**
   * Get debug information about the cache
   */
  getDebugInfo(): object {
    if (!this.cache) {
      return {
        status: 'empty',
        isInitializing: this.isInitializing,
      };
    }

    return {
      status: 'cached',
      isSubscribed: this.cache.isSubscribed,
      productId: this.cache.productId,
      lastUpdated: this.cache.lastUpdated.toISOString(),
      ageMinutes: Math.round((new Date().getTime() - this.cache.lastUpdated.getTime()) / (1000 * 60)),
      isStale: this.isCacheStale(),
      isInitializing: this.isInitializing,
    };
  }

  /**
   * Check if specific entitlement is active (from cache)
   */
  async hasEntitlement(entitlementId: string): Promise<boolean> {
    // Check beta status first
    try {
      const betaStatusService = BetaStatusService.getInstance();
      const hasBetaAccess = await betaStatusService.hasBetaAccess();
      if (hasBetaAccess) {
        console.log('🚀 Beta access: hasEntitlement returning true');
        return true;
      }
    } catch (error) {
      console.error('Error checking beta status in hasEntitlement:', error);
    }

    if (!this.cache?.customerInfo) {
      return false;
    }
    return this.cache.customerInfo.entitlements.active[entitlementId] !== undefined;
  }

  /**
   * Get all active entitlements (from cache)
   */
  getActiveEntitlements(): string[] {
    if (!this.cache?.customerInfo) {
      return [];
    }
    return Object.keys(this.cache.customerInfo.entitlements.active);
  }

  /**
   * Listen for subscription changes (called by subscription service)
   */
  onSubscriptionChanged(customerInfo: CustomerInfo): void {
    const previousStatus = this.cache?.isSubscribed || false;
    this.updateStatus(customerInfo).then(() => {
      const newStatus = this.cache?.isSubscribed || false;

      if (previousStatus !== newStatus) {
        console.log(`🔔 Subscription status changed: ${previousStatus} → ${newStatus}`);
      }
    }).catch(error => {
      console.error('Error updating subscription status in onSubscriptionChanged:', error);
    });
  }
}

export const subscriptionStatusCache = SubscriptionStatusCache.getInstance();
export default subscriptionStatusCache;