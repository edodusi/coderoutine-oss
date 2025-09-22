import React, { createContext, useContext, useState, useCallback, ReactNode } from 'react';
import { Linking } from 'react-native';
import SubscriptionModal, { SubscriptionModalType } from '../components/modals/SubscriptionModal';
import LoadingModal from '../components/modals/LoadingModal';

export interface ModalData {
  type: SubscriptionModalType | 'premium_required';
  title?: string;
  message?: string;
  details?: string;
  onRetry?: () => void;
  onContactSupport?: () => void;
  onSubscribe?: () => void;
}

interface ModalContextType {
  showModal: (data: ModalData) => void;
  hideModal: () => void;
  showSuccessModal: (title?: string, message?: string) => void;
  showErrorModal: (title?: string, message?: string, details?: string, onRetry?: () => void) => void;
  showVerificationFailedModal: (title?: string, message?: string, details?: string) => void;
  showRestoreSuccessModal: (message?: string) => void;
  showRestoreErrorModal: (message?: string, onRetry?: () => void) => void;
  showStoreUnavailableModal: (message?: string) => void;
  showPremiumRequiredModal: (featureName: string, onSubscribe?: () => void) => void;
  showLoadingModal: (message?: string, subMessage?: string) => void;
  hideLoadingModal: () => void;
  isVisible: boolean;
  isLoadingVisible: boolean;
}

const ModalContext = createContext<ModalContextType | undefined>(undefined);

export const useModal = (): ModalContextType => {
  const context = useContext(ModalContext);
  if (!context) {
    throw new Error('useModal must be used within a ModalProvider');
  }
  return context;
};

interface ModalProviderProps {
  children: ReactNode;
}

export const ModalProvider: React.FC<ModalProviderProps> = ({ children }) => {
  const [modalData, setModalData] = useState<ModalData | null>(null);
  const [isVisible, setIsVisible] = useState(false);
  const [isLoadingVisible, setIsLoadingVisible] = useState(false);
  const [loadingMessage, setLoadingMessage] = useState('Processing...');
  const [loadingSubMessage, setLoadingSubMessage] = useState<string | undefined>();

  const showModal = useCallback((data: ModalData) => {
    // Hide loading modal if showing
    setIsLoadingVisible(false);
    setModalData(data);
    setIsVisible(true);
  }, []);

  const hideModal = useCallback(() => {
    setIsVisible(false);
    // Clear modal data after animation completes
    setTimeout(() => {
      setModalData(null);
    }, 300);
  }, []);

  const contactSupport = useCallback(() => {
    const supportEmail = 'support@coderoutine.com';
    const subject = 'Subscription Support Request';
    const body = 'Hi! I need help with my subscription. Please provide details about your issue below:\n\n';

    const mailtoUrl = `mailto:${supportEmail}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;

    Linking.openURL(mailtoUrl).catch(error => {
      console.error('Failed to open email client:', error);
      // Fallback: could show another modal with support info
    });
  }, []);

  // Convenience methods for common modal types
  const showSuccessModal = useCallback((title?: string, message?: string) => {
    showModal({
      type: 'purchase_success',
      title,
      message,
    });
  }, [showModal]);

  const showErrorModal = useCallback((title?: string, message?: string, details?: string, onRetry?: () => void) => {
    showModal({
      type: 'purchase_error',
      title,
      message,
      details,
      onRetry,
    });
  }, [showModal]);

  const showVerificationFailedModal = useCallback((title?: string, message?: string, details?: string) => {
    showModal({
      type: 'verification_failed',
      title,
      message,
      details,
      onContactSupport: contactSupport,
    });
  }, [showModal, contactSupport]);

  const showRestoreSuccessModal = useCallback((message?: string) => {
    showModal({
      type: 'restore_success',
      message,
    });
  }, [showModal]);

  const showRestoreErrorModal = useCallback((message?: string, onRetry?: () => void) => {
    showModal({
      type: 'restore_error',
      message,
      onRetry,
    });
  }, [showModal]);

  const showStoreUnavailableModal = useCallback((message?: string) => {
    showModal({
      type: 'store_unavailable',
      message,
    });
  }, [showModal]);



  const showPremiumRequiredModal = useCallback((featureName: string, onSubscribe?: () => void) => {
    const funnyMessages = [
      `Hey there! 👋 The ${featureName} feature is for our premium members who help keep the lights on around here!`,
      `Oops! 🤖 The ${featureName} feature needs a little fuel to run (aka your subscription) because even AI needs coffee money!`,
      `Almost there! ✨ The ${featureName} feature is part of our premium toolkit - a small price for a deluxe code routine!`,
      `Hold up! 🚀 The ${featureName} feature is in the premium zone. We need your support to keep these amazing features running!`,
    ];

    const randomMessage = funnyMessages[Math.floor(Math.random() * funnyMessages.length)];

    showModal({
      type: 'premium_required',
      title: `✨ Premium Feature`,
      message: `${randomMessage}\n\nReady to unlock the full experience?`,
      onSubscribe,
    });
  }, [showModal]);

  const showLoadingModal = useCallback((message?: string, subMessage?: string) => {
    setLoadingMessage(message || 'Processing...');
    setLoadingSubMessage(subMessage);
    setIsLoadingVisible(true);
  }, []);

  const hideLoadingModal = useCallback(() => {
    setIsLoadingVisible(false);
    // Clear loading messages after animation
    setTimeout(() => {
      setLoadingMessage('Processing...');
      setLoadingSubMessage(undefined);
    }, 300);
  }, []);

  const contextValue: ModalContextType = {
    showModal,
    hideModal,
    showSuccessModal,
    showErrorModal,
    showVerificationFailedModal,
    showRestoreSuccessModal,
    showRestoreErrorModal,
    showStoreUnavailableModal,
    showPremiumRequiredModal,
    showLoadingModal,
    hideLoadingModal,
    isVisible,
    isLoadingVisible,
  };

  return (
    <ModalContext.Provider value={contextValue}>
      {children}

      {/* Loading Modal */}
      <LoadingModal
        visible={isLoadingVisible}
        message={loadingMessage}
        subMessage={loadingSubMessage}
      />

      {/* Subscription Feedback Modal */}
      {modalData && modalData.type !== 'loading' && (
        <SubscriptionModal
          visible={isVisible}
          type={modalData.type}
          title={modalData.title}
          message={modalData.message}
          details={modalData.details}
          onClose={hideModal}
          onRetry={modalData.onRetry}
          onContactSupport={modalData.onContactSupport}
          onSubscribe={modalData.onSubscribe}
        />
      )}
    </ModalContext.Provider>
  );
};

export default ModalProvider;
