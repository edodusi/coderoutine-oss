/**
 * RevenueCat Configuration
 *
 * This file defines the RevenueCat entitlement identifiers used throughout the app.
 * With RevenueCat, we focus on entitlements (what the user has access to) rather than
 * specific product IDs (what they purchased).
 */

// Primary entitlement ID for premium features
// This should match the entitlement ID configured in your RevenueCat dashboard
export const PREMIUM_ENTITLEMENT_ID = 'coderoutine_monthly_subscription';

// Additional entitlement IDs for future use
export const ENTITLEMENTS = {
  PREMIUM: PREMIUM_ENTITLEMENT_ID,
  // Add more entitlements here as needed, e.g.:
  // PRO: 'pro',
  // ENTERPRISE: 'enterprise',
} as const;

// Premium features that require the premium entitlement
export const PREMIUM_FEATURES = {
  AI_SUMMARIES: 'ai_summaries',
  TRANSLATIONS: 'translations',
  AD_FREE: 'ad_free',
  UNLIMITED_FAVORITES: 'unlimited_favorites',
  OFFLINE_READING: 'offline_reading',
  CUSTOM_THEMES: 'custom_themes',
} as const;

// Helper function to check if a feature requires premium access
export const isPremiumFeature = (feature: string): boolean => {
  return Object.values(PREMIUM_FEATURES).includes(feature as any);
};

// Type definitions for TypeScript support
export type EntitlementId = typeof ENTITLEMENTS[keyof typeof ENTITLEMENTS];
export type PremiumFeature = typeof PREMIUM_FEATURES[keyof typeof PREMIUM_FEATURES];
