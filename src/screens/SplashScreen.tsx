import React, { useEffect, useState, useCallback } from 'react';
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

  const animateProgress = useCallback((toValue: number): Promise<void> => {
    return new Promise((resolve) => {
      Animated.timing(progressAnim, {
        toValue,
        duration: 150, // Reduced from 300ms for faster progress
        useNativeDriver: false,
      }).start(() => resolve());
    });
  }, [progressAnim]);

  const initializeApp = useCallback(async () => {
    try {
      // Step 1: Critical initialization - Device ID and Firebase (parallel)
      setInitializationStep('Initializing core services...');
      await animateProgress(0.2);

      const [deviceIdResult, firebaseResult] = await Promise.allSettled([
        initializeDeviceId(),
        firebaseApp.initialize()
      ]);

      // Handle device ID result
      if (deviceIdResult.status === 'fulfilled') {
        console.log('✅ Device ID initialized:', deviceIdResult.value);
      } else {
        console.error('❌ Device ID initialization failed:', deviceIdResult.reason);
      }

      // Handle Firebase result and setup background tasks
      if (firebaseResult.status === 'fulfilled' && firebaseResult.value) {
        console.log('✅ Firebase and Crashlytics initialized successfully');
        
        // Non-blocking: Check crash status in background
        firebaseApp.didCrashOnPreviousExecution()
          .then(didCrash => {
            if (didCrash) {
              console.log('App crashed on previous execution - crash report sent');
              firebaseApp.logEvent('app_recovered_from_crash');
            }
          })
          .catch(err => console.warn('Could not check previous crash status:', err));

        // Non-blocking: Log app launch
        firebaseApp.logEvent('app_launched', {
          timestamp: new Date().toISOString(),
          environment: __DEV__ ? 'development' : 'production'
        });
      } else {
        console.log('Firebase not available - continuing without Crashlytics');
      }

      // Step 2: Parallel initialization of non-blocking services
      setInitializationStep('Loading user data...');
      await animateProgress(0.5);

      // Run beta status, subscription, and notification checks in parallel
      await Promise.allSettled([
        // Beta status check
        (async () => {
          if (Constants.executionEnvironment === 'storeClient' || Platform.OS === 'web') {
            console.log('⏭️ Beta status initialization skipped in Expo Go/web');
            return null;
          }
          try {
            const betaStatusService = BetaStatusService.getInstance();
            const betaStatus = await betaStatusService.initializeBetaStatus();
            console.log('✅ Beta status initialized:', { betaStatus });
            return betaStatus;
          } catch (error) {
            console.error('❌ Beta status initialization failed:', error);
            firebaseApp.logError('Beta status initialization failed', error);
            return null;
          }
        })(),

        // Subscription check
        (async () => {
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
        })(),

        // Notification status
        (async () => {
          try {
            await refreshNotificationStatus();
            const { status } = await Notifications.getPermissionsAsync();
            console.log('Current notification permission status:', status);

            const notificationService = NotificationService.getInstance();
            const preference = await notificationService.getNotificationPreference();

            if (preference === true && status === 'granted') {
              console.log('Ensuring notification setup is complete...');
              notificationService.setNotificationsEnabled(true);
            } else if (preference === true && status === 'denied') {
              console.log('Notification permission was revoked - user will need to re-enable');
            }

            console.log('✅ Notification status loaded and synced successfully');
          } catch (error) {
            console.warn('Notification status loading warning:', error);
          }
        })()
      ]);

      // Step 3: Fetch today's article (critical for app functionality)
      setInitializationStep('Fetching today\'s routine...');
      await animateProgress(0.85);

      try {
        await fetchTodaysArticle();
        console.log('✅ Today\'s article fetched successfully');
      } catch (error) {
        console.error('Error fetching today\'s article:', error);
        firebaseApp.logError('Failed to fetch article during splash', error);
      }

      // Step 4: Finalize
      setInitializationStep('Ready!');
      await animateProgress(1.0);

      // Defer non-critical cleanup to background (after app loads)
      setTimeout(() => {
        storageService.cleanExpiredBacklogArticles()
          .then(() => console.log('✅ Expired backlog articles cleaned in background'))
          .catch(error => {
            console.error('Error cleaning expired backlog articles:', error);
            firebaseApp.logError('Failed to clean expired backlog articles', error);
          });
      }, 1000);

      // Minimal transition delay
      await new Promise(resolve => setTimeout(resolve, 200)); // Reduced from 500ms

      // Complete initialization
      onInitializationComplete();

    } catch (error) {
      console.error('App initialization error:', error);
      firebaseApp.logError('App initialization failed during splash', error);

      // Even if there's an error, continue to the app
      setInitializationStep('Completing setup...');
      await animateProgress(1.0);
      await new Promise(resolve => setTimeout(resolve, 200));
      onInitializationComplete();
    }
  }, [animateProgress, fetchTodaysArticle, refreshNotificationStatus, onInitializationComplete]);

  useEffect(() => {
    // Start animations
    Animated.parallel([
      Animated.timing(fadeAnim, {
        toValue: 1,
        duration: 500, // Reduced from 800ms
        useNativeDriver: true,
      }),
      Animated.spring(scaleAnim, {
        toValue: 1,
        tension: 60, // Increased for faster animation
        friction: 7, // Reduced for faster animation
        useNativeDriver: true,
      }),
    ]).start();

    // Start initialization process
    initializeApp();
  }, [fadeAnim, scaleAnim, initializeApp]);

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
          style={styles.headerImage}
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
  headerImage: {
    height: 50,
    width: 180,
    marginLeft: 10,
    marginBottom: 10,
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