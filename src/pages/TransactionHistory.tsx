import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, Coins, TrendingUp, ShoppingBag, MessageSquare, Tv } from 'lucide-react';
import { getTransactions } from '../lib/coins';

interface Transaction {
  id: string;
  amount: number;
  transaction_type: 'comment_reward' | 'ad_reward' | 'purchase';
  description: string;
  payment_provider?: string;
  payment_amount?: number;
  created_at: string;
}

export default function TransactionHistory() {
  const navigate = useNavigate();
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadTransactions();
  }, []);

  async function loadTransactions() {
    try {
      const txs = await getTransactions();
      setTransactions(txs);
    } catch (error) {
      console.error('Failed to load transactions:', error);
    } finally {
      setLoading(false);
    }
  }

  function getTransactionIcon(type: string) {
    switch (type) {
      case 'comment_reward':
        return <MessageSquare className="w-5 h-5 text-blue-400" />;
      case 'ad_reward':
        return <Tv className="w-5 h-5 text-green-400" />;
      case 'purchase':
        return <ShoppingBag className="w-5 h-5 text-purple-400" />;
      default:
        return <Coins className="w-5 h-5 text-yellow-400" />;
    }
  }

  function formatDate(dateString: string) {
    const date = new Date(dateString);
    return new Intl.DateTimeFormat('en-GB', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    }).format(date);
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-blue-900 to-slate-900">
      <div className="max-w-4xl mx-auto px-4 py-8">
        <button
          onClick={() => navigate(-1)}
          className="flex items-center gap-2 text-white/80 hover:text-white mb-6 transition-colors"
        >
          <ArrowLeft className="w-5 h-5" />
          Back
        </button>

        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-16 h-16 bg-gradient-to-br from-yellow-400 to-orange-500 rounded-full mb-4 shadow-lg">
            <TrendingUp className="w-8 h-8 text-white" />
          </div>
          <h1 className="text-3xl font-bold text-white mb-2">Transaction History</h1>
          <p className="text-white/60">Track all your coin earnings and purchases</p>
        </div>

        {loading ? (
          <div className="text-center py-12">
            <div className="animate-spin w-8 h-8 border-4 border-white/20 border-t-white rounded-full mx-auto mb-4"></div>
            <p className="text-white/60">Loading transactions...</p>
          </div>
        ) : transactions.length === 0 ? (
          <div className="bg-white/5 backdrop-blur-sm rounded-2xl p-12 border border-white/10 text-center">
            <Coins className="w-16 h-16 text-white/20 mx-auto mb-4" />
            <h3 className="text-xl font-semibold text-white mb-2">No Transactions Yet</h3>
            <p className="text-white/60 mb-6">
              Start earning coins by commenting on profiles or watching ads
            </p>
            <button
              onClick={() => navigate('/shop')}
              className="px-6 py-3 bg-gradient-to-r from-yellow-400 to-orange-500 text-white font-semibold rounded-xl hover:shadow-lg transition-all"
            >
              Visit Shop
            </button>
          </div>
        ) : (
          <div className="space-y-3">
            {transactions.map((tx) => (
              <div
                key={tx.id}
                className="bg-white/10 backdrop-blur-sm rounded-xl p-4 border border-white/20 hover:border-white/40 transition-all"
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-4">
                    <div className="w-12 h-12 bg-white/10 rounded-full flex items-center justify-center">
                      {getTransactionIcon(tx.transaction_type)}
                    </div>
                    <div>
                      <div className="font-semibold text-white mb-1">{tx.description}</div>
                      <div className="text-sm text-white/60">{formatDate(tx.created_at)}</div>
                      {tx.payment_provider && (
                        <div className="text-xs text-white/40 mt-1">
                          via {tx.payment_provider}
                          {tx.payment_amount && ` (£${tx.payment_amount.toFixed(2)})`}
                        </div>
                      )}
                    </div>
                  </div>
                  <div className="text-right">
                    <div className="text-xl font-bold text-green-400 flex items-center gap-1">
                      +{tx.amount.toFixed(2)}
                      <Coins className="w-5 h-5 text-yellow-400" />
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
