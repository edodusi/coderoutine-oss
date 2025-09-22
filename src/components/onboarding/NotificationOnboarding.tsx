import React, { useEffect, useState } from 'react';
import { useNotifications } from '../../context/NotificationContext';
import { useNotificationModal } from '../../context/NotificationModalContext';
import NotificationOnboardingModal from './NotificationOnboardingModal';

interface NotificationOnboardingProps {
  children: React.ReactNode;
  onOnboardingComplete?: () => void;
}

const NotificationOnboarding: React.FC<NotificationOnboardingProps> = ({
  children,
  onOnboardingComplete,
}) => {
  const {
    state: notificationState,
    requestPermissionsForOnboarding,
    setOnboardingCompleted,
  } = useNotifications();
  
  const { showEnableSuccessModal, showEnableErrorModal } = useNotificationModal();
  const [showOnboardingModal, setShowOnboardingModal] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);

  useEffect(() => {
    // Check if we should show onboarding after the notification state is loaded
    if (notificationState.isInitialized && !notificationState.hasCompletedOnboarding) {
      // Edge case: If user already has granted permissions but hasn't completed onboarding
      // (e.g., from a previous app version), just mark onboarding as completed
      if (notificationState.permissionStatus === 'granted' && notificationState.isEnabled) {
        console.log('User already has notifications enabled, skipping onboarding');
        setOnboardingCompleted().catch(console.error);
        return;
      }
      
      // Small delay to ensure smooth transition after splash screen
      const timer = setTimeout(() => {
        setShowOnboardingModal(true);
      }, 500);
      
      return () => clearTimeout(timer);
    }
  }, [notificationState.isInitialized, notificationState.hasCompletedOnboarding, notificationState.permissionStatus, notificationState.isEnabled, setOnboardingCompleted]);

  const handleEnableNotifications = async () => {
    if (isProcessing) return;
    
    setIsProcessing(true);
    
    try {
      const result = await requestPermissionsForOnboarding();
      
      if (result.granted) {
        // Success - show confirmation and close modal
        setShowOnboardingModal(false);
        showEnableSuccessModal(
          '🎉 Notifications Enabled!',
          'You\'ll receive notifications when new coding articles are available.'
        );
      } else {
        // Permission denied - show info and close modal
        setShowOnboardingModal(false);
        if (result.error) {
          showEnableErrorModal(
            '📱 Notifications Skipped',
            'No worries! You can enable notifications anytime in the app settings.',
            result.error
          );
        }
      }
      
      // Call completion callback regardless of permission result
      if (onOnboardingComplete) {
        onOnboardingComplete();
      }
      
    } catch (error) {
      console.error('Error during notification onboarding:', error);
      setShowOnboardingModal(false);
      showEnableErrorModal(
        '❌ Setup Failed',
        'There was an issue setting up notifications. You can try again later in settings.',
        error instanceof Error ? error.message : 'Unknown error occurred'
      );
      
      if (onOnboardingComplete) {
        onOnboardingComplete();
      }
    } finally {
      setIsProcessing(false);
    }
  };

  const handleSkipNotifications = async () => {
    if (isProcessing) return;
    
    try {
      await setOnboardingCompleted();
      setShowOnboardingModal(false);
      
      if (onOnboardingComplete) {
        onOnboardingComplete();
      }
    } catch (error) {
      console.error('Error completing onboarding:', error);
      // Still close the modal and continue
      setShowOnboardingModal(false);
      
      if (onOnboardingComplete) {
        onOnboardingComplete();
      }
    }
  };

  return (
    <>
      {children}
      
      <NotificationOnboardingModal
        visible={showOnboardingModal}
        onEnable={handleEnableNotifications}
        onSkip={handleSkipNotifications}
        isLoading={isProcessing || notificationState.isLoading}
      />
    </>
  );
};

export default NotificationOnboarding;