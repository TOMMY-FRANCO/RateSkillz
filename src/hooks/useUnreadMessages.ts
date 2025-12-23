import { useState, useEffect } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { getUnreadCount, subscribeToMessages } from '../lib/messaging';
import { supabase } from '../lib/supabase';

export function useUnreadMessages() {
  const { user } = useAuth();
  const [unreadCount, setUnreadCount] = useState(0);

  useEffect(() => {
    if (!user) {
      setUnreadCount(0);
      return;
    }

    const fetchUnreadCount = async () => {
      const count = await getUnreadCount(user.id);
      setUnreadCount(count);
    };

    fetchUnreadCount();

    const channel = supabase
      .channel('unread_messages')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'messages',
          filter: `recipient_id=eq.${user.id}`,
        },
        () => {
          fetchUnreadCount();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [user]);

  return unreadCount;
}
