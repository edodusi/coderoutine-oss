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
  Easing,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../../context/ThemeContext';

const { height: SCREEN_HEIGHT } = Dimensions.get('window');

export type SubscriptionModalType =
  | 'purchase_success'
  | 'purchase_error'
  | 'verification_failed'
  | 'restore_success'
  | 'restore_error'
  | 'store_unavailable'
  | 'premium_required'
  | 'loading';

export interface SubscriptionModalProps {
  visible: boolean;
  type: SubscriptionModalType;
  title?: string;
  message?: string;
  details?: string;
  onClose: () => void;
  onRetry?: () => void;
  onContactSupport?: () => void;
  onSubscribe?: () => void;
}

interface ModalConfig {
  icon: keyof typeof Ionicons.glyphMap;
  iconColor: string;
  title: string;
  showRetry?: boolean;
  showSupport?: boolean;
  showSubscribe?: boolean;
}

const SubscriptionModal: React.FC<SubscriptionModalProps> = ({
  visible,
  type,
  title,
  message,
  details,
  onClose,
  onRetry,
  onContactSupport,
  onSubscribe,
}) => {
  const { theme } = useTheme();
  const modalTranslateY = useRef(new Animated.Value(SCREEN_HEIGHT)).current;
  const modalOpacity = useRef(new Animated.Value(0)).current;
  const backdropOpacity = useRef(new Animated.Value(0)).current;

  const getModalConfig = (): ModalConfig => {
    switch (type) {
      case 'purchase_success':
        return {
          icon: 'checkmark-circle',
          iconColor: theme.colors.success,
          title: '🎉 Subscription Activated!',
        };
      case 'purchase_error':
        return {
          icon: 'close-circle',
          iconColor: theme.colors.error,
          title: '❌ Purchase Failed',
          showRetry: true,
        };
      case 'verification_failed':
        return {
          icon: 'warning',
          iconColor: theme.colors.warning,
          title: '⚠️ Verification Issue',
          showSupport: true,
        };
      case 'restore_success':
        return {
          icon: 'checkmark-circle',
          iconColor: theme.colors.success,
          title: '✅ Restore Complete',
        };
      case 'restore_error':
        return {
          icon: 'close-circle',
          iconColor: theme.colors.error,
          title: '❌ Restore Failed',
          showRetry: true,
        };
      case 'store_unavailable':
        return {
          icon: 'cloud-offline',
          iconColor: theme.colors.textSecondary,
          title: '📱 Store Unavailable',
        };

      case 'premium_required':
        return {
          icon: 'diamond',
          iconColor: theme.colors.primary,
          title: '✨ Premium Feature',
          showSubscribe: true,
        };
      case 'loading':
        return {
          icon: 'hourglass',
          iconColor: theme.colors.primary,
          title: '⏳ Processing...',
        };
      default:
        return {
          icon: 'information-circle',
          iconColor: theme.colors.primary,
          title: 'Information',
        };
    }
  };

  const config = getModalConfig();
  const modalTitle = title || config.title;

  const getDefaultMessage = (): string => {
    switch (type) {
      case 'purchase_success':
        return 'Welcome to CodeRoutine Premium! You now have unlimited access to:\n\n✨ AI-powered article summaries\n🌍 Real-time translations\n🚫 Ad-free reading experience\n❤️ Unlimited favorites\n📱 Enhanced features';
      case 'purchase_error':
        return 'We encountered an issue while processing your subscription. Please try again or contact support if the problem persists.';
      case 'verification_failed':
        return 'Your purchase was successful but we couldn\'t verify it with our servers. Your subscription should be active. If you don\'t see premium features, please contact support.';
      case 'restore_success':
        return 'Your subscription status has been updated successfully. If you have an active subscription, premium features are now available.';
      case 'restore_error':
        return 'We couldn\'t restore your purchases at this time. Please check your internet connection and try again.';
      case 'store_unavailable':
        return 'The app store is currently unavailable. Please check your internet connection and try again later.';

      case 'premium_required':
        return 'This feature is available for premium subscribers only. Your support helps us maintain and improve these AI-powered features!';
      case 'loading':
        return 'Please wait while we process your request...';
      default:
        return 'An unexpected situation occurred.';
    }
  };

  const modalMessage = message || getDefaultMessage();

  useEffect(() => {
    if (visible) {
      // Show modal
      Animated.parallel([
        Animated.timing(backdropOpacity, {
          toValue: 0.5,
          duration: 150,
          useNativeDriver: true,
        }),
        Animated.timing(modalTranslateY, {
          toValue: -10,
          duration: 180,
          easing: Easing.out(Easing.cubic),
          useNativeDriver: true,
        }),
        Animated.timing(modalOpacity, {
          toValue: 1,
          duration: 180,
          useNativeDriver: true,
        }),
      ]).start(() => {
        // Small bounce back to final position
        Animated.timing(modalTranslateY, {
          toValue: 0,
          duration: 60,
          easing: Easing.out(Easing.ease),
          useNativeDriver: true,
        }).start();
      });
    } else {
      // Hide modal
      Animated.parallel([
        Animated.timing(backdropOpacity, {
          toValue: 0,
          duration: 150,
          useNativeDriver: true,
        }),
        Animated.timing(modalTranslateY, {
          toValue: SCREEN_HEIGHT,
          duration: 150,
          useNativeDriver: true,
        }),
        Animated.timing(modalOpacity, {
          toValue: 0,
          duration: 150,
          useNativeDriver: true,
        }),
      ]).start();
    }
  }, [visible]);

  const handleClose = () => {
    Animated.parallel([
      Animated.timing(backdropOpacity, {
        toValue: 0,
        duration: 150,
        useNativeDriver: true,
      }),
      Animated.timing(modalTranslateY, {
        toValue: SCREEN_HEIGHT,
        duration: 150,
        useNativeDriver: true,
      }),
      Animated.timing(modalOpacity, {
        toValue: 0,
        duration: 150,
        useNativeDriver: true,
      }),
    ]).start(() => {
      onClose();
    });
  };

  const handleOverlayPress = () => {
    if (type !== 'loading') {
      handleClose();
    }
  };

  const styles = StyleSheet.create({
    overlay: {
      flex: 1,
      justifyContent: 'flex-end',
    },
    backdrop: {
      ...StyleSheet.absoluteFillObject,
      backgroundColor: '#000',
    },
    container: {
      paddingHorizontal: 16,
      paddingBottom: 50,
    },
    modal: {
      backgroundColor: theme.colors.card,
      borderRadius: 16,
      padding: 24,
      maxHeight: SCREEN_HEIGHT * 0.8,
      elevation: 8,
      shadowOpacity: 0.25,
      shadowRadius: 16,
      shadowOffset: { width: 0, height: 8 },
    },
    header: {
      alignItems: 'center',
      marginBottom: 20,
    },
    icon: {
      marginBottom: 12,
    },
    title: {
      fontSize: 20,
      fontWeight: 'bold',
      color: theme.colors.text,
      textAlign: 'center',
      marginBottom: 8,
    },
    message: {
      fontSize: 16,
      color: theme.colors.text,
      textAlign: 'center',
      lineHeight: 24,
      marginBottom: 16,
    },
    details: {
      fontSize: 14,
      color: theme.colors.textSecondary,
      textAlign: 'center',
      lineHeight: 20,
      marginBottom: 20,
      backgroundColor: theme.colors.surface,
      padding: 12,
      borderRadius: 8,
      fontFamily: 'monospace',
    },
    buttonContainer: {
      gap: 12,
    },
    button: {
      backgroundColor: theme.colors.primary,
      borderRadius: 12,
      paddingVertical: 14,
      paddingHorizontal: 20,
      alignItems: 'center',
      flexDirection: 'row',
      justifyContent: 'center',
    },
    buttonSecondary: {
      backgroundColor: 'transparent',
      borderWidth: 1,
      borderColor: theme.colors.border,
    },
    buttonDanger: {
      backgroundColor: theme.colors.error,
    },
    buttonText: {
      fontSize: 16,
      fontWeight: '600',
      color: '#FFFFFF',
    },
    buttonTextSecondary: {
      color: theme.colors.text,
    },
    buttonIcon: {
      marginRight: 8,
    },
    loadingContainer: {
      alignItems: 'center',
      paddingVertical: 20,
    },
    loadingText: {
      fontSize: 16,
      color: theme.colors.text,
      marginTop: 12,
    },
    celebrationContainer: {
      backgroundColor: theme.colors.success + '10',
      borderRadius: 12,
      padding: 16,
      marginVertical: 16,
      alignItems: 'center',
    },
    celebrationText: {
      fontSize: 18,
      fontWeight: '600',
      color: theme.colors.success,
      marginBottom: 12,
    },
    featureHighlights: {
      alignSelf: 'stretch',
    },
    featureHighlight: {
      fontSize: 14,
      color: theme.colors.success,
      marginBottom: 4,
      textAlign: 'center',
    },
  });

  if (!visible) return null;

  return (
    <Modal
      transparent
      visible={visible}
      animationType="none"
      statusBarTranslucent
      onRequestClose={type !== 'loading' ? handleClose : undefined}
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

        <TouchableWithoutFeedback onPress={handleOverlayPress}>
          <View style={styles.container}>
            <TouchableWithoutFeedback onPress={() => {}}>
              <Animated.View
                style={[
                  styles.modal,
                  {
                    transform: [{ translateY: modalTranslateY }],
                    opacity: modalOpacity,
                  },
                ]}
              >
                {type === 'loading' ? (
                  <View style={styles.loadingContainer}>
                    <Animated.View
                      style={{
                        transform: [{
                          rotate: modalOpacity.interpolate({
                            inputRange: [0, 1],
                            outputRange: ['0deg', '360deg'],
                          })
                        }]
                      }}
                    >
                      <Ionicons
                        name="hourglass"
                        size={40}
                        color={theme.colors.primary}
                      />
                    </Animated.View>
                    <Text style={styles.loadingText}>{modalMessage}</Text>
                  </View>
                ) : (
                  <>
                    <View style={styles.header}>
                      <View style={styles.icon}>
                        <Ionicons
                          name={config.icon}
                          size={48}
                          color={config.iconColor}
                        />
                      </View>
                      <Text style={styles.title}>{modalTitle}</Text>
                    </View>

                    <Text style={styles.message}>{modalMessage}</Text>

                    {details && (
                      <Text style={styles.details}>{details}</Text>
                    )}

                    {/* Special success celebration for purchase success */}
                    {type === 'purchase_success' && (
                      <View style={styles.celebrationContainer}>
                        <Text style={styles.celebrationText}>🎉 Welcome to Premium! 🎉</Text>
                        <View style={styles.featureHighlights}>
                          <Text style={styles.featureHighlight}>• Start exploring AI summaries</Text>
                          <Text style={styles.featureHighlight}>• Try article translations</Text>
                          <Text style={styles.featureHighlight}>• Enjoy ad-free reading</Text>
                        </View>
                      </View>
                    )}

                    <View style={styles.buttonContainer}>
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

                      {config.showSupport && onContactSupport && (
                        <TouchableOpacity
                          style={[styles.button, styles.buttonSecondary]}
                          onPress={() => {
                            handleClose();
                            onContactSupport();
                          }}
                        >
                          <Ionicons
                            name="help-circle"
                            size={20}
                            color={theme.colors.text}
                            style={styles.buttonIcon}
                          />
                          <Text style={[styles.buttonText, styles.buttonTextSecondary]}>
                            Contact Support
                          </Text>
                        </TouchableOpacity>
                      )}

                      {config.showSubscribe && onSubscribe && (
                        <TouchableOpacity
                          style={styles.button}
                          onPress={() => {
                            handleClose();
                            onSubscribe();
                          }}
                        >
                          <Ionicons
                            name="diamond"
                            size={20}
                            color="#FFFFFF"
                            style={styles.buttonIcon}
                          />
                          <Text style={styles.buttonText}>Get Premium</Text>
                        </TouchableOpacity>
                      )}


                      <TouchableOpacity
                        style={[
                          styles.button,
                          config.showRetry || config.showSupport || config.showSubscribe
                            ? styles.buttonSecondary
                            : styles.button,
                        ]}
                        onPress={handleClose}
                      >
                        <Text
                          style={[
                            styles.buttonText,
                            config.showRetry || config.showSupport || config.showSubscribe
                              ? styles.buttonTextSecondary
                              : styles.buttonText,
                          ]}
                        >
                          {type === 'purchase_success' || type === 'restore_success' ? 'Let\'s Go!' : type === 'premium_required' ? 'Maybe Later' : 'OK'}
                        </Text>
                      </TouchableOpacity>
                    </View>
                  </>
                )}
              </Animated.View>
            </TouchableWithoutFeedback>
          </View>
        </TouchableWithoutFeedback>
      </View>
    </Modal>
  );
};

export default SubscriptionModal;
