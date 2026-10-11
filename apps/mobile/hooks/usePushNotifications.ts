import { useEffect, useRef } from 'react';
import { Platform } from 'react-native';
import * as Notifications from 'expo-notifications';
import * as Device from 'expo-device';
import Constants from 'expo-constants';
import { useMutation } from 'convex/react';
import { api } from '@tendso/convex-client';
import type { Id } from '@tendso/convex-client';

// Configure how notifications appear when the app is in the foreground
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldShowBanner: true,
    shouldShowList: true,
    shouldPlaySound: true,
    shouldSetBadge: true,
  }),
});

export function usePushNotifications(creatorId: Id<'creators'> | undefined) {
  const registerToken = useMutation(api.notifications.registerPushToken);
  const registered = useRef(false);

  useEffect(() => {
    if (!creatorId || registered.current) return;

    async function register() {
      // Push notifications only work on physical devices
      if (!Device.isDevice) {
        console.log('[Push] Must use physical device for push notifications');
        return;
      }

      // Check/request permissions
      const { status: existingStatus } = await Notifications.getPermissionsAsync();
      let finalStatus = existingStatus;

      if (existingStatus !== 'granted') {
        const { status } = await Notifications.requestPermissionsAsync();
        finalStatus = status;
      }

      if (finalStatus !== 'granted') {
        console.log('[Push] Notification permission not granted');
        return;
      }

      // Android needs a notification channel
      if (Platform.OS === 'android') {
        await Notifications.setNotificationChannelAsync('default', {
          name: 'Default',
          importance: Notifications.AndroidImportance.MAX,
          vibrationPattern: [0, 250, 250, 250],
          lightColor: '#E4B05E',
        });
      }

      try {
        // Read the EAS projectId from the app config so it always matches the
        // currently-linked project. Was previously hardcoded to a stale project,
        // which mints push tokens against the wrong project and breaks delivery.
        const projectId =
          Constants.expoConfig?.extra?.eas?.projectId ??
          (Constants as any).easConfig?.projectId;
        if (!projectId) {
          console.error('[Push] Missing EAS projectId in app config');
          return;
        }

        const token = (
          await Notifications.getExpoPushTokenAsync({ projectId })
        ).data;

        console.log('[Push] Token:', token);

        await registerToken({
          creatorId: creatorId!,
          token,
          platform: Platform.OS as 'ios' | 'android' | 'web',
        });

        registered.current = true;
        console.log('[Push] Token registered successfully');
      } catch (error) {
        console.error('[Push] Error registering token:', error);
      }
    }

    register();
  }, [creatorId, registerToken]);
}
