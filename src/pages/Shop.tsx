import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Coins, CreditCard, ArrowLeft, Sparkles } from 'lucide-react';
import { COIN_PACKAGES } from '../lib/coins';
import { getCoinBalance } from '../lib/coins';

export default function Shop() {
  const navigate = useNavigate();
  const [balance, setBalance] = useState<number>(0);
  const [loading, setLoading] = useState(true);
  const [selectedPackage, setSelectedPackage] = useState<string | null>(null);

  useEffect(() => {
    loadBalance();
  }, []);

  async function loadBalance() {
    try {
      const bal = await getCoinBalance();
      setBalance(bal);
    } catch (error) {
      console.error('Failed to load balance:', error);
    } finally {
      setLoading(false);
    }
  }

  function handlePurchase(packageId: string) {
    setSelectedPackage(packageId);
    alert('Stripe payment integration required. Please configure Stripe to enable purchases.\n\nVisit: https://bolt.new/setup/stripe');
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-blue-900 to-slate-900">
      <div className="max-w-7xl mx-auto px-4 py-8">
        <button
          onClick={() => navigate(-1)}
          className="flex items-center gap-2 text-white/80 hover:text-white mb-6 transition-colors"
        >
          <ArrowLeft className="w-5 h-5" />
          Back
        </button>

        <div className="text-center mb-12">
          <div className="inline-flex items-center justify-center w-20 h-20 bg-gradient-to-br from-yellow-400 to-orange-500 rounded-full mb-4 shadow-lg">
            <Coins className="w-10 h-10 text-white" />
          </div>
          <h1 className="text-4xl font-bold text-white mb-2">Coin Shop</h1>
          <p className="text-white/60 text-lg">Purchase coins to enhance your experience</p>

          <div className="inline-flex items-center gap-2 mt-4 px-6 py-3 bg-white/10 backdrop-blur-sm rounded-full border border-white/20">
            <Coins className="w-5 h-5 text-yellow-400" />
            <span className="text-2xl font-bold text-white">
              {loading ? '...' : balance.toFixed(2)}
            </span>
            <span className="text-white/60">coins</span>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 mb-12">
          {COIN_PACKAGES.map((pkg) => (
            <div
              key={pkg.id}
              className={`relative bg-white/10 backdrop-blur-sm rounded-2xl p-6 border-2 transition-all hover:scale-105 ${
                pkg.popular
                  ? 'border-yellow-400 shadow-2xl shadow-yellow-400/20'
                  : 'border-white/20 hover:border-white/40'
              }`}
            >
              {pkg.popular && (
                <div className="absolute -top-3 left-1/2 -translate-x-1/2">
                  <div className="flex items-center gap-1 px-3 py-1 bg-gradient-to-r from-yellow-400 to-orange-500 rounded-full text-white text-sm font-semibold shadow-lg">
                    <Sparkles className="w-4 h-4" />
                    Most Popular
                  </div>
                </div>
              )}

              <div className="text-center mb-6">
                <div className="inline-flex items-center justify-center w-16 h-16 bg-gradient-to-br from-yellow-400/20 to-orange-500/20 rounded-full mb-4">
                  <Coins className="w-8 h-8 text-yellow-400" />
                </div>
                <div className="text-5xl font-bold text-white mb-2">
                  {pkg.coins.toLocaleString()}
                </div>
                <div className="text-white/60 text-sm mb-4">coins</div>
                <div className="text-3xl font-bold text-white">
                  £{pkg.price.toFixed(2)}
                </div>
              </div>

              <button
                onClick={() => handlePurchase(pkg.id)}
                disabled={selectedPackage === pkg.id}
                className={`w-full py-3 rounded-xl font-semibold transition-all ${
                  pkg.popular
                    ? 'bg-gradient-to-r from-yellow-400 to-orange-500 text-white hover:shadow-lg hover:shadow-yellow-400/50'
                    : 'bg-white/20 text-white hover:bg-white/30'
                } disabled:opacity-50 disabled:cursor-not-allowed`}
              >
                <div className="flex items-center justify-center gap-2">
                  <CreditCard className="w-5 h-5" />
                  Buy Now
                </div>
              </button>
            </div>
          ))}
        </div>

        <div className="bg-white/5 backdrop-blur-sm rounded-2xl p-8 border border-white/10">
          <h2 className="text-2xl font-bold text-white mb-6 flex items-center gap-2">
            <Coins className="w-6 h-6 text-yellow-400" />
            Ways to Earn Coins
          </h2>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="bg-white/5 rounded-xl p-6 border border-white/10">
              <div className="flex items-start gap-4">
                <div className="w-12 h-12 bg-blue-500/20 rounded-full flex items-center justify-center flex-shrink-0">
                  <span className="text-2xl">💬</span>
                </div>
                <div>
                  <h3 className="text-lg font-semibold text-white mb-2">Comment Rewards</h3>
                  <p className="text-white/60 text-sm mb-2">
                    Earn <span className="text-yellow-400 font-semibold">0.01 coins</span> for your first comment on each player's profile
                  </p>
                  <ul className="text-white/40 text-xs space-y-1">
                    <li>• Only first comment per profile</li>
                    <li>• Cannot earn from own profile</li>
                  </ul>
                </div>
              </div>
            </div>

            <div className="bg-white/5 rounded-xl p-6 border border-white/10">
              <div className="flex items-start gap-4">
                <div className="w-12 h-12 bg-green-500/20 rounded-full flex items-center justify-center flex-shrink-0">
                  <span className="text-2xl">📺</span>
                </div>
                <div>
                  <h3 className="text-lg font-semibold text-white mb-2">Watch Ads</h3>
                  <p className="text-white/60 text-sm mb-2">
                    Earn <span className="text-yellow-400 font-semibold">10 coins</span> per ad viewed
                  </p>
                  <ul className="text-white/40 text-xs space-y-1">
                    <li>• One ad per day limit</li>
                    <li>• Quick 30-second videos</li>
                  </ul>
                </div>
              </div>
            </div>
          </div>
        </div>

        <div className="mt-8 text-center">
          <p className="text-white/40 text-sm">
            All transactions are secure and encrypted. Total coin pool: 1 billion coins
          </p>
        </div>
      </div>
    </div>
  );
}
