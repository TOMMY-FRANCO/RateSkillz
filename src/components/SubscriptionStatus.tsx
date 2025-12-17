import React, { useEffect, useState } from 'react';
import { Crown, AlertCircle } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';

interface SubscriptionData {
  subscription_status: string;
  price_id: string;
  current_period_end: number;
  cancel_at_period_end: boolean;
}

export function SubscriptionStatus() {
  const { user } = useAuth();
  const [subscription, setSubscription] = useState<SubscriptionData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (user) {
      fetchSubscription();
    }
  }, [user]);

  const fetchSubscription = async () => {
    try {
      const { data, error } = await supabase
        .from('stripe_user_subscriptions')
        .select('*')
        .single();

      if (error && error.code !== 'PGRST116') {
        console.error('Error fetching subscription:', error);
      } else if (data) {
        setSubscription(data);
      }
    } catch (error) {
      console.error('Error:', error);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="bg-gray-100 rounded-lg p-4">
        <div className="animate-pulse flex space-x-4">
          <div className="rounded-full bg-gray-300 h-6 w-6"></div>
          <div className="flex-1 space-y-2">
            <div className="h-4 bg-gray-300 rounded w-3/4"></div>
          </div>
        </div>
      </div>
    );
  }

  if (!subscription || subscription.subscription_status !== 'active') {
    return (
      <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
        <div className="flex items-center">
          <AlertCircle className="h-5 w-5 text-blue-600 mr-2" />
          <span className="text-blue-800 font-medium">Free Plan</span>
        </div>
      </div>
    );
  }

  const endDate = new Date(subscription.current_period_end * 1000);
  const isExpiringSoon = endDate.getTime() - Date.now() < 7 * 24 * 60 * 60 * 1000; // 7 days

  return (
    <div className={`border rounded-lg p-4 ${
      subscription.cancel_at_period_end || isExpiringSoon
        ? 'bg-yellow-50 border-yellow-200'
        : 'bg-green-50 border-green-200'
    }`}>
      <div className="flex items-center justify-between">
        <div className="flex items-center">
          <Crown className={`h-5 w-5 mr-2 ${
            subscription.cancel_at_period_end || isExpiringSoon
              ? 'text-yellow-600'
              : 'text-green-600'
          }`} />
          <div>
            <span className={`font-medium ${
              subscription.cancel_at_period_end || isExpiringSoon
                ? 'text-yellow-800'
                : 'text-green-800'
            }`}>
              Premium Plan
            </span>
            {subscription.cancel_at_period_end && (
              <p className="text-sm text-yellow-700">
                Expires {endDate.toLocaleDateString()}
              </p>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}