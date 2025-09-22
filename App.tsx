/**
 * CodeRoutine - Alpha Version
 *
 * A daily coding knowledge routine app with automatic progress tracking,
 * immutable read status, and clean user experience.
 *
 * Features:
 * - Daily coding articles
 * - Automatic read marking at 100% progress
 * - Immutable read status (once read, never modified)
 * - Progress tracking and reading streaks
 * - Offline caching and performance optimization
 */

import React, { useEffect } from 'react';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { ThemeProvider } from './src/context/ThemeContext';
import { AppProvider } from './src/context/AppContext';
import { ModalProvider } from './src/context/ModalContext';
import { NotificationProvider } from './src/context/NotificationContext';
import { NotificationModalProvider } from './src/context/NotificationModalContext';
import { PodcastProvider } from './src/context/PodcastContext';
import { ToastProvider } from './src/components/Toast';
import Navigation from './src/components/Navigation';
import SplashScreen from './src/screens/SplashScreen';
import NotificationOnboarding from './src/components/onboarding/NotificationOnboarding';
import { firebaseService } from './src/services/firebaseService';
import { firebaseApp } from './src/services/firebaseApp';

function AppContent() {
  const [isInitialized, setIsInitialized] = React.useState(false);

  const handleInitializationComplete = () => {
    setIsInitialized(true);
  };

  if (!isInitialized) {
    return <SplashScreen onInitializationComplete={handleInitializationComplete} />;
  }

  return (
    <NotificationOnboarding>
      <Navigation />
    </NotificationOnboarding>
  );
}

export default function App() {
  useEffect(() => {
    const initializeServices = async () => {
      try {
        // Initialize Firebase service (API backend)
        await firebaseService.initialize();
      } catch (error) {
        console.error('App services initialization error:', error);
        // Log initialization errors to Crashlytics (if available)
        try {
          firebaseApp.logError('App services initialization failed', error);
        } catch (crashlyticsError) {
          console.warn('Could not log error to Crashlytics:', crashlyticsError);
        }
      }
    };

    initializeServices();
  }, []);

  return (
    <SafeAreaProvider>
      <ThemeProvider>
        <ModalProvider>
          <NotificationModalProvider>
            <NotificationProvider>
              <AppProvider>
                <PodcastProvider>
                  <ToastProvider>
                    <AppContent />
                  </ToastProvider>
                </PodcastProvider>
              </AppProvider>
            </NotificationProvider>
          </NotificationModalProvider>
        </ModalProvider>
      </ThemeProvider>
    </SafeAreaProvider>
  );
}
