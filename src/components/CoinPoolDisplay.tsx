import { TrendingUp, Coins } from 'lucide-react';
import { useCoinPool } from '../hooks/useCoinPool';

export function CoinPoolDisplay() {
  const { stats, loading } = useCoinPool();

  if (loading) {
    return (
      <div className="bg-gradient-to-br from-yellow-500/10 to-amber-600/10 rounded-xl p-6 border border-yellow-500/20 animate-pulse">
        <div className="h-6 bg-yellow-500/20 rounded w-48 mb-4"></div>
        <div className="h-4 bg-yellow-500/20 rounded w-32"></div>
      </div>
    );
  }

  const distributedFormatted = stats.distributed_coins.toLocaleString('en-US', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });

  const totalFormatted = stats.total_coins.toLocaleString('en-US');

  const progressPercentage = (stats.distributed_coins / stats.total_coins) * 100;

  return (
    <div className="bg-gradient-to-br from-yellow-500/10 to-amber-600/10 rounded-xl p-6 border border-yellow-500/20 hover:border-yellow-500/30 transition-all">
      <div className="flex items-start justify-between mb-4">
        <div>
          <h3 className="text-lg font-bold text-gray-900 flex items-center gap-2 mb-1">
            <Coins className="w-5 h-5 text-yellow-500" />
            Coin Pool Distribution
          </h3>
          <p className="text-sm text-gray-600">
            Coins distributed to users from pool
          </p>
        </div>
        <div className="flex items-center gap-1.5 px-3 py-1.5 bg-green-500/10 rounded-full border border-green-500/20">
          <TrendingUp className="w-4 h-4 text-green-500" />
          <span className="text-xs font-semibold text-green-500">
            {stats.distribution_percentage.toFixed(4)}%
          </span>
        </div>
      </div>

      <div className="space-y-3">
        <div className="flex justify-between items-baseline">
          <span className="text-sm text-gray-600">Distributed to Users</span>
          <span className="text-2xl font-bold text-yellow-600">
            {distributedFormatted}
          </span>
        </div>

        <div className="w-full bg-gray-200 rounded-full h-3 overflow-hidden">
          <div
            className="h-full bg-gradient-to-r from-yellow-500 to-amber-500 rounded-full transition-all duration-1000 ease-out relative overflow-hidden"
            style={{ width: `${Math.max(0.5, progressPercentage)}%` }}
          >
            <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/20 to-transparent animate-shimmer"></div>
          </div>
        </div>

        <div className="flex justify-between items-baseline text-xs text-gray-500">
          <span>Total supply: {totalFormatted}</span>
          <span className="font-medium">
            {stats.remaining_coins.toLocaleString('en-US', {
              minimumFractionDigits: 2,
              maximumFractionDigits: 2,
            })}{' '}
            available
          </span>
        </div>

        <p className="text-xs text-gray-500 italic pt-2 border-t border-gray-200">
          Coins are distributed through ads, comments, and purchases. Once distributed, they circulate between users forever.
        </p>
      </div>
    </div>
  );
}
