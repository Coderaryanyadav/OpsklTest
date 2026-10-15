import { useState, useEffect, useCallback } from 'react';
import { Platform } from 'react-native';
import { logger, registerPushTokenSafe, revokePushTokenSafe } from '@opskil/shared';

let Notifications: any = null;
let Device: any = null;
let Constants: any = null;

if (Platform.OS !== 'web') {
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    Notifications = require('expo-notifications');
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    Device = require('expo-device');
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    Constants = require('expo-constants').default || require('expo-constants');

    // Configure foreground notification presentation handler on native platforms
    if (Notifications && typeof Notifications.setNotificationHandler === 'function') {
      Notifications.setNotificationHandler({
        handleNotification: async () => ({
          shouldShowAlert: true,
          shouldShowBanner: true,
          shouldShowList: true,
          shouldPlaySound: true,
          shouldSetBadge: true,
        }),
      });
    }
  } catch {
    // Gracefully handle test environments where native expo modules are not loaded
    Notifications = null;
    Device = null;
    Constants = null;
  }
}

export interface UsePushNotificationsResult {
  expoPushToken: string | null;
  permissionGranted: boolean;
  isLoading: boolean;
  requestPermission: (userId: string) => Promise<boolean>;
  revokeToken: (userId: string) => Promise<void>;
}

export function usePushNotifications(): UsePushNotificationsResult {
  const [expoPushToken, setExpoPushToken] = useState<string | null>(null);
  const [permissionGranted, setPermissionGranted] = useState(false);
  const [isLoading, setIsLoading] = useState(false);

  // Check initial permission status silently without prompting user
  useEffect(() => {
    async function checkPermission() {
      if (!Notifications || !Device) return;
      try {
        const { status } = await Notifications.getPermissionsAsync();
        setPermissionGranted(status === 'granted');
      } catch (err) {
        logger.warn('Failed to check notification permissions', { err });
      }
    }
    checkPermission();
  }, []);

  /**
   * Request permission only after explaining the value to the user (Contextual Priming)
   */
  const requestPermission = useCallback(async (userId: string): Promise<boolean> => {
    if (!Notifications || !Device) {
      logger.info('Push notifications not supported on current platform or simulator');
      return false;
    }

    setIsLoading(true);
    try {
      if (Platform.OS === 'android') {
        await Notifications.setNotificationChannelAsync('opskil_shifts', {
          name: 'Opskl Shift Alerts',
          importance: Notifications.AndroidImportance.MAX,
          vibrationPattern: [0, 250, 250, 250],
          lightColor: '#000000',
        });
      }

      // Check existing status
      const { status: existingStatus } = await Notifications.getPermissionsAsync();
      let finalStatus = existingStatus;

      if (existingStatus !== 'granted') {
        const { status } = await Notifications.requestPermissionsAsync();
        finalStatus = status;
      }

      if (finalStatus !== 'granted') {
        setPermissionGranted(false);
        setIsLoading(false);
        return false;
      }

      setPermissionGranted(true);

      // Fetch Expo Push Token with EAS projectId support
      const projectId =
        Constants?.expoConfig?.extra?.eas?.projectId ||
        Constants?.easConfig?.projectId;

      const tokenResult = await Notifications.getExpoPushTokenAsync(
        projectId ? { projectId } : undefined
      ).catch((err: any) => {
        logger.warn('Failed to get Expo push token', { err });
        return null;
      });

      if (tokenResult?.data) {
        const token = tokenResult.data;
        setExpoPushToken(token);

        // Register in backend
        const platform = Platform.OS === 'ios' ? 'ios' : Platform.OS === 'android' ? 'android' : 'web';
        const deviceName = Device.modelName || Device.deviceName || 'Mobile Device';
        await registerPushTokenSafe(userId, token, platform, deviceName);
        logger.info('Registered push token with backend', { userId, platform });
      }

      setIsLoading(false);
      return true;
    } catch (error: any) {
      logger.error('Error requesting push notification permissions', { error });
      setIsLoading(false);
      return false;
    }
  }, []);

  const revokeToken = useCallback(async (userId: string) => {
    if (expoPushToken) {
      await revokePushTokenSafe(userId, expoPushToken);
      setExpoPushToken(null);
    }
  }, [expoPushToken]);

  return {
    expoPushToken,
    permissionGranted,
    isLoading,
    requestPermission,
    revokeToken,
  };
}
