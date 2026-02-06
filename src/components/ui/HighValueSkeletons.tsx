import { useState, useEffect, useRef, ReactNode } from 'react';
import { ShimmerBar, StaggerItem, SlowLoadMessage } from './Shimmer';
import { AnimatedCounter } from './AnimatedCounter';
import { SkeletonAvatar } from './SkeletonPresets';
import { Coins, Trophy, ArrowUp, ArrowDown } from 'lucide-react';
import { playSound } from '../../lib/sounds';

interface SkeletonReceiptProps {
  visible: boolean;
  onTimeout?: () => void;
  className?: string;
}

export function SkeletonReceipt({ visible, onTimeout, className = '' }: SkeletonReceiptProps) {
  const [timedOut, setTimedOut] = useState(false);

  useEffect(() => {
    if (!visible) {
      setTimedOut(false);
      return;
    }
    const timer = setTimeout(() => {
      setTimedOut(true);
      onTimeout?.();
    }, 3000);
    return () => clearTimeout(timer);
  }, [visible, onTimeout]);

  if (!visible) return null;

  return (
    <div className={`bg-gradient-to-br from-gray-900/90 to-gray-800/90 border border-gray-700 rounded-2xl p-6 space-y-4 ${className}`}>
      <StaggerItem index={0} className="flex items-center gap-4">
        <SkeletonAvatar size="lg" shape="rounded" />
        <div className="flex-1 space-y-2">
          <ShimmerBar className="h-5 w-36 rounded" />
          <ShimmerBar className="h-3 w-24 rounded" speed="slow" />
        </div>
      </StaggerItem>

      <StaggerItem index={1} className="space-y-3">
        <div className="flex justify-between items-center p-3 bg-yellow-500/5 rounded-lg border border-yellow-500/20">
          <ShimmerBar className="h-3 w-20 rounded" speed="slow" />
          <ShimmerBar className="h-5 w-24 rounded" />
        </div>
        <div className="flex justify-between items-center p-3 bg-cyan-500/5 rounded-lg border border-cyan-500/20">
          <ShimmerBar className="h-3 w-24 rounded" speed="slow" />
          <ShimmerBar className="h-5 w-20 rounded" />
        </div>
        <div className="flex justify-between items-center p-3 bg-green-500/5 rounded-lg border border-green-500/20">
          <ShimmerBar className="h-3 w-16 rounded" speed="slow" />
          <ShimmerBar className="h-5 w-28 rounded" />
        </div>
      </StaggerItem>

      <StaggerItem index={2}>
        <ShimmerBar className="h-12 w-full rounded-xl" speed="slow" />
      </StaggerItem>

      {timedOut && (
        <p className="text-center text-xs text-gray-500 animate-content-reveal">
          Finalizing transaction...
        </p>
      )}
    </div>
  );
}

interface CardReceiptRevealProps {
  cardName: string;
  cardUsername: string;
  pricePaid: number;
  newValue: number;
  newBalance: number;
  className?: string;
}

export function CardReceiptReveal({
  cardName,
  cardUsername,
  pricePaid,
  newValue,
  newBalance,
  className = '',
}: CardReceiptRevealProps) {
  const soundPlayed = useRef(false);

  useEffect(() => {
    if (!soundPlayed.current) {
      soundPlayed.current = true;
      const t = setTimeout(() => playSound('coin-purchase'), 100);
      return () => clearTimeout(t);
    }
  }, []);

  return (
    <div className={`bg-gradient-to-br from-gray-900 to-gray-800 border border-green-500/40 rounded-2xl p-6 animate-content-reveal ${className}`}>
      <div className="flex items-center gap-3 mb-4">
        <div className="w-10 h-10 rounded-full bg-green-500/20 flex items-center justify-center">
          <Coins className="w-5 h-5 text-green-400" />
        </div>
        <div>
          <h3 className="text-lg font-bold text-white">{cardName}</h3>
          <p className="text-sm text-gray-400">@{cardUsername}</p>
        </div>
      </div>

      <div className="space-y-2">
        <div className="flex justify-between items-center p-3 bg-yellow-500/10 rounded-lg border border-yellow-500/20">
          <span className="text-sm text-yellow-300">Price Paid</span>
          <span className="font-bold text-yellow-400">
            <AnimatedCounter value={pricePaid} duration={400} decimals={2} />
          </span>
        </div>
        <div className="flex justify-between items-center p-3 bg-cyan-500/10 rounded-lg border border-cyan-500/20">
          <span className="text-sm text-cyan-300">New Card Value</span>
          <span className="font-bold text-cyan-400">
            <AnimatedCounter value={newValue} duration={400} decimals={2} />
          </span>
        </div>
        <div className="flex justify-between items-center p-3 bg-green-500/10 rounded-lg border border-green-500/20">
          <span className="text-sm text-green-300">Your Balance</span>
          <span className="font-bold text-green-400">
            <AnimatedCounter value={newBalance} duration={400} decimals={2} />
          </span>
        </div>
      </div>
    </div>
  );
}

interface BattleResultSkeletonProps {
  visible: boolean;
  className?: string;
}

export function BattleResultSkeleton({ visible, className = '' }: BattleResultSkeletonProps) {
  if (!visible) return null;

  return (
    <div className={`space-y-4 ${className}`}>
      <StaggerItem index={0} className="flex items-center justify-center gap-6">
        <div className="text-center space-y-2">
          <SkeletonAvatar size="lg" />
          <ShimmerBar className="h-3 w-16 rounded mx-auto" speed="slow" />
        </div>
        <ShimmerBar className="h-8 w-12 rounded" speed="slow" />
        <div className="text-center space-y-2">
          <SkeletonAvatar size="lg" />
          <ShimmerBar className="h-3 w-16 rounded mx-auto" speed="slow" />
        </div>
      </StaggerItem>

      <StaggerItem index={1}>
        <div className="bg-white/[0.03] rounded-xl border border-white/[0.06] p-4">
          <div className="grid grid-cols-3 gap-3 text-center">
            {[0, 1, 2].map((i) => (
              <div key={i} className="space-y-1">
                <ShimmerBar className="h-3 w-16 rounded mx-auto" speed="slow" />
                <ShimmerBar className="h-7 w-10 rounded mx-auto" speed="slow" />
              </div>
            ))}
          </div>
        </div>
      </StaggerItem>

      <StaggerItem index={2}>
        <div className="bg-white/[0.03] rounded-xl border border-white/[0.06] p-4 space-y-2">
          <ShimmerBar className="h-4 w-28 rounded" speed="slow" />
          <ShimmerBar className="h-6 w-20 rounded" speed="slow" />
        </div>
      </StaggerItem>

      <StaggerItem index={3} className="space-y-2">
        {[0, 1].map((i) => (
          <ShimmerBar key={i} className="h-14 rounded-xl" speed="slow" />
        ))}
      </StaggerItem>

      <SlowLoadMessage loading={true} message="Battle results loading..." />
    </div>
  );
}

interface BattleResultRevealProps {
  isWinner: boolean;
  myScore: number;
  opponentScore: number;
  wagerAmount: number;
  opponentName: string;
  className?: string;
}

export function BattleResultReveal({
  isWinner,
  myScore,
  opponentScore,
  wagerAmount,
  opponentName,
  className = '',
}: BattleResultRevealProps) {
  const [showConfetti, setShowConfetti] = useState(false);
  const soundPlayed = useRef(false);

  useEffect(() => {
    if (!soundPlayed.current) {
      soundPlayed.current = true;
      const t = setTimeout(() => playSound(isWinner ? 'battle-win' : 'battle-loss'), 150);
      return () => clearTimeout(t);
    }
  }, [isWinner]);

  useEffect(() => {
    if (isWinner) {
      const timer = setTimeout(() => setShowConfetti(true), 200);
      return () => clearTimeout(timer);
    }
  }, [isWinner]);

  return (
    <div
      className={`rounded-2xl p-6 border animate-content-reveal relative overflow-hidden ${
        isWinner
          ? 'bg-gradient-to-br from-green-900/40 to-emerald-900/30 border-green-500/50 animate-win-flash'
          : 'bg-gradient-to-br from-gray-900/80 to-gray-800/60 border-gray-600/50'
      } ${className}`}
    >
      {showConfetti && (
        <div className="absolute inset-0 pointer-events-none overflow-hidden">
          {Array.from({ length: 12 }).map((_, i) => (
            <div
              key={i}
              className="absolute w-2 h-2 rounded-full animate-confetti-burst"
              style={{
                backgroundColor: ['#22c55e', '#fbbf24', '#3b82f6', '#ec4899'][i % 4],
                left: `${10 + (i * 7) % 80}%`,
                top: `${5 + (i * 11) % 40}%`,
                animationDelay: `${i * 80}ms`,
              }}
            />
          ))}
        </div>
      )}

      <div className="text-center mb-4 relative z-10">
        <div className={`inline-flex items-center gap-2 px-4 py-2 rounded-full text-sm font-bold ${
          isWinner
            ? 'bg-green-500/20 text-green-400 border border-green-500/30'
            : 'bg-gray-700/50 text-gray-400 border border-gray-600/30'
        }`}>
          <Trophy className={`w-4 h-4 ${isWinner ? 'text-yellow-400' : 'text-gray-500'}`} />
          {isWinner ? 'Victory!' : 'Defeat'}
        </div>
      </div>

      <div className="flex items-center justify-center gap-6 mb-4 relative z-10">
        <div className="text-center">
          <p className="text-sm text-gray-400 mb-1">You</p>
          <p className="text-3xl font-black text-white">
            <AnimatedCounter value={myScore} duration={600} decimals={0} />
          </p>
        </div>
        <span className="text-gray-600 text-xl font-bold">vs</span>
        <div className="text-center">
          <p className="text-sm text-gray-400 mb-1">{opponentName}</p>
          <p className="text-3xl font-black text-white">
            <AnimatedCounter value={opponentScore} duration={600} decimals={0} />
          </p>
        </div>
      </div>

      <div className={`text-center p-3 rounded-lg relative z-10 ${
        isWinner ? 'bg-green-500/10 border border-green-500/20' : 'bg-red-500/10 border border-red-500/20'
      }`}>
        <div className="flex items-center justify-center gap-2">
          <Coins className={`w-4 h-4 ${isWinner ? 'text-green-400' : 'text-red-400'}`} />
          <span className={`font-bold ${isWinner ? 'text-green-400' : 'text-red-400'}`}>
            {isWinner ? '+' : '-'}
            <AnimatedCounter value={wagerAmount} duration={600} decimals={0} /> coins
          </span>
        </div>
      </div>
    </div>
  );
}

interface RankChangeIndicatorProps {
  currentRank: number;
  previousRank?: number | null;
  className?: string;
}

export function RankChangeIndicator({
  currentRank,
  previousRank,
  className = '',
}: RankChangeIndicatorProps) {
  const soundPlayed = useRef(false);
  const hasChange = previousRank && previousRank !== currentRank;

  useEffect(() => {
    if (hasChange && !soundPlayed.current) {
      soundPlayed.current = true;
      playSound(currentRank < previousRank! ? 'rank-up' : 'rank-down');
    }
  }, [hasChange, currentRank, previousRank]);

  if (!previousRank || previousRank === currentRank) {
    return (
      <span className={`text-2xl font-black text-gray-500 ${className}`}>
        #{currentRank}
      </span>
    );
  }

  const improved = currentRank < previousRank;
  const diff = Math.abs(currentRank - previousRank);

  return (
    <div className={`flex items-center gap-1.5 animate-rank-slide-up ${className}`}>
      <span className="text-2xl font-black text-gray-500">#{currentRank}</span>
      <div
        className={`flex items-center gap-0.5 px-1.5 py-0.5 rounded-full text-xs font-bold animate-subtle-pulse ${
          improved
            ? 'bg-green-500/20 text-green-400'
            : 'bg-orange-500/20 text-orange-400'
        }`}
      >
        {improved ? (
          <ArrowUp className="w-3 h-3" />
        ) : (
          <ArrowDown className="w-3 h-3" />
        )}
        {diff}
      </div>
    </div>
  );
}

interface HighValueTransitionProps {
  loading: boolean;
  skeleton: ReactNode;
  children: ReactNode;
  delayMs?: number;
  className?: string;
}

export function HighValueTransition({
  loading,
  skeleton,
  children,
  delayMs = 500,
  className = '',
}: HighValueTransitionProps) {
  const [showSkeleton, setShowSkeleton] = useState(false);
  const [showContent, setShowContent] = useState(false);

  useEffect(() => {
    if (loading) {
      setShowContent(false);
      const timer = setTimeout(() => setShowSkeleton(true), delayMs);
      return () => clearTimeout(timer);
    } else {
      setShowSkeleton(false);
      const timer = setTimeout(() => setShowContent(true), 50);
      return () => clearTimeout(timer);
    }
  }, [loading, delayMs]);

  if (loading && showSkeleton) {
    return <div className={`animate-stagger-fade-in ${className}`}>{skeleton}</div>;
  }

  if (!loading && showContent) {
    return <div className={`animate-content-reveal ${className}`}>{children}</div>;
  }

  return null;
}
