/**
 * RevenueCat Configuration
 *
 * IMPORTANT: You need to configure your RevenueCat API keys here or via environment variables.
 *
 * To get your API keys:
 * 1. Go to https://app.revenuecat.com/
 * 2. Navigate to your project
 * 3. Go to "Project Settings" > "API Keys"
 * 4. Copy your Apple App Store API key and Google Play API key
 *
 * Option 1: Environment Variables (Recommended)
 * Add these to your .env file:
 * EXPO_PUBLIC_REVENUECAT_APPLE_API_KEY=appl_xxxxxxxxxxxxxxxxx
 * EXPO_PUBLIC_REVENUECAT_GOOGLE_API_KEY=goog_xxxxxxxxxxxxxxxxx
 *
 * Option 2: Direct Configuration (for testing)
 * Replace the placeholder values below with your actual API keys
 */

import { Platform } from 'react-native';
import Constants from 'expo-constants';

// RevenueCat API Keys Configuration
export const REVENUECAT_CONFIG = {
  // Get these from RevenueCat Dashboard > Project Settings > API Keys
  apiKeys: {
    // Apple App Store API Key (starts with "appl_")
    apple: process.env.EXPO_PUBLIC_REVENUECAT_APPLE_API_KEY || 'REPLACE_WITH_YOUR_APPLE_API_KEY',

    // Google Play API Key (starts with "goog_")
    google: process.env.EXPO_PUBLIC_REVENUECAT_GOOGLE_API_KEY || 'REPLACE_WITH_YOUR_GOOGLE_API_KEY',
  },

  // Development settings
  development: {
    // Enable debug logging in development
    enableDebugLogs: __DEV__,

    // Skip initialization if API keys are not configured (prevents crashes during development)
    skipInitializationOnInvalidKeys: __DEV__,
  },
};

/**
 * Get the appropriate API key for the current platform
 */
export const getCurrentPlatformApiKey = (): string => {
  return Platform.OS === 'android'
    ? REVENUECAT_CONFIG.apiKeys.google
    : REVENUECAT_CONFIG.apiKeys.apple;
};

/**
 * Validate if the API key is properly configured
 */
export const isApiKeyValid = (apiKey: string): boolean => {
  if (!apiKey) return false;

  // Check for placeholder values
  const placeholders = [
    'REPLACE_WITH_YOUR_APPLE_API_KEY',
    'REPLACE_WITH_YOUR_GOOGLE_API_KEY',
    'your_revenuecat_apple_api_key',
    'your_revenuecat_google_api_key',
    'appl_xxxxxxxxxxxxxxxxx',
    'goog_xxxxxxxxxxxxxxxxx',
  ];

  if (placeholders.includes(apiKey)) return false;

  // Check if it starts with the correct prefix
  const isAppleKey = apiKey.startsWith('appl_');
  const isGoogleKey = apiKey.startsWith('goog_');

  return isAppleKey || isGoogleKey;
};

/**
 * Get validation status for current platform
 */
export const getApiKeyValidationStatus = (): {
  isValid: boolean;
  apiKey: string;
  platform: string;
  errorMessage?: string;
} => {
  const apiKey = getCurrentPlatformApiKey();
  const platform = Platform.OS;
  const isValid = isApiKeyValid(apiKey);

  let errorMessage: string | undefined;

  if (!isValid) {
    errorMessage = `Invalid ${platform === 'ios' ? 'Apple' : 'Google'} API key. Please configure your RevenueCat API keys in src/config/revenueCatConfig.ts or via environment variables.`;
  }

  return {
    isValid,
    apiKey,
    platform,
    errorMessage,
  };
};

/**
 * Log configuration status (helpful for debugging)
 */
export const logConfigurationStatus = (): void => {
  if (!__DEV__) {
    return;
  }

  // Skip configuration warnings in Expo Go - billing isn't available anyway
  if (Constants.executionEnvironment === 'storeClient') {
    console.log('📱 RevenueCat configuration skipped in Expo Go - this is normal in development');
    return;
  }

  const status = getApiKeyValidationStatus();

  console.log('=== RevenueCat Configuration Status ===');
  console.log(`Platform: ${status.platform}`);
  console.log(`API Key Valid: ${status.isValid}`);
  console.log(`API Key Preview: ${status.apiKey.substring(0, 10)}...`);
  console.log('');

  if (!status.isValid) {
    console.error('❌ RevenueCat Configuration Error:');
    console.error(status.errorMessage);
    console.error('');
    console.error('To fix this:');
    console.error('1. Get your API keys from https://app.revenuecat.com/');
    console.error('2. Go to Project Settings > API Keys');
    console.error('3. Copy your Apple App Store and Google Play API keys');
    console.error('4. Add them to your .env file or update src/config/revenueCatConfig.ts');
    console.error('');
    console.error('Environment variables:');
    console.error('EXPO_PUBLIC_REVENUECAT_APPLE_API_KEY=appl_your_key_here');
    console.error('EXPO_PUBLIC_REVENUECAT_GOOGLE_API_KEY=goog_your_key_here');
  } else {
    console.log('✅ RevenueCat is properly configured');
  }

  console.log('=====================================');
};
