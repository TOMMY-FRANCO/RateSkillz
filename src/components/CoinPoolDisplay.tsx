import { TrendingUp, Coins, RefreshCw, AlertCircle, CheckCircle } from 'lucide-react';
import { useCoinPool } from '../hooks/useCoinPool';
import { GlassCard } from './ui/GlassCard';
import { useState } from 'react';

export function CoinPoolDisplay() {
  const { stats, loading, syncing, syncPool } = useCoinPool();
  const [showSyncMessage, setShowSyncMessage] = useState(false);

  const handleSync = async () => {
    try {
      const result = await syncPool();
      setShowSyncMessage(true);
      setTimeout(() => setShowSyncMessage(false), 3000);
      console.log('Sync completed:', result);
    } catch (error) {
      console.error('Sync failed:', error);
    }
  };

  if (loading) {
    return (
      <GlassCard className="p-6 animate-pulse">
        <div className="h-6 bg-white/10 rounded w-48 mb-4"></div>
        <div className="h-4 bg-white/10 rounded w-32"></div>
      </GlassCard>
    );
  }

  const distributedFormatted = stats.actual_distributed.toLocaleString('en-GB', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });

  const totalFormatted = stats.total_coins.toLocaleString('en-GB');

  const progressPercentage = (stats.actual_distributed / stats.total_coins) * 100;

  return (
    <GlassCard className="p-6 hover:shadow-[0_0_30px_rgba(0,255,133,0.15)] transition-all">
      <div className="flex items-start justify-between mb-4">
        <div>
          <h3 className="text-base font-bold text-white flex items-center gap-2 mb-1 uppercase tracking-wide font-['Roboto_Condensed'] italic">
            <Coins className="w-5 h-5 text-[#00FF85]" />
            {stats.pool_name || 'Pool Distribution'}
            {stats.is_synced ? (
              <CheckCircle className="w-4 h-4 text-green-400" title="Pool is synced" />
            ) : (
              <AlertCircle className="w-4 h-4 text-yellow-400" title={`Discrepancy: ${stats.discrepancy.toFixed(2)} coins`} />
            )}
          </h3>
          <p className="text-sm text-white/60 font-['Montserrat'] font-normal tracking-[0.5px]">
            Coins distributed to users
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={handleSync}
            disabled={syncing}
            className="p-2 hover:bg-white/10 rounded-lg transition-colors disabled:opacity-50"
            title="Sync pool integrity"
          >
            <RefreshCw className={`w-4 h-4 text-[#00FF85] ${syncing ? 'animate-spin' : ''}`} />
          </button>
          <div className="flex items-center gap-1.5 px-3 py-1.5 bg-[#00FF85]/10 rounded-full border border-[#00FF85]/30">
            <TrendingUp className="w-4 h-4 text-[#00FF85]" />
            <span className="text-xs font-semibold text-[#00FF85]">
              {stats.distribution_percentage.toFixed(4)}%
            </span>
          </div>
        </div>
      </div>

      {showSyncMessage && (
        <div className="mb-3 px-3 py-2 bg-green-500/20 border border-green-500/30 rounded-lg text-sm text-green-300">
          Pool synced successfully
        </div>
      )}

      {!stats.is_synced && (
        <div className="mb-3 px-3 py-2 bg-yellow-500/20 border border-yellow-500/30 rounded-lg text-sm text-yellow-300">
          Discrepancy detected: {Math.abs(stats.discrepancy).toFixed(2)} coins
        </div>
      )}

      <div className="space-y-3">
        <div className="flex justify-between items-baseline">
          <span className="text-sm text-white/60 font-['Montserrat']">Distributed</span>
          <span className="text-2xl font-bold text-[#00FF85] font-['Roboto_Mono'] drop-shadow-[0_0_10px_rgba(0,255,133,0.5)]">
            {distributedFormatted}
          </span>
        </div>

        <div className="w-full bg-white/5 rounded-full h-3 overflow-hidden border border-white/10">
          <div
            className="h-full bg-gradient-to-r from-[#00FF85] to-[#00E0FF] rounded-full transition-all duration-1000 ease-out relative overflow-hidden shadow-[0_0_20px_rgba(0,255,133,0.4)]"
            style={{ width: `${Math.max(0.5, progressPercentage)}%` }}
          >
            <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/30 to-transparent animate-shimmer"></div>
          </div>
        </div>

        <div className="flex justify-between items-baseline text-xs text-white/50 font-['Montserrat']">
          <span>Total: {totalFormatted}</span>
          <span className="font-medium text-white/70">
            {stats.remaining_coins.toLocaleString('en-GB', {
              minimumFractionDigits: 2,
              maximumFractionDigits: 2,
            })}{' '}
            available
          </span>
        </div>

        <p className="text-xs text-white/40 italic pt-2 border-t border-white/10 font-['Montserrat'] tracking-[0.5px]">
          Distributed through adverts, comments and purchases. Circulates between users.
        </p>
      </div>
    </GlassCard>
  );
}
