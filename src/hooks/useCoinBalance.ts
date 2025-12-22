import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { useAuth } from './useAuth';

export function useCoinBalance() {
  const { user } = useAuth();
  const [balance, setBalance] = useState<number>(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchBalance = async () => {
    if (!user) {
      setBalance(0);
      setLoading(false);
      return;
    }

    try {
      setLoading(true);
      setError(null);

      const { data, error: fetchError } = await supabase
        .from('coins')
        .select('balance')
        .eq('user_id', user.id)
        .maybeSingle();

      if (fetchError) throw fetchError;

      setBalance(data?.balance || 0);
    } catch (err) {
      console.error('Error fetching coin balance:', err);
      setError(err instanceof Error ? err.message : 'Failed to fetch balance');
      setBalance(0);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchBalance();

    const channel = supabase
      .channel('coin_balance_changes')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'coins',
          filter: `user_id=eq.${user?.id}`,
        },
        () => {
          fetchBalance();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [user?.id]);

  return { balance, loading, error, refetch: fetchBalance };
}
