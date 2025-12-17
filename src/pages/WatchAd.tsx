import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, Coins, Tv, CheckCircle, Clock } from 'lucide-react';
import { awardAdCoins, getCoinBalance } from '../lib/coins';

export default function WatchAd() {
  const navigate = useNavigate();
  const [watching, setWatching] = useState(false);
  const [completed, setCompleted] = useState(false);
  const [countdown, setCountdown] = useState(30);
  const [error, setError] = useState<string | null>(null);
  const [earning, setEarning] = useState(false);
  const [balance, setBalance] = useState<number>(0);

  useEffect(() => {
    loadBalance();
  }, []);

  useEffect(() => {
    if (watching && countdown > 0) {
      const timer = setTimeout(() => setCountdown(countdown - 1), 1000);
      return () => clearTimeout(timer);
    } else if (watching && countdown === 0) {
      handleAdComplete();
    }
  }, [watching, countdown]);

  async function loadBalance() {
    try {
      const bal = await getCoinBalance();
      setBalance(bal);
    } catch (error) {
      console.error('Failed to load balance:', error);
    }
  }

  async function startAd() {
    setWatching(true);
    setError(null);
    setCountdown(30);
  }

  async function handleAdComplete() {
    setWatching(false);
    setEarning(true);

    try {
      const result = await awardAdCoins();
      if (result.earned) {
        setCompleted(true);
        await loadBalance();
      } else {
        setError('Already watched ad today. Come back tomorrow!');
      }
    } catch (err: any) {
      setError(err.message || 'Failed to award coins');
    } finally {
      setEarning(false);
    }
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
          <p className="text-white/60 text-lg">Watch a short ad and earn 10 coins</p>

          <div className="inline-flex items-center gap-2 mt-4 px-6 py-3 bg-white/10 backdrop-blur-sm rounded-full border border-white/20">
            <Coins className="w-5 h-5 text-yellow-400" />
            <span className="text-2xl font-bold text-white">{balance.toFixed(2)}</span>
            <span className="text-white/60">coins</span>
          </div>
        </div>

        {!watching && !completed && !error && (
          <div className="bg-white/10 backdrop-blur-sm rounded-2xl p-12 border border-white/20 text-center">
            <div className="mb-8">
              <div className="inline-flex items-center gap-3 px-6 py-4 bg-gradient-to-r from-green-400 to-emerald-500 rounded-2xl shadow-lg mb-4">
                <Coins className="w-8 h-8 text-white" />
                <span className="text-3xl font-bold text-white">+10 coins</span>
              </div>
              <p className="text-white/60 mt-4">Watch a 30-second ad to earn coins</p>
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

            <p className="text-white/40 text-sm mt-6">Limit: One ad per day</p>
          </div>
        )}

        {watching && (
          <div className="bg-white/10 backdrop-blur-sm rounded-2xl p-12 border border-white/20 text-center">
            <div className="mb-8">
              <div className="w-32 h-32 mx-auto mb-6 bg-gradient-to-br from-green-400 to-emerald-500 rounded-full flex items-center justify-center shadow-2xl">
                <Clock className="w-16 h-16 text-white" />
              </div>
              <h2 className="text-4xl font-bold text-white mb-2">{countdown}s</h2>
              <p className="text-white/60">Please keep watching...</p>
            </div>

            <div className="max-w-xl mx-auto aspect-video bg-black/50 rounded-xl border-2 border-white/20 flex items-center justify-center mb-4">
              <div className="text-center">
                <div className="text-6xl mb-4">📺</div>
                <p className="text-white/60">Ad Playing...</p>
              </div>
            </div>

            <div className="w-full bg-white/10 rounded-full h-2 overflow-hidden">
              <div
                className="h-full bg-gradient-to-r from-green-400 to-emerald-500 transition-all duration-1000"
                style={{ width: `${((30 - countdown) / 30) * 100}%` }}
              />
            </div>
          </div>
        )}

        {earning && (
          <div className="bg-white/10 backdrop-blur-sm rounded-2xl p-12 border border-white/20 text-center">
            <div className="animate-spin w-12 h-12 border-4 border-white/20 border-t-white rounded-full mx-auto mb-4"></div>
            <p className="text-white text-lg">Processing your reward...</p>
          </div>
        )}

        {completed && (
          <div className="bg-white/10 backdrop-blur-sm rounded-2xl p-12 border border-white/20 text-center">
            <div className="w-24 h-24 mx-auto mb-6 bg-gradient-to-br from-green-400 to-emerald-500 rounded-full flex items-center justify-center shadow-2xl">
              <CheckCircle className="w-12 h-12 text-white" />
            </div>
            <h2 className="text-3xl font-bold text-white mb-2">Congratulations!</h2>
            <p className="text-white/60 mb-8">You earned 10 coins</p>

            <div className="inline-flex items-center gap-3 px-8 py-4 bg-gradient-to-r from-green-400 to-emerald-500 rounded-2xl shadow-lg mb-8">
              <Coins className="w-8 h-8 text-white" />
              <span className="text-4xl font-bold text-white">+10</span>
            </div>

            <div className="space-x-4">
              <button
                onClick={() => navigate('/dashboard')}
                className="px-6 py-3 bg-white/20 text-white font-semibold rounded-xl hover:bg-white/30 transition-all"
              >
                Back to Dashboard
              </button>
              <button
                onClick={() => navigate('/transactions')}
                className="px-6 py-3 bg-gradient-to-r from-yellow-400 to-orange-500 text-white font-semibold rounded-xl hover:shadow-lg transition-all"
              >
                View Transactions
              </button>
            </div>
          </div>
        )}

        {error && (
          <div className="bg-red-500/10 backdrop-blur-sm rounded-2xl p-12 border border-red-500/20 text-center">
            <div className="text-6xl mb-4">⏰</div>
            <h2 className="text-2xl font-bold text-white mb-2">Already Watched Today</h2>
            <p className="text-white/60 mb-8">{error}</p>

            <button
              onClick={() => navigate('/dashboard')}
              className="px-6 py-3 bg-white/20 text-white font-semibold rounded-xl hover:bg-white/30 transition-all"
            >
              Back to Dashboard
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
