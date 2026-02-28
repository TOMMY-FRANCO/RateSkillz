import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';

export const ARENA_UNLOCK_THRESHOLDS: Record<string, number> = {
  london: 0,
  manchester: 50_000,
  liverpool: 100_000,
  birmingham: 150_000,
  leeds: 200_000,
  bristol: 250_000,
};

interface ArenaUnlockState {
  userCount: number | null;
  loading: boolean;
  error: string | null;
  isUnlocked: (slug: string) => boolean;
  getProgress: (slug: string) => { current: number; target: number; percent: number };
  refetch: () => Promise<void>;
}

export function useArenaUnlocks(): ArenaUnlockState {
  const [userCount, setUserCount] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchCount = async () => {
    setLoading(true);
    setError(null);
    try {
      const { count, error: countError } = await supabase
        .from('profiles')
        .select('*', { count: 'exact', head: true });

      if (countError) throw countError;
      setUserCount(count ?? 0);
    } catch (err) {
      console.error('Failed to fetch user count:', err);
      setError('Failed to load user count');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchCount();
  }, []);

  const isUnlocked = (slug: string): boolean => {
    const threshold = ARENA_UNLOCK_THRESHOLDS[slug];
    if (threshold === undefined) return false;
    if (threshold === 0) return true;
    if (userCount === null) return false;
    return userCount >= threshold;
  };

  const getProgress = (slug: string) => {
    const target = ARENA_UNLOCK_THRESHOLDS[slug] || 0;
    const current = userCount ?? 0;
    const percent = target > 0 ? Math.min((current / target) * 100, 100) : 100;
    return { current, target, percent };
  };

  return { userCount, loading, error, isUnlocked, getProgress, refetch: fetchCount };
}
