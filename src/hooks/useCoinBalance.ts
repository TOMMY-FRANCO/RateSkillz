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
        .from('profiles')
        .select('coin_balance')
        .eq('id', user.id)
        .maybeSingle();

      if (fetchError) throw fetchError;

      setBalance(Number(data?.coin_balance || 0));
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
  }, [user?.id]);

  return { balance, loading, error, refetch: fetchBalance };
}
