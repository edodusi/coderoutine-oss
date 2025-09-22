import React, { createContext, useContext, useState, useCallback, ReactNode } from 'react';
import { Linking } from 'react-native';
import NotificationModal, { NotificationModalType } from '../components/modals/notifications/NotificationModal';

export interface NotificationModalData {
  type: NotificationModalType;
  title?: string;
  message?: string;
  details?: string;
  onRetry?: () => void;
  onEnable?: () => void;
  onOpenSettings?: () => void;
}

interface NotificationModalContextType {
  showModal: (data: NotificationModalData) => void;
  hideModal: () => void;
  showPermissionRequestModal: (title?: string, message?: string, onEnable?: () => void) => void;
  showPermissionDeniedModal: (title?: string, message?: string, onOpenSettings?: () => void) => void;
  showEnableSuccessModal: (title?: string, message?: string) => void;
  showDisableSuccessModal: (title?: string, message?: string) => void;
  showEnableErrorModal: (title?: string, message?: string, details?: string, onRetry?: () => void) => void;
  showDisableErrorModal: (title?: string, message?: string, details?: string, onRetry?: () => void) => void;
  isVisible: boolean;
}

const NotificationModalContext = createContext<NotificationModalContextType | undefined>(undefined);

interface NotificationModalProviderProps {
  children: ReactNode;
}

export const NotificationModalProvider: React.FC<NotificationModalProviderProps> = ({ children }) => {
  const [modalData, setModalData] = useState<NotificationModalData | null>(null);
  const [isVisible, setIsVisible] = useState(false);

  const showModal = useCallback((data: NotificationModalData) => {
    setModalData(data);
    setIsVisible(true);
  }, []);

  const hideModal = useCallback(() => {
    setIsVisible(false);
    // Clear modal data after animation completes
    setTimeout(() => setModalData(null), 300);
  }, []);

  const showPermissionRequestModal = useCallback((title?: string, message?: string, onEnable?: () => void) => {
    showModal({
      type: 'permission_request',
      title,
      message,
      onEnable,
    });
  }, [showModal]);

  const showPermissionDeniedModal = useCallback((title?: string, message?: string, onOpenSettings?: () => void) => {
    const handleOpenSettings = onOpenSettings || (() => {
      Linking.openSettings().catch(error => {
        console.error('Failed to open settings:', error);
      });
    });

    showModal({
      type: 'permission_denied',
      title,
      message,
      onOpenSettings: handleOpenSettings,
    });
  }, [showModal]);

  const showEnableSuccessModal = useCallback((title?: string, message?: string) => {
    showModal({
      type: 'enable_success',
      title,
      message,
    });
  }, [showModal]);

  const showDisableSuccessModal = useCallback((title?: string, message?: string) => {
    showModal({
      type: 'disable_success',
      title,
      message,
    });
  }, [showModal]);

  const showEnableErrorModal = useCallback((title?: string, message?: string, details?: string, onRetry?: () => void) => {
    showModal({
      type: 'enable_error',
      title,
      message,
      details,
      onRetry,
    });
  }, [showModal]);

  const showDisableErrorModal = useCallback((title?: string, message?: string, details?: string, onRetry?: () => void) => {
    showModal({
      type: 'disable_error',
      title,
      message,
      details,
      onRetry,
    });
  }, [showModal]);



  const contextValue: NotificationModalContextType = {
    showModal,
    hideModal,
    showPermissionRequestModal,
    showPermissionDeniedModal,
    showEnableSuccessModal,
    showDisableSuccessModal,
    showEnableErrorModal,
    showDisableErrorModal,
    isVisible,
  };

  return (
    <NotificationModalContext.Provider value={contextValue}>
      {children}
      
      {/* Notification Modal */}
      {modalData && (
        <NotificationModal
          visible={isVisible}
          type={modalData.type}
          title={modalData.title}
          message={modalData.message}
          details={modalData.details}
          onClose={hideModal}
          onRetry={modalData.onRetry}
          onEnable={modalData.onEnable}
          onOpenSettings={modalData.onOpenSettings}
        />
      )}
    </NotificationModalContext.Provider>
  );
};

export const useNotificationModal = (): NotificationModalContextType => {
  const context = useContext(NotificationModalContext);
  if (context === undefined) {
    throw new Error('useNotificationModal must be used within a NotificationModalProvider');
  }
  return context;
};

export default NotificationModalProvider;