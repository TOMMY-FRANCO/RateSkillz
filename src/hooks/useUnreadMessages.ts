import { useState, useEffect } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { getUnreadCount } from '../lib/messaging';

export function useUnreadMessages() {
  const { user } = useAuth();
  const [unreadCount, setUnreadCount] = useState(0);

  const fetchUnreadCount = async () => {
    if (!user) {
      setUnreadCount(0);
      return;
    }
    const count = await getUnreadCount(user.id);
    setUnreadCount(count);
  };

  useEffect(() => {
    fetchUnreadCount();
  }, [user]);

  return { unreadCount, refetch: fetchUnreadCount };
}
