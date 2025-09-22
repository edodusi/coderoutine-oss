import * as Notifications from 'expo-notifications';
import * as Device from 'expo-device';
import { Platform } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
const PUSH_TOKEN_KEY = 'expo_push_token';
const NOTIFICATIONS_PREFERENCE_KEY = 'notifications_preference';
const REGISTRATION_STATUS_KEY = 'notification_registration_status';
const LAST_INITIALIZATION_KEY = 'notification_last_init';
const ONBOARDING_COMPLETED_KEY = 'notification_onboarding_completed';

// Configure notification handler
Notifications.setNotificationHandler({
  handleNotification: async (notification) => {
    // Check if this notification is for an article that's already been read
    const notificationData = notification.request.content.data;
    const articleId = notificationData?.articleId;

    console.log('🔔 Incoming notification:', {
      title: notification.request.content.title,
      articleId: articleId,
      articleTitle: notificationData?.articleTitle,
    });

    if (articleId && typeof articleId === 'string') {
      try {
        // Import storageService to check if article is already read
        const { storageService } = await import('../services/storageService');
        const articleHistory = await storageService.getArticleHistory();
        const articleProgress = articleHistory.find(p => p.articleId === articleId);

        if (articleProgress?.isRead) {
          console.log(`📖 Suppressing notification - article ${articleId} already read at ${articleProgress.readAt}`);
          return {
            shouldShowAlert: false,
            shouldPlaySound: false,
            shouldSetBadge: false,
            shouldShowBanner: false,
            shouldShowList: false,
            shouldShowInForeground: false,
          };
        } else {
          console.log(`📬 Showing notification - article ${articleId} "${notificationData?.articleTitle}" not yet read`);
        }
      } catch (error) {
        console.error('Error checking article read status for notification:', error);
        console.log('🔔 Showing notification anyway (fail safe)');
        // If we can't check, show the notification anyway (fail safe)
      }
    } else {
      console.log('🔔 Showing notification - no articleId provided');
    }

    return {
      shouldShowAlert: true,
      shouldPlaySound: true,
      shouldSetBadge: false,
      shouldShowBanner: true,
      shouldShowList: true,
      shouldShowInForeground: true,
    };
  },
});

export interface NotificationServiceInterface {
  registerForPushNotifications: () => Promise<string | null>;
  getExpoPushToken: () => Promise<string | null>;
  requestPermissions: () => Promise<boolean>;
  requestPermissionsWithContext: () => Promise<{ granted: boolean; userAction: 'granted' | 'denied' | 'cancelled' }>;
  areNotificationsEnabled: () => Promise<boolean>;
  setNotificationsEnabled: (enabled: boolean) => Promise<void>;
  setupNotificationChannels: () => Promise<void>;
  sendTokenToServer: (token: string) => Promise<void>;
  sendTokenToServerWithCache: (token: string) => Promise<void>;
  unregisterFromServer: (token: string) => Promise<void>;
  getNotificationPreference: () => Promise<boolean | null>;
  setNotificationPreference: (enabled: boolean) => Promise<void>;
  initializeNotifications: () => Promise<{ success: boolean; error?: string }>;
  hasCompletedOnboarding: () => Promise<boolean>;
  setOnboardingCompleted: (completed: boolean) => Promise<void>;
  handleNotificationReceived: (notification: Notifications.Notification) => void;
  handleNotificationResponse: (response: Notifications.NotificationResponse) => void;
  requestPermissionsAggressively: () => Promise<{ granted: boolean; userAction: 'granted' | 'denied' | 'cancelled' }>;
  checkIfArticleAlreadyRead: (articleId: string) => Promise<boolean>;
}

class NotificationService implements NotificationServiceInterface {
  private static instance: NotificationService;
  private expoPushToken: string | null = null;
  private isInitialized: boolean = false;
  private initializationPromise: Promise<{ success: boolean; error?: string }> | null = null;
  private registrationCache: Map<string, boolean> = new Map();

  static getInstance(): NotificationService {
    if (!NotificationService.instance) {
      NotificationService.instance = new NotificationService();
    }
    return NotificationService.instance;
  }

  async registerForPushNotifications(): Promise<string | null> {
    try {
      // Check if device supports push notifications
      if (!Device.isDevice) {
        console.warn('Push notifications only work on physical devices');
        return null;
      }

      // Check if notifications are enabled in app preferences
      const notificationPreference = await this.getNotificationPreference();
      if (notificationPreference === false) {
        console.log('Push notifications disabled in user preferences');
        return null;
      }

      // Request permissions
      const hasPermission = await this.requestPermissions();
      if (!hasPermission) {
        console.warn('Push notification permissions not granted');
        return null;
      }

      // Setup notification channels for Android
      await this.setupNotificationChannels();

      // Get Expo push token
      const token = await this.getExpoPushToken();
      if (token) {
        this.expoPushToken = token;
        await AsyncStorage.setItem(PUSH_TOKEN_KEY, token);

        // Send token to server with caching
        await this.sendTokenToServerWithCache(token);

        console.log('Push notifications registered successfully');
        return token;
      }

      return null;
    } catch (error) {
      console.error('Error registering for push notifications:', error);
      return null;
    }
  }

  async getExpoPushToken(): Promise<string | null> {
    try {
      if (this.expoPushToken) {
        return this.expoPushToken;
      }

      // Try to get cached token first
      const cachedToken = await AsyncStorage.getItem(PUSH_TOKEN_KEY);
      if (cachedToken) {
        // Validate cached token by checking if it's still in correct format
        if (this.isValidExpoPushToken(cachedToken)) {
          this.expoPushToken = cachedToken;
          return cachedToken;
        } else {
          // Clear invalid cached token
          await AsyncStorage.removeItem(PUSH_TOKEN_KEY);
        }
      }

      // Generate new token
      const { data: token } = await Notifications.getExpoPushTokenAsync({
        projectId: '233896e5-1ec1-416f-8afb-ad71a0dbc080', // Your EAS project ID from app.json
      });

      if (token) {
        this.expoPushToken = token;
        await AsyncStorage.setItem(PUSH_TOKEN_KEY, token);
        return token;
      }

      return null;
    } catch (error) {
      console.error('Error getting Expo push token:', error);
      return null;
    }
  }

  private isValidExpoPushToken(token: string): boolean {
    // Basic validation for Expo push token format
    return token.startsWith('ExponentPushToken[') && token.endsWith(']') && token.length > 30;
  }

  async requestPermissions(): Promise<boolean> {
    try {
      const { status: existingStatus } = await Notifications.getPermissionsAsync();
      let finalStatus = existingStatus;

      if (existingStatus !== 'granted') {
        const { status } = await Notifications.requestPermissionsAsync();
        finalStatus = status;
      }

      return finalStatus === 'granted';
    } catch (error) {
      console.error('Error requesting notification permissions:', error);
      return false;
    }
  }

  async getNotificationPreference(): Promise<boolean | null> {
    try {
      const preference = await AsyncStorage.getItem(NOTIFICATIONS_PREFERENCE_KEY);
      if (preference === null) {
        return null; // Not set
      }
      return preference === 'true';
    } catch (error) {
      console.error('Error getting notification preference:', error);
      return null;
    }
  }

  async setNotificationPreference(enabled: boolean): Promise<void> {
    try {
      await AsyncStorage.setItem(NOTIFICATIONS_PREFERENCE_KEY, enabled.toString());
    } catch (error) {
      console.error('Error setting notification preference:', error);
      throw error;
    }
  }

  async hasCompletedOnboarding(): Promise<boolean> {
    try {
      const completed = await AsyncStorage.getItem(ONBOARDING_COMPLETED_KEY);
      return completed === 'true';
    } catch (error) {
      console.error('Error checking onboarding status:', error);
      return false;
    }
  }

  async setOnboardingCompleted(completed: boolean): Promise<void> {
    try {
      await AsyncStorage.setItem(ONBOARDING_COMPLETED_KEY, completed.toString());
    } catch (error) {
      console.error('Error setting onboarding status:', error);
      throw error;
    }
  }

  async areNotificationsEnabled(): Promise<boolean> {
    const preference = await this.getNotificationPreference();
    return preference !== false; // Default to true if not set or null
  }

  async setNotificationsEnabled(enabled: boolean): Promise<void> {
    try {
      // Save preference first
      await this.setNotificationPreference(enabled);

      if (enabled) {
        // Validate that we have permission before proceeding
        const { status } = await Notifications.getPermissionsAsync();
        if (status !== 'granted') {
          throw new Error('Cannot enable notifications without permission');
        }

        // Check if already initialized and has valid token
        const existingToken = await this.getExpoPushToken();
        if (existingToken && this.isInitialized && this.registrationCache.get(existingToken)) {
          console.log('Already registered with valid token, skipping initialization');
          return;
        }

        // Initialize and register for push notifications
        if (!this.isInitialized) {
          await this.initializeNotifications();
        }
        await this.registerForPushNotifications();
      } else {
        // Unregister from server and clear local data
        if (this.expoPushToken) {
          await this.unregisterFromServer(this.expoPushToken);
        }
        await this.clearNotificationData();
      }
    } catch (error) {
      console.error('Error setting notifications enabled status:', error);
      throw error;
    }
  }

  private async clearNotificationData(): Promise<void> {
    await AsyncStorage.multiRemove([
      PUSH_TOKEN_KEY,
      REGISTRATION_STATUS_KEY,
      LAST_INITIALIZATION_KEY
    ]);
    this.expoPushToken = null;
    this.isInitialized = false;
    this.registrationCache.clear();
  }

  async initializeNotifications(): Promise<{ success: boolean; error?: string }> {
    // Debounce multiple simultaneous calls
    if (this.initializationPromise) {
      return this.initializationPromise;
    }

    this.initializationPromise = this._performInitialization();
    const result = await this.initializationPromise;
    this.initializationPromise = null;

    return result;
  }

  private async _performInitialization(): Promise<{ success: boolean; error?: string }> {
    try {
      console.log('Initializing notifications...');

      // Check if already initialized recently (within last 24 hours)
      const lastInit = await AsyncStorage.getItem(LAST_INITIALIZATION_KEY);
      if (lastInit) {
        const lastInitTime = parseInt(lastInit, 10);
        const now = Date.now();
        const twentyFourHours = 24 * 60 * 60 * 1000;

        if (now - lastInitTime < twentyFourHours) {
          console.log('Notifications initialized recently, skipping');
          this.isInitialized = true;
          return { success: true };
        }
      }

      // Check user preference
      const preference = await this.getNotificationPreference();

      if (preference === null) {
        // First time - don't auto-request, just mark as ready for user action
        console.log('First time - notifications not configured yet');
        return { success: true, error: 'First time setup - user action required' };

      } else if (preference === true) {
        // User has enabled notifications - ensure everything is set up
        console.log('Notifications enabled in preferences - validating setup');

        const { status } = await Notifications.getPermissionsAsync();
        if (status !== 'granted') {
          return { success: false, error: 'Permission not granted' };
        }

        await this.setupNotificationChannels();

        // Only register if we don't have a valid token or it's not registered
        const token = await this.getExpoPushToken();
        if (token && !this.registrationCache.get(token)) {
          await this.sendTokenToServerWithCache(token);
        }

        // Mark as initialized
        await AsyncStorage.setItem(LAST_INITIALIZATION_KEY, Date.now().toString());
        this.isInitialized = true;

        return { success: !!token };

      } else {
        // User has disabled notifications
        console.log('Notifications disabled in preferences');
        this.isInitialized = true;
        return { success: true };
      }

    } catch (error) {
      console.error('Error initializing notifications:', error);
      this.initializationPromise = null;
      return { success: false, error: error instanceof Error ? error.message : String(error) };
    }
  }

  async requestPermissionsWithContext(): Promise<{ granted: boolean; userAction: 'granted' | 'denied' | 'cancelled' }> {
    try {
      const { status: existingStatus } = await Notifications.getPermissionsAsync();

      if (existingStatus === 'granted') {
        return { granted: true, userAction: 'granted' };
      }

      // Request permissions
      const { status } = await Notifications.requestPermissionsAsync();

      if (status === 'granted') {
        return { granted: true, userAction: 'granted' };
      } else {
        return { granted: false, userAction: status === 'denied' ? 'denied' : 'cancelled' };
      }
    } catch (error) {
      console.error('Error requesting notification permissions:', error);
      return { granted: false, userAction: 'denied' };
    }
  }

  // Smart permission request that respects platform guidelines
  async requestPermissionsAggressively(): Promise<{ granted: boolean; userAction: 'granted' | 'denied' | 'cancelled' }> {
    try {
      const { status: existingStatus } = await Notifications.getPermissionsAsync();

      if (existingStatus === 'granted') {
        return { granted: true, userAction: 'granted' };
      }

      // Platform-specific permission handling
      if (Platform.OS === 'ios') {
        if (existingStatus === 'denied') {
          // On iOS, once denied, subsequent requests won't show dialog
          console.log('iOS permission previously denied - user must enable in Settings');
          return { granted: false, userAction: 'denied' };
        }

        // For iOS, request with all permission types
        const { status } = await Notifications.requestPermissionsAsync({
          ios: {
            allowAlert: true,
            allowBadge: true,
            allowSound: true,
            allowDisplayInCarPlay: false,
            allowCriticalAlerts: false,
            provideAppNotificationSettings: false,
            allowProvisional: false,
          },
        });

        return {
          granted: status === 'granted',
          userAction: status === 'granted' ? 'granted' : 'denied',
        };
      } else {
        // Android - can request multiple times
        console.log(`Requesting Android permissions (current status: ${existingStatus})`);
        const { status } = await Notifications.requestPermissionsAsync();

        return {
          granted: status === 'granted',
          userAction: status === 'granted' ? 'granted' : 'denied',
        };
      }
    } catch (error) {
      console.error('Error requesting permissions:', error);
      return { granted: false, userAction: 'denied' };
    }
  }

  // Helper method to check if an article is already read
  async checkIfArticleAlreadyRead(articleId: string): Promise<boolean> {
    try {
      const { storageService } = await import('../services/storageService');
      const articleHistory = await storageService.getArticleHistory();
      const articleProgress = articleHistory.find(p => p.articleId === articleId);
      return articleProgress?.isRead || false;
    } catch (error) {
      console.error('Error checking if article is read:', error);
      return false; // Fail safe - assume not read
    }
  }

  async cleanup(): Promise<void> {
    try {
      await AsyncStorage.multiRemove([
        PUSH_TOKEN_KEY,
        REGISTRATION_STATUS_KEY,
        LAST_INITIALIZATION_KEY,
        ONBOARDING_COMPLETED_KEY
      ]);
      this.expoPushToken = null;
      this.isInitialized = false;
      this.registrationCache.clear();
      this.initializationPromise = null;
      console.log('NotificationService cleanup completed');
    } catch (error) {
      console.error('Error during NotificationService cleanup:', error);
    }
  }

  async setupNotificationChannels(): Promise<void> {
    if (Platform.OS === 'android') {
      try {
        // Main notification channel for daily articles
        await Notifications.setNotificationChannelAsync('daily-articles', {
          name: 'Daily Articles',
          description: 'Notifications for new daily coding articles',
          importance: Notifications.AndroidImportance.DEFAULT,
          vibrationPattern: [0, 250, 250, 250],
          lightColor: '#007AFF',
          sound: 'default',
          enableVibrate: true,
          enableLights: true,
          showBadge: true,
          lockscreenVisibility: Notifications.AndroidNotificationVisibility.PUBLIC,
        });

        // Default channel (fallback)
        await Notifications.setNotificationChannelAsync('default', {
          name: 'General',
          description: 'General app notifications',
          importance: Notifications.AndroidImportance.DEFAULT,
          sound: 'default',
          showBadge: true,
        });

        // Test notifications channel (development only)
        if (__DEV__) {
          await Notifications.setNotificationChannelAsync('test-notifications', {
            name: 'Test Notifications',
            description: 'Development testing notifications',
            importance: Notifications.AndroidImportance.HIGH,
            vibrationPattern: [0, 250, 250, 250],
            lightColor: '#AF85D3',
            sound: 'default',
            enableVibrate: true,
            enableLights: true,
            showBadge: true,
            lockscreenVisibility: Notifications.AndroidNotificationVisibility.PUBLIC,
          });
        }

        console.log('✅ Android notification channels set up successfully');
      } catch (error) {
        console.error('❌ Error setting up notification channels:', error);
        throw error;
      }
    }
  }

  async sendTokenToServer(token: string): Promise<void> {
    try {
      // Get the API base URL from app configuration
      const apiBaseUrl = process.env.EXPO_PUBLIC_API_BASE_URL;

      console.log('Sending push token to server with parameters:', {
        expoPushToken: token,
        platform: Platform.OS,
        deviceId: Device.modelName || 'unknown',
      });

      const response = await fetch(`${apiBaseUrl}/api/notification/register`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-access-token': process.env.EXPO_PUBLIC_ACCESS_TOKEN,
        },
        body: JSON.stringify({
          expoPushToken: token,
          platform: Platform.OS,
          deviceId: Device.modelName || 'unknown',
        }),
      });

      if (!response.ok) {
        throw new Error(`Failed to register token: ${response.status}`);
      }

      console.log('Push token sent to server successfully');
    } catch (error) {
      console.error('Error sending token to server:', error);
      throw error; // Let caller handle the error
    }
  }

  async sendTokenToServerWithCache(token: string): Promise<void> {
    try {
      // Check if token is already registered
      const lastRegistered = await AsyncStorage.getItem(REGISTRATION_STATUS_KEY);
      if (lastRegistered === token && this.registrationCache.get(token)) {
        console.log('Token already registered, skipping server call');
        return;
      }

      // Send to server
      await this.sendTokenToServer(token);

      // Cache successful registration
      await AsyncStorage.setItem(REGISTRATION_STATUS_KEY, token);
      this.registrationCache.set(token, true);
    } catch (error) {
      console.error('Error sending token to server with cache:', error);
      throw error;
    }
  }

  handleNotificationReceived(notification: Notifications.Notification): void {
    const notificationData = notification.request.content.data;
    const articleId = notificationData?.articleId;
    const articleTitle = notificationData?.articleTitle;

    console.log('🔔 Notification received in foreground:', {
      title: notification.request.content.title,
      body: notification.request.content.body,
      articleId: articleId,
      articleTitle: articleTitle,
      type: notificationData?.type,
      identifier: notification.request.identifier,
    });

    if (articleId) {
      console.log(`📬 Article notification received for: ${articleId} "${articleTitle}"`);
      console.log('💡 Note: If this article was already read, the notification should have been suppressed by the handler.');
    }

    // Handle foreground notification display
    // The notification handler configuration above will determine how it's shown
  }

  handleNotificationResponse(response: Notifications.NotificationResponse): void {
    const notificationData = response.notification.request.content.data;
    const articleId = notificationData?.articleId;
    const articleTitle = notificationData?.articleTitle;

    console.log('👆 Notification tapped:', {
      title: response.notification.request.content.title,
      actionIdentifier: response.actionIdentifier,
      articleId: articleId,
      articleTitle: articleTitle,
      type: notificationData?.type,
    });

    if (articleId) {
      console.log(`📖 User tapped notification for article: ${articleId} "${articleTitle}"`);
      // Navigation to specific article will be handled in the main app component
    }

    // Handle notification tap - just open the app to home screen
    // Navigation will be handled in the main app component
  }

  async unregisterFromServer(token: string): Promise<void> {
    try {
      // Get the API base URL from app configuration
      const apiBaseUrl = process.env.EXPO_PUBLIC_API_BASE_URL;

      const response = await fetch(`${apiBaseUrl}/api/notification/unregister`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-access-token': process.env.EXPO_PUBLIC_ACCESS_TOKEN,
        },
        body: JSON.stringify({
          expoPushToken: token,
        }),
      });

      await Notifications.unregisterForNotificationsAsync();

      if (!response.ok) {
        throw new Error(`Failed to unregister token: ${response.status}`);
      }

      // Clear registration cache
      this.registrationCache.delete(token);
      await AsyncStorage.removeItem(REGISTRATION_STATUS_KEY);

      console.log('Push token unregistered from server successfully');
    } catch (error) {
      console.error('Error unregistering token from server:', error);
      throw error; // Re-throw to allow caller to handle
    }
  }




}

export default NotificationService;
