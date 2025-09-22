import Constants from 'expo-constants';

export interface AppConfig {
  apiBaseUrl: string;
  accessToken: string;
  isDevelopment: boolean;
  version: string;
  timeout: {
    api: number;
    analytics: number;
    aiSummary: number;
  };
  features: {
    analytics: boolean;
    notifications: boolean;
    offline: boolean;
  };
  subscription: {
    // In development mode, subscription is always active regardless of actual purchase status
    // This allows developers to test premium features without requiring actual purchases
    devModeAlwaysActive: boolean;
  };
}

// Get environment-specific configuration
const getApiBaseUrl = (): string => {
  // Check for environment variable first (Expo's public env vars)
  const envApiUrl = process.env.EXPO_PUBLIC_API_BASE_URL;
  if (envApiUrl) {
    return envApiUrl;
  }

  // Fallback to app.json config
  const configApiUrl = Constants.expoConfig?.extra?.apiBaseUrl;
  if (configApiUrl) {
    return configApiUrl;
  }

  // Development vs Production URLs
  if (__DEV__) {
    // For development, you can switch between local and cloud
    const useLocalApi = process.env.EXPO_PUBLIC_USE_LOCAL_API === 'true' || 
                       Constants.expoConfig?.extra?.useLocalApi === 'true';

    if (useLocalApi) {
      return 'http://localhost:8080';
    } else {
      // Use the cloud function in development too
      return 'https://europe-west8-coderoutine-edo.cloudfunctions.net/coderoutine-api';
    }
  }

  // Production URL
  return 'https://europe-west8-coderoutine-edo.cloudfunctions.net/coderoutine-api';
};

// Get access token from environment variables
const getAccessToken = (): string => {
  // First try environment variable (preferred method)
  const envToken = process.env.EXPO_PUBLIC_ACCESS_TOKEN;
  if (envToken) {
    if (envToken.includes('your-secure-access-token-here') || envToken === 'your-token-here') {
      console.warn('⚠️ Using placeholder access token. Please generate a secure token.');
    } else {
      console.log('✅ Access token loaded from environment variables');
    }
    return envToken;
  }

  // Fallback to app.json (deprecated method)
  const configToken = Constants.expoConfig?.extra?.accessToken;
  if (configToken) {
    console.warn('⚠️ Access token loaded from app.json (deprecated). Please use environment variables.');
    return configToken;
  }

  // No token found
  console.error('❌ Access token not configured');
  console.error('Please set up your environment variables:');
  console.error('1. Copy env.template to .env: cp env.template .env');
  console.error('2. Generate a token: npm run generate-token');
  console.error('3. Set EXPO_PUBLIC_ACCESS_TOKEN in your .env file');
  throw new Error('Access token not configured. Please set EXPO_PUBLIC_ACCESS_TOKEN environment variable.');
};

// Main app configuration
export const appConfig: AppConfig = {
  apiBaseUrl: getApiBaseUrl(),
  accessToken: getAccessToken(),
  isDevelopment: __DEV__,
  version: Constants.expoConfig?.version || '1.0.0',

  timeout: {
    api: 15000, // 15 seconds for regular API requests
    analytics: 5000, // 5 seconds for analytics (non-critical)
    aiSummary: 90000, // 90 seconds for AI summary generation (can take 60+ seconds)
  },

  features: {
    analytics: true, // Enable analytics logging
    notifications: true, // Enable push notifications
    offline: true, // Enable offline support
  },

  subscription: {
    // DEV MODE: Subscription is always active in development to enable testing of premium features
    devModeAlwaysActive: __DEV__,
  },
};

// Environment-specific overrides
if (__DEV__) {
  // Development-specific settings
  appConfig.timeout.api = 30000; // 30 seconds for development
  appConfig.timeout.aiSummary = 120000; // 120 seconds for AI summary in development

  console.log('🔧 App Configuration (Development):', {
    apiBaseUrl: appConfig.apiBaseUrl,
    version: appConfig.version,
    features: appConfig.features,
    subscription: appConfig.subscription,
    hasAccessToken: !!appConfig.accessToken,
  });
} else {
  // Production-specific settings
  console.log('🚀 App Configuration (Production):', {
    apiBaseUrl: appConfig.apiBaseUrl,
    version: appConfig.version,
    hasAccessToken: !!appConfig.accessToken,
  });
}

export default appConfig;
