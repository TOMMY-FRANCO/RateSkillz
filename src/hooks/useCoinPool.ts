import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';

interface CoinPoolStats {
  pool_name?: string;
  total_coins: number;
  distributed_coins: number;
  actual_distributed: number;
  remaining_coins: number;
  distribution_percentage: number;
  discrepancy: number;
  is_synced: boolean;
  total_users_with_coins: number;
  last_updated: string;
}

export function useCoinPool() {
  const [stats, setStats] = useState<CoinPoolStats>({
    total_coins: 1000000000,
    distributed_coins: 0,
    actual_distributed: 0,
    remaining_coins: 1000000000,
    distribution_percentage: 0,
    discrepancy: 0,
    is_synced: true,
    total_users_with_coins: 0,
    last_updated: new Date().toISOString(),
  });
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchStats = async () => {
    try {
      setLoading(true);
      setError(null);

      const { data, error: fetchError } = await supabase
        .rpc('get_coin_pool_status')
        .single();

      if (fetchError) throw fetchError;

      if (data) {
        const distributionPercentage = (data.actual_distributed / data.total_coins) * 100;
        setStats({
          pool_name: data.pool_name,
          total_coins: parseFloat(data.total_coins),
          distributed_coins: parseFloat(data.distributed_coins),
          actual_distributed: parseFloat(data.actual_distributed),
          remaining_coins: parseFloat(data.remaining_coins),
          distribution_percentage: distributionPercentage,
          discrepancy: parseFloat(data.discrepancy),
          is_synced: data.is_synced,
          total_users_with_coins: data.total_users_with_coins,
          last_updated: data.last_updated,
        });
      }
    } catch (err) {
      console.error('Error fetching coin pool status:', err);
      setError(err instanceof Error ? err.message : 'Failed to fetch pool status');
    } finally {
      setLoading(false);
    }
  };

  const syncPool = async () => {
    try {
      setSyncing(true);
      setError(null);

      const { data, error: syncError } = await supabase
        .rpc('sync_coin_pool_integrity')
        .single();

      if (syncError) throw syncError;

      console.log('Coin pool synced');

      await fetchStats();

      return data;
    } catch (err) {
      console.error('Error syncing coin pool:', err);
      setError(err instanceof Error ? err.message : 'Failed to sync pool');
      throw err;
    } finally {
      setSyncing(false);
    }
  };

  useEffect(() => {
    fetchStats();
  }, []);

  return { stats, loading, syncing, error, refetch: fetchStats, syncPool };
}
