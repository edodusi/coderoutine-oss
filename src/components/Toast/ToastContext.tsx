import React, { createContext, useContext, useState, useCallback } from 'react';
import Toast from './Toast';

export interface ToastContextType {
  showToast: (message: string, type?: 'success' | 'error' | 'info', duration?: number) => void;
  showSuccessToast: (message: string, duration?: number) => void;
  showErrorToast: (message: string, duration?: number) => void;
  showInfoToast: (message: string, duration?: number) => void;
  hideToast: () => void;
}

const ToastContext = createContext<ToastContextType | undefined>(undefined);

export const useToast = (): ToastContextType => {
  const context = useContext(ToastContext);
  if (!context) {
    throw new Error('useToast must be used within a ToastProvider');
  }
  return context;
};

interface ToastProviderProps {
  children: React.ReactNode;
}

export const ToastProvider: React.FC<ToastProviderProps> = ({ children }) => {
  const [toastConfig, setToastConfig] = useState<{
    visible: boolean;
    message: string;
    type: 'success' | 'error' | 'info';
    duration: number;
  }>({
    visible: false,
    message: '',
    type: 'success',
    duration: 3000,
  });

  const showToast = useCallback((
    message: string,
    type: 'success' | 'error' | 'info' = 'success',
    duration: number = 3000
  ) => {
    setToastConfig({
      visible: true,
      message,
      type,
      duration,
    });
  }, []);

  const showSuccessToast = useCallback((message: string, duration: number = 3000) => {
    showToast(message, 'success', duration);
  }, [showToast]);

  const showErrorToast = useCallback((message: string, duration: number = 3000) => {
    showToast(message, 'error', duration);
  }, [showToast]);

  const showInfoToast = useCallback((message: string, duration: number = 3000) => {
    showToast(message, 'info', duration);
  }, [showToast]);

  const hideToast = useCallback(() => {
    setToastConfig(prev => ({
      ...prev,
      visible: false,
    }));
  }, []);

  const value: ToastContextType = {
    showToast,
    showSuccessToast,
    showErrorToast,
    showInfoToast,
    hideToast,
  };

  return (
    <ToastContext.Provider value={value}>
      {children}
      <Toast
        visible={toastConfig.visible}
        message={toastConfig.message}
        type={toastConfig.type}
        duration={toastConfig.duration}
        onHide={hideToast}
      />
    </ToastContext.Provider>
  );
};