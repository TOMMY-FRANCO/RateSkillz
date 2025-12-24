import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, Coins, TrendingUp, ShoppingBag, MessageSquare, Tv, Crown, ArrowUpCircle, ArrowDownCircle } from 'lucide-react';
import { getTransactions } from '../lib/coins';
import { useCoinBalance } from '../hooks/useCoinBalance';

interface Transaction {
  id: string;
  amount: number;
  transaction_type: string;
  description: string;
  payment_provider?: string;
  payment_amount?: number;
  created_at: string;
  balance_after?: number;
}

export default function TransactionHistory() {
  const navigate = useNavigate();
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [loading, setLoading] = useState(true);
  const { balance: currentBalance } = useCoinBalance();
  const [balanceValidation, setBalanceValidation] = useState<{ isValid: boolean; message: string } | null>(null);

  useEffect(() => {
    loadTransactions();
  }, []);

  async function loadTransactions() {
    try {
      const txs = await getTransactions();
      setTransactions(txs);

      // Validate that transaction sum matches current balance
      if (txs.length > 0 && currentBalance !== undefined) {
        const transactionSum = txs.reduce((sum: number, tx: Transaction) => sum + tx.amount, 0);
        const discrepancy = Math.abs(currentBalance - transactionSum);

        if (discrepancy < 0.01) {
          setBalanceValidation({ isValid: true, message: 'Balance verified' });
        } else {
          setBalanceValidation({
            isValid: false,
            message: `Balance discrepancy detected: ${discrepancy.toFixed(2)} coins difference`
          });
          console.error('Balance mismatch:', { transactionSum, currentBalance, discrepancy });
        }
      }
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
      case 'card_purchase':
        return <ShoppingBag className="w-5 h-5 text-purple-400" />;
      case 'card_sale':
        return <ArrowUpCircle className="w-5 h-5 text-green-400" />;
      case 'card_royalty':
        return <Crown className="w-5 h-5 text-yellow-400" />;
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
      hour12: false,
    }).format(date);
  }

  function formatDateShort(dateString: string) {
    const date = new Date(dateString);
    return new Intl.DateTimeFormat('en-GB', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
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

          {balanceValidation && (
            <div className={`mt-4 px-4 py-2 rounded-lg ${balanceValidation.isValid ? 'bg-green-500/20 text-green-300' : 'bg-red-500/20 text-red-300'}`}>
              <p className="text-sm font-medium">{balanceValidation.message}</p>
            </div>
          )}
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
              Start earning coins by commenting on profiles, watching adverts, or trading cards
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
                <div className="flex items-start justify-between gap-4">
                  <div className="flex items-start gap-4 flex-1">
                    <div className="w-12 h-12 bg-white/10 rounded-full flex items-center justify-center flex-shrink-0">
                      {getTransactionIcon(tx.transaction_type)}
                    </div>
                    <div className="flex-1 min-w-0">
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
                  <div className="text-right flex-shrink-0">
                    <div className={`text-xl font-bold flex items-center gap-1 justify-end mb-1 ${
                      tx.amount >= 0 ? 'text-green-400' : 'text-red-400'
                    }`}>
                      {tx.amount >= 0 ? '+' : ''}{tx.amount.toFixed(2)}
                      <Coins className="w-5 h-5 text-yellow-400" />
                    </div>
                    {tx.balance_after !== undefined && (
                      <div className="text-sm text-white/60">
                        Balance: <span className="font-semibold text-white">{tx.balance_after.toFixed(2)}</span>
                      </div>
                    )}
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
