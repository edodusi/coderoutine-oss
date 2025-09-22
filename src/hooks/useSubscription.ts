import { useState, useEffect, useCallback } from 'react';
import { subscriptionService } from '../services/subscriptionService';
import { subscriptionStatusCache } from '../services/subscriptionStatusCache';
import { PREMIUM_ENTITLEMENT_ID } from '../config/iapProducts';
import type {
  PurchasesOffering,
  PurchasesPackage,
  CustomerInfo
} from 'react-native-purchases';
import { Platform } from 'react-native';
import Constants from 'expo-constants';
import { BetaStatusService } from '../services/beta';

export interface UseSubscriptionReturn {
  // Subscription state
  isSubscribed: boolean;
  setIsSubscribed: (value: boolean) => void;

  offerings: PurchasesOffering | null;
  customerInfo: CustomerInfo | null;

  // Loading states
  purchaseLoading: boolean;
  restoreLoading: boolean;
  offeringsLoading: boolean;

  // Actions
  purchaseSubscription: (packageToPurchase: PurchasesPackage) => Promise<void>;
  restorePurchases: () => Promise<void>;
  refreshCustomerInfo: () => Promise<void>;

  // Error handling
  lastError: string | null;
  clearError: () => void;
}

export const useSubscription = (): UseSubscriptionReturn => {
  // State management - subscription status starts as false
  const [isSubscribed, setIsSubscribed] = useState<boolean>(false);
  const [betaStatus, setBetaStatus] = useState<number>(0);
  const [offerings, setOfferings] = useState<PurchasesOffering | null>(null);
  const [customerInfo, setCustomerInfo] = useState<CustomerInfo | null>(null);

  // Loading states
  const [purchaseLoading, setPurchaseLoading] = useState<boolean>(false);
  const [restoreLoading, setRestoreLoading] = useState<boolean>(false);
  const [offeringsLoading, setOfferingsLoading] = useState<boolean>(false);

  // Error handling
  const [lastError, setLastError] = useState<string | null>(null);

  /**
   * Clear any existing error
   */
  const clearError = useCallback(() => {
    setLastError(null);
  }, []);

  /**
   * Update subscription status based on customer info
   */
  const updateSubscriptionStatus = useCallback((info: CustomerInfo) => {
    setCustomerInfo(info);
    // Check for active premium entitlement
    const hasActiveEntitlement = info.entitlements.active[PREMIUM_ENTITLEMENT_ID] !== undefined;

    // In DEV mode, beta mode, or with active entitlement, set subscription as active
    const isActiveSubscription = __DEV__ || betaStatus === 1 || hasActiveEntitlement;
    setIsSubscribed(isActiveSubscription);

    console.log('Subscription status updated:', {
      hasActiveEntitlement,
      betaStatus,
      isActiveSubscription,
      devMode: __DEV__,
      devModeOverride: __DEV__ ? 'SUBSCRIPTION ALWAYS ACTIVE IN DEV MODE' : false,
      entitlements: Object.keys(info.entitlements.active)
    });

    // Log clear message about DEV mode override
    if (__DEV__ && !hasActiveEntitlement && betaStatus !== 1) {
      console.log('🚀 DEV MODE: Subscription is active due to development environment (no actual purchase required)');
    }
  }, [betaStatus]);

  // Create a getter that returns true for DEV mode, beta mode, or valid subscription
  const getIsSubscribed = useCallback(() => {
    return __DEV__ || betaStatus === 1 || isSubscribed;
  }, [isSubscribed, betaStatus]);

  /**
   * Initialize beta status
   */
  const initializeBetaStatus = useCallback(async () => {
    try {
      const betaStatusService = BetaStatusService.getInstance();
      const currentBetaStatus = await betaStatusService.getCurrentBetaStatus();
      setBetaStatus(currentBetaStatus);
      console.log('Beta status initialized:', { betaStatus: currentBetaStatus });
    } catch (error) {
      console.error('Failed to initialize beta status:', error);
      setBetaStatus(0); // Default to no beta access
    }
  }, []);

  /**
   * Initialize the subscription service and fetch initial data
   */
  const initializeSubscription = useCallback(async () => {
    // if expo or web, return immediately
    if (Platform.OS === 'web' || Constants.executionEnvironment === 'storeClient') {
      return;
    }

    try {
      // Initialize subscription cache (which also initializes RevenueCat)
      await subscriptionStatusCache.initialize();

      // Check if we have cached data
      const cachedStatus = subscriptionStatusCache.getStatus();
      if (cachedStatus && cachedStatus.customerInfo) {
        updateSubscriptionStatus(cachedStatus.customerInfo);
      }

      // Load offerings if RevenueCat is initialized
      if (subscriptionService.isInitialized) {
        await loadOfferings();
      } else {
        // Initialization was skipped (e.g., invalid API keys in development)
        console.log('RevenueCat initialization was skipped - subscription features disabled');
        setLastError('Subscription service not available - please configure RevenueCat API keys');
      }
    } catch (error) {
      console.error('Failed to initialize subscription:', error);
      setLastError(error instanceof Error ? error.message : 'Failed to initialize subscription');
    }
  }, []);

  /**
   * Load available offerings from RevenueCat
   */
  const loadOfferings = useCallback(async () => {
    setOfferingsLoading(true);
    try {
      const currentOfferings = await subscriptionService.getOfferings();
      setOfferings(currentOfferings);
      clearError();
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Failed to load subscription options';

      // Suppress billing errors in Expo Go development environment
      if (Constants.executionEnvironment === 'storeClient') {
        console.warn('RevenueCat offerings unavailable in Expo Go - this is normal in development');
        return;
      }

      // Don't show error if it's just configuration issue in development
      if (__DEV__ && (errorMessage.includes('not properly configured') || errorMessage.includes('Billing is not available'))) {
        console.warn('Offerings unavailable due to configuration - this is normal in development');
      } else {
        console.error('Failed to load offerings:', error);
        setLastError(errorMessage);
      }
    } finally {
      setOfferingsLoading(false);
    }
  }, [clearError]);

  /**
   * Refresh customer info to get latest subscription status
   */
  const refreshCustomerInfo = useCallback(async () => {
    console.log('Refreshing customer info...');
    try {
      // Try to get from cache first
      const cachedStatus = await subscriptionStatusCache.getStatusWithRefresh(5); // Refresh if older than 5 minutes

      if (cachedStatus && cachedStatus.customerInfo) {
        updateSubscriptionStatus(cachedStatus.customerInfo);
        clearError();
        return;
      }

      // Fallback to direct service call
      const info = await subscriptionService.getCustomerInfo();
      updateSubscriptionStatus(info);

      // Update cache
      subscriptionStatusCache.updateStatus(info).catch(error => {
        console.error('Error updating subscription cache:', error);
      });
      clearError();
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Failed to check subscription status';

      // Suppress billing errors in Expo Go development environment
      if (Constants.executionEnvironment === 'storeClient') {
        console.warn('RevenueCat customer info unavailable in Expo Go - this is normal in development');
        return;
      }

      // Don't show error if it's just configuration issue in development
      if (__DEV__ && (errorMessage.includes('not properly configured') || errorMessage.includes('Billing is not available'))) {
        console.warn('Customer info unavailable due to configuration - this is normal in development');
      } else {
        console.error('Failed to refresh customer info:', error);
        setLastError(errorMessage);
      }
    }
  }, [updateSubscriptionStatus, clearError]);

  /**
   * Purchase a subscription package
   */
  const purchaseSubscription = useCallback(async (packageToPurchase: PurchasesPackage) => {
    if (purchaseLoading) {
      console.log('Purchase already in progress, ignoring request');
      return;
    }

    setPurchaseLoading(true);
    clearError();

    try {
      console.log('Starting purchase for package:', packageToPurchase.identifier);

      const result = await subscriptionService.purchasePackage(packageToPurchase);

      if (result.success && result.customerInfo) {
        // Update subscription status with new customer info
        updateSubscriptionStatus(result.customerInfo);

        // Update cache
        subscriptionStatusCache.updateStatus(result.customerInfo).catch(error => {
          console.error('Error updating subscription cache after purchase:', error);
        });
        console.log('Purchase completed successfully');
      } else {
        // Purchase failed or was cancelled
        const errorMessage = result.error || 'Purchase failed for unknown reason';

        // Don't set error for user cancellation
        if (!subscriptionService.shouldShowError({ message: errorMessage })) {
          console.log('Purchase was cancelled by user');
          return; // Exit silently for cancellation
        }

        setLastError(errorMessage);
        console.error('Purchase failed:', errorMessage);
      }
    } catch (error: any) {
      console.error('Purchase error:', error);

      // Check if it's a configuration error
      if (error instanceof Error && error.message.includes('not properly configured')) {
        setLastError('Subscription service not available. Please configure RevenueCat API keys.');
        return;
      }

      // Check if it's a user cancellation error
      if (!subscriptionService.shouldShowError(error)) {
        console.log('Purchase was cancelled by user');
        return; // Exit silently for cancellation
      }

      const errorMessage = error instanceof Error ? error.message : 'Purchase failed';
      setLastError(errorMessage);
    } finally {
      setPurchaseLoading(false);
    }
  }, [purchaseLoading, clearError, updateSubscriptionStatus]);

  /**
   * Restore previous purchases
   */
  const restorePurchases = useCallback(async () => {
    if (restoreLoading) {
      console.log('Restore already in progress, ignoring request');
      return;
    }

    setRestoreLoading(true);
    clearError();

    try {
      console.log('Starting purchase restoration...');

      const result = await subscriptionService.restorePurchases();

      if (result.success && result.customerInfo) {
        // Update subscription status with restored customer info
        updateSubscriptionStatus(result.customerInfo);

        // Update cache
        subscriptionStatusCache.updateStatus(result.customerInfo).catch(error => {
          console.error('Error updating subscription cache after restore:', error);
        });
        console.log('Purchases restored successfully');
      } else {
        // Restore completed but no active subscriptions found
        const errorMessage = result.error || 'No active subscriptions found to restore';
        setLastError(errorMessage);
        console.log('Restore completed but no active subscriptions:', errorMessage);
      }
    } catch (error: any) {
      console.error('Restore error:', error);

      // Check if it's a configuration error
      if (error instanceof Error && error.message.includes('not properly configured')) {
        setLastError('Subscription service not available. Please configure RevenueCat API keys.');
        return;
      }

      const errorMessage = error instanceof Error ? error.message : 'Failed to restore purchases';
      setLastError(errorMessage);
    } finally {
      setRestoreLoading(false);
    }
  }, [restoreLoading, clearError, updateSubscriptionStatus]);

  /**
   * Initialize subscription and beta status on mount
   */
  useEffect(() => {
    // Skip both subscription and beta initialization in Expo Go
    if (Platform.OS === 'web' || Constants.executionEnvironment === 'storeClient') {
      return;
    }
    
    // Log DEV mode behavior at startup
    if (__DEV__) {
      console.log('🚀 DEV MODE: Subscription will always be active in development environment');
      console.log('   This overrides actual subscription status for testing purposes');
    }
    
    initializeBetaStatus();
    initializeSubscription();
  }, [initializeBetaStatus, initializeSubscription]);

  return {
    // Subscription state
    isSubscribed: getIsSubscribed(),
    setIsSubscribed,
    offerings,
    customerInfo,

    // Loading states
    purchaseLoading,
    restoreLoading,
    offeringsLoading,

    // Actions
    purchaseSubscription,
    restorePurchases,
    refreshCustomerInfo,

    // Error handling
    lastError,
    clearError,
  };
};

export default useSubscription;
