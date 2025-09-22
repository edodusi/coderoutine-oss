import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Image,
  ActivityIndicator,
  Animated,
  Dimensions,
  Platform,
} from 'react-native';
import * as Notifications from 'expo-notifications';
import Constants from 'expo-constants';
import { useTheme } from '../context/ThemeContext';
import { useApp } from '../context/AppContext';
import { useNotifications } from '../context/NotificationContext';
import { firebaseApp } from '../services/firebaseApp';
import { subscriptionService } from '../services/subscriptionService';
import { BetaStatusService } from '../services/beta';
import { initializeDeviceId } from '../utils/deviceId';
import { storageService } from '../services/storageService';
import NotificationService from '../services/NotificationService';

const { width } = Dimensions.get('window');

interface SplashScreenProps {
  onInitializationComplete: () => void;
}

const SplashScreen: React.FC<SplashScreenProps> = ({ onInitializationComplete }) => {
  const { theme, isDarkMode } = useTheme();
  const { fetchTodaysArticle } = useApp();
  const { refreshNotificationStatus } = useNotifications();

  const [initializationStep, setInitializationStep] = useState('Starting...');
  const [fadeAnim] = useState(new Animated.Value(0));
  const [scaleAnim] = useState(new Animated.Value(0.8));
  const [progressAnim] = useState(new Animated.Value(0));

  useEffect(() => {
    // Start animations
    Animated.parallel([
      Animated.timing(fadeAnim, {
        toValue: 1,
        duration: 800,
        useNativeDriver: true,
      }),
      Animated.spring(scaleAnim, {
        toValue: 1,
        tension: 50,
        friction: 8,
        useNativeDriver: true,
      }),
    ]).start();

    // Start initialization process
    initializeApp();
  }, []);

  const initializeApp = async () => {
    try {
      // Step 1: Initialize Device ID first
      setInitializationStep('Initializing device...');
      await animateProgress(0.1);

      try {
        const deviceId = await initializeDeviceId();
        console.log('✅ Device ID initialized:', deviceId);
      } catch (error) {
        console.error('❌ Device ID initialization failed:', error);
        // Continue anyway, fallback will be used
      }

      // Step 2: Initialize Firebase and Beta Status
      setInitializationStep('Initializing Firebase...');
      await animateProgress(0.2);

      let firebaseInitialized = false;
      try {
        firebaseInitialized = await firebaseApp.initialize();
        if (firebaseInitialized) {
          console.log('✅ Firebase and Crashlytics initialized successfully');

          // Check if app crashed on previous run
          try {
            const didCrash = await firebaseApp.didCrashOnPreviousExecution();
            if (didCrash) {
              console.log('App crashed on previous execution - crash report sent');
              firebaseApp.logEvent('app_recovered_from_crash');
            }
          } catch (crashCheckError) {
            console.warn('Could not check previous crash status:', crashCheckError);
          }

          // Set app launch event
          firebaseApp.logEvent('app_launched', {
            timestamp: new Date().toISOString(),
            environment: __DEV__ ? 'development' : 'production'
          });
        } else {
          console.log('Firebase not available - continuing without Crashlytics');
        }
      } catch (firebaseError) {
        console.warn('Firebase initialization failed (likely running in Expo Go):', firebaseError);
        firebaseInitialized = false;
      }

      // Step 3: Initialize Beta Status
      setInitializationStep('Checking user status...');
      await animateProgress(0.35);

      try {
        // Skip beta status initialization in Expo Go
        if (Constants.executionEnvironment === 'storeClient' || Platform.OS === 'web') {
          console.log('⏭️ Beta status initialization skipped in Expo Go/web');
        } else {
          const betaStatusService = BetaStatusService.getInstance();
          const betaStatus = await betaStatusService.initializeBetaStatus();
          console.log('✅ Beta status initialized:', { betaStatus });
        }
      } catch (error) {
        console.error('❌ Beta status initialization failed:', error);
        firebaseApp.logError('Beta status initialization failed', error);
        // Continue without beta status
      }

      // Step 4: Check subscription status
      setInitializationStep('Checking subscription status...');
      await animateProgress(0.55);

      try {
        await subscriptionService.initialize();
        if (subscriptionService.isInitialized) {
          await subscriptionService.getCustomerInfo();
          console.log('✅ Subscription status checked successfully');
        } else {
          console.log('⚠️ Subscription service not configured - continuing without premium features');
        }
      } catch (error) {
        console.log('⚠️ Subscription check skipped:', error);
      }

      // Step 5: Load and sync notification status comprehensively
      setInitializationStep('Loading notification settings...');
      await animateProgress(0.75);

      try {
        // Refresh notification status and check for permission changes
        await refreshNotificationStatus();

        // Additional check: verify if permission status changed while app was closed
        const { status } = await Notifications.getPermissionsAsync();
        console.log('Current notification permission status:', status);

        // If we have cached preferences but permission status doesn't match, reconcile
        const notificationService = NotificationService.getInstance();
        const preference = await notificationService.getNotificationPreference();

        if (preference === true && status === 'granted') {
          // User wants notifications and has permission - ensure background setup is complete
          console.log('Ensuring notification setup is complete...');
          notificationService.setNotificationsEnabled(true);
        } else if (preference === true && status === 'denied') {
          // User wants notifications but lost permission - will need to re-request
          console.log('Notification permission was revoked - user will need to re-enable');
        }

        console.log('✅ Notification status loaded and synced successfully');
      } catch (error) {
        console.warn('Notification status loading warning:', error);
        // Don't fail the app if notification status loading fails
      }

      // Step 6: Clean expired backlog articles
      setInitializationStep('Cleaning expired articles...');
      await animateProgress(0.85);

      try {
        await storageService.cleanExpiredBacklogArticles();
        console.log('✅ Expired backlog articles cleaned successfully');
      } catch (error) {
        console.error('Error cleaning expired backlog articles:', error);
        firebaseApp.logError('Failed to clean expired backlog articles', error);
        // Continue even if cleanup fails
      }

      // Step 7: Fetch today's article
      setInitializationStep('Fetching today\'s routine...');
      await animateProgress(0.9);

      try {
        await fetchTodaysArticle();
        console.log('✅ Today\'s article fetched successfully');
      } catch (error) {
        console.error('Error fetching today\'s article:', error);
        firebaseApp.logError('Failed to fetch article during splash', error);
      }

      // Step 8: Finalizing
      setInitializationStep('Almost ready...');
      await animateProgress(1.0);

      // Wait a moment before transitioning
      await new Promise(resolve => setTimeout(resolve, 500));

      // Complete initialization
      onInitializationComplete();

    } catch (error) {
      console.error('App initialization error:', error);
      firebaseApp.logError('App initialization failed during splash', error);

      // Even if there's an error, continue to the app
      setInitializationStep('Completing setup...');
      await animateProgress(1.0);
      await new Promise(resolve => setTimeout(resolve, 500));
      onInitializationComplete();
    }
  };

  const animateProgress = (toValue: number): Promise<void> => {
    return new Promise((resolve) => {
      Animated.timing(progressAnim, {
        toValue,
        duration: 300,
        useNativeDriver: false,
      }).start(() => resolve());
    });
  };

  return (
    <View style={[styles.container, { backgroundColor: theme.colors.background }]}>
      <Animated.View
        style={[
          styles.content,
          {
            opacity: fadeAnim,
            transform: [{ scale: scaleAnim }],
          },
        ]}
      >
        {/* Logo/Icon */}
        <View style={styles.logoContainer}>
          <Image
            source={require('../../assets/icon.png')}
            style={styles.logo}
            resizeMode="contain"
          />
        </View>

        {/* App Title */}
        <Image
          source={isDarkMode ? require('../../assets/header-dark.png') : require('../../assets/header.png')}
          style={{
            height: 50,
            width: 180,
            marginLeft: 10,
            marginBottom: 10,
          }}
          resizeMode="contain"
        />

        <Text style={[styles.subtitle, { color: theme.colors.textSecondary }]}>
          Daily coding knowledge routine
        </Text>

        {/* Loading Indicator */}
        <View style={styles.loadingContainer}>
          <ActivityIndicator
            size="large"
            color={theme.colors.primary}
            style={styles.spinner}
          />

          {/* Progress Bar */}
          <View style={[styles.progressBarContainer, { backgroundColor: theme.colors.border }]}>
            <Animated.View
              style={[
                styles.progressBar,
                {
                  backgroundColor: theme.colors.primary,
                  width: progressAnim.interpolate({
                    inputRange: [0, 1],
                    outputRange: ['0%', '100%'],
                  }),
                },
              ]}
            />
          </View>

          {/* Status Text */}
          <Text style={[styles.statusText, { color: theme.colors.textSecondary }]}>
            {initializationStep}
          </Text>
        </View>

        {/* Version Info */}
        <Text style={[styles.version, { color: theme.colors.textSecondary }]}>
          Version {Constants.expoConfig?.version || '1.0.0'}
        </Text>
      </Animated.View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  content: {
    alignItems: 'center',
    width: width * 0.8,
  },
  logoContainer: {
    marginBottom: 30,
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 4,
    },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 5,
  },
  logo: {
    width: 120,
    height: 120,
    borderRadius: 20,
  },
  title: {
    fontSize: 32,
    fontWeight: 'bold',
    marginBottom: 8,
    textAlign: 'center',
  },
  subtitle: {
    fontSize: 16,
    marginBottom: 60,
    textAlign: 'center',
    opacity: 0.8,
  },
  loadingContainer: {
    alignItems: 'center',
    width: '100%',
  },
  spinner: {
    marginBottom: 20,
  },
  progressBarContainer: {
    width: '80%',
    height: 4,
    borderRadius: 2,
    overflow: 'hidden',
    marginBottom: 16,
  },
  progressBar: {
    height: '100%',
    borderRadius: 2,
  },
  statusText: {
    fontSize: 14,
    textAlign: 'center',
    marginBottom: 40,
    opacity: 0.7,
  },
  version: {
    fontSize: 12,
    opacity: 0.5,
    position: 'absolute',
    bottom: -60,
  },
});

export default SplashScreen;
