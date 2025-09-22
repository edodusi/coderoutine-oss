import { Platform } from 'react-native';
import * as Application from 'expo-application';
import Constants from 'expo-constants';
import Purchases, {
  PurchasesOffering,
  PurchasesPackage,
  CustomerInfo,
  MakePurchaseResult
} from 'react-native-purchases';
import { PREMIUM_ENTITLEMENT_ID } from '../config/iapProducts';
import {
  REVENUECAT_CONFIG,
  getApiKeyValidationStatus,
  logConfigurationStatus
} from '../config/revenueCatConfig';

import { BetaStatusService } from './beta';

export interface PurchaseResult {
  success: boolean;
  error?: string;
  customerInfo?: CustomerInfo;
}

class SubscriptionService {
  private static instance: SubscriptionService;
  private _isInitialized = false;

  private constructor() {}

  static getInstance(): SubscriptionService {
    if (!SubscriptionService.instance) {
      SubscriptionService.instance = new SubscriptionService();
    }
    return SubscriptionService.instance;
  }

  /**
   * Initialize RevenueCat SDK and log in user
   */
  async initialize(): Promise<void> {
    if (this._isInitialized || Constants.executionEnvironment === 'storeClient' || Platform.OS === 'web') {
      return;
    }

    try {
      // Log configuration status for debugging
      if (__DEV__) {
        logConfigurationStatus();
      }

      // Get and validate API key for current platform
      const validationStatus = getApiKeyValidationStatus();

      if (!validationStatus.isValid) {
        if (REVENUECAT_CONFIG.development.skipInitializationOnInvalidKeys) {
          console.warn('⚠️ Skipping RevenueCat initialization due to invalid API key');
          console.warn('This is normal during development if you haven\'t configured your API keys yet.');
          return;
        }
        throw new Error(validationStatus.errorMessage);
      }

      const apiKey = validationStatus.apiKey;

      if (REVENUECAT_CONFIG.development.enableDebugLogs) {
        Purchases.setLogLevel(Purchases.LOG_LEVEL.DEBUG);
        console.log(`✅ Configuring RevenueCat for ${validationStatus.platform} with API key: ${apiKey.substring(0, 15)}...`);
      }

      await Purchases.configure({ apiKey });

      // Log in user with their installation ID for better analytics and user tracking
      const installationId = await this.getInstallationId();
      await Purchases.logIn(installationId);

      this._isInitialized = true;
      console.log('✅ RevenueCat initialized successfully');
    } catch (error) {
      console.error('❌ Failed to initialize RevenueCat:', error);

      // In development, don't crash the app if API keys are not configured
      if (__DEV__ && REVENUECAT_CONFIG.development.skipInitializationOnInvalidKeys) {
        console.warn('⚠️ RevenueCat initialization failed, continuing without subscription functionality');
        console.warn('To enable subscriptions, please configure your API keys in src/config/revenueCatConfig.ts');
        return;
      }

      throw error;
    }
  }

  /**
   * Get current offerings from RevenueCat
   */
  async getOfferings(): Promise<PurchasesOffering | null> {
    try {
      await this.ensureInitialized();
      const offerings = await Purchases.getOfferings();
      return offerings.current;
    } catch (error) {
      // Suppress billing errors in Expo Go development environment
      if (Constants.executionEnvironment === 'storeClient') {
        console.warn('RevenueCat offerings unavailable in Expo Go - this is normal in development');
        throw new Error('Billing services unavailable in development environment');
      }
      console.error('Failed to fetch offerings:', error);
      throw error;
    }
  }

  /**
   * Purchase a specific package
   */
  async purchasePackage(packageToPurchase: PurchasesPackage): Promise<PurchaseResult> {
    try {
      await this.ensureInitialized();

      console.log('Starting purchase for package:', packageToPurchase.identifier);

      const result: MakePurchaseResult = await Purchases.purchasePackage(packageToPurchase);

      // Check if user now has the premium entitlement
      // In DEV mode or beta mode, always consider entitlement as active
      let hasEntitlement = __DEV__;
      if (!hasEntitlement) {
        try {
          const betaStatusService = BetaStatusService.getInstance();
          const hasBetaAccess = await betaStatusService.hasBetaAccess();
          hasEntitlement = hasBetaAccess || result.customerInfo.entitlements.active[PREMIUM_ENTITLEMENT_ID] !== undefined;
        } catch (error) {
          console.error('Error checking beta status during purchase:', error);
          hasEntitlement = result.customerInfo.entitlements.active[PREMIUM_ENTITLEMENT_ID] !== undefined;
        }
      }

      if (hasEntitlement) {
        console.log('Purchase successful - premium entitlement activated');
        return {
          success: true,
          customerInfo: result.customerInfo
        };
      } else {
        console.log('Purchase completed but premium entitlement not found');
        return {
          success: false,
          error: 'Purchase completed but premium access not activated',
          customerInfo: result.customerInfo
        };
      }
    } catch (error: any) {
      console.error('Purchase failed:', error);
      return {
        success: false,
        error: this.formatErrorMessage(error)
      };
    }
  }

  /**
   * Restore purchases for the current user
   */
  async restorePurchases(): Promise<PurchaseResult> {
    try {
      await this.ensureInitialized();

      console.log('Restoring purchases...');

      const customerInfo = await Purchases.restorePurchases();

      // Check if user has premium entitlement after restore
      // In DEV mode or beta mode, always consider entitlement as active
      let hasEntitlement = __DEV__;
      if (!hasEntitlement) {
        try {
          const betaStatusService = BetaStatusService.getInstance();
          const hasBetaAccess = await betaStatusService.hasBetaAccess();
          hasEntitlement = hasBetaAccess || customerInfo.entitlements.active[PREMIUM_ENTITLEMENT_ID] !== undefined;
        } catch (error) {
          console.error('Error checking beta status during restore:', error);
          hasEntitlement = customerInfo.entitlements.active[PREMIUM_ENTITLEMENT_ID] !== undefined;
        }
      }

      return {
        success: hasEntitlement,
        customerInfo,
        error: hasEntitlement ? undefined : 'No active premium subscription found'
      };
    } catch (error: any) {
      console.error('Failed to restore purchases:', error);
      return {
        success: false,
        error: this.formatErrorMessage(error)
      };
    }
  }

  /**
   * Check if RevenueCat is initialized
   */
  get isInitialized(): boolean {
    return this._isInitialized;
  }

  /**
   * Get current customer info from RevenueCat
   */
  async getCustomerInfo(): Promise<CustomerInfo> {
    try {
      await this.ensureInitialized();
      return await Purchases.getCustomerInfo();
    } catch (error) {
      // Suppress billing errors in Expo Go development environment
      if (Constants.executionEnvironment === 'storeClient') {
        console.warn('RevenueCat customer info unavailable in Expo Go - this is normal in development');
        throw new Error('Billing services unavailable in development environment');
      }
      console.error('Failed to get customer info:', error);
      throw error;
    }
  }

  /**
   * Check if user has active premium entitlement
   */
  async hasActiveEntitlement(entitlementId: string = PREMIUM_ENTITLEMENT_ID): Promise<boolean> {
    // In DEV mode, always return true to bypass subscription checks
    if (__DEV__) {
      console.log('🚀 DEV mode: hasActiveEntitlement returning true');
      return true;
    }

    // Check beta status first
    try {
      const betaStatusService = BetaStatusService.getInstance();
      const hasBetaAccess = await betaStatusService.hasBetaAccess();
      if (hasBetaAccess) {
        console.log('🚀 Beta access: hasActiveEntitlement returning true');
        return true;
      }
    } catch (error) {
      console.error('Error checking beta status:', error);
      // Continue with normal entitlement check
    }

    try {
      const customerInfo = await this.getCustomerInfo();
      return customerInfo.entitlements.active[entitlementId] !== undefined;
    } catch (error) {
      console.error('Failed to check entitlement:', error);
      return false;
    }
  }

  /**
   * Get unique installation ID for user identification
   */
  private async getInstallationId(): Promise<string> {
    try {
      // Create a unique identifier based on app installation
      const instanceId = Application.applicationId || 'unknown';
      const installTime = Application.getInstallationTimeAsync ?
        String(await Application.getInstallationTimeAsync()) :
        String(Date.now());

      const platformPrefix = Platform.OS === 'ios' ? 'ios' : 'android';
      return `${platformPrefix}_${instanceId}_${installTime}`;
    } catch (error) {
      console.error('Failed to get installation ID:', error);
      // Fallback to timestamp-based ID
      const platformPrefix = Platform.OS === 'ios' ? 'ios' : 'android';
      return `${platformPrefix}_coderoutine_${Date.now()}`;
    }
  }

  /**
   * Ensure RevenueCat is initialized before making calls
   */
  private async ensureInitialized(): Promise<void> {
    // Skip entirely in Expo Go - don't even try to initialize
    if (Constants.executionEnvironment === 'storeClient' || Platform.OS === 'web') {
      throw new Error('Billing services unavailable in development environment');
    }

    if (!this._isInitialized) {
      await this.initialize();
    }

    // If still not initialized (e.g., due to invalid API key in dev), throw error
    if (!this._isInitialized) {
      const validationStatus = getApiKeyValidationStatus();
      throw new Error(
        validationStatus.errorMessage ||
        'RevenueCat is not properly configured. Please check your API keys in src/config/revenueCatConfig.ts'
      );
    }
  }

  /**
   * Format error messages for user display
   */
  private formatErrorMessage(error: any): string {
    if (error?.code) {
      switch (error.code) {
        case 'PURCHASE_CANCELLED':
        case 'USER_CANCELLED':
          return 'Purchase was cancelled';
        case 'STORE_PROBLEM':
          return 'Store unavailable - please try again later';
        case 'PURCHASE_NOT_ALLOWED':
          return 'Purchase not allowed';
        case 'PURCHASE_INVALID':
          return 'Purchase is invalid';
        case 'PRODUCT_NOT_AVAILABLE':
          return 'Product is not available';
        case 'NETWORK_ERROR':
          return 'Network error - please check your connection';
        default:
          return error.message || 'An unexpected error occurred';
      }
    }

    if (error instanceof Error) {
      if (error.message.includes('cancelled') || error.message.includes('canceled')) {
        return 'Purchase was cancelled by user';
      } else if (error.message.includes('unavailable')) {
        return 'Subscription is not available';
      } else if (error.message.includes('network')) {
        return 'Network error occurred during purchase';
      }
      return error.message;
    }

    return 'Unknown error occurred';
  }

  /**
   * Check if error should be shown to user (hide cancellation errors)
   */
  shouldShowError(error: any): boolean {
    if (error?.code === 'PURCHASE_CANCELLED' || error?.code === 'USER_CANCELLED') {
      return false;
    }

    if (error instanceof Error) {
      const message = error.message.toLowerCase();
      if (message.includes('cancelled') || message.includes('canceled') ||
          message.includes('user cancelled') || message.includes('user canceled') ||
          message.includes('purchase was cancelled') || message.includes('purchase was canceled')) {
        return false;
      }
    }

    // Check for string messages
    if (typeof error === 'string') {
      const message = error.toLowerCase();
      if (message.includes('cancelled') || message.includes('canceled')) {
        return false;
      }
    }

    // Check for message property
    if (error?.message && typeof error.message === 'string') {
      const message = error.message.toLowerCase();
      if (message.includes('cancelled') || message.includes('canceled')) {
        return false;
      }
    }

    return true;
  }
}

export const subscriptionService = SubscriptionService.getInstance();
export default subscriptionService;
