import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';

interface CoinPoolStats {
  total_coins: number;
  distributed_coins: number;
  remaining_coins: number;
  distribution_percentage: number;
}

export function useCoinPool() {
  const [stats, setStats] = useState<CoinPoolStats>({
    total_coins: 1000000000,
    distributed_coins: 0,
    remaining_coins: 1000000000,
    distribution_percentage: 0,
  });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchStats = async () => {
    try {
      setLoading(true);
      setError(null);

      const { data, error: fetchError } = await supabase
        .rpc('get_coin_pool_stats')
        .single();

      if (fetchError) throw fetchError;

      if (data) {
        setStats(data);
      }
    } catch (err) {
      console.error('Error fetching coin pool stats:', err);
      setError(err instanceof Error ? err.message : 'Failed to fetch pool stats');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchStats();
  }, []);

  return { stats, loading, error, refetch: fetchStats };
}
