import React, { useEffect, useState } from 'react';
import { CheckCircle, ArrowRight, Home, Coins, Sparkles } from 'lucide-react';
import { Link, useSearchParams, useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { supabase } from '../lib/supabase';

export function CheckoutSuccess() {
  const [searchParams] = useSearchParams();
  const sessionId = searchParams.get('session_id');
  const coins = searchParams.get('coins');
  const { user } = useAuth();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [newBalance, setNewBalance] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!user) {
      navigate('/login');
      return;
    }

    const fetchUpdatedBalance = async () => {
      try {
        await new Promise(resolve => setTimeout(resolve, 2000));

        const { data, error } = await supabase
          .from('profiles')
          .select('coin_balance')
          .eq('id', user.id)
          .single();

        if (error) throw error;

        setNewBalance(data.coin_balance);
      } catch (err) {
        console.error('Error fetching balance:', err);
        setError('Could not verify coin balance. Please check your transaction history.');
      } finally {
        setLoading(false);
      }
    };

    if (sessionId) {
      fetchUpdatedBalance();
    } else {
      setLoading(false);
    }
  }, [sessionId, user, navigate]);

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-900 via-blue-900 to-slate-900 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500 mx-auto mb-4"></div>
          <p className="text-white">Processing your payment...</p>
          <p className="text-white/60 text-sm mt-2">Your coins will be credited shortly</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-blue-900 to-slate-900 flex items-center justify-center py-12 px-4 sm:px-6 lg:px-8">
      <div className="max-w-md w-full">
        <div className="glass-card p-8 text-center">
          <div className="mx-auto flex items-center justify-center h-24 w-24 rounded-full bg-gradient-to-br from-green-500 to-emerald-600 mb-6 shadow-lg shadow-green-500/50">
            <CheckCircle className="h-12 w-12 text-white" />
          </div>

          <h2 className="text-3xl font-bold text-white mb-4">
            Payment Successful!
          </h2>

          <p className="text-white/80 mb-6">
            Thank you for your purchase. Your payment has been processed successfully.
          </p>

          {error && (
            <div className="bg-red-500/10 border border-red-500/20 rounded-lg p-4 mb-6">
              <p className="text-red-400 text-sm">{error}</p>
            </div>
          )}

          {coins && (
            <div className="bg-gradient-to-br from-blue-500/20 to-green-500/20 border border-blue-500/30 rounded-xl p-6 mb-6">
              <div className="flex items-center justify-center gap-2 mb-2">
                <Sparkles className="w-6 h-6 text-yellow-400" />
                <span className="text-3xl font-bold text-white">
                  +{coins} Coins
                </span>
                <Sparkles className="w-6 h-6 text-yellow-400" />
              </div>
              <p className="text-white/60 text-sm">Added to your account</p>

              {newBalance !== null && (
                <div className="mt-4 pt-4 border-t border-white/10">
                  <div className="flex items-center justify-center gap-2">
                    <Coins className="w-5 h-5 text-blue-400" />
                    <span className="text-white/80">New Balance:</span>
                    <span className="text-2xl font-bold text-white">{newBalance}</span>
                  </div>
                </div>
              )}
            </div>
          )}

          {sessionId && (
            <div className="bg-white/5 rounded-lg p-4 mb-6">
              <p className="text-sm text-white/60">
                <span className="font-medium text-white/80">Transaction ID:</span>
                <br />
                <span className="font-mono text-xs break-all">{sessionId}</span>
              </p>
            </div>
          )}

          <div className="space-y-3">
            <Link
              to="/dashboard"
              className="w-full flex justify-center items-center px-4 py-3 border border-transparent text-base font-medium rounded-lg text-white bg-gradient-to-r from-blue-500 to-green-500 hover:from-blue-600 hover:to-green-600 transition-all"
            >
              Go to Dashboard
              <ArrowRight className="ml-2 h-4 w-4" />
            </Link>

            <Link
              to="/transactions"
              className="w-full flex justify-center items-center px-4 py-3 border border-white/20 text-base font-medium rounded-lg text-white hover:bg-white/5 transition-colors"
            >
              View Transaction History
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}