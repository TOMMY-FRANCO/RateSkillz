import { Coins, RefreshCw } from 'lucide-react';
import { useCoinBalance } from '../hooks/useCoinBalance';

export function CoinBalance() {
  const { balance, loading, refetch } = useCoinBalance();

  const handleRefresh = async () => {
    await refetch();
  };

  if (loading) {
    return (
      <div className="flex items-center gap-1.5 px-3 py-1.5 bg-gradient-to-r from-yellow-500/10 to-amber-500/10 rounded-full border border-yellow-500/20">
        <Coins className="w-4 h-4 text-yellow-500 animate-pulse" />
        <span className="text-sm font-semibold text-yellow-500">...</span>
      </div>
    );
  }

  return (
    <div className="flex items-center gap-1.5 px-3 py-1.5 bg-gradient-to-r from-yellow-500/10 to-amber-500/10 rounded-full border border-yellow-500/20 hover:border-yellow-500/40 transition-all group">
      <Coins className="w-4 h-4 text-yellow-500" />
      <span className="text-sm font-semibold text-yellow-500">
        {balance.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
      </span>
      <button
        onClick={handleRefresh}
        className="opacity-0 group-hover:opacity-100 transition-opacity"
        title="Refresh balance"
      >
        <RefreshCw className="w-3 h-3 text-yellow-500 hover:text-yellow-400 active:animate-spin" />
      </button>
    </div>
  );
}
