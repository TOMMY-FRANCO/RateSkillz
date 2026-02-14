import { useState, useEffect, useCallback, useRef } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { getUnreadCount } from '../lib/messaging';

export function useUnreadMessages() {
  const { user } = useAuth();
  const [unreadCount, setUnreadCount] = useState(0);

  const lastFetchTimeRef = useRef(0);
  const unreadCountRef = useRef(0);

  const fetchUnreadCount = useCallback(async () => {
    if (!user) {
      setUnreadCount(0);
      unreadCountRef.current = 0;
      return;
    }

    const now = Date.now();
    const CACHE_TTL = 5 * 60 * 1000; // 5 minutes
    if (now - lastFetchTimeRef.current < CACHE_TTL && unreadCountRef.current > 0) {
      return;
    }

    const count = await getUnreadCount(user.id);
    setUnreadCount(count);
    unreadCountRef.current = count;
    lastFetchTimeRef.current = now;
  }, [user]);

  useEffect(() => {
    fetchUnreadCount();
  }, [fetchUnreadCount]);

  return { unreadCount, refetch: fetchUnreadCount };
}
