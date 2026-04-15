import { useEffect, useRef } from 'react';
import { useAuth } from '@/contexts/AuthContext';

/**
 * Registers the device for push notifications on native platforms (iOS/Android).
 * Saves the FCM/APNs token to the device_tokens table.
 * On web, this is a no-op. Fully optional — never crashes the app.
 */
export const usePushNotifications = () => {
  const { user } = useAuth();
  const setupDone = useRef(false);

  useEffect(() => {
    if (!user) return;
    if (setupDone.current) return;
    setupDone.current = true;

    const setup = async () => {
      try {
        const { Capacitor } = await import('@capacitor/core');
        const platform = Capacitor.getPlatform();
        console.log('[Push] Platform:', platform, 'isNative:', Capacitor.isNativePlatform());

        if (!Capacitor.isNativePlatform()) {
          console.log('[Push] Not native platform, skipping push registration');
          return;
        }

        const { PushNotifications } = await import('@capacitor/push-notifications');
        const { supabase } = await import('@/integrations/supabase/client');

        const saveToken = async (tokenValue: string) => {
          const token = tokenValue?.trim();
          if (!token) return;

          console.log('[Push] Saving token:', token.substring(0, 20) + '...');

          try {
            const { data: existing } = await supabase
              .from('device_tokens')
              .select('id')
              .eq('user_id', user.id)
              .eq('platform', platform)
              .maybeSingle();

            if (existing) {
              const { error } = await supabase
                .from('device_tokens')
                .update({ token, updated_at: new Date().toISOString() })
                .eq('id', existing.id);
              console.log('[Push] Token updated:', error ? error.message : 'success');
            } else {
              const { error } = await supabase
                .from('device_tokens')
                .insert({ user_id: user.id, token, platform });
              console.log('[Push] Token inserted:', error ? error.message : 'success');
            }
          } catch (e) {
            console.error('[Push] Failed to save push token:', e);
          }
        };

        let permStatus = await PushNotifications.checkPermissions();
        console.log('[Push] Current permission status:', permStatus.receive);

        if (permStatus.receive === 'prompt') {
          permStatus = await PushNotifications.requestPermissions();
          console.log('[Push] Permission after request:', permStatus.receive);
        }
        if (permStatus.receive !== 'granted') {
          console.log('[Push] Permission not granted:', permStatus.receive);
          return;
        }

        // Add listeners BEFORE calling register to avoid missing the token event
        await PushNotifications.addListener('registration', async (token) => {
          console.log('[Push] Registration token:', token.value?.substring(0, 20) + '...');
          await saveToken(token.value);
        });

        await PushNotifications.addListener('registrationError', (error) => {
          console.error('[Push] Registration error:', JSON.stringify(error));
        });

        await PushNotifications.addListener('pushNotificationReceived', (notification) => {
          console.log('[Push] Notification received in foreground:', notification);
        });

        await PushNotifications.addListener('pushNotificationActionPerformed', (action) => {
          console.log('[Push] Notification action:', action);
        });

        console.log('[Push] Calling register()...');
        await PushNotifications.register();
        console.log('[Push] register() called successfully');
      } catch (err) {
        console.error('[Push] Setup error:', err);
      }
    };

    // Delay to ensure app is fully loaded
    setTimeout(setup, 1500);

    // Don't clean up listeners — they must persist for the app lifetime
  }, [user]);
};
