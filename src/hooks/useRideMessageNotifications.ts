import { useEffect, useRef } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from 'sonner';

const playMsgSound = () => {
  try {
    const ctx = new (window.AudioContext || (window as any).webkitAudioContext)();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.frequency.setValueAtTime(660, ctx.currentTime);
    osc.frequency.setValueAtTime(880, ctx.currentTime + 0.08);
    gain.gain.setValueAtTime(0.25, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.3);
    osc.start(ctx.currentTime);
    osc.stop(ctx.currentTime + 0.3);
  } catch { /* Audio not available */ }
};

/**
 * Global hook: listens for new ride_messages where the current user
 * is either the booking owner or the shuttle driver.
 * Shows a toast + plays a sound when a message arrives from someone else.
 */
export const useRideMessageNotifications = () => {
  const { user } = useAuth();
  const seenIdsRef = useRef<Set<string>>(new Set());

  useEffect(() => {
    if (!user) return;

    // We subscribe to ALL inserts on ride_messages, then check relevance client-side
    const channel = supabase
      .channel(`global-chat-notify-${user.id}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'ride_messages',
        },
        async (payload) => {
          const msg = payload.new as any;

          // Ignore own messages
          if (msg.sender_id === user.id) return;

          // Deduplicate
          if (seenIdsRef.current.has(msg.id)) return;
          seenIdsRef.current.add(msg.id);

          // Check if this booking belongs to us or if we're the driver
          const { data: booking } = await supabase
            .from('bookings')
            .select('user_id, shuttle_id')
            .eq('id', msg.booking_id)
            .maybeSingle();

          if (!booking) return;

          const isPassenger = booking.user_id === user.id;
          let isDriver = false;

          if (!isPassenger && booking.shuttle_id) {
            const { data: shuttle } = await supabase
              .from('shuttles')
              .select('driver_id')
              .eq('id', booking.shuttle_id)
              .maybeSingle();
            isDriver = shuttle?.driver_id === user.id;
          }

          if (!isPassenger && !isDriver) return;

          // Get sender name
          const { data: senderProfile } = await supabase
            .from('profiles')
            .select('full_name')
            .eq('user_id', msg.sender_id)
            .maybeSingle();

          const senderName = senderProfile?.full_name || 'Someone';

          playMsgSound();
          toast.info(`💬 ${senderName}`, {
            description: msg.message.length > 50
              ? msg.message.slice(0, 50) + '…'
              : msg.message,
            duration: 5000,
          });
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [user]);
};
