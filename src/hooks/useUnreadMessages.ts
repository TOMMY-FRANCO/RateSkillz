import { useState, useEffect } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { getUnreadCount } from '../lib/messaging';
typescriptimport { useCallback } from 'react';

export function useUnreadMessages() {
  const { user } = useAuth();
  const [unreadCount, setUnreadCount] = useState(0);

  const [lastFetchTime, setLastFetchTime] = useState(0);

const fetchUnreadCount = useCallback(async () => {
  if (!user) {
    setUnreadCount(0);
    return;
  }

  // Don't fetch if we fetched less than 5 minutes ago
  const now = Date.now();
  const CACHE_TTL = 5 * 60 * 1000; // 5 minutes
  if (now - lastFetchTime < CACHE_TTL && unreadCount > 0) {
    return; // Use cached result
  }

  const count = await getUnreadCount(user.id);
  setUnreadCount(count);
  setLastFetchTime(now); // Remember when we fetched
}, [user, lastFetchTime, unreadCount]);

useEffect(() => {
  fetchUnreadCount();
}, [user]); // Only fetch when user changes

  return { unreadCount, refetch: fetchUnreadCount };
}
