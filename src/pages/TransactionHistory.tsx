import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, Coins, TrendingUp, ShoppingBag, MessageSquare, Tv, Crown, ArrowUpCircle, ArrowDownCircle, RefreshCw, AlertCircle, Loader2, ChevronLeft, ChevronRight } from 'lucide-react';
import { getTransactions } from '../lib/coins';
import { useCoinBalance } from '../hooks/useCoinBalance';
import { useAuth } from '../hooks/useAuth';
import { markNotificationsRead } from '../lib/notifications';
import { ShimmerBar, StaggerItem, SlowLoadMessage } from '../components/ui/Shimmer';
import { SkeletonAvatar } from '../components/ui/SkeletonPresets';

interface Transaction {
  id: string;
  amount: number;
  transaction_type: string;
  description: string;
  created_at: string;
  balance_after?: number;
  related_user_id?: string;
}

interface Pagination {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
  hasMore: boolean;
}

export default function TransactionHistory() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [pagination, setPagination] = useState<Pagination>({
    page: 1,
    limit: 20,
    total: 0,
    totalPages: 0,
    hasMore: false
  });
  const [refreshingBalance, setRefreshingBalance] = useState(false);
  const { balance: currentBalance, loading: balanceLoading, refetch: refetchBalance } = useCoinBalance();
  const [balanceValidation, setBalanceValidation] = useState<{ isValid: boolean; message: string } | null>(null);

  useEffect(() => {
    loadTransactions(pagination.page);
    if (user) {
      markNotificationsRead(user.id, 'transaction');
    }
  }, [user, pagination.page]);

  useEffect(() => {
    if (transactions.length > 0 && !balanceLoading) {
      validateBalance();
    }
  }, [currentBalance, transactions, balanceLoading]);

  async function loadTransactions(page: number = 1) {
    try {
      setLoading(true);
      setError(null);
      const result = await getTransactions(page, 20);
      console.log('[TransactionHistory] Loaded transactions:', result.transactions.length);
      console.log('[TransactionHistory] Pagination:', result.pagination);

      setTransactions(result.transactions);
      setPagination(result.pagination);
    } catch (error) {
      console.error('[TransactionHistory] Failed to load transactions:', error);
      setError(error instanceof Error ? error.message : 'Failed to load transactions. Please try again.');
    } finally {
      setLoading(false);
    }
  }

  async function handleRefreshBalance() {
    try {
      setRefreshingBalance(true);
      await refetchBalance();
    } catch (error) {
      console.error('Failed to refresh balance:', error);
    } finally {
      setRefreshingBalance(false);
    }
  }

  function handlePreviousPage() {
    if (pagination.page > 1) {
      setPagination(prev => ({ ...prev, page: prev.page - 1 }));
    }
  }

  function handleNextPage() {
    if (pagination.hasMore) {
      setPagination(prev => ({ ...prev, page: prev.page + 1 }));
    }
  }

  function validateBalance() {
    console.log('[TransactionHistory] Running validation...');
    console.log('[TransactionHistory] Current balance:', currentBalance);
    console.log('[TransactionHistory] Balance loading:', balanceLoading);

    if (transactions.length === 0) {
      console.log('[TransactionHistory] No transactions to validate');
      return;
    }

    if (balanceLoading) {
      console.log('[TransactionHistory] Balance still loading, skipping validation');
      return;
    }

    if (pagination.page !== 1) {
      setBalanceValidation(null);
      return;
    }

    const mostRecentTx = transactions[0];
    if (!mostRecentTx.balance_after) {
      console.log('[TransactionHistory] Most recent transaction missing balance_after, skipping validation');
      setBalanceValidation(null);
      return;
    }

    const expectedBalance = typeof mostRecentTx.balance_after === 'string'
      ? parseFloat(mostRecentTx.balance_after)
      : mostRecentTx.balance_after;

    const discrepancy = Math.abs(currentBalance - expectedBalance);

    console.log('[TransactionHistory] Validation:', {
      currentBalance,
      expectedBalance,
      mostRecentTxDate: mostRecentTx.created_at,
      discrepancy,
    });

    const isBalanceVerified = discrepancy < 0.01;

    if (isBalanceVerified) {
      console.log('[TransactionHistory] Balance VERIFIED ✓');
      setBalanceValidation({ isValid: true, message: 'Balance verified' });
    } else {
      console.error('[TransactionHistory] DISCREPANCY DETECTED ✗', {
        currentBalance,
        expectedBalance,
        discrepancy,
        mostRecentTx,
      });
      setBalanceValidation({
        isValid: false,
        message: `Transaction Balance discrepancy detected: ${discrepancy.toFixed(2)} coins difference`
      });
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
      case 'whatsapp_share':
      case 'reward_whatsapp':
      case 'reward_social_share':
      case 'reward_friend_milestone':
        return <TrendingUp className="w-5 h-5 text-emerald-400" />;
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

          {!balanceLoading ? (
            <div className="mt-6 inline-flex items-center gap-3 bg-white/10 backdrop-blur-sm border border-white/20 rounded-xl px-6 py-4">
              <Coins className="w-6 h-6 text-yellow-400" />
              <div className="text-left">
                <p className="text-white/60 text-sm">Current Balance</p>
                <p className="text-2xl font-bold text-white">{currentBalance.toFixed(2)} <span className="text-lg text-white/60">coins</span></p>
              </div>
              <button
                onClick={handleRefreshBalance}
                disabled={refreshingBalance}
                className="ml-2 p-2 hover:bg-white/10 rounded-lg transition-colors disabled:opacity-50"
                title="Refresh balance"
              >
                <RefreshCw className={`w-5 h-5 text-white/70 ${refreshingBalance ? 'animate-spin' : ''}`} />
              </button>
            </div>
          ) : (
            <div className="mt-6 inline-flex items-center gap-3 bg-white/10 backdrop-blur-sm border border-white/20 rounded-xl px-6 py-4">
              <Loader2 className="w-6 h-6 text-yellow-400 animate-spin" />
              <p className="text-white/60">Loading balance...</p>
            </div>
          )}

          {balanceValidation && (
            <div className={`mt-4 px-4 py-2 rounded-lg ${balanceValidation.isValid ? 'bg-green-500/20 text-green-300' : 'bg-red-500/20 text-red-300'}`}>
              <p className="text-sm font-medium">{balanceValidation.message}</p>
            </div>
          )}

          {pagination.total > 0 && (
            <p className="text-white/40 text-sm mt-2">
              Showing {((pagination.page - 1) * pagination.limit) + 1} - {Math.min(pagination.page * pagination.limit, pagination.total)} of {pagination.total} transactions
            </p>
          )}
        </div>

        {error && (
          <div className="bg-red-500/10 border border-red-500/30 rounded-xl p-6 mb-6">
            <div className="flex items-start gap-3">
              <AlertCircle className="w-6 h-6 text-red-400 flex-shrink-0 mt-0.5" />
              <div>
                <h3 className="text-red-300 font-semibold mb-1">Error Loading Transactions</h3>
                <p className="text-red-200/80 text-sm">{error}</p>
                <button
                  onClick={() => loadTransactions(pagination.page)}
                  className="mt-3 px-4 py-2 bg-red-500/20 hover:bg-red-500/30 text-red-200 rounded-lg text-sm font-medium transition-colors"
                >
                  Try Again
                </button>
              </div>
            </div>
          </div>
        )}

        {loading ? (
          <div className="space-y-3">
            {Array.from({ length: 5 }).map((_, i) => (
              <StaggerItem key={i} index={i}>
                <div className="bg-white/10 backdrop-blur-sm rounded-xl p-4 border border-white/20">
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex items-start gap-4 flex-1">
                      <SkeletonAvatar size="md" />
                      <div className="flex-1 space-y-2">
                        <ShimmerBar className="h-4 w-3/4 rounded" />
                        <ShimmerBar className="h-3 w-1/2 rounded" speed="slow" />
                      </div>
                    </div>
                    <div className="space-y-2">
                      <ShimmerBar className="h-5 w-20 rounded" />
                      <ShimmerBar className="h-3 w-16 rounded" speed="slow" />
                    </div>
                  </div>
                </div>
              </StaggerItem>
            ))}
            <SlowLoadMessage loading={true} message="Loading transactions..." />
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

            {pagination.totalPages > 1 && (
              <div className="mt-8 flex items-center justify-center gap-4">
                <button
                  onClick={handlePreviousPage}
                  disabled={pagination.page === 1}
                  className="flex items-center gap-2 px-4 py-2 bg-white/10 hover:bg-white/20 disabled:opacity-50 disabled:cursor-not-allowed rounded-lg text-white font-medium transition-colors"
                >
                  <ChevronLeft className="w-5 h-5" />
                  Previous
                </button>

                <div className="text-white/60 text-sm">
                  Page {pagination.page} of {pagination.totalPages}
                </div>

                <button
                  onClick={handleNextPage}
                  disabled={!pagination.hasMore}
                  className="flex items-center gap-2 px-4 py-2 bg-white/10 hover:bg-white/20 disabled:opacity-50 disabled:cursor-not-allowed rounded-lg text-white font-medium transition-colors"
                >
                  Next
                  <ChevronRight className="w-5 h-5" />
                </button>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
