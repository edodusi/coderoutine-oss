/**
 * UpdateNotification Component
 *
 * Displays a minimal notification banner at the top when an app update
 * is ready to be applied. User can reload immediately or dismiss.
 * Matches the app's design system and respects safe areas.
 */

import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Platform,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../context/ThemeContext';

interface UpdateNotificationProps {
  isVisible: boolean;
  onReload: () => void;
  onDismiss: () => void;
  devMode?: boolean;
}

export default function UpdateNotification({
  isVisible,
  onReload,
  onDismiss,
  devMode = false,
}: UpdateNotificationProps) {
  const { theme } = useTheme();
  const insets = useSafeAreaInsets();

  if (!isVisible) {
    return null;
  }

  return (
    <View
      style={[
        styles.container,
        {
          backgroundColor: theme.colors.success,
          paddingTop: insets.top + 8,
          borderBottomColor: theme.colors.border,
        },
      ]}
    >
      <View style={styles.content}>
        <Ionicons
          name="checkmark-circle"
          size={20}
          color={theme.colors.background}
          style={styles.icon}
        />
        <Text
          style={[
            styles.message,
            { color: theme.colors.background },
          ]}
        >
          {devMode ? '[DEV] App update available' : 'App update available'}
        </Text>
      </View>

      <View style={styles.actions}>
        <TouchableOpacity
          style={[
            styles.reloadButton,
            { backgroundColor: theme.colors.background },
          ]}
          onPress={onReload}
          activeOpacity={0.7}
        >
          <Text
            style={[
              styles.reloadText,
              { color: theme.colors.success },
            ]}
          >
            Reload
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.dismissButton}
          onPress={onDismiss}
          activeOpacity={0.7}
        >
          <Ionicons
            name="close"
            size={20}
            color={theme.colors.background}
          />
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingBottom: 12,
    borderBottomWidth: 1,
    ...Platform.select({
      ios: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.1,
        shadowRadius: 4,
      },
      android: {
        elevation: 4,
      },
    }),
  },
  content: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  icon: {
    marginRight: 8,
  },
  message: {
    fontSize: 14,
    fontWeight: '600',
    flex: 1,
    paddingRight: 8,
  },
  actions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  reloadButton: {
    paddingHorizontal: 16,
    paddingVertical: 4,
    borderRadius: 6,
  },
  reloadText: {
    fontSize: 14,
    fontWeight: '600',
  },
  dismissButton: {
    padding: 6,
  },
});
