import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Coins, CreditCard, ArrowLeft, Sparkles, Loader2 } from 'lucide-react';
import { COIN_PACKAGES } from '../lib/coins';
import { useCoinBalance } from '../hooks/useCoinBalance';
import { CoinPoolDisplay } from '../components/CoinPoolDisplay';
import { createCoinPurchaseCheckout } from '../lib/stripe';

export default function Shop() {
  const navigate = useNavigate();
  const { balance, loading } = useCoinBalance();
  const [purchasingPackage, setPurchasingPackage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function handlePurchase(packageId: string) {
    const pkg = COIN_PACKAGES.find(p => p.id === packageId);
    if (!pkg) return;

    setPurchasingPackage(packageId);
    setError(null);

    try {
      const { url } = await createCoinPurchaseCheckout(pkg.coins, pkg.price);

      if (url) {
        window.location.href = url;
      } else {
        throw new Error('No checkout URL received');
      }
    } catch (err: any) {
      console.error('Checkout error:', err);

      // Provide user-friendly error messages
      let errorMessage = 'Payment account setup failed. Please try again.';

      if (err.message?.includes('authentication') || err.message?.includes('authenticated')) {
        errorMessage = 'Please log in to purchase coins.';
      } else if (err.message?.includes('network') || err.message?.includes('fetch')) {
        errorMessage = 'Network error. Please check your connection and try again.';
      } else if (err.message) {
        errorMessage = err.message;
      }

      setError(errorMessage);
      setPurchasingPackage(null);
    }
  }

  return (
    <div className="min-h-screen pb-24">
      <div className="max-w-7xl mx-auto px-4 py-8">
        <button
          onClick={() => navigate(-1)}
          className="flex items-center gap-2 text-[#B0B8C8] hover:text-white mb-6 transition-colors bg-transparent border-none cursor-pointer"
        >
          <ArrowLeft className="w-5 h-5" />
          Back
        </button>

        <div className="text-center mb-12">
          <div className="inline-flex items-center justify-center w-20 h-20 bg-gradient-to-br from-[#FFD700] to-[#FFA500] rounded-full mb-4 shadow-lg shadow-[#FFD700]/30">
            <Coins className="w-10 h-10 text-black" />
          </div>
          <h1 className="text-4xl font-bold text-white mb-2 heading-glow">Coin Shop</h1>
          <p className="text-[#B0B8C8] text-lg">Purchase coins to enhance your experience</p>

          <div className="inline-flex items-center gap-2 mt-4 px-6 py-3 glass-container rounded-full">
            <Coins className="w-5 h-5 text-[#FFD700]" />
            <span className="text-2xl font-bold text-white stats-number">
              {loading ? '...' : balance.toFixed(2)}
            </span>
            <span className="text-[#B0B8C8]">coins</span>
          </div>
        </div>

        <div className="max-w-2xl mx-auto mb-8">
          <CoinPoolDisplay />
        </div>

        {error && (
          <div className="max-w-2xl mx-auto mb-6 glass-container bg-red-500/10 border-red-500/50 p-4 rounded-xl">
            <p className="text-red-400 text-center">{error}</p>
          </div>
        )}

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 mb-12">
          {COIN_PACKAGES.map((pkg) => (
            <div
              key={pkg.id}
              className={`relative glass-card p-6 border-2 transition-all hover:scale-105 ${
                pkg.popular
                  ? 'border-[#FFD700] shadow-2xl shadow-[#FFD700]/20'
                  : 'border-white/20 hover:border-white/40'
              }`}
            >
              {pkg.popular && (
                <div className="absolute -top-3 left-1/2 -translate-x-1/2">
                  <div className="flex items-center gap-1 px-3 py-1 bg-gradient-to-r from-[#FFD700] to-[#FFA500] rounded-full text-black text-sm font-semibold shadow-lg">
                    <Sparkles className="w-4 h-4" />
                    Most Popular
                  </div>
                </div>
              )}

              <div className="text-center mb-6">
                <div className="inline-flex items-center justify-center w-16 h-16 bg-gradient-to-br from-[#FFD700]/20 to-[#FFA500]/20 rounded-full mb-4">
                  <Coins className="w-8 h-8 text-[#FFD700]" />
                </div>
                <div className="text-5xl font-bold text-white mb-2 stats-number">
                  {pkg.coins.toLocaleString()}
                </div>
                <div className="text-[#B0B8C8] text-sm mb-4">coins</div>
                <div className="text-3xl font-bold text-white">
                  £{pkg.price.toFixed(2)}
                </div>
              </div>

              <button
                onClick={() => handlePurchase(pkg.id)}
                disabled={purchasingPackage === pkg.id}
                className={`w-full py-3 rounded-xl font-semibold transition-all ${
                  pkg.popular
                    ? 'btn-primary'
                    : 'btn-ghost'
                } disabled:opacity-50 disabled:cursor-not-allowed`}
              >
                <div className="flex items-center justify-center gap-2">
                  {purchasingPackage === pkg.id ? (
                    <>
                      <Loader2 className="w-5 h-5 animate-spin" />
                      Setting up payment...
                    </>
                  ) : (
                    <>
                      <CreditCard className="w-5 h-5" />
                      Buy Now
                    </>
                  )}
                </div>
              </button>
            </div>
          ))}
        </div>

        <div className="glass-container p-8 border border-white/10">
          <h2 className="text-2xl font-bold text-white mb-6 flex items-center gap-2">
            <Coins className="w-6 h-6 text-[#FFD700]" />
            Ways to Earn Coins
          </h2>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="glass-card p-6 border border-white/10">
              <div className="flex items-start gap-4">
                <div className="w-12 h-12 bg-[#38BDF8]/20 rounded-full flex items-center justify-center flex-shrink-0">
                  <span className="text-2xl">💬</span>
                </div>
                <div>
                  <h3 className="text-lg font-semibold text-white mb-2">Comment Rewards</h3>
                  <p className="text-[#B0B8C8] text-sm mb-2">
                    Earn <span className="text-[#00FF85] font-semibold">0.1 coin</span> for your first comment on each player's profile
                  </p>
                  <ul className="text-[#6B7280] text-xs space-y-1">
                    <li>• Only first comment per profile</li>
                    <li>• Cannot earn from own profile</li>
                  </ul>
                </div>
              </div>
            </div>

            <div className="glass-card p-6 border border-white/10">
              <div className="flex items-start gap-4">
                <div className="w-12 h-12 bg-[#00FF85]/20 rounded-full flex items-center justify-center flex-shrink-0">
                  <span className="text-2xl">📺</span>
                </div>
                <div>
                  <h3 className="text-lg font-semibold text-white mb-2">Watch Adverts</h3>
                  <p className="text-[#B0B8C8] text-sm mb-2">
                    Earn <span className="text-[#00FF85] font-semibold">10 coins</span> per advert viewed
                  </p>
                  <ul className="text-[#6B7280] text-xs space-y-1">
                    <li>• One advert per day limit</li>
                    <li>• Quick 30-second videos</li>
                  </ul>
                </div>
              </div>
            </div>
          </div>
        </div>

        <div className="mt-8 text-center">
          <p className="text-[#6B7280] text-sm">
            All transactions are secure and encrypted.
          </p>
        </div>
      </div>
    </div>
  );
}
