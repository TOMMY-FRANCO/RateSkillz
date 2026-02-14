import { useEffect, useState } from 'react';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../hooks/useAuth';

interface Subscription {
  status: string;
  current_period_end: string;
}

export function SubscriptionStatus() {
  const { user } = useAuth();
  const [subscription, setSubscription] = useState<Subscription | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (user) {
      loadSubscription();
    }
  }, [user]);

  const loadSubscription = async () => {
    try {
      const { data } = await supabase
        .from('subscriptions')
        .select('*')
        .eq('user_id', user?.id)
        .single();

      setSubscription(data);
    } catch (error) {
      console.error('Error loading subscription:', error);
    } finally {
      setLoading(false);
    }
  };

  if (loading) return <div className="text-white/60">Loading...</div>;
  if (!subscription) return null;

  return (
    <div className="glass-card p-4">
      <h3 className="text-lg font-semibold text-white mb-2">Subscription Status</h3>
      <p className="text-white/80">
        Status: <span className="capitalize">{subscription.status}</span>
      </p>
      <p className="text-white/60 text-sm mt-1">
        Next billing: {new Date(subscription.current_period_end).toLocaleDateString()}
      </p>
    </div>
  );
}
