import { useEffect, useState, useCallback, useRef } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from 'sonner';

// Notification sound using Web Audio API
const playNotificationSound = () => {
  try {
    const ctx = new (window.AudioContext || (window as any).webkitAudioContext)();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.frequency.setValueAtTime(880, ctx.currentTime);
    osc.frequency.setValueAtTime(1100, ctx.currentTime + 0.1);
    osc.frequency.setValueAtTime(880, ctx.currentTime + 0.2);
    gain.gain.setValueAtTime(0.3, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.4);
    osc.start(ctx.currentTime);
    osc.stop(ctx.currentTime + 0.4);
  } catch {
    // Audio not available
  }
};

/**
 * Subscribes to realtime booking status changes for the current user
 * and shows toast notifications.
 */
export const useBookingNotifications = () => {
  const { user } = useAuth();

  useEffect(() => {
    if (!user) return;

    const channel = supabase
      .channel(`booking-notifications-${user.id}`)
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'bookings',
          filter: `user_id=eq.${user.id}`,
        },
        (payload) => {
          const newStatus = (payload.new as any).status;
          const oldStatus = (payload.old as any).status;

          if (newStatus === oldStatus) return;

          switch (newStatus) {
            case 'confirmed':
              playNotificationSound();
              toast.success('Booking Confirmed! 🎉', {
                description: 'Your driver has confirmed your ride. Get ready!',
              });
              break;
            case 'boarded':
              toast.info('Welcome Aboard! 🚐', {
                description: 'You have been marked as boarded. Enjoy your ride!',
              });
              break;
            case 'completed':
              toast.success('Ride Completed! ✅', {
                description: 'You have arrived at your destination. Thanks for riding with Massar!',
              });
              break;
            case 'cancelled':
              toast.error('Booking Cancelled', {
                description: 'Your booking has been cancelled.',
              });
              break;
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [user]);
};

/**
 * For drivers: subscribes to new bookings on their shuttle
 * Returns a newBookingsCount badge number that resets when acknowledged
 */
export const useDriverBookingNotifications = (shuttleId: string | null) => {
  const [newBookingsCount, setNewBookingsCount] = useState(0);
  const mountedRef = useRef(true);

  const acknowledge = useCallback(() => setNewBookingsCount(0), []);

  useEffect(() => {
    mountedRef.current = true;
    if (!shuttleId) return;

    const channel = supabase
      .channel(`driver-notifications-${shuttleId}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'bookings',
          filter: `shuttle_id=eq.${shuttleId}`,
        },
        () => {
          if (!mountedRef.current) return;
          playNotificationSound();
          setNewBookingsCount(prev => prev + 1);
          toast.info('New Booking! 📋', {
            description: 'A new passenger has booked a ride on your shuttle.',
          });
        }
      )
      .subscribe();

    return () => {
      mountedRef.current = false;
      supabase.removeChannel(channel);
    };
  }, [shuttleId]);

  return { newBookingsCount, acknowledge };
};
