import React, { useCallback, useRef } from 'react';
import { useApp } from '../context/AppContext';
import { useModal } from '../context/ModalContext';
import { useNavigation } from '@react-navigation/native';
import { subscriptionService } from '../services/subscriptionService';
import { firebaseApp } from '../services/firebaseApp';

// Cache for entitlement verification to avoid excessive API calls
interface EntitlementCache {
  isValid: boolean;
  timestamp: number;
  ttl: number; // Time to live in milliseconds
}

const ENTITLEMENT_CACHE_TTL = 5 * 1000; // 5 seconds for faster refresh after purchase

// Global cache clearing mechanism for immediate post-purchase access
let globalCacheClearCallback: (() => void) | null = null;

export const clearAllPremiumAccessCaches = () => {
  console.log('🗑️ Clearing all premium access caches globally');
  if (globalCacheClearCallback) {
    globalCacheClearCallback();
  }
};

export interface PremiumAccessResult {
  hasAccess: boolean;
  checkAccess: () => boolean;
  clearEntitlementCache: () => void;
}

/**
 * Hook for managing premium feature access
 * Provides a unified way to check subscription status and show premium modals
 * Includes real-time entitlement verification for security
 */
export const usePremiumAccess = () => {
  const { isSubscribed, refreshSubscriptionStatus } = useApp();
  const { showPremiumRequiredModal } = useModal();
  const navigation = useNavigation();
  const entitlementCache = useRef<EntitlementCache | null>(null);

  // Register global cache clear callback
  React.useEffect(() => {
    globalCacheClearCallback = () => {
      console.log('🗑️ Premium access cache cleared via global callback');
      entitlementCache.current = null;
    };

    return () => {
      globalCacheClearCallback = null;
    };
  }, []);

  /**
   * Check if cached entitlement is still valid
   */
  const isCacheValid = useCallback((): boolean => {
    if (!entitlementCache.current) return false;

    const now = Date.now();
    const cacheAge = now - entitlementCache.current.timestamp;
    return cacheAge < entitlementCache.current.ttl;
  }, []);

  /**
   * Update entitlement cache
   */
  const updateCache = useCallback((isValid: boolean): void => {
    entitlementCache.current = {
      isValid,
      timestamp: Date.now(),
      ttl: ENTITLEMENT_CACHE_TTL,
    };
  }, []);

  /**
   * Clear entitlementCache - useful after purchases or subscription changes
   */
  const clearEntitlementCache = useCallback((): void => {
    console.log('🗑️ Clearing entitlement cache');
    entitlementCache.current = null;
  }, []);

  /**
   * Check if user has premium access with real-time entitlement verification
   * This method verifies entitlements with the subscription service to catch
   * expired, cancelled, or refunded subscriptions immediately
   * @param featureName - Name of the feature being accessed (for display in modal)
   * @returns Promise that resolves to true if user has access, false if modal was shown
   */
  const checkPremiumAccess = useCallback(async (featureName: string): Promise<boolean> => {
    const startTime = Date.now();

    try {
      // Log to analytics for monitoring feature usage
      firebaseApp.logEvent('premium_feature_access_attempt', {
        featureName,
        cachedSubscriptionStatus: isSubscribed,
        timestamp: new Date().toISOString(),
      });

      // Always do real-time verification for subscribers to catch immediate changes
      if (isSubscribed) {
        const hasActiveEntitlement = await subscriptionService.hasActiveEntitlement();

        // Update cache with fresh result
        updateCache(hasActiveEntitlement);

        if (hasActiveEntitlement) {
          const verificationTime = Date.now() - startTime;

          // Log successful access
          firebaseApp.logEvent('premium_access_granted', {
            featureName,
            verificationMethod: 'real_time_entitlement',
            verificationTimeMs: verificationTime,
            timestamp: new Date().toISOString(),
          });

          return true;
        } else {
          const verificationTime = Date.now() - startTime;

          // Clear cache and refresh subscription status
          entitlementCache.current = null;
          try {
            await refreshSubscriptionStatus();
          } catch (refreshError) {
            firebaseApp.logError('Failed to refresh subscription status after entitlement verification failed', refreshError);
          }

          // Log access denied with details
          firebaseApp.logEvent('premium_access_denied', {
            featureName,
            reason: 'subscription_expired_or_cancelled',
            hadCachedAccess: isSubscribed,
            verificationTimeMs: verificationTime,
            timestamp: new Date().toISOString(),
          });

          // Show premium required modal
          showPremiumRequiredModal(featureName, () => {
            (navigation as any).navigate('Subscription');
          });

          return false;
        }
      }

      // For non-subscribers, show modal immediately
      updateCache(false);

      // Log blocked access attempt
      firebaseApp.logEvent('premium_access_blocked', {
        featureName,
        reason: 'cached_status_not_subscribed',
        timestamp: new Date().toISOString(),
      });

      showPremiumRequiredModal(featureName, () => {
        (navigation as any).navigate('Subscription');
      });
      return false;
    } catch (error) {
      const verificationTime = Date.now() - startTime;

      // Log error for monitoring
      firebaseApp.logError(`Premium access verification failed for ${featureName}`, error instanceof Error ? error : new Error(String(error)));
      firebaseApp.logEvent('premium_access_verification_error', {
        featureName,
        errorMessage: error instanceof Error ? error.message : String(error),
        hadCachedAccess: isSubscribed,
        verificationTimeMs: verificationTime,
        timestamp: new Date().toISOString(),
      });

      // Clear cache on error to ensure fresh check next time
      entitlementCache.current = null;

      // On error, fall back to cached subscription status
      // This ensures the app still works even if there are network issues
      if (isSubscribed) {
        firebaseApp.logEvent('premium_access_fallback_granted', {
          featureName,
          reason: 'verification_error_fallback_to_cached',
          timestamp: new Date().toISOString(),
        });

        return true;
      } else {
        firebaseApp.logEvent('premium_access_fallback_denied', {
          featureName,
          reason: 'verification_error_no_cached_access',
          timestamp: new Date().toISOString(),
        });

        showPremiumRequiredModal(featureName, () => {
          (navigation as any).navigate('Subscription');
        });
        return false;
      }
    }
  }, [isSubscribed, showPremiumRequiredModal, navigation, refreshSubscriptionStatus, isCacheValid, updateCache]);

  /**
   * Synchronously check if user has premium access based on cached status
   * Use this for conditional UI rendering (non-blocking)
   * For actual feature access, always use checkPremiumAccess()
   */
  const hasPremiumAccess = useCallback((): boolean => {
    return isSubscribed;
  }, [isSubscribed]);

  return {
    hasAccess: isSubscribed,
    checkPremiumAccess,
    hasPremiumAccess,
    clearEntitlementCache,
  };
};
