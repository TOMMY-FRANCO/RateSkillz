import { useState } from 'react';
import { createCheckoutSession } from '../../lib/stripe';
import { useAuth } from '../../contexts/AuthContext';
import { AuthModal } from '../auth/AuthModal';

interface ProductCardProps {
  product: any;
}

export function ProductCard({ product }: ProductCardProps) {
  const { user } = useAuth();
  const [loading, setLoading] = useState(false);
  const [showAuthModal, setShowAuthModal] = useState(false);

  const handlePurchase = async () => {
    if (!user) {
      setShowAuthModal(true);
      return;
    }

    setLoading(true);
    try {
      const sessionUrl = await createCheckoutSession(product.priceId);
      if (sessionUrl) {
        window.location.href = sessionUrl;
      }
    } catch (error) {
      console.error('Error creating checkout session:', error);
    } finally {
      setLoading(false);
    }
  };

  return (
    <>
      <div className="glass-card p-6 hover:border-[#00E0FF]/50 transition-all">
        <h3 className="text-xl font-bold text-white mb-2">{product.name}</h3>
        <p className="text-white/60 mb-4">{product.description}</p>
        <div className="flex items-baseline mb-4">
          <span className="text-3xl font-bold text-white">${product.price}</span>
          <span className="text-white/60 ml-2">/{product.interval}</span>
        </div>
        <button
          onClick={handlePurchase}
          disabled={loading}
          className="w-full bg-gradient-to-r from-[#00E0FF] to-[#7B2FF7] hover:opacity-90 text-white font-medium py-2.5 px-4 rounded-md transition-opacity disabled:opacity-50"
        >
          {loading ? 'Processing...' : 'Purchase'}
        </button>
      </div>

      <AuthModal
        isOpen={showAuthModal}
        onClose={() => setShowAuthModal(false)}
        initialMode="signup"
      />
    </>
  );
}
