import { Coins, RefreshCw } from 'lucide-react';
import { useCoinBalance } from '../hooks/useCoinBalance';

export function CoinBalance() {
  const { balance, loading, refetch } = useCoinBalance();

  const handleRefresh = async () => {
    await refetch();
  };

  if (loading) {
    return (
      <div className="flex items-center gap-1.5 px-3 py-1.5 bg-white/5 backdrop-blur-[15px] rounded-full border border-[#00FF85]/30">
        <Coins className="w-4 h-4 text-[#00FF85] animate-pulse" />
        <span className="text-sm font-semibold text-[#00FF85]">...</span>
      </div>
    );
  }

  return (
    <div className="flex items-center gap-1.5 px-3 py-1.5 bg-white/5 backdrop-blur-[15px] rounded-full border border-[#00FF85]/30 hover:border-[#00FF85]/50 hover:shadow-[0_0_20px_rgba(0,255,133,0.3)] transition-all group">
      <Coins className="w-4 h-4 text-[#00FF85]" />
      <span className="text-sm font-bold text-[#00FF85] font-['Roboto_Mono'] drop-shadow-[0_0_10px_rgba(0,255,133,0.5)]">
        {balance.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
      </span>
      <button
        onClick={handleRefresh}
        className="opacity-0 group-hover:opacity-100 transition-all active:scale-90"
        title="Refresh balance"
      >
        <RefreshCw className="w-3 h-3 text-[#00FF85] hover:text-[#00E0FF] active:animate-spin" />
      </button>
    </div>
  );
}
