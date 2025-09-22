import React, { useRef, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Modal,
  TouchableOpacity,
  Animated,
  Dimensions,
  TouchableWithoutFeedback,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../../../context/ThemeContext';

const { height: SCREEN_HEIGHT, width: SCREEN_WIDTH } = Dimensions.get('window');
// Optimize for common Android screen sizes (5.5" to 6.7" displays)
const IS_COMPACT_SCREEN = SCREEN_HEIGHT < 800 || SCREEN_WIDTH < 360;
const IS_LARGE_SCREEN = SCREEN_HEIGHT > 900 && SCREEN_WIDTH > 400;

export type NotificationModalType =
  | 'permission_request'
  | 'permission_denied'
  | 'enable_success'
  | 'disable_success'
  | 'enable_error'
  | 'disable_error';

export interface NotificationModalProps {
  visible: boolean;
  type: NotificationModalType;
  title?: string;
  message?: string;
  details?: string;
  onClose: () => void;
  onRetry?: () => void;
  onEnable?: () => void;
  onOpenSettings?: () => void;
}

interface ModalConfig {
  icon: keyof typeof Ionicons.glyphMap;
  iconColor: string;
  title: string;
  showRetry?: boolean;
  showEnable?: boolean;
  showOpenSettings?: boolean;
}

const NotificationModal: React.FC<NotificationModalProps> = ({
  visible,
  type,
  title,
  message,
  details,
  onClose,
  onRetry,
  onEnable,
  onOpenSettings,
}) => {
  const { theme } = useTheme();
  const modalScale = useRef(new Animated.Value(0)).current;
  const modalOpacity = useRef(new Animated.Value(0)).current;
  const backdropOpacity = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (visible) {
      // Show modal
      Animated.parallel([
        Animated.timing(backdropOpacity, {
          toValue: 0.5,
          duration: 300,
          useNativeDriver: true,
        }),
        Animated.spring(modalScale, {
          toValue: 1,
          tension: 100,
          friction: 8,
          useNativeDriver: true,
        }),
        Animated.timing(modalOpacity, {
          toValue: 1,
          duration: 300,
          useNativeDriver: true,
        }),
      ]).start();
    } else {
      // Hide modal
      Animated.parallel([
        Animated.timing(backdropOpacity, {
          toValue: 0,
          duration: 250,
          useNativeDriver: true,
        }),
        Animated.timing(modalScale, {
          toValue: 0,
          duration: 250,
          useNativeDriver: true,
        }),
        Animated.timing(modalOpacity, {
          toValue: 0,
          duration: 250,
          useNativeDriver: true,
        }),
      ]).start();
    }
  }, [visible]);

  const handleClose = () => {
    Animated.parallel([
      Animated.timing(backdropOpacity, {
        toValue: 0,
        duration: 250,
        useNativeDriver: true,
      }),
      Animated.timing(modalScale, {
        toValue: 0,
        duration: 250,
        useNativeDriver: true,
      }),
      Animated.timing(modalOpacity, {
        toValue: 0,
        duration: 250,
        useNativeDriver: true,
      }),
    ]).start(() => {
      onClose();
    });
  };

  const getModalConfig = (): ModalConfig => {
    switch (type) {
      case 'permission_request':
        return {
          icon: 'notifications',
          iconColor: theme.colors.primary,
          title: 'Enable Notifications',
          showEnable: true,
        };
      case 'permission_denied':
        return {
          icon: 'notifications-off',
          iconColor: theme.colors.error,
          title: 'Permission Required',
          showOpenSettings: true,
        };
      case 'enable_success':
        return {
          icon: 'checkmark-circle',
          iconColor: theme.colors.success,
          title: 'Notifications Enabled',
        };
      case 'disable_success':
        return {
          icon: 'checkmark-circle',
          iconColor: theme.colors.success,
          title: 'Notifications Disabled',
        };
      case 'enable_error':
        return {
          icon: 'close-circle',
          iconColor: theme.colors.error,
          title: 'Enable Failed',
          showRetry: true,
        };
      case 'disable_error':
        return {
          icon: 'close-circle',
          iconColor: theme.colors.error,
          title: 'Disable Failed',
          showRetry: true,
        };

      default:
        return {
          icon: 'information-circle',
          iconColor: theme.colors.primary,
          title: 'Notification',
        };
    }
  };

  const getDefaultMessage = (): string => {
    switch (type) {
      case 'permission_request':
        return 'Get notified when new articles are available. We\'ll only send you relevant updates about daily coding content.';
      case 'permission_denied':
        return 'Notification permission was denied. You can enable it manually in your device settings.';
      case 'enable_success':
        return 'You\'ll now receive notifications when new articles are available.';
      case 'disable_success':
        return 'You will no longer receive push notifications.';
      case 'enable_error':
        return 'We couldn\'t enable notifications. Please check your connection and try again.';
      case 'disable_error':
        return 'We couldn\'t disable notifications. Please check your connection and try again.';

      default:
        return 'Notification update';
    }
  };

  const config = getModalConfig();

  const styles = StyleSheet.create({
    overlay: {
      flex: 1,
      justifyContent: 'center',
      alignItems: 'center',
    },
    backdrop: {
      ...StyleSheet.absoluteFillObject,
      backgroundColor: '#000',
    },
    container: {
      justifyContent: 'center',
      alignItems: 'center',
      paddingHorizontal: IS_COMPACT_SCREEN ? 16 : IS_LARGE_SCREEN ? 24 : 20,
      paddingVertical: 40,
    },
    modal: {
      backgroundColor: theme.colors.card,
      borderRadius: IS_COMPACT_SCREEN ? 16 : 20,
      maxHeight: Math.min(SCREEN_HEIGHT * 0.8, 600), // Max 600px or 80% of screen
      maxWidth: Math.min(SCREEN_WIDTH * 0.9, 400), // Max 400px or 90% of screen width
      minHeight: 200, // Ensure minimum usable height
      width: '100%',
      elevation: 8,
      shadowOpacity: 0.25,
      shadowRadius: 16,
      shadowOffset: { width: 0, height: 8 },
      overflow: 'hidden',
    },
    scrollContainer: {
      padding: IS_COMPACT_SCREEN ? 20 : IS_LARGE_SCREEN ? 28 : 24,
    },
    header: {
      alignItems: 'center',
      marginBottom: IS_COMPACT_SCREEN ? 16 : IS_LARGE_SCREEN ? 24 : 20,
    },
    icon: {
      marginBottom: IS_COMPACT_SCREEN ? 8 : IS_LARGE_SCREEN ? 16 : 12,
    },
    title: {
      fontSize: 18,
      fontWeight: 'bold',
      color: theme.colors.text,
      textAlign: 'center',
      marginBottom: IS_COMPACT_SCREEN ? 8 : IS_LARGE_SCREEN ? 12 : 10,
    },
    message: {
      fontSize: 16,
      color: theme.colors.text,
      textAlign: 'center',
      lineHeight: 22,
      marginBottom: IS_COMPACT_SCREEN ? 12 : IS_LARGE_SCREEN ? 20 : 16,
    },
    details: {
      fontSize: 14,
      color: theme.colors.textSecondary,
      textAlign: 'center',
      lineHeight: 20,
      marginBottom: IS_COMPACT_SCREEN ? 12 : IS_LARGE_SCREEN ? 24 : 20,
      backgroundColor: theme.colors.surface,
      padding: IS_COMPACT_SCREEN ? 12 : IS_LARGE_SCREEN ? 16 : 14,
      borderRadius: 10,
      fontFamily: 'monospace',
    },
    buttonContainer: {
      gap: IS_COMPACT_SCREEN ? 10 : IS_LARGE_SCREEN ? 16 : 12,
      marginTop: IS_COMPACT_SCREEN ? 12 : IS_LARGE_SCREEN ? 20 : 16,
    },
    button: {
      backgroundColor: theme.colors.primary,
      borderRadius: IS_COMPACT_SCREEN ? 10 : IS_LARGE_SCREEN ? 14 : 12,
      paddingVertical: IS_COMPACT_SCREEN ? 14 : IS_LARGE_SCREEN ? 18 : 16, // Ensure 44dp+ touch target
      paddingHorizontal: IS_COMPACT_SCREEN ? 16 : IS_LARGE_SCREEN ? 24 : 20,
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      minHeight: 44, // Android minimum touch target
    },
    buttonSecondary: {
      backgroundColor: 'transparent',
      borderWidth: 1,
      borderColor: theme.colors.border,
    },
    buttonIcon: {
      marginRight: IS_COMPACT_SCREEN ? 6 : IS_LARGE_SCREEN ? 10 : 8,
    },
    buttonText: {
      color: '#FFFFFF',
      fontSize: 16,
      fontWeight: '600',
    },
    buttonTextSecondary: {
      color: theme.colors.text,
    },
  });

  return (
    <Modal
      visible={visible}
      transparent
      animationType="none"
      statusBarTranslucent
      onRequestClose={handleClose}
    >
      <View style={styles.overlay}>
        <Animated.View
          style={[
            styles.backdrop,
            {
              opacity: backdropOpacity,
            },
          ]}
        />

        <TouchableWithoutFeedback onPress={handleClose}>
          <View style={styles.container}>
            <TouchableWithoutFeedback onPress={() => {}}>
              <Animated.View
                style={[
                  styles.modal,
                  {
                    transform: [{ scale: modalScale }],
                    opacity: modalOpacity,
                  },
                ]}
              >
                <View style={styles.scrollContainer}>
                  {/* Header */}
                  <View style={styles.header}>
                    <Ionicons
                      name={config.icon}
                      size={IS_COMPACT_SCREEN ? 36 : IS_LARGE_SCREEN ? 52 : 44}
                      color={config.iconColor}
                      style={styles.icon}
                    />
                    <Text style={styles.title}>
                      {title || config.title}
                    </Text>
                  </View>

                  {/* Message */}
                  <Text style={styles.message}>
                    {message || getDefaultMessage()}
                  </Text>

                  {/* Details */}
                  {details && (
                    <Text style={styles.details}>
                      {details}
                    </Text>
                  )}

                  {/* Action Buttons */}
                  <View style={styles.buttonContainer}>
                  {config.showEnable && onEnable && (
                    <TouchableOpacity
                      style={styles.button}
                      onPress={() => {
                        handleClose();
                        onEnable();
                      }}
                    >
                      <Ionicons
                        name="notifications"
                        size={20}
                        color="#FFFFFF"
                        style={styles.buttonIcon}
                      />
                      <Text style={styles.buttonText}>Enable Notifications</Text>
                    </TouchableOpacity>
                  )}

                  {config.showRetry && onRetry && (
                    <TouchableOpacity
                      style={styles.button}
                      onPress={() => {
                        handleClose();
                        onRetry();
                      }}
                    >
                      <Ionicons
                        name="refresh"
                        size={20}
                        color="#FFFFFF"
                        style={styles.buttonIcon}
                      />
                      <Text style={styles.buttonText}>Try Again</Text>
                    </TouchableOpacity>
                  )}

                  {config.showOpenSettings && onOpenSettings && (
                    <TouchableOpacity
                      style={[styles.button, styles.buttonSecondary]}
                      onPress={() => {
                        handleClose();
                        onOpenSettings();
                      }}
                    >
                      <Ionicons
                        name="settings"
                        size={20}
                        color={theme.colors.text}
                        style={styles.buttonIcon}
                      />
                      <Text style={[styles.buttonText, styles.buttonTextSecondary]}>
                        Open Settings
                      </Text>
                    </TouchableOpacity>
                  )}

                  {/* Close Button */}
                  <TouchableOpacity
                    style={[
                      styles.button,
                      config.showRetry || config.showEnable || config.showOpenSettings
                        ? styles.buttonSecondary
                        : styles.button,
                    ]}
                    onPress={handleClose}
                  >
                    <Text
                      style={[
                        styles.buttonText,
                        config.showRetry || config.showEnable || config.showOpenSettings
                          ? styles.buttonTextSecondary
                          : styles.buttonText,
                      ]}
                    >
                      {config.showRetry || config.showEnable || config.showOpenSettings ? 'Cancel' : 'OK'}
                    </Text>
                  </TouchableOpacity>
                </View>
              </View>
              </Animated.View>
            </TouchableWithoutFeedback>
          </View>
        </TouchableWithoutFeedback>
      </View>
    </Modal>
  );
};

export default NotificationModal;
