import React, { useRef, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Modal,
  Animated,
  Dimensions,
  Easing,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../../context/ThemeContext';

const { height: SCREEN_HEIGHT } = Dimensions.get('window');

export interface LoadingModalProps {
  visible: boolean;
  message?: string;
  subMessage?: string;
}

const LoadingModal: React.FC<LoadingModalProps> = ({
  visible,
  message = 'Processing...',
  subMessage,
}) => {
  const { theme } = useTheme();
  const modalTranslateY = useRef(new Animated.Value(SCREEN_HEIGHT)).current;
  const modalOpacity = useRef(new Animated.Value(0)).current;
  const overlayOpacity = useRef(new Animated.Value(0)).current;
  const spinAnimation = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (visible) {
      // Reset values
      modalTranslateY.setValue(SCREEN_HEIGHT);
      modalOpacity.setValue(0);
      overlayOpacity.setValue(0);
      spinAnimation.setValue(0);

      // Start spinning animation
      Animated.loop(
        Animated.timing(spinAnimation, {
          toValue: 1,
          duration: 2000,
          easing: Easing.linear,
          useNativeDriver: true,
        })
      ).start();

      // Animate modal in
      Animated.parallel([
        Animated.timing(overlayOpacity, {
          toValue: 1,
          duration: 200,
          useNativeDriver: true,
        }),
        Animated.timing(modalOpacity, {
          toValue: 1,
          duration: 250,
          useNativeDriver: true,
        }),
        Animated.spring(modalTranslateY, {
          toValue: 0,
          damping: 15,
          mass: 0.8,
          stiffness: 200,
          useNativeDriver: true,
        }),
      ]).start();
    } else {
      // Stop spinning animation
      spinAnimation.stopAnimation();
    }
  }, [visible]);

  const spin = spinAnimation.interpolate({
    inputRange: [0, 1],
    outputRange: ['0deg', '360deg'],
  });

  const styles = StyleSheet.create({
    overlay: {
      position: 'absolute',
      top: 0,
      left: 0,
      right: 0,
      bottom: 0,
      backgroundColor: 'rgba(0, 0, 0, 0.6)',
    },
    container: {
      flex: 1,
      justifyContent: 'center',
      alignItems: 'center',
      paddingHorizontal: 40,
    },
    modal: {
      backgroundColor: theme.colors.card,
      borderRadius: 20,
      padding: 32,
      alignItems: 'center',
      minWidth: 280,
      maxWidth: 320,
      elevation: 12,
      shadowOpacity: 0.3,
      shadowRadius: 20,
      shadowOffset: { width: 0, height: 10 },
    },
    iconContainer: {
      marginBottom: 20,
    },
    loadingIcon: {
      marginBottom: 8,
    },
    title: {
      fontSize: 18,
      fontWeight: '600',
      color: theme.colors.text,
      textAlign: 'center',
      marginBottom: 12,
    },
    message: {
      fontSize: 16,
      color: theme.colors.text,
      textAlign: 'center',
      lineHeight: 22,
    },
    subMessage: {
      fontSize: 14,
      color: theme.colors.textSecondary,
      textAlign: 'center',
      lineHeight: 20,
      marginTop: 8,
    },
    dotsContainer: {
      flexDirection: 'row',
      justifyContent: 'center',
      alignItems: 'center',
      marginTop: 16,
    },
    dot: {
      width: 8,
      height: 8,
      borderRadius: 4,
      backgroundColor: theme.colors.primary,
      marginHorizontal: 3,
    },
  });

  // Animated dots for loading effect
  const DotAnimation = ({ delay }: { delay: number }) => {
    const dotOpacity = useRef(new Animated.Value(0.3)).current;

    useEffect(() => {
      if (visible) {
        const animate = () => {
          Animated.sequence([
            Animated.timing(dotOpacity, {
              toValue: 1,
              duration: 600,
              delay,
              useNativeDriver: true,
            }),
            Animated.timing(dotOpacity, {
              toValue: 0.3,
              duration: 600,
              useNativeDriver: true,
            }),
          ]).start(() => {
            if (visible) {
              animate();
            }
          });
        };
        animate();
      }
    }, [visible, delay]);

    return (
      <Animated.View style={[styles.dot, { opacity: dotOpacity }]} />
    );
  };

  if (!visible) return null;

  return (
    <Modal
      transparent
      visible={visible}
      animationType="none"
      statusBarTranslucent
    >
      <Animated.View style={[styles.overlay, { opacity: overlayOpacity }]}>
        <View style={styles.container}>
          <Animated.View
            style={[
              styles.modal,
              {
                opacity: modalOpacity,
                transform: [{ translateY: modalTranslateY }],
              },
            ]}
          >
            <View style={styles.iconContainer}>
              <Animated.View
                style={[
                  styles.loadingIcon,
                  {
                    transform: [{ rotate: spin }],
                  },
                ]}
              >
                <Ionicons
                  name="sync"
                  size={40}
                  color={theme.colors.primary}
                />
              </Animated.View>
            </View>

            <Text style={styles.title}>{message}</Text>

            {subMessage && (
              <Text style={styles.subMessage}>{subMessage}</Text>
            )}

            <View style={styles.dotsContainer}>
              <DotAnimation delay={0} />
              <DotAnimation delay={200} />
              <DotAnimation delay={400} />
            </View>
          </Animated.View>
        </View>
      </Animated.View>
    </Modal>
  );
};

export default LoadingModal;