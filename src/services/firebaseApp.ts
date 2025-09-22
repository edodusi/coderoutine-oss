let firebase: any = null;
let crashlytics: any = null;

// Conditional imports to prevent crashes in Expo Go
try {
  firebase = require('@react-native-firebase/app').firebase;
  crashlytics = require('@react-native-firebase/crashlytics').default;
} catch (error) {
  console.warn('Firebase modules not available (likely running in Expo Go):', error instanceof Error ? error.message : error);
}

class FirebaseApp {
  private static instance: FirebaseApp;
  private initialized = false;

  private constructor() {}

  static getInstance(): FirebaseApp {
    if (!FirebaseApp.instance) {
      FirebaseApp.instance = new FirebaseApp();
    }
    return FirebaseApp.instance;
  }

  /**
   * Initialize Firebase app and Crashlytics
   */
  async initialize(): Promise<boolean> {
    try {
      if (this.initialized) {
        console.log('Firebase app already initialized');
        return true;
      }

      // Check if Firebase is available and properly configured
      if (!firebase) {
        console.warn('Firebase not available - likely running in Expo Go. Crashlytics will be disabled.');
        return false;
      }

      if (!firebase.apps.length) {
        console.error('No Firebase apps found. Make sure google-services.json/GoogleService-Info.plist are properly configured.');
        return false;
      }

      // Initialize Crashlytics
      await this.initializeCrashlytics();

      this.initialized = true;
      console.log('✅ Firebase app initialized successfully');
      return true;
    } catch (error) {
      console.error('Error initializing Firebase app:', error);
      this.logError('FirebaseApp initialization failed', error);
      return false;
    }
  }

  /**
   * Initialize Crashlytics service
   */
  private async initializeCrashlytics(): Promise<void> {
    try {
      // Check if Crashlytics is available
      if (!crashlytics || !crashlytics()) {
        console.warn('Crashlytics not available - likely running in Expo Go or unsupported platform');
        return;
      }

      // Enable crash collection
      await crashlytics().setCrashlyticsCollectionEnabled(true);

      // Set user ID if available (can be updated later when you add authentication)
      crashlytics().setUserId('anonymous-user');

      // Set custom app version info
      crashlytics().setAttribute('app_version', '1.0.0');
      crashlytics().setAttribute('environment', __DEV__ ? 'development' : 'production');

      console.log('✅ Crashlytics initialized successfully');
    } catch (error) {
      console.error('Error initializing Crashlytics:', error);
      throw error;
    }
  }

  /**
   * Log a non-fatal error to Crashlytics
   */
  logError(message: string, error?: any): void {
    try {
      if (!this.initialized || !crashlytics || !crashlytics()) {
        console.log('Crashlytics not available, logging to console:', message, error);
        return;
      }

      // Log to Crashlytics
      if (error instanceof Error) {
        crashlytics().recordError(error);
      } else if (typeof error === 'string') {
        crashlytics().log(message + ': ' + error);
      } else {
        crashlytics().log(message);
      }

      // Also log to console for development
      if (__DEV__) {
        console.error(message, error);
      }
    } catch (e) {
      console.error('Error logging to Crashlytics:', e);
    }
  }

  /**
   * Log a custom event to Crashlytics
   */
  logEvent(event: string, parameters?: Record<string, any>): void {
    try {
      if (!this.initialized || !crashlytics || !crashlytics()) {
        console.log('Crashlytics not available, logging event to console:', event, parameters);
        return;
      }

      crashlytics().log(`Event: ${event}`);

      if (parameters) {
        Object.entries(parameters).forEach(([key, value]) => {
          crashlytics().setAttribute(key, String(value));
        });
      }

      // Removed console.log for cleaner development logs
    } catch (error) {
      console.error('Error logging event to Crashlytics:', error);
    }
  }

  /**
   * Set user identifier for crash reports
   */
  setUserId(userId: string): void {
    try {
      if (!this.initialized || !crashlytics || !crashlytics()) {
        console.log('Crashlytics not available, cannot set user ID');
        return;
      }

      crashlytics().setUserId(userId);
      console.log('User ID set for Crashlytics:', userId);
    } catch (error) {
      console.error('Error setting user ID in Crashlytics:', error);
    }
  }

  /**
   * Set custom attributes for crash reports
   */
  setCustomAttribute(key: string, value: string): void {
    try {
      if (!this.initialized || !crashlytics || !crashlytics()) {
        console.log('Crashlytics not available, cannot set custom attribute');
        return;
      }

      crashlytics().setAttribute(key, value);
      if (__DEV__) {
        console.log(`Custom attribute set: ${key} = ${value}`);
      }
    } catch (error) {
      console.error('Error setting custom attribute in Crashlytics:', error);
    }
  }

  /**
   * Test crash functionality (only use in development)
   */
  testCrash(): void {
    if (!__DEV__) {
      console.warn('Test crash should only be used in development');
      return;
    }

    if (!this.initialized || !crashlytics || !crashlytics()) {
      console.log('Crashlytics not available, cannot test crash');
      return;
    }

    console.log('Testing Crashlytics crash reporting...');
    crashlytics().crash();
  }

  /**
   * Force a crash report to be sent (for testing)
   */
  async sendUnsentReports(): Promise<void> {
    try {
      if (!this.initialized || !crashlytics || !crashlytics()) {
        console.log('Crashlytics not available, cannot send unsent reports');
        return;
      }

      await crashlytics().sendUnsentReports();
      console.log('Unsent crash reports sent to Crashlytics');
    } catch (error) {
      console.error('Error sending unsent reports:', error);
    }
  }

  /**
   * Check if the app crashed on the previous run
   */
  async didCrashOnPreviousExecution(): Promise<boolean> {
    try {
      if (!this.initialized || !crashlytics || !crashlytics()) {
        return false;
      }

      return await crashlytics().didCrashOnPreviousExecution();
    } catch (error) {
      console.error('Error checking previous crash status:', error);
      return false;
    }
  }

  /**
   * Get Crashlytics instance (for advanced usage)
   */
  getCrashlyticsInstance() {
    if (!this.initialized || !crashlytics) {
      console.warn('Firebase app not initialized or Crashlytics not available');
      return null;
    }
    return crashlytics();
  }

  /**
   * Check if Firebase and Crashlytics are properly initialized
   */
  isInitialized(): boolean {
    return this.initialized;
  }
}

export const firebaseApp = FirebaseApp.getInstance();
export default firebaseApp;