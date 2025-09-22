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
import { useTheme } from '../../context/ThemeContext';

const { height: SCREEN_HEIGHT, width: SCREEN_WIDTH } = Dimensions.get('window');
// Optimize for common Android screen sizes (5.5" to 6.7" displays)
const IS_COMPACT_SCREEN = SCREEN_HEIGHT < 800 || SCREEN_WIDTH < 360;
const IS_LARGE_SCREEN = SCREEN_HEIGHT > 900 && SCREEN_WIDTH > 400;

interface NotificationOnboardingModalProps {
  visible: boolean;
  onEnable: () => void;
  onSkip: () => void;
  isLoading: boolean;
}

const NotificationOnboardingModal: React.FC<NotificationOnboardingModalProps> = ({
  visible,
  onEnable,
  onSkip,
  isLoading,
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
      padding: IS_COMPACT_SCREEN ? 20 : IS_LARGE_SCREEN ? 28 : 24,
      maxHeight: Math.min(SCREEN_HEIGHT * 0.8, 600),
      maxWidth: Math.min(SCREEN_WIDTH * 0.9, 400),
      width: '100%',
      minHeight: 200,
      elevation: 8,
      shadowOpacity: 0.25,
      shadowRadius: 16,
      shadowOffset: { width: 0, height: 8 },
    },
    header: {
      alignItems: 'center',
      marginBottom: IS_COMPACT_SCREEN ? 16 : IS_LARGE_SCREEN ? 24 : 20,
    },
    iconContainer: {
      width: IS_COMPACT_SCREEN ? 60 : IS_LARGE_SCREEN ? 80 : 70,
      height: IS_COMPACT_SCREEN ? 60 : IS_LARGE_SCREEN ? 80 : 70,
      borderRadius: IS_COMPACT_SCREEN ? 30 : IS_LARGE_SCREEN ? 40 : 35,
      backgroundColor: theme.colors.primary + '20',
      justifyContent: 'center',
      alignItems: 'center',
      marginBottom: IS_COMPACT_SCREEN ? 12 : IS_LARGE_SCREEN ? 16 : 14,
    },
    title: {
      fontSize: 20,
      fontWeight: 'bold',
      color: theme.colors.text,
      textAlign: 'center',
      marginBottom: 8,
    },
    subtitle: {
      fontSize: 16,
      color: theme.colors.textSecondary,
      textAlign: 'center',
      lineHeight: 22,
    },
    content: {
      marginBottom: IS_COMPACT_SCREEN ? 20 : IS_LARGE_SCREEN ? 32 : 24,
    },
    benefitItem: {
      flexDirection: 'row',
      alignItems: 'flex-start',
      marginBottom: IS_COMPACT_SCREEN ? 12 : IS_LARGE_SCREEN ? 16 : 14,
    },
    benefitIcon: {
      width: IS_COMPACT_SCREEN ? 20 : IS_LARGE_SCREEN ? 24 : 22,
      height: IS_COMPACT_SCREEN ? 20 : IS_LARGE_SCREEN ? 24 : 22,
      borderRadius: IS_COMPACT_SCREEN ? 10 : IS_LARGE_SCREEN ? 12 : 11,
      backgroundColor: theme.colors.success + '20',
      justifyContent: 'center',
      alignItems: 'center',
      marginRight: IS_COMPACT_SCREEN ? 10 : IS_LARGE_SCREEN ? 12 : 11,
      marginTop: 2,
    },
    benefitText: {
      flex: 1,
      fontSize: 16,
      color: theme.colors.text,
      lineHeight: 22,
    },
    noteContainer: {
      backgroundColor: theme.colors.surface,
      borderRadius: IS_COMPACT_SCREEN ? 10 : IS_LARGE_SCREEN ? 12 : 11,
      padding: IS_COMPACT_SCREEN ? 12 : IS_LARGE_SCREEN ? 16 : 14,
      marginTop: IS_COMPACT_SCREEN ? 8 : IS_LARGE_SCREEN ? 12 : 10,
    },
    noteText: {
      fontSize: 14,
      color: theme.colors.textSecondary,
      lineHeight: 20,
      fontStyle: 'italic',
    },
    buttonContainer: {
      gap: IS_COMPACT_SCREEN ? 10 : IS_LARGE_SCREEN ? 16 : 12,
    },
    enableButton: {
      backgroundColor: theme.colors.primary,
      borderRadius: IS_COMPACT_SCREEN ? 10 : IS_LARGE_SCREEN ? 14 : 12,
      paddingVertical: IS_COMPACT_SCREEN ? 14 : IS_LARGE_SCREEN ? 18 : 16,
      paddingHorizontal: IS_COMPACT_SCREEN ? 16 : IS_LARGE_SCREEN ? 24 : 20,
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      minHeight: 44,
      elevation: 2,
      shadowOpacity: 0.1,
      shadowRadius: 4,
      shadowOffset: { width: 0, height: 2 },
    },
    enableButtonDisabled: {
      backgroundColor: theme.colors.textSecondary,
      elevation: 0,
      shadowOpacity: 0,
    },
    enableButtonText: {
      color: '#FFFFFF',
      fontSize: 16,
      fontWeight: '600',
      marginLeft: 8,
    },
    skipButton: {
      backgroundColor: 'transparent',
      borderRadius: IS_COMPACT_SCREEN ? 10 : IS_LARGE_SCREEN ? 14 : 12,
      paddingVertical: IS_COMPACT_SCREEN ? 14 : IS_LARGE_SCREEN ? 18 : 16,
      paddingHorizontal: IS_COMPACT_SCREEN ? 16 : IS_LARGE_SCREEN ? 24 : 20,
      alignItems: 'center',
      justifyContent: 'center',
      minHeight: 44,
      borderWidth: 1,
      borderColor: theme.colors.border,
    },
    skipButtonText: {
      color: theme.colors.textSecondary,
      fontSize: 16,
      fontWeight: '500',
    },
  });

  return (
    <Modal
      visible={visible}
      transparent
      animationType="none"
      statusBarTranslucent
      onRequestClose={onSkip}
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

        <TouchableWithoutFeedback onPress={onSkip}>
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
                {/* Header */}
                <View style={styles.header}>
                  <View style={styles.iconContainer}>
                    <Ionicons
                      name="notifications"
                      size={IS_COMPACT_SCREEN ? 28 : IS_LARGE_SCREEN ? 36 : 32}
                      color={theme.colors.primary}
                    />
                  </View>
                  <Text style={styles.title}>Hello 👋</Text>
                  <Text style={styles.subtitle}>
                    Do you want me to notify you when new articles are available?
                  </Text>
                </View>

                {/* Content */}
                <View style={styles.content}>
                  <View style={styles.benefitItem}>
                    <View style={styles.benefitIcon}>
                      <Ionicons
                        name="checkmark"
                        size={IS_COMPACT_SCREEN ? 12 : IS_LARGE_SCREEN ? 14 : 13}
                        color={theme.colors.success}
                      />
                    </View>
                    <Text style={styles.benefitText}>
                      Daily notifications when a new article is published
                    </Text>
                  </View>

                  <View style={styles.benefitItem}>
                    <View style={styles.benefitIcon}>
                      <Ionicons
                        name="checkmark"
                        size={IS_COMPACT_SCREEN ? 12 : IS_LARGE_SCREEN ? 14 : 13}
                        color={theme.colors.success}
                      />
                    </View>
                    <Text style={styles.benefitText}>
                      No spam - promise!
                    </Text>
                  </View>

                  <View style={styles.noteContainer}>
                    <Text style={styles.noteText}>
                      💡 You can always change this setting later in the app settings
                    </Text>
                  </View>
                </View>

                {/* Buttons */}
                <View style={styles.buttonContainer}>
                  <TouchableOpacity
                    style={[
                      styles.enableButton,
                      isLoading && styles.enableButtonDisabled,
                    ]}
                    onPress={onEnable}
                    disabled={isLoading}
                    activeOpacity={0.8}
                  >
                    {isLoading ? (
                      <Ionicons
                        name="hourglass"
                        size={20}
                        color="#FFFFFF"
                      />
                    ) : (
                      <Ionicons
                        name="notifications"
                        size={20}
                        color="#FFFFFF"
                      />
                    )}
                    <Text style={styles.enableButtonText}>
                      {isLoading ? 'Setting up...' : 'Enable Notifications'}
                    </Text>
                  </TouchableOpacity>

                  <TouchableOpacity
                    style={styles.skipButton}
                    onPress={onSkip}
                    disabled={isLoading}
                    activeOpacity={0.6}
                  >
                    <Text style={styles.skipButtonText}>Maybe Later</Text>
                  </TouchableOpacity>
                </View>
              </Animated.View>
            </TouchableWithoutFeedback>
          </View>
        </TouchableWithoutFeedback>
      </View>
    </Modal>
  );
};

export default NotificationOnboardingModal;
