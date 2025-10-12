import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Switch,
  TouchableOpacity,
  Alert,
  Linking,
  ActivityIndicator,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation, useFocusEffect } from '@react-navigation/native';
import { StackNavigationProp } from '@react-navigation/stack';
import { useTheme, ThemeMode } from '../context/ThemeContext';
import { useApp } from '../context/AppContext';
import { useNotifications } from '../context/NotificationContext';
import { useModal } from '../context/ModalContext';
import { useNotificationModal } from '../context/NotificationModalContext';
import { useToast } from '../components/Toast';
import { RootStackParamList } from '../components/Navigation';
import * as Clipboard from 'expo-clipboard';
import { storageService } from '../services/storageService';
import NotificationService from '../services/NotificationService';
import { BetaStatusService } from '../services/beta';
import { getUniqueDeviceId, getUniqueDeviceIdSync } from '../utils/deviceId';
import { getAppVersion, getAppBuildNumber } from '../utils/deviceId';
import { SupportedLanguage, LanguageOption } from '../types';
import { useAppUpdates } from '../hooks/useAppUpdates';

type SettingsScreenNavigationProp = StackNavigationProp<RootStackParamList, 'Subscription'>;

const LANGUAGE_OPTIONS: LanguageOption[] = [
  { code: 'it', name: 'Italian', flag: '🇮🇹' },
  { code: 'es', name: 'Spanish', flag: '🇪🇸' },
  { code: 'de', name: 'German', flag: '🇩🇪' },
  { code: 'fr', name: 'French', flag: '🇫🇷' },
];

const SettingsScreen: React.FC = () => {
  const { theme, themeMode, setThemeMode } = useTheme();
  const navigation = useNavigation<SettingsScreenNavigationProp>();
  const {
    state,
    resetAppData,
    updateTranslationSettings,
    isSubscribed,
    subscriptionConnected,
    refreshSubscriptionStatus,
    refreshTodaysArticle,
  } = useApp();
  const {
    state: notificationState,
    enableNotifications,
    disableNotifications,
    refreshNotificationStatus,
  } = useNotifications();
  const { showSuccessModal } = useModal();
  const { showSuccessToast } = useToast();
  const {
    showPermissionRequestModal,
    showPermissionDeniedModal,
    showEnableSuccessModal,
    showDisableSuccessModal,
    showEnableErrorModal,
    showDisableErrorModal,
  } = useNotificationModal();
  const [isResetting, setIsResetting] = useState(false);
  const [isTogglingNotifications, setIsTogglingNotifications] = useState(false);
  const [betaDebugInfo, setBetaDebugInfo] = useState<any>(null);
  const [deviceId, setDeviceId] = useState<string>('Loading...');
  const [devDayOffset, setDevDayOffset] = useState<number>(0);
  const [currentDevArticleInfo, setCurrentDevArticleInfo] = useState<string>('Today');
  const [devSimulateUpdate, setDevSimulateUpdate] = useState(false);

  // App updates
  const {
    isUpdatesEnabled,
    isUpdateReady,
    checkForUpdate,
    reloadApp,
  } = useAppUpdates();
  const [isCheckingUpdate, setIsCheckingUpdate] = useState(false);

  // Get bundle version
  const bundleVersion = getAppVersion();

  // Get app build number
  const buildNumber = getAppBuildNumber();

  const handleCopyDeviceId = async () => {
    try {
      if (deviceId === 'Loading...') {
        Alert.alert('Please wait', 'Device ID is still loading');
        return;
      }
      await Clipboard.setStringAsync(deviceId);
      showSuccessToast('📋 Device ID copied!');
    } catch (_error) {
      Alert.alert('Error', 'Failed to copy Device ID to clipboard');
    }
  };

  const loadBetaDebugInfo = async () => {
    if (__DEV__) {
      try {
        const betaService = BetaStatusService.getInstance();
        const debugInfo = await betaService.getDebugInfo();
        const currentBetaStatus = await betaService.getCurrentBetaStatus();
        setBetaDebugInfo({ ...debugInfo, currentBetaStatus });
      } catch (error) {
        console.error('Error loading beta debug info:', error);
      }
    }
  };

  const loadDevDayOffset = async () => {
    if (__DEV__) {
      try {
        const offset = await storageService.getDevDayOffset();
        setDevDayOffset(offset);
        updateDevArticleInfo(offset);
      } catch (error) {
        console.error('Error loading dev day offset:', error);
      }
    }
  };

  const updateDevArticleInfo = (offset: number) => {
    if (offset === 0) {
      setCurrentDevArticleInfo('Today');
    } else if (offset > 0) {
      setCurrentDevArticleInfo(`${offset} day${offset > 1 ? 's' : ''} in the future`);
    } else {
      setCurrentDevArticleInfo(`${Math.abs(offset)} day${Math.abs(offset) > 1 ? 's' : ''} ago`);
    }
  };

  const handleDevDayOffsetChange = async (offset: number) => {
    if (!__DEV__) return;

    try {
      await storageService.saveDevDayOffset(offset);
      setDevDayOffset(offset);
      updateDevArticleInfo(offset);

      // Refresh today's article with new offset
      await refreshTodaysArticle();

      showSuccessToast(`Dev day offset set to ${offset === 0 ? 'today' : offset > 0 ? `+${offset} days` : `${offset} days`}`);
    } catch (_error) {
      Alert.alert('Error', 'Failed to update dev day offset');
    }
  };

  const handleDevSimulateUpdateToggle = async (value: boolean) => {
    if (!__DEV__) return;

    try {
      await storageService.set('dev_simulate_update', value ? 'true' : 'false');
      setDevSimulateUpdate(value);
      if (value) {
        showSuccessToast('✅ Update notification shown! Check top of screen');
      } else {
        showSuccessToast('Update notification hidden');
      }
    } catch (_error) {
      Alert.alert('Error', 'Failed to toggle update simulation');
    }
  };

  // Load device ID on component mount
  useEffect(() => {
    const loadDeviceId = async () => {
      try {
        // Try sync version first (if already cached from splash screen)
        const syncId = getUniqueDeviceIdSync();
        if (!syncId.includes('-temp-')) {
          setDeviceId(syncId);
          return;
        }

        // Fallback to async version
        const id = await getUniqueDeviceId();
        setDeviceId(id);
      } catch (error) {
        console.error('Error loading device ID:', error);
        setDeviceId('Error loading ID');
      }
    };
    loadDeviceId();
  }, []);

  // Refresh subscription status when settings screen is focused
  // Load dev simulate update state
  useEffect(() => {
    const loadDevSimulateUpdate = async () => {
      if (!__DEV__) return;
      try {
        const value = await storageService.get('dev_simulate_update');
        setDevSimulateUpdate(value === 'true');
      } catch (_error) {
        // Ignore errors, defaults to false
      }
    };
    loadDevSimulateUpdate();
  }, []);

  useFocusEffect(
    React.useCallback(() => {
      console.log('Settings screen focused - refreshing subscription status');
      refreshSubscriptionStatus();
      loadBetaDebugInfo();
      loadDevDayOffset();
    }, [refreshSubscriptionStatus])
  );

  // Note: Notification status refresh is handled by the AppState listener in NotificationContext
  // No need for additional focus refresh to prevent flickering

  const handleSubscriptionPress = () => {
    navigation.navigate('Subscription');
  };

  const handleThemeChange = (mode: ThemeMode) => {
    setThemeMode(mode);
  };

  const handleLanguageChange = async (language: SupportedLanguage | null) => {
    await updateTranslationSettings({
      preferredLanguage: language,
      rememberLanguage: language !== null, // Auto-enable remember when selecting a language
    });
  };

  const handleRememberLanguageToggle = async (value: boolean) => {
    await updateTranslationSettings({
      rememberLanguage: value,
    });
  };

  const getLanguageDisplayName = (languageCode: string | null) => {
    if (!languageCode) return 'Ask each time';
    const language = LANGUAGE_OPTIONS.find(l => l.code === languageCode);
    return language ? `${language.flag} ${language.name}` : 'Unknown';
  };

  const handleResetData = async () => {
    // Show confirmation dialog
    Alert.alert(
      '⚠️ Reset All Data',
      'This will permanently delete:\n\n• All reading history and progress\n• Cached article content\n• App preferences and settings\n• Local storage data\n\nThis action cannot be undone.\n\nAre you sure you want to continue?',
      [
        {
          text: 'Cancel',
          style: 'cancel',
        },
        {
          text: 'Yes, Reset Everything',
          style: 'destructive',
          onPress: async () => {
            setIsResetting(true);
            try {
              await resetAppData();

              Alert.alert(
                '✅ Reset Complete',
                'All app data has been cleared successfully. The app will now refresh with today\'s article.',
                [{ text: 'OK' }]
              );
            } catch (error) {
              console.error('Reset error:', error);
              Alert.alert(
                '❌ Reset Failed',
                'Failed to reset app data. Please try the "Clear Cache & Refresh" option instead.',
                [{ text: 'OK' }]
              );
            } finally {
              setIsResetting(false);
            }
          },
        },
      ],
      { cancelable: true }
    );
  };

  const handleNotificationToggle = async (value: boolean) => {
    if (isTogglingNotifications) return; // Prevent multiple simultaneous operations

    setIsTogglingNotifications(true);

    try {
      if (value) {
        // Enabling notifications - always attempt to request permissions first
        if (notificationState.permissionStatus === 'undetermined') {
          // Show explanation modal first
          showPermissionRequestModal(
            '🔔 Enable Notifications',
            'Get notified when new articles are available. We\'ll only send you relevant updates about daily coding content.',
            () => handleEnableNotificationsWithErrorBoundary()
          );
        } else if (notificationState.permissionStatus === 'denied') {
          // Try permission request first before going to settings
          await handleEnableNotificationsWithErrorBoundary();
        } else {
          // Permission granted - enable directly
          await handleEnableNotificationsWithErrorBoundary();
        }
      } else {
        // Disabling notifications
        const result = await disableNotifications();
        if (!result.success) {
          showDisableErrorModal(
            '🔔 Disable Failed',
            `Failed to disable notifications. ${result.error || 'Please try again.'}`,
            result.error,
            () => handleNotificationToggle(value)
          );
        } else {
          showDisableSuccessModal('✅ Notifications Disabled', 'You will no longer receive push notifications.');
        }
      }
    } catch (error) {
      console.error('Error toggling notifications:', error);
      // Generic error fallback
      showEnableErrorModal(
        '🔔 Operation Failed',
        'Something went wrong with notification settings. Please try again.',
        error instanceof Error ? error.message : 'Unknown error',
        () => handleNotificationToggle(value)
      );
    } finally {
      setIsTogglingNotifications(false);
    }
  };

  const handleEnableNotificationsWithErrorBoundary = async () => {
    try {
      const result = await enableNotifications();
      if (!result.success) {
        if (result.error?.includes('Permission denied') || result.error?.includes('cannot request again')) {
          showPermissionDeniedModal(
            '🔔 Permission Required',
            'Notifications need permission to work. You can enable them in your device settings.',
            () => openNotificationSettings()
          );
        } else {
          showEnableErrorModal(
            '🔔 Enable Failed',
            `Failed to enable notifications. ${result.error || 'Please try again.'}`,
            result.error,
            () => handleEnableNotificationsWithErrorBoundary()
          );
        }
      } else {
        showEnableSuccessModal('✅ Notifications Enabled', 'You\'ll receive notifications when new articles are available.');
      }
    } catch (error) {
      console.error('Error enabling notifications:', error);
      showEnableErrorModal(
        '🔔 Enable Failed',
        'Failed to enable notifications. Please check your connection and try again.',
        error instanceof Error ? error.message : 'Unknown error',
        () => handleEnableNotificationsWithErrorBoundary()
      );
    }
  };

  const openNotificationSettings = () => {
    Linking.openSettings();
  };

  const handleResetOnboarding = async () => {
    try {
      const notificationService = NotificationService.getInstance();
      await notificationService.setOnboardingCompleted(false);
      showSuccessModal(
        '🔄 Onboarding Reset',
        'Notification onboarding has been reset. Restart the app to see the onboarding flow again.'
      );
    } catch (error) {
      console.error('Error resetting onboarding:', error);
      showEnableErrorModal(
        '❌ Reset Failed',
        'Failed to reset notification onboarding.',
        error instanceof Error ? error.message : 'Unknown error',
        () => handleResetOnboarding()
      );
    }
  };

  const getNotificationStatusText = () => {
    if (notificationState.isLoading) return 'Loading...';
    if (!notificationState.isEnabled) return 'Disabled';

    switch (notificationState.permissionStatus) {
      case 'granted':
        return notificationState.pushToken ? 'Active' : 'Setting up...';
      case 'denied':
        return 'Permission denied';
      case 'undetermined':
        return 'Permission needed';
      default:
        return 'Unknown';
    }
  };

  const getNotificationStatusColor = () => {
    if (notificationState.isLoading) return theme.colors.textSecondary;
    if (!notificationState.isEnabled) return theme.colors.textSecondary;

    switch (notificationState.permissionStatus) {
      case 'granted':
        return notificationState.pushToken ? theme.colors.success : theme.colors.warning;
      case 'denied':
        return theme.colors.error;
      case 'undetermined':
        return theme.colors.warning;
      default:
        return theme.colors.textSecondary;
    }
  };

  const getThemeDisplayName = (mode: ThemeMode) => {
    switch (mode) {
      case 'light': return 'Light';
      case 'dark': return 'Dark';
      case 'system': return 'System';
      default: return 'Unknown';
    }
  };

  const styles = StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: theme.colors.background,
    },
    scrollContainer: {
      flexGrow: 1,
      padding: 16,
    },
    section: {
      backgroundColor: theme.colors.card,
      borderRadius: 12,
      padding: 16,
      marginBottom: 16,
      elevation: 2,
      shadowOpacity: 0.1,
      shadowRadius: 4,
      shadowOffset: { width: 0, height: 2 },
    },
    sectionTitle: {
      fontSize: 18,
      fontWeight: 'bold',
      color: theme.colors.text,
      marginBottom: 16,
    },
    settingItem: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      paddingVertical: 12,
      borderBottomWidth: 1,
      borderBottomColor: theme.colors.border,
    },
    lastSettingItem: {
      borderBottomWidth: 0,
    },
    settingLabel: {
      fontSize: 16,
      color: theme.colors.text,
      flex: 1,
    },
    settingValue: {
      fontSize: 14,
      color: theme.colors.textSecondary,
      marginRight: 8,
    },
    themeOptions: {
      marginTop: 8,
    },
    themeOption: {
      flexDirection: 'row',
      alignItems: 'center',
      paddingVertical: 8,
      paddingHorizontal: 12,
      marginVertical: 4,
      borderRadius: 8,
      backgroundColor: theme.colors.surface,
    },
    themeOptionSelected: {
      backgroundColor: theme.colors.primary + '20',
      borderWidth: 1,
      borderColor: theme.colors.primary,
    },
    themeOptionText: {
      fontSize: 16,
      color: theme.colors.text,
      marginLeft: 12,
      flex: 1,
    },
    themeOptionSelectedText: {
      color: theme.colors.primary,
      fontWeight: '600',
    },
    button: {
      backgroundColor: theme.colors.error,
      borderRadius: 8,
      paddingVertical: 12,
      paddingHorizontal: 16,
      alignItems: 'center',
      marginTop: 16,
    },
    buttonDisabled: {
      opacity: 0.5,
    },
    buttonText: {
      color: '#FFFFFF',
      fontSize: 16,
      fontWeight: '600',
    },
    description: {
      fontSize: 14,
      color: theme.colors.textSecondary,
      lineHeight: 20,
      marginBottom: 8,
      marginTop: 24,
    },
    descriptionData: {
      fontSize: 14,
      color: theme.colors.textSecondary,
      lineHeight: 20,
      marginBottom: 8,
    },
    statsGrid: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      justifyContent: 'space-between',
    },
    statItem: {
      width: '48%',
      backgroundColor: theme.colors.surface,
      borderRadius: 8,
      padding: 12,
      marginBottom: 8,
      alignItems: 'center',
    },
    statValue: {
      fontSize: 20,
      fontWeight: 'bold',
      color: theme.colors.primary,
      marginBottom: 4,
    },
    statLabel: {
      fontSize: 12,
      color: theme.colors.textSecondary,
      textAlign: 'center',
    },
    statusIndicator: {
      flexDirection: 'row',
      alignItems: 'center',
    },
    statusText: {
      fontSize: 14,
      fontWeight: '500',
      marginLeft: 8,
    },
    refreshButton: {
      marginLeft: 8,
      padding: 4,
      borderRadius: 12,
    },
    languageOptions: {
      marginTop: 8,
    },
    languageOption: {
      flexDirection: 'row',
      alignItems: 'center',
      paddingVertical: 8,
      paddingHorizontal: 12,
      marginVertical: 4,
      borderRadius: 8,
      backgroundColor: theme.colors.surface,
    },
    languageOptionSelected: {
      backgroundColor: theme.colors.primary + '20',
      borderWidth: 1,
      borderColor: theme.colors.primary,
    },
    languageOptionText: {
      fontSize: 16,
      color: theme.colors.text,
      marginLeft: 12,
      flex: 1,
    },
    languageOptionSelectedText: {
      color: theme.colors.primary,
      fontWeight: '600',
    },
    settingLabelContainer: {
      flex: 1,
    },
    settingDescription: {
      fontSize: 14,
      marginTop: 2,
      lineHeight: 18,
    },
    connectionWarning: {
      flexDirection: 'row',
      alignItems: 'center',
      padding: 12,
      borderRadius: 8,
      marginTop: 8,
    },
    connectionWarningText: {
      fontSize: 14,
      fontWeight: '500',
    },
    buttonContent: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
    },
    buttonIcon: {
      marginRight: 8,
    },
    copyButton: {
      padding: 8,
      borderRadius: 8,
      backgroundColor: theme.colors.surface,
      borderWidth: 1,
      borderColor: theme.colors.border,
    },
    appIdContainer: {
      backgroundColor: theme.colors.surface,
      borderRadius: 8,
      padding: 12,
      marginTop: 8,
      marginBottom: 8,
    },
    appIdText: {
      fontSize: 12,
      fontFamily: 'monospace',
      color: theme.colors.textSecondary,
      textAlign: 'center',
      lineHeight: 16,
    },
  });

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.scrollContainer}>
      {/* Subscription */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Subscription</Text>

        <TouchableOpacity
          style={styles.settingItem}
          onPress={handleSubscriptionPress}
        >
          <View style={styles.settingLabelContainer}>
            <Text style={styles.settingLabel}>Premium Subscription</Text>
            <Text style={[styles.settingDescription, { color: theme.colors.textSecondary }]}>
              Manage your subscription and premium features
            </Text>
          </View>
          <View style={styles.statusIndicator}>
            <Ionicons
              name={isSubscribed ? 'diamond' : 'leaf'}
              size={20}
              color={isSubscribed ? theme.colors.success : theme.colors.primary}
            />
            <Text style={[styles.statusText, {
              color: isSubscribed ? theme.colors.success : theme.colors.textSecondary
            }]}>
              {isSubscribed ? 'Active' : 'Free'}
            </Text>
            <Ionicons
              name="chevron-forward"
              size={16}
              color={theme.colors.textSecondary}
              style={{ marginLeft: 8 }}
            />
          </View>
        </TouchableOpacity>

        {!subscriptionConnected && (
          <View style={[styles.connectionWarning, { backgroundColor: theme.colors.warning + '20' }]}>
            <Ionicons
              name="warning"
              size={16}
              color={theme.colors.warning}
              style={{ marginRight: 8 }}
            />
            <Text style={[styles.connectionWarningText, { color: theme.colors.warning }]}>
              Store connection unavailable
            </Text>
          </View>
        )}

        <Text style={styles.description}>
          Tap to view premium features, manage your subscription, or restore purchases.
        </Text>
      </View>

      {/* Push Notifications */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Push Notifications</Text>

        <View style={styles.settingItem}>
          <View style={styles.settingLabelContainer}>
            <Text style={styles.settingLabel}>Enable Notifications</Text>
            <Text style={[styles.settingDescription, { color: theme.colors.textSecondary }]}>
              Get notified when new articles are available
            </Text>
          </View>
          <Switch
            value={notificationState.isEnabled}
            onValueChange={handleNotificationToggle}
            disabled={notificationState.isLoading || isTogglingNotifications}
            trackColor={{ false: theme.colors.border, true: theme.colors.primary + '30' }}
            thumbColor={notificationState.isEnabled ? theme.colors.primary : theme.colors.textSecondary}
            ios_backgroundColor={theme.colors.border}
          />
        </View>

        <View style={styles.settingItem}>
          <View style={styles.settingLabelContainer}>
            <Text style={styles.settingLabel}>Status</Text>
            <Text style={[styles.settingDescription, { color: theme.colors.textSecondary }]}>
              Current notification permission and token status
            </Text>
          </View>
          <View style={styles.statusIndicator}>
            <Ionicons
              name={
                notificationState.isEnabled && notificationState.permissionStatus === 'granted'
                  ? 'notifications'
                  : 'notifications-off'
              }
              size={20}
              color={getNotificationStatusColor()}
            />
            <Text style={[styles.statusText, { color: getNotificationStatusColor() }]}>
              {getNotificationStatusText()}
            </Text>
            {!notificationState.isLoading && (
              <TouchableOpacity
                style={styles.refreshButton}
                onPress={() => {
                  refreshNotificationStatus().catch(console.error);
                }}
                hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
              >
                <Ionicons
                  name="refresh"
                  size={16}
                  color={theme.colors.textSecondary}
                />
              </TouchableOpacity>
            )}
          </View>
        </View>



        {notificationState.permissionStatus === 'denied' && (
          <View style={[styles.connectionWarning, { backgroundColor: theme.colors.error + '20' }]}>
            <Ionicons
              name="warning"
              size={16}
              color={theme.colors.error}
              style={{ marginRight: 8 }}
            />
            <Text style={[styles.connectionWarningText, { color: theme.colors.error }]}>
              Notification permission denied. Enable in device settings.
            </Text>
          </View>
        )}

        <Text style={styles.description}>
          Push notifications will alert you when new daily articles are available. You can disable them at any time. Notifications require device permissions.
        </Text>



        {/* Debug option for development */}
        {__DEV__ && (
          <TouchableOpacity
            style={[styles.settingItem, styles.lastSettingItem]}
            onPress={handleResetOnboarding}
          >
            <View style={styles.settingLabelContainer}>
              <Text style={styles.settingLabel}>Reset Onboarding (Debug)</Text>
              <Text style={[styles.settingDescription, { color: theme.colors.textSecondary }]}>
                Reset notification onboarding flow for testing
              </Text>
            </View>
            <Ionicons
              name="refresh-circle"
              size={20}
              color={theme.colors.warning}
            />
          </TouchableOpacity>
        )}
      </View>

      {/* Translation Settings */}
      <View style={styles.section}>
        <View style={{flexDirection: 'row', alignItems: 'center'}}>
          <Ionicons name="diamond"
            size={14}
            color={theme.colors.text}
            style={{marginRight: 8, height: 28}} />
          <Text style={styles.sectionTitle}>
            Summary Translations
          </Text>
        </View>

        <View style={styles.settingItem}>
          <Text style={styles.settingLabel}>Preferred Language</Text>
          <Text style={styles.settingValue}>
            {getLanguageDisplayName(state.translationSettings.preferredLanguage)}
          </Text>
        </View>

        <View style={styles.languageOptions}>
          <TouchableOpacity
            style={[
              styles.languageOption,
              !state.translationSettings.preferredLanguage && styles.languageOptionSelected,
            ]}
            onPress={() => handleLanguageChange(null)}
          >
            <Ionicons
              name={!state.translationSettings.preferredLanguage ? 'radio-button-on' : 'radio-button-off'}
              size={20}
              color={!state.translationSettings.preferredLanguage ? theme.colors.primary : theme.colors.textSecondary}
            />
            <Text
              style={[
                styles.languageOptionText,
                !state.translationSettings.preferredLanguage && styles.languageOptionSelectedText,
              ]}
            >
              Ask me each time
            </Text>
          </TouchableOpacity>

          {LANGUAGE_OPTIONS.map((language) => (
            <TouchableOpacity
              key={language.code}
              style={[
                styles.languageOption,
                state.translationSettings.preferredLanguage === language.code && styles.languageOptionSelected,
              ]}
              onPress={() => handleLanguageChange(language.code)}
            >
              <Ionicons
                name={state.translationSettings.preferredLanguage === language.code ? 'radio-button-on' : 'radio-button-off'}
                size={20}
                color={state.translationSettings.preferredLanguage === language.code ? theme.colors.primary : theme.colors.textSecondary}
              />
              <Text
                style={[
                  styles.languageOptionText,
                  state.translationSettings.preferredLanguage === language.code && styles.languageOptionSelectedText,
                ]}
              >
                {language.flag} {language.name}
              </Text>
            </TouchableOpacity>
          ))}
        </View>

        <View style={[styles.settingItem, styles.lastSettingItem]}>
          <View style={styles.settingLabelContainer}>
            <Text style={styles.settingLabel}>Remember Language Choice</Text>
            <Text style={[styles.settingDescription, { color: theme.colors.textSecondary }]}>
              Skip language selection dialog when enabled
            </Text>
          </View>
          <Switch
            value={state.translationSettings.rememberLanguage}
            onValueChange={handleRememberLanguageToggle}
            trackColor={{ false: theme.colors.border, true: theme.colors.primary + '30' }}
            thumbColor={state.translationSettings.rememberLanguage ? theme.colors.primary : theme.colors.textSecondary}
          />
        </View>

        <Text style={styles.description}>
          The default language for summaries is English. This setting only affects the language of its translations, which you can generate from the opening the settings menu of Today's Article.
        </Text>
      </View>

      {/* Appearance Settings */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Appearance</Text>

        <View style={styles.settingItem}>
          <Text style={styles.settingLabel}>Theme</Text>
          <Text style={styles.settingValue}>{getThemeDisplayName(themeMode)}</Text>
        </View>

        <View style={styles.themeOptions}>
          {(['light', 'dark', 'system'] as ThemeMode[]).map((mode) => (
            <TouchableOpacity
              key={mode}
              style={[
                styles.themeOption,
                themeMode === mode && styles.themeOptionSelected,
              ]}
              onPress={() => handleThemeChange(mode)}
            >
              <Ionicons
                name={themeMode === mode ? 'radio-button-on' : 'radio-button-off'}
                size={20}
                color={themeMode === mode ? theme.colors.primary : theme.colors.textSecondary}
              />
              <Text
                style={[
                  styles.themeOptionText,
                  themeMode === mode && styles.themeOptionSelectedText,
                ]}
              >
                {getThemeDisplayName(mode)}
              </Text>
            </TouchableOpacity>
          ))}
        </View>
      </View>

      {/* Data Management */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Data Management</Text>

        <Text style={styles.descriptionData}>
          Reset all your reading data, cached content, preferences, and start fresh. This will clear everything and fetch today's article.
        </Text>

        <TouchableOpacity
          style={[styles.button, isResetting && styles.buttonDisabled]}
          onPress={handleResetData}
          disabled={isResetting}
        >
          <Text style={styles.buttonText}>
            {isResetting ? '🔄 Resetting Data...' : '🗑️ Reset All Data'}
          </Text>
        </TouchableOpacity>
      </View>

      {/* App Information */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>App Information</Text>

        <View style={styles.settingItem}>
          <View style={styles.settingLabelContainer}>
            <Text style={styles.settingLabel}>Device ID</Text>
            <Text style={[styles.settingDescription, { color: theme.colors.textSecondary }]}>
              Unique identifier for this app installation
            </Text>
          </View>
          <TouchableOpacity
            style={styles.copyButton}
            onPress={handleCopyDeviceId}
            activeOpacity={0.7}
          >
            <Ionicons
              name="copy-outline"
              size={20}
              color={theme.colors.primary}
            />
          </TouchableOpacity>
        </View>

        <View style={styles.appIdContainer}>
          <Text style={styles.appIdText} selectable>
            {deviceId}
          </Text>
        </View>

        <Text style={styles.description}>
          The Device ID is a unique identifier for this app installation that helps us provide
          personalized support.
        </Text>

        <View style={styles.settingItem}>
          <View style={styles.settingLabelContainer}>
            <Text style={styles.settingLabel}>Build Version</Text>
          </View>
        </View>

        <View style={styles.appIdContainer}>
          <Text style={styles.appIdText} selectable>
            {bundleVersion}.{buildNumber}
          </Text>
        </View>

        {/* Check for Updates Button - Only in production */}
        {isUpdatesEnabled && !__DEV__ && (
          <>
            {isUpdateReady ? (
              <TouchableOpacity
                style={[styles.button, { marginTop: 16, backgroundColor: theme.colors.primary }]}
                onPress={reloadApp}
              >
                <Text style={styles.buttonText}>✨ Update Available - Reload Now</Text>
              </TouchableOpacity>
            ) : (
              <TouchableOpacity
                style={[
                  styles.button,
                  isCheckingUpdate && styles.buttonDisabled,
                  { marginTop: 16 }
                ]}
                onPress={async () => {
                  setIsCheckingUpdate(true);
                  try {
                    await checkForUpdate();
                    // User will be notified via banner when update is ready
                    // If no update, show toast
                    setTimeout(() => {
                      if (!isUpdateReady) {
                        showSuccessToast('✅ App is up to date!');
                      }
                    }, 1000);
                  } catch (_error) {
                    Alert.alert('Error', 'Failed to check for updates');
                  } finally {
                    setIsCheckingUpdate(false);
                  }
                }}
                disabled={isCheckingUpdate}
              >
                {isCheckingUpdate ? (
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                    <ActivityIndicator size="small" color="#FFFFFF" />
                    <Text style={styles.buttonText}>🔍 Checking...</Text>
                  </View>
                ) : (
                  <Text style={styles.buttonText}>🔍 Check for Updates</Text>
                )}
              </TouchableOpacity>
            )}
          </>
        )}

        {/* Dev mode info about updates */}
        {__DEV__ && (
          <Text style={[styles.description, { marginTop: 16, fontStyle: 'italic' }]}>
            💡 EAS Updates are disabled in development mode. Use the "Simulate Update Notification"
            toggle below to test the update banner UI.
          </Text>
        )}

        {/* Expo Push Token (DEV mode only) */}
        {__DEV__ && (
          <>
            <View style={styles.settingItem}>
              <View style={styles.settingLabelContainer}>
                <Text style={styles.settingLabel}>Expo Push Token</Text>
                <Text style={[styles.settingDescription, { color: theme.colors.textSecondary }]}>
                  Push notification token for testing
                </Text>
              </View>
              <TouchableOpacity
                style={styles.copyButton}
                onPress={async () => {
                  try {
                    if (!notificationState.pushToken) {
                      Alert.alert('No Token', 'Push token is not available');
                      return;
                    }
                    await Clipboard.setStringAsync(notificationState.pushToken);
                    showSuccessToast('📋 Push token copied!');
                  } catch (error) {
                    Alert.alert('Error', 'Failed to copy push token to clipboard: ' + (error instanceof Error ? error.message : 'Unknown error'));
                  }
                }}
                activeOpacity={0.7}
              >
                <Ionicons
                  name="copy-outline"
                  size={20}
                  color={theme.colors.primary}
                />
              </TouchableOpacity>
            </View>

            <View style={styles.appIdContainer}>
              <Text style={styles.appIdText} selectable>
                {notificationState.pushToken || 'No push token available'}
              </Text>
            </View>

            <Text style={styles.description}>
              The Expo Push Token is used for testing push notifications in development mode.
            </Text>
          </>
        )}

        {/* Dev Day Offset (DEV mode only) */}
        {__DEV__ && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Development Settings</Text>

            <View style={styles.settingItem}>
              <View style={styles.settingLabelContainer}>
                <Text style={styles.settingLabel}>Article Day Offset</Text>
                <Text style={[styles.settingDescription, { color: theme.colors.textSecondary }]}>
                  Test different days for "today's article"
                </Text>
              </View>
              <Text style={[styles.settingValue, { color: theme.colors.primary }]}>
                {currentDevArticleInfo}
              </Text>
            </View>

            <View style={styles.appIdContainer}>
              <Text style={[styles.appIdText, { marginBottom: 12 }]}>
                Current offset: {devDayOffset === 0 ? 'None (Today)' : `${devDayOffset > 0 ? '+' : ''}${devDayOffset} days`}
              </Text>

              <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
                {[-3, -2, -1, 0, 1, 2].map((offset) => (
                  <TouchableOpacity
                    key={offset}
                    style={[
                      styles.button,
                      {
                        backgroundColor: devDayOffset === offset ? theme.colors.primary : theme.colors.surface,
                        borderWidth: 1,
                        borderColor: theme.colors.border,
                        paddingHorizontal: 12,
                        paddingVertical: 8,
                        marginTop: 0,
                        flex: 0,
                        minWidth: 60,
                      }
                    ]}
                    onPress={() => handleDevDayOffsetChange(offset)}
                    activeOpacity={0.8}
                  >
                    <Text style={[
                      styles.buttonText,
                      {
                        color: devDayOffset === offset ? '#FFFFFF' : theme.colors.text,
                        fontSize: 12,
                        textAlign: 'center'
                      }
                    ]}>
                      {offset === 0 ? 'Today' : offset > 0 ? `+${offset}d` : `${offset}d`}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
            </View>

            {/* Simulate Update Notification */}
            <View style={styles.settingItem}>
              <View style={styles.settingLabelContainer}>
                <Text style={styles.settingLabel}>Simulate Update Notification</Text>
                <Text style={[styles.settingDescription, { color: theme.colors.textSecondary }]}>
                  Test the update banner UI (dev only)
                </Text>
              </View>
              <Switch
                value={devSimulateUpdate}
                onValueChange={handleDevSimulateUpdateToggle}
                trackColor={{ false: theme.colors.disabled, true: theme.colors.success }}
                thumbColor={devSimulateUpdate ? theme.colors.background : theme.colors.placeholder}
              />
            </View>
          </View>
        )}

        {/* Beta Status Debug Info (DEV mode only) */}
        {__DEV__ && betaDebugInfo && (
          <>
            <View style={styles.settingItem}>
              <View style={styles.settingLabelContainer}>
                <Text style={styles.settingLabel}>Beta Status (Debug)</Text>
                <Text style={[styles.settingDescription, { color: theme.colors.textSecondary }]}>
                  Current beta access status and cache info
                </Text>
              </View>
              <Text style={[styles.settingValue, {
                color: betaDebugInfo.currentBetaStatus === 1 ? theme.colors.success : theme.colors.textSecondary
              }]}>
                {betaDebugInfo.currentBetaStatus === 1 ? 'Active' : 'Inactive'}
              </Text>
            </View>

            <View style={styles.appIdContainer}>
              <Text style={styles.appIdText}>
                Cache Age: {betaDebugInfo.cacheAge ? `${Math.round(betaDebugInfo.cacheAge / 1000)}s` : 'No cache'}{'\n'}
                Should Refresh: {betaDebugInfo.shouldRefresh ? 'Yes' : 'No'}{'\n'}
                Last Checked: {betaDebugInfo.localStatus?.lastChecked ? new Date(betaDebugInfo.localStatus.lastChecked).toLocaleString() : 'Never'}
              </Text>
            </View>

            <TouchableOpacity
              style={[styles.button, { backgroundColor: theme.colors.primary, marginTop: 8 }]}
              onPress={async () => {
                try {
                  const betaService = BetaStatusService.getInstance();
                  const testResult = await betaService.testBetaStatusIntegration();

                  Alert.alert(
                    '🧪 Beta Status Test',
                    `Status: ${testResult.success ? 'Success' : 'Failed'}\n` +
                    `Beta Status: ${testResult.betaStatus}\n` +
                    `Firebase Connected: ${testResult.firebaseConnected ? 'Yes' : 'No'}\n` +
                    `Cached: ${testResult.cached ? 'Yes' : 'No'}` +
                    (testResult.error ? `\nError: ${testResult.error}` : ''),
                    [
                      { text: 'OK' },
                      {
                        text: 'Refresh Debug Info',
                        onPress: () => loadBetaDebugInfo()
                      }
                    ]
                  );
                } catch (error) {
                  Alert.alert('Test Error', error instanceof Error ? error.message : 'Unknown error');
                }
              }}
              activeOpacity={0.8}
            >
              <Text style={[styles.buttonText, { color: '#FFFFFF' }]}>
                🧪 Test Beta Status Integration
              </Text>
            </TouchableOpacity>
          </>
        )}
      </View>
    </ScrollView>
  );
};

export default SettingsScreen;
