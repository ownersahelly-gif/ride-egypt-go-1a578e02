import { useEffect } from 'react';
import { useAuth } from '@/contexts/AuthContext';

/**
 * Registers the device for push notifications on native platforms (iOS/Android).
 * Saves the FCM/APNs token to the device_tokens table.
 * On web, this is a no-op. Fully optional — never crashes the app.
 */
export const usePushNotifications = () => {
  const { user } = useAuth();

  useEffect(() => {
    if (!user) return;

    let cancelled = false;

    const setup = async () => {
      try {
        const { Capacitor } = await import('@capacitor/core');
        if (!Capacitor.isNativePlatform()) return;

        const { PushNotifications } = await import('@capacitor/push-notifications');
        const { supabase } = await import('@/integrations/supabase/client');

        let permStatus = await PushNotifications.checkPermissions();
        if (permStatus.receive === 'prompt') {
          permStatus = await PushNotifications.requestPermissions();
        }
        if (permStatus.receive !== 'granted') {
          console.log('Push notification permission not granted');
          return;
        }

        if (cancelled) return;

        const platform = Capacitor.getPlatform();

        await PushNotifications.addListener('registration', async (token) => {
          try {
            const { data: existing } = await supabase
              .from('device_tokens')
              .select('id')
              .eq('user_id', user.id)
              .eq('platform', platform)
              .maybeSingle();

            if (existing) {
              await supabase
                .from('device_tokens')
                .update({ token: token.value, updated_at: new Date().toISOString() })
                .eq('id', existing.id);
            } else {
              await supabase
                .from('device_tokens')
                .insert({ user_id: user.id, token: token.value, platform });
            }
            console.log('Push token registered:', platform);
          } catch (e) {
            console.error('Failed to save push token:', e);
          }
        });

        await PushNotifications.addListener('registrationError', (error) => {
          console.error('Push registration error:', error);
        });

        await PushNotifications.addListener('pushNotificationReceived', (notification) => {
          console.log('Push notification received:', notification);
        });

        await PushNotifications.register();
      } catch (err) {
        console.warn('Push notifications unavailable:', err);
      }
    };

    // Delay to ensure app is fully loaded
    const timer = setTimeout(setup, 1500);

    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [user]);
};
