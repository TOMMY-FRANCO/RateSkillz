import { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, Coins, Tv, CheckCircle, Clock, Sparkles } from 'lucide-react';
import { awardAdCoins, getCoinBalance, canWatchAdToday } from '../lib/coins';
import { dismissAdBadge } from '../lib/notifications';

type Phase =
  | 'checking'
  | 'ready'
  | 'watching'
  | 'earning'
  | 'congrats'
  | 'cooldown'
  | 'error';

export default function WatchAd() {
  const navigate = useNavigate();
  const [phase, setPhase] = useState<Phase>('checking');
  const [countdown, setCountdown] = useState(30);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [balance, setBalance] = useState<number>(0);
  const [earnedBalance, setEarnedBalance] = useState<number>(0);
  const [nextAvailable, setNextAvailable] = useState<string | null>(null);
  const [hoursRemaining, setHoursRemaining] = useState<number>(0);
  const [minutesRemaining, setMinutesRemaining] = useState<number>(0);
  const [congratsProgress, setCongratsProgress] = useState(0);
  const autoTransitionRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    dismissAdBadge();
    loadBalance();
    checkAdAvailability();
  }, []);

  useEffect(() => {
    if (phase === 'watching' && countdown > 0) {
      const timer = setTimeout(() => setCountdown(countdown - 1), 1000);
      return () => clearTimeout(timer);
    } else if (phase === 'watching' && countdown === 0) {
      handleAdComplete();
    }
  }, [phase, countdown]);

  useEffect(() => {
    if (phase === 'congrats') {
      let progress = 0;
      const interval = setInterval(() => {
        progress += 100 / 25;
        setCongratsProgress(Math.min(progress, 100));
        if (progress >= 100) {
          clearInterval(interval);
        }
      }, 100);

      autoTransitionRef.current = setTimeout(() => {
        transitionToCooldown();
      }, 2500);

      return () => {
        clearInterval(interval);
        if (autoTransitionRef.current) clearTimeout(autoTransitionRef.current);
      };
    }
  }, [phase]);

  async function loadBalance() {
    try {
      const bal = await getCoinBalance();
      setBalance(bal);
    } catch {
      console.error('Failed to load balance');
    }
  }

  async function checkAdAvailability() {
    setPhase('checking');
    try {
      const result = await canWatchAdToday();
      if (!result.can_watch) {
        const hours = result.hours_remaining || 0;
        const minutes = result.minutes_remaining || 0;
        setHoursRemaining(hours);
        setMinutesRemaining(minutes);
        setNextAvailable(result.next_available_gmt || null);
        setPhase('cooldown');
      } else {
        setPhase('ready');
      }
    } catch {
      console.error('[WatchAd] Failed to check ad availability');
      setPhase('ready');
    }
  }

  function startAd() {
    setPhase('watching');
    setCountdown(30);
  }

  async function handleAdComplete() {
    setPhase('earning');
    try {
      const result = await awardAdCoins();
      if (result.earned) {
        const newBal = await getCoinBalance();
        setEarnedBalance(newBal);
        setBalance(newBal);
        setCongratsProgress(0);
        setPhase('congrats');
      } else {
        const hours = result.hours_remaining || 0;
        const minutes = result.minutes_remaining || 0;
        setHoursRemaining(hours);
        setMinutesRemaining(minutes);
        setNextAvailable(result.next_available_gmt || null);
        setPhase('cooldown');
      }
    } catch (err: any) {
      setErrorMsg(err.message || 'Failed to award coins. Please try again.');
      setPhase('error');
    }
  }

  function transitionToCooldown() {
    if (autoTransitionRef.current) clearTimeout(autoTransitionRef.current);
    checkAdAvailability();
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
          <div className="inline-flex items-center justify-center w-20 h-20 bg-gradient-to-br from-green-400 to-emerald-500 rounded-full mb-4 shadow-lg">
            <Tv className="w-10 h-10 text-white" />
          </div>
          <h1 className="text-4xl font-bold text-white mb-2">Watch & Earn</h1>
          <p className="text-white/60 text-lg">Watch a short advert and earn 5 coins</p>

          <div className="inline-flex items-center gap-2 mt-4 px-6 py-3 bg-white/10 backdrop-blur-sm rounded-full border border-white/20">
            <Coins className="w-5 h-5 text-yellow-400" />
            <span className="text-2xl font-bold text-white">{balance.toFixed(2)}</span>
            <span className="text-white/60">coins</span>
          </div>
        </div>

        {phase === 'checking' && (
          <div className="bg-white/10 backdrop-blur-sm rounded-2xl p-12 border border-white/20 text-center">
            <div className="animate-spin w-12 h-12 border-4 border-white/20 border-t-white rounded-full mx-auto mb-4"></div>
            <p className="text-white text-lg">Checking advert availability...</p>
          </div>
        )}

        {phase === 'ready' && (
          <div className="bg-white/10 backdrop-blur-sm rounded-2xl p-12 border border-white/20 text-center">
            <div className="mb-8">
              <div className="inline-flex items-center gap-3 px-6 py-4 bg-gradient-to-r from-green-400 to-emerald-500 rounded-2xl shadow-lg mb-4">
                <Coins className="w-8 h-8 text-white" />
                <span className="text-3xl font-bold text-white">+5 coins</span>
              </div>
              <p className="text-white/60 mt-4">Watch a 30-second advert to earn coins</p>
            </div>

            <button
              onClick={startAd}
              className="px-8 py-4 bg-gradient-to-r from-green-400 to-emerald-500 text-white text-lg font-semibold rounded-xl hover:shadow-lg hover:shadow-green-400/50 transition-all"
            >
              <div className="flex items-center gap-2">
                <Tv className="w-6 h-6" />
                Start Watching
              </div>
            </button>

            <div className="mt-6 space-y-2">
              <p className="text-white/40 text-sm">Limit: One ad per day</p>
              <p className="text-white/30 text-xs">Resets daily at 00:00 GMT (midnight UK time)</p>
            </div>
          </div>
        )}

        {phase === 'watching' && (
          <div className="bg-white/10 backdrop-blur-sm rounded-2xl p-12 border border-white/20 text-center">
            <div className="mb-8">
              <div className="w-32 h-32 mx-auto mb-6 bg-gradient-to-br from-green-400 to-emerald-500 rounded-full flex items-center justify-center shadow-2xl">
                <Clock className="w-16 h-16 text-white" />
              </div>
              <h2 className="text-4xl font-bold text-white mb-2">{countdown}s</h2>
              <p className="text-white/60">Please keep watching...</p>
            </div>

            <div className="max-w-xl mx-auto aspect-video rounded-xl border-2 border-white/20 overflow-hidden mb-4">
              <iframe
                className="w-full h-full"
                src=""https://www.youtube.com/embed/8tQUugBt7Oo?si=hZ89kYdgwjj916SQ&controls=0&autoplay=1&modestbranding=1&rel=0""
                title="Ad Video"
                allow="autoplay; encrypted-media"
                allowFullScreen
              />
            </div>

            <div className="w-full bg-white/10 rounded-full h-2 overflow-hidden">
              <div
                className="h-full bg-gradient-to-r from-green-400 to-emerald-500 transition-all duration-1000"
                style={{ width: `${((30 - countdown) / 30) * 100}%` }}
              />
            </div>
          </div>
        )}

        {phase === 'earning' && (
          <div className="bg-white/10 backdrop-blur-sm rounded-2xl p-12 border border-white/20 text-center">
            <div className="animate-spin w-12 h-12 border-4 border-white/20 border-t-white rounded-full mx-auto mb-4"></div>
            <p className="text-white text-lg">Processing your reward...</p>
          </div>
        )}

        {phase === 'congrats' && (
          <div className="bg-white/10 backdrop-blur-sm rounded-2xl p-12 border border-white/20 text-center relative overflow-hidden">
            <div className="absolute inset-0 pointer-events-none">
              {Array.from({ length: 12 }).map((_, i) => (
                <div
                  key={i}
                  className="absolute w-2 h-2 rounded-full animate-bounce"
                  style={{
                    left: `${8 + i * 8}%`,
                    top: `${10 + (i % 3) * 15}%`,
                    backgroundColor: i % 3 === 0 ? '#00FF85' : i % 3 === 1 ? '#00E0FF' : '#FFD700',
                    animationDelay: `${i * 0.1}s`,
                    animationDuration: `${0.6 + (i % 4) * 0.2}s`,
                  }}
                />
              ))}
            </div>

            <div className="relative z-10">
              <div className="flex items-center justify-center gap-3 mb-6">
                <Sparkles className="w-8 h-8 text-yellow-400 animate-pulse" />
                <div className="w-28 h-28 bg-gradient-to-br from-[#00FF85] to-[#00E0FF] rounded-full flex items-center justify-center shadow-2xl shadow-[#00FF85]/30 ring-4 ring-[#00FF85]/20">
                  <CheckCircle className="w-14 h-14 text-white" />
                </div>
                <Sparkles className="w-8 h-8 text-[#00E0FF] animate-pulse" style={{ animationDelay: '0.3s' }} />
              </div>

              <h2 className="text-4xl font-bold text-white mb-2 tracking-tight">Congratulations!</h2>
              <p className="text-white/70 text-lg mb-8">You have earned your daily reward</p>

              <div className="inline-flex items-center gap-4 px-10 py-5 bg-gradient-to-r from-[#00FF85]/20 to-[#00E0FF]/20 border border-[#00FF85]/40 rounded-2xl shadow-lg shadow-[#00FF85]/10 mb-4">
                <Coins className="w-10 h-10 text-yellow-400" />
                <div className="text-left">
                  <p className="text-white/60 text-sm font-medium">You earned</p>
                  <p className="text-5xl font-black text-transparent bg-clip-text bg-gradient-to-r from-[#00FF85] to-[#00E0FF]">+5 coins</p>
                </div>
              </div>

              <div className="flex items-center justify-center gap-2 mb-8">
                <Coins className="w-4 h-4 text-yellow-400" />
                <span className="text-white/80 text-sm">New balance: </span>
                <span className="text-white font-bold text-lg">{earnedBalance.toFixed(2)} coins</span>
              </div>

              <div className="mb-6">
                <div className="w-full bg-white/10 rounded-full h-1.5 overflow-hidden">
                  <div
                    className="h-full bg-gradient-to-r from-[#00FF85] to-[#00E0FF] transition-all duration-100 ease-linear"
                    style={{ width: `${congratsProgress}%` }}
                  />
                </div>
                <p className="text-white/40 text-xs mt-2">Continuing automatically...</p>
              </div>

              <button
                onClick={transitionToCooldown}
                className="px-8 py-3 bg-gradient-to-r from-[#00FF85] to-[#00E0FF] text-black font-bold rounded-xl hover:opacity-90 transition-all shadow-lg shadow-[#00FF85]/20"
              >
                Continue
              </button>
            </div>
          </div>
        )}

        {phase === 'cooldown' && (
          <div className="bg-red-500/10 backdrop-blur-sm rounded-2xl p-12 border border-red-500/20 text-center">
            <div className="w-24 h-24 mx-auto mb-6 bg-red-500/20 rounded-full flex items-center justify-center">
              <Clock className="w-12 h-12 text-red-400" />
            </div>
            <h2 className="text-2xl font-bold text-white mb-2">Ad Not Available Yet</h2>
            <p className="text-white/60 mb-6">
              {hoursRemaining > 0 || minutesRemaining > 0
                ? `Next ad available in ${hoursRemaining} hours ${minutesRemaining} minutes`
                : 'You have already watched your daily ad. Come back after midnight GMT.'}
            </p>

            <div className="bg-white/5 rounded-xl p-6 mb-8 border border-white/10">
              <p className="text-white/80 text-sm mb-3">Time until next ad:</p>
              <div className="flex items-center justify-center gap-4 mb-4">
                <div className="bg-gradient-to-br from-orange-400 to-red-500 rounded-xl p-4 min-w-[100px]">
                  <p className="text-4xl font-bold text-white">{hoursRemaining}</p>
                  <p className="text-white/80 text-sm mt-1">Hours</p>
                </div>
                <div className="text-white text-3xl font-bold">:</div>
                <div className="bg-gradient-to-br from-orange-400 to-red-500 rounded-xl p-4 min-w-[100px]">
                  <p className="text-4xl font-bold text-white">{minutesRemaining}</p>
                  <p className="text-white/80 text-sm mt-1">Minutes</p>
                </div>
              </div>
              <p className="text-white/60 text-xs mb-2">
                Current GMT time: {new Date().toLocaleString('en-GB', { timeZone: 'UTC', hour12: false })}
              </p>
              {nextAvailable && (
                <p className="text-green-400 text-sm">
                  Next available: {new Date(nextAvailable).toLocaleString('en-GB', { timeZone: 'UTC', hour12: false })} GMT
                </p>
              )}
              <p className="text-white/40 text-xs mt-3">
                Ad viewing also resets at midnight GMT daily
              </p>
            </div>

            <div className="space-x-4">
              <button
                onClick={() => navigate('/dashboard')}
                className="px-6 py-3 bg-white/20 text-white font-semibold rounded-xl hover:bg-white/30 transition-all"
              >
                Back to Dashboard
              </button>
              <button
                onClick={checkAdAvailability}
                className="px-6 py-3 bg-gradient-to-r from-blue-400 to-cyan-500 text-white font-semibold rounded-xl hover:shadow-lg transition-all"
              >
                Check Again
              </button>
            </div>
          </div>
        )}

        {phase === 'error' && (
          <div className="bg-red-500/10 backdrop-blur-sm rounded-2xl p-12 border border-red-500/20 text-center">
            <div className="w-24 h-24 mx-auto mb-6 bg-red-500/20 rounded-full flex items-center justify-center">
              <Clock className="w-12 h-12 text-red-400" />
            </div>
            <h2 className="text-2xl font-bold text-white mb-2">Something went wrong</h2>
            <p className="text-white/60 mb-8">{errorMsg}</p>
            <div className="space-x-4">
              <button
                onClick={() => navigate('/dashboard')}
                className="px-6 py-3 bg-white/20 text-white font-semibold rounded-xl hover:bg-white/30 transition-all"
              >
                Back to Dashboard
              </button>
              <button
                onClick={() => { setPhase('ready'); setErrorMsg(null); }}
                className="px-6 py-3 bg-gradient-to-r from-green-400 to-emerald-500 text-white font-semibold rounded-xl hover:shadow-lg transition-all"
              >
                Try Again
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
