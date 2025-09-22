import React, { createContext, useContext, useState, useEffect, ReactNode, useCallback } from 'react';
import { AppState } from 'react-native';
import * as Notifications from 'expo-notifications';
import NotificationService from '../services/NotificationService';
import { Platform } from 'react-native';
import Constants from 'expo-constants';


interface NotificationState {
  isEnabled: boolean;
  pushToken: string | null;
  permissionStatus: 'undetermined' | 'granted' | 'denied';
  isLoading: boolean;
  isInitialized: boolean;
  lastError: string | null;
  hasCompletedOnboarding: boolean;
}

interface NotificationContextType {
  state: NotificationState;
  enableNotifications: () => Promise<{ success: boolean; error?: string }>;
  disableNotifications: () => Promise<{ success: boolean; error?: string }>;
  requestPermissions: () => Promise<boolean>;
  refreshNotificationStatus: () => Promise<void>;
  initializeIfNeeded: () => Promise<void>;
  requestPermissionsWithExplanation: () => Promise<{ success: boolean; error?: string; showSettings?: boolean }>;
  checkOnboardingStatus: () => Promise<boolean>;
  setOnboardingCompleted: () => Promise<void>;
  requestPermissionsForOnboarding: () => Promise<{ granted: boolean; error?: string }>;
  checkIfArticleAlreadyRead: (articleId: string) => Promise<boolean>;
}

const NotificationContext = createContext<NotificationContextType | undefined>(undefined);

interface NotificationProviderProps {
  children: ReactNode;
}

export const NotificationProvider: React.FC<NotificationProviderProps> = ({ children }) => {
  const [state, setState] = useState<NotificationState>({
    isEnabled: false, // Default to disabled until we check preferences
    pushToken: null,
    permissionStatus: 'undetermined',
    isLoading: false, // Start with no loading
    isInitialized: false,
    lastError: null,
    hasCompletedOnboarding: false, // Will be updated after checking storage
  });

  const notificationService = NotificationService.getInstance();

  // Basic setup on mount
  useEffect(() => {
    if (Platform.OS === 'web' || Constants.executionEnvironment === 'storeClient') {
      setState(prev => ({ ...prev, isInitialized: true }));
      return;
    }

    loadBasicNotificationStatus();

    // Set up notification listeners
    const notificationListener = Notifications.addNotificationReceivedListener(
      notificationService.handleNotificationReceived
    );

    const responseListener = Notifications.addNotificationResponseReceivedListener(
      notificationService.handleNotificationResponse
    );

    return () => {
      notificationListener.remove();
      responseListener.remove();
    };
  }, []);

  // Load basic status without heavy operations
  const loadBasicNotificationStatus = useCallback(async () => {
    try {
      setState(prev => ({ ...prev, isLoading: true }));

      // Load all data in parallel for better performance
      const [
        { status },
        preference,
        hasCompletedOnboarding,
        cachedToken
      ] = await Promise.all([
        Notifications.getPermissionsAsync(),
        notificationService.getNotificationPreference(),
        notificationService.hasCompletedOnboarding(),
        notificationService.getExpoPushToken()
      ]);

      const isEnabled = preference === true;

      // Single atomic state update
      setState(prev => ({
        ...prev,
        isEnabled,
        pushToken: cachedToken,
        permissionStatus: status as 'undetermined' | 'granted' | 'denied',
        isLoading: false,
        isInitialized: true,
        lastError: null,
        hasCompletedOnboarding,
      }));

    } catch (error) {
      console.error('Error loading basic notification status:', error);
      setState(prev => ({ 
        ...prev, 
        isLoading: false, 
        isInitialized: true,
        lastError: error instanceof Error ? error.message : 'Failed to load notification status'
      }));
    }
  }, []);

  // AppState listener for detecting external permission changes
  useEffect(() => {
    let lastAppState = 'active';
    let lastRefreshTime = 0;
    const refreshCooldown = 5000; // 5 seconds minimum between refreshes
    
    const handleAppStateChange = (nextAppState: string) => {
      // Only refresh when coming back from background to active
      // This is when user might have changed permissions in system settings
      if (nextAppState === 'active' && lastAppState === 'background') {
        const now = Date.now();
        
        if (now - lastRefreshTime > refreshCooldown) {
          lastRefreshTime = now;
          console.log('App became active from background - refreshing notification status');
          
          // Delay to ensure app is fully active and avoid flickering
          setTimeout(() => {
            loadBasicNotificationStatus().catch(error => {
              console.error('Error refreshing notification status:', error);
            });
          }, 300);
        }
      }
      
      lastAppState = nextAppState;
    };

    const appStateSubscription = AppState.addEventListener('change', handleAppStateChange);
    return () => appStateSubscription?.remove();
  }, [loadBasicNotificationStatus]);

  // Full initialization when needed
  const initializeIfNeeded = useCallback(async () => {
    if (state.isInitialized && state.isEnabled) {
      return;
    }

    try {
      setState(prev => ({ ...prev, isLoading: true, lastError: null }));
      const result = await notificationService.initializeNotifications();
      
      if (result.success) {
        await loadBasicNotificationStatus();
      } else {
        setState(prev => ({ 
          ...prev, 
          isLoading: false,
          lastError: result.error || 'Initialization failed'
        }));
      }
    } catch (error) {
      console.error('Error during full initialization:', error);
      setState(prev => ({ 
        ...prev, 
        isLoading: false,
        lastError: error instanceof Error ? error.message : 'Initialization failed'
      }));
    }
  }, [state.isInitialized, state.isEnabled]);

  const enableNotifications = useCallback(async (): Promise<{ success: boolean; error?: string }> => {
    try {
      setState(prev => ({ ...prev, isLoading: true, lastError: null }));

      // Try to request permissions (respects platform guidelines)
      const permissionResult = await notificationService.requestPermissionsAggressively();
      
      if (!permissionResult.granted) {
        setState(prev => ({ ...prev, isLoading: false }));
        
        const errorMessage = permissionResult.userAction === 'denied' 
          ? 'Permission denied. Please enable notifications in device settings.'
          : 'Permission required to enable notifications.';
          
        return { success: false, error: errorMessage };
      }

      // Permission granted - enable notifications
      await notificationService.setNotificationsEnabled(true);
      
      // Refresh status to get updated state (includes token)
      await loadBasicNotificationStatus();

      return { success: true };
    } catch (error) {
      console.error('Error enabling notifications:', error);
      const errorMessage = error instanceof Error ? error.message : 'Failed to enable notifications';
      setState(prev => ({ 
        ...prev, 
        isLoading: false,
        lastError: errorMessage
      }));
      return { success: false, error: errorMessage };
    }
  }, [loadBasicNotificationStatus]);

  const disableNotifications = useCallback(async (): Promise<{ success: boolean; error?: string }> => {
    try {
      setState(prev => ({ ...prev, isLoading: true, lastError: null }));

      // Disable notifications in service
      await notificationService.setNotificationsEnabled(false);

      // Single atomic state update after successful operation
      setState(prev => ({
        ...prev,
        isEnabled: false,
        pushToken: null,
        isLoading: false,
        lastError: null,
      }));

      return { success: true };
    } catch (error) {
      console.error('Error disabling notifications:', error);
      const errorMessage = error instanceof Error ? error.message : 'Failed to disable notifications';
      setState(prev => ({ 
        ...prev, 
        isLoading: false,
        lastError: errorMessage
      }));
      return { success: false, error: errorMessage };
    }
  }, []);

  const requestPermissions = async (): Promise<boolean> => {
    try {
      const granted = await notificationService.requestPermissions();

      setState(prev => ({
        ...prev,
        permissionStatus: granted ? 'granted' : 'denied',
      }));

      return granted;
    } catch (error) {
      console.error('Error requesting permissions:', error);
      setState(prev => ({
        ...prev,
        permissionStatus: 'denied',
      }));
      return false;
    }
  };

  const refreshNotificationStatus = useCallback(async () => {
    await loadBasicNotificationStatus();
  }, [loadBasicNotificationStatus]);



  const requestPermissionsWithExplanation = async (): Promise<{ success: boolean; error?: string; showSettings?: boolean }> => {
    try {
      setState(prev => ({ ...prev, isLoading: true, lastError: null }));

      const permissionResult = await notificationService.requestPermissionsWithContext();
      
      setState(prev => ({ 
        ...prev, 
        isLoading: false,
        permissionStatus: permissionResult.granted ? 'granted' : 'denied'
      }));

      if (!permissionResult.granted) {
        const showSettings = permissionResult.userAction === 'denied';
        const errorMessage = showSettings 
          ? 'Permission denied. You can enable notifications in your device settings.'
          : 'Permission is required to receive notifications.';
          
        return { 
          success: false, 
          error: errorMessage,
          showSettings 
        };
      }

      return { success: true };
    } catch (error) {
      console.error('Error requesting permissions with explanation:', error);
      const errorMessage = error instanceof Error ? error.message : 'Failed to request permissions';
      setState(prev => ({ 
        ...prev, 
        isLoading: false,
        lastError: errorMessage
      }));
      return { success: false, error: errorMessage };
    }
  };

  const checkOnboardingStatus = async (): Promise<boolean> => {
    try {
      const hasCompleted = await notificationService.hasCompletedOnboarding();
      setState(prev => ({ ...prev, hasCompletedOnboarding: hasCompleted }));
      return hasCompleted;
    } catch (error) {
      console.error('Error checking onboarding status:', error);
      return true; // Default to completed if error
    }
  };

  const setOnboardingCompleted = async (): Promise<void> => {
    try {
      await notificationService.setOnboardingCompleted(true);
      setState(prev => ({ ...prev, hasCompletedOnboarding: true }));
    } catch (error) {
      console.error('Error setting onboarding completed:', error);
      throw error;
    }
  };

  const requestPermissionsForOnboarding = async (): Promise<{ granted: boolean; error?: string }> => {
    try {
      setState(prev => ({ ...prev, isLoading: true, lastError: null }));

      const permissionResult = await notificationService.requestPermissionsWithContext();
      
      setState(prev => ({ 
        ...prev, 
        isLoading: false,
        permissionStatus: permissionResult.granted ? 'granted' : 'denied'
      }));

      if (permissionResult.granted) {
        // Permission granted - enable notifications and complete setup
        await notificationService.setNotificationsEnabled(true);
        await setOnboardingCompleted();
        
        // Refresh status to get updated token
        await loadBasicNotificationStatus();
        
        return { granted: true };
      } else {
        // Permission denied - mark onboarding as completed but don't enable
        await setOnboardingCompleted();
        
        const errorMessage = permissionResult.userAction === 'denied' 
          ? 'Permission was denied. You can enable notifications later in settings.'
          : 'Permission is required to receive notifications.';
          
        return { granted: false, error: errorMessage };
      }
    } catch (error) {
      console.error('Error requesting permissions for onboarding:', error);
      const errorMessage = error instanceof Error ? error.message : 'Failed to request permissions';
      setState(prev => ({ 
        ...prev, 
        isLoading: false,
        lastError: errorMessage
      }));
      return { granted: false, error: errorMessage };
    }
  };

  // Helper method to check if article is already read
  const checkIfArticleAlreadyRead = useCallback(async (articleId: string): Promise<boolean> => {
    return await notificationService.checkIfArticleAlreadyRead(articleId);
  }, []);

  const contextValue: NotificationContextType = {
    state,
    enableNotifications,
    disableNotifications,
    requestPermissions,
    refreshNotificationStatus,
    initializeIfNeeded,
    requestPermissionsWithExplanation,
    checkOnboardingStatus,
    setOnboardingCompleted,
    requestPermissionsForOnboarding,
    checkIfArticleAlreadyRead,
  };

  return (
    <NotificationContext.Provider value={contextValue}>
      {children}
    </NotificationContext.Provider>
  );
};

export const useNotifications = (): NotificationContextType => {
  const context = useContext(NotificationContext);
  if (context === undefined) {
    throw new Error('useNotifications must be used within a NotificationProvider');
  }
  return context;
};
