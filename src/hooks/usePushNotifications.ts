import { useEffect } from 'react';
import { useAuth } from '@/contexts/AuthContext';

export const usePushNotifications = () => {
  const { user } = useAuth();

  useEffect(() => {
    if (!user) return;

    let cancelled = false;

    const setup = async () => {
      try {
        const { Capacitor } = await import('@capacitor/core');
        const platform = Capacitor.getPlatform();
        console.log('[Push] Platform:', platform, 'isNative:', Capacitor.isNativePlatform());

        if (!Capacitor.isNativePlatform()) return;

        const { PushNotifications } = await import('@capacitor/push-notifications');
        const { supabase } = await import('@/integrations/supabase/client');

        let permStatus = await PushNotifications.checkPermissions();
        console.log('[Push] Current permission status:', permStatus.receive);

        if (permStatus.receive === 'prompt') {
          permStatus = await PushNotifications.requestPermissions();
        }
        if (permStatus.receive !== 'granted') return;
        if (cancelled) return;

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

        // ✅ Use FirebaseMessaging to get the real FCM token
        const pkg = '@capacitor-firebase/messaging';
        const { FirebaseMessaging } = await import(/* @vite-ignore */ pkg);
        const { token } = await FirebaseMessaging.getToken();
        console.log('[Push] Got FCM token:', token?.substring(0, 20) + '...');

        if (!token || cancelled) return;

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
      } catch (err) {
        console.error('[Push] Setup error:', err);
      }
    };

    const timer = setTimeout(setup, 1500);
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [user]);
};
