/**
 * useAppUpdates Hook
 *
 * Manages EAS update checking and downloading for the app.
 * Provides functionality to:
 * - Check for available updates
 * - Download and apply updates
 * - Notify users when updates are ready
 */

import { useEffect, useState, useCallback } from 'react';
import * as Updates from 'expo-updates';
import { NativeModules } from 'react-native';

// Access DevSettings for reloading in dev mode
const DevSettings = NativeModules.DevSettings;

export interface UpdateInfo {
  isUpdateReady: boolean;
  error: Error | null;
}

export function useAppUpdates() {
  const [updateInfo, setUpdateInfo] = useState<UpdateInfo>({
    isUpdateReady: false,
    error: null,
  });

  // Check if updates are enabled (they're disabled in development)
  const isUpdatesEnabled = Updates.isEnabled;

  /**
   * Download the available update
   */
  const downloadUpdate = useCallback(async () => {
    if (!isUpdatesEnabled) {
      return;
    }

    try {
      console.log('⬇️ Downloading update in background...');
      // Silently download in background
      const result = await Updates.fetchUpdateAsync();

      console.log('✅ Update downloaded successfully!', {
        isNew: result.isNew,
        manifest: result.manifest?.id,
      });

      // Only notify user when download is complete
      setUpdateInfo(prev => ({
        ...prev,
        isUpdateReady: true,
        error: null,
      }));

      console.log('🎉 Update is ready to be applied - notifying user');
    } catch (error) {
      console.error('❌ Error downloading update:', error);
      setUpdateInfo(prev => ({
        ...prev,
        error: error as Error,
      }));
    }
  }, [isUpdatesEnabled]);

  /**
   * Check for available updates
   */
  const checkForUpdate = useCallback(async () => {
    if (!isUpdatesEnabled) {
      // Updates are disabled in development mode - this is expected
      return;
    }

    try {
      console.log('🔍 Checking for updates...');
      const update = await Updates.checkForUpdateAsync();

      if (update.isAvailable) {
        console.log('✅ Update available! Starting download...');
        console.log('Update details:', {
          updateId: update.manifest?.id,
        });
        // Silently download the update in the background
        await downloadUpdate();
      } else {
        console.log('✅ App is up to date');
      }
    } catch (error) {
      // Silently handle errors - don't log or set error state
      // This prevents noisy error logs in development mode
      if (__DEV__) {
        // In dev mode, updates API calls will fail - this is expected
        return;
      }
      // Only log in production if there's an actual issue
      console.error('❌ Error checking for update:', error);
      setUpdateInfo(prev => ({
        ...prev,
        error: error as Error,
      }));
    }
  }, [isUpdatesEnabled, downloadUpdate]);

  /**
   * Reload the app to apply the update
   * In dev mode: uses DevSettings.reload()
   * In production: uses Updates.reloadAsync()
   */
  const reloadApp = useCallback(async () => {
    // In dev mode, use DevSettings to reload
    if (__DEV__) {
      console.log('🔄 [DEV] Reloading app using DevSettings...');
      try {
        if (DevSettings) {
          DevSettings.reload();
        } else {
          console.warn('DevSettings not available, cannot reload in dev mode');
        }
      } catch (error) {
        console.error('Error reloading in dev mode:', error);
      }
      return;
    }

    // In production mode, always attempt to reload
    console.log('🔄 Reloading app to apply update...');

    try {
      // Attempt Updates.reloadAsync() - this is the proper way for EAS Updates
      await Updates.reloadAsync();
    } catch (error) {
      console.error('Error reloading app with Updates.reloadAsync():', error);

      // Log the error but don't block - the update might still apply on next launch
      setUpdateInfo(prev => ({
        ...prev,
        error: error as Error,
      }));

      // Even if reloadAsync fails, the update is downloaded and will be applied
      // on the next natural app restart
      console.log('Update is downloaded and will be applied on next app launch');
    }
  }, [isUpdatesEnabled]);

  /**
   * Check for updates on mount and when app comes to foreground
   * Only in production - skip in development to avoid errors
   */
  useEffect(() => {
    if (isUpdatesEnabled && !__DEV__) {
      console.log('📱 App mounted - checking for updates');
      checkForUpdate();
    } else if (__DEV__) {
      console.log('🛠️ Dev mode - skipping automatic update check');
    }
  }, [checkForUpdate, isUpdatesEnabled]);

  return {
    ...updateInfo,
    isUpdatesEnabled,
    checkForUpdate,
    downloadUpdate,
    reloadApp,
  };
}
