import { useEffect } from 'react';
import { Platform } from 'react-native';
import * as Notifications from 'expo-notifications';
import Constants from 'expo-constants';
import { api } from './api';

// Push notifications are NOT supported in Expo Go since SDK 53.
// They only work in a development build or production build.
const IS_EXPO_GO = Constants.executionEnvironment === 'storeClient';

if (!IS_EXPO_GO) {
  Notifications.setNotificationHandler({
    handleNotification: async () => ({
      shouldShowAlert: true,
      shouldPlaySound: true,
      shouldSetBadge: true,
    }),
  });

  if (Platform.OS === 'android') {
    Notifications.setNotificationChannelAsync('default', {
      name: 'MedAssist',
      importance: Notifications.AndroidImportance.MAX,
      vibrationPattern: [0, 250, 250, 250],
      lightColor: '#2563eb',
    });
  }
}

export function usePushNotifications(isDoctor = false) {
  useEffect(() => {
    // Skip entirely in Expo Go — not supported since SDK 53
    if (IS_EXPO_GO) return;

    let cancelled = false;

    async function register() {
      try {
        const { status: existingStatus } = await Notifications.getPermissionsAsync();
        let finalStatus = existingStatus;
        if (existingStatus !== 'granted') {
          const { status } = await Notifications.requestPermissionsAsync();
          finalStatus = status;
        }
        if (finalStatus !== 'granted') return;

        const projectId =
          Constants.expoConfig?.extra?.eas?.projectId ??
          Constants.easConfig?.projectId;

        if (!projectId) return;

        const tokenData = await Notifications.getExpoPushTokenAsync({ projectId });
        if (cancelled || !tokenData?.data) return;

        if (isDoctor) {
          await api.registerDoctorPushToken({ token: tokenData.data });
        } else {
          await api.registerPushToken({ token: tokenData.data });
        }
      } catch {
        // Fail silently
      }
    }

    register();
    return () => { cancelled = true; };
  }, [isDoctor]);
}
