import * as Application from 'expo-application';
import { Platform } from 'react-native';

let deviceId: string | null = null;

/**
 * Gets the unique, stable identifier for this app installation.
 * It's cached in memory after the first read for performance.
 * On iOS, this is the identifierForVendor.
 * On Android, this is the ANDROID_ID.
 * It remains stable until the app is uninstalled.
 */
export const getUniqueDeviceId = async (): Promise<string> => {
  if (deviceId) {
    return deviceId;
  }

  try {
    if (Platform.OS === 'ios') {
      deviceId = await Application.getIosIdForVendorAsync();
      console.log('📱 Got iOS device ID:', deviceId ? 'Success' : 'Failed');
    } else {
      deviceId = await Application.getAndroidId();
      console.log('📱 Got Android device ID:', deviceId ? 'Success' : 'Failed');
    }

    // Fallback to app bundle ID + random if device ID is null
    if (!deviceId) {
      console.warn('⚠️ Device ID is null, using fallback identifier');
      const bundleId = Application.applicationId || 'unknown';
      const randomSuffix = Math.random().toString(36).substring(2, 8);
      deviceId = `${bundleId}-${randomSuffix}`;
    }

  } catch (error) {
    console.error('❌ Error getting device ID:', error);
    // Final fallback
    const bundleId = Application.applicationId || 'unknown';
    const randomSuffix = Math.random().toString(36).substring(2, 8);
    deviceId = `${bundleId}-fallback-${randomSuffix}`;
  }

  console.log('🔑 Using device ID:', deviceId);
  return deviceId;
};

/**
 * Gets the unique device ID synchronously (if already cached)
 * Returns a temporary ID if not cached yet
 */
export const getUniqueDeviceIdSync = (): string => {
  if (deviceId) {
    return deviceId;
  }

  // Return a temporary ID that will be replaced once async version loads
  const bundleId = Application.applicationId || 'unknown';
  const tempSuffix = Math.random().toString(36).substring(2, 6);
  return `${bundleId}-temp-${tempSuffix}`;
};

/**
 * Initialize device ID asynchronously and cache it
 */
export const initializeDeviceId = async (): Promise<string> => {
  return await getUniqueDeviceId();
};

/**
 * Clear the cached device ID (useful for testing)
 */
export const clearDeviceIdCache = (): void => {
  deviceId = null;
};

/**
 * Get the app bundle identifier (different from device ID)
 */
export const getAppBundleId = (): string => {
  return Application.applicationId || 'unknown';
};

/**
 * Get the app version
 */
export const getAppVersion = (): string => {
  return Application.nativeApplicationVersion || 'unknown';
};

/**
 * Get the app build number
 */
export const getAppBuildNumber = (): string => {
  return Application.nativeBuildVersion || 'unknown';
};
