import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';

/**
 * Returns a map of bookingId → unread message count for the current user.
 * Listens in real-time for new messages.
 */
export const useUnreadMessages = (bookingIds: string[]) => {
  const { user } = useAuth();
  const [unreadCounts, setUnreadCounts] = useState<Record<string, number>>({});

  useEffect(() => {
    if (!user || bookingIds.length === 0) return;

    const fetchUnread = async () => {
      // Get unread messages where sender is NOT the current user
      const { data } = await supabase
        .from('ride_messages')
        .select('booking_id')
        .in('booking_id', bookingIds)
        .neq('sender_id', user.id)
        .eq('is_read', false);

      const counts: Record<string, number> = {};
      (data || []).forEach((msg: any) => {
        counts[msg.booking_id] = (counts[msg.booking_id] || 0) + 1;
      });
      setUnreadCounts(counts);
    };

    fetchUnread();

    // Subscribe to new messages
    const channel = supabase
      .channel('unread-messages')
      .on('postgres_changes', {
        event: 'INSERT',
        schema: 'public',
        table: 'ride_messages',
      }, (payload) => {
        const msg = payload.new as any;
        if (bookingIds.includes(msg.booking_id) && msg.sender_id !== user.id) {
          setUnreadCounts(prev => ({
            ...prev,
            [msg.booking_id]: (prev[msg.booking_id] || 0) + 1,
          }));
        }
      })
      .on('postgres_changes', {
        event: 'UPDATE',
        schema: 'public',
        table: 'ride_messages',
      }, (payload) => {
        const msg = payload.new as any;
        if (msg.is_read && bookingIds.includes(msg.booking_id)) {
          // Refetch counts
          fetchUnread();
        }
      })
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [user, bookingIds.join(',')]);

  const markAsRead = async (bookingId: string) => {
    if (!user) return;
    await supabase
      .from('ride_messages')
      .update({ is_read: true })
      .eq('booking_id', bookingId)
      .neq('sender_id', user.id)
      .eq('is_read', false);
    setUnreadCounts(prev => ({ ...prev, [bookingId]: 0 }));
  };

  return { unreadCounts, markAsRead };
};
