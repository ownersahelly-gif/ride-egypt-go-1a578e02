import { useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';

/**
 * Listens for incoming call push notifications on native platforms.
 * When a notification with data.type === "incoming_call" arrives,
 * navigates to the IncomingCall page.
 */
export const useIncomingCall = () => {
  const navigate = useNavigate();
  const setupDoneRef = useRef(false);

  useEffect(() => {
    // Prevent duplicate setup from React strict mode
    if (setupDoneRef.current) return;

    let cleanup: (() => void) | undefined;

    const setup = async () => {
      try {
        const { Capacitor } = await import('@capacitor/core');
        if (!Capacitor.isNativePlatform()) return;

        const { PushNotifications } = await import('@capacitor/push-notifications');

        const listener = await PushNotifications.addListener(
          'pushNotificationReceived',
          (notification) => {
            const data = notification.data;
            if (data?.type === 'incoming_call') {
              navigate(
                `/incoming-call?tripId=${encodeURIComponent(data.tripId)}&caller=${encodeURIComponent(data.caller)}`
              );
            }
          }
        );

        const actionListener = await PushNotifications.addListener(
          'pushNotificationActionPerformed',
          (action) => {
            const data = action.notification.data;
            if (data?.type === 'incoming_call') {
              navigate(
                `/incoming-call?tripId=${encodeURIComponent(data.tripId)}&caller=${encodeURIComponent(data.caller)}`
              );
            }
          }
        );

        setupDoneRef.current = true;

        cleanup = () => {
          listener.remove();
          actionListener.remove();
        };
      } catch (err) {
        console.log('[IncomingCall] Not on native platform, skipping push listener');
      }
    };

    setup();

    return () => {
      cleanup?.();
    };
  }, [navigate]);
};
