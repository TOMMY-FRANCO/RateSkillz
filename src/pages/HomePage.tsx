import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';
import { ProductCard } from '../components/stripe/ProductCard';
import { SubscriptionStatus } from '../components/stripe/SubscriptionStatus';
import { AuthModal } from '../components/auth/AuthModal';

export function HomePage() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [showAuthModal, setShowAuthModal] = useState(false);

  const products = [
    {
      id: 'basic',
      name: 'Basic Plan',
      description: 'Perfect for getting started',
      price: 9.99,
      interval: 'month',
      priceId: 'price_basic',
    },
    {
      id: 'pro',
      name: 'Pro Plan',
      description: 'For professionals',
      price: 29.99,
      interval: 'month',
      priceId: 'price_pro',
    },
    {
      id: 'enterprise',
      name: 'Enterprise Plan',
      description: 'For large teams',
      price: 99.99,
      interval: 'month',
      priceId: 'price_enterprise',
    },
  ];

  return (
    <div className="min-h-screen p-8">
      <div className="max-w-7xl mx-auto">
        <div className="text-center mb-12">
          <h1 className="text-4xl font-bold text-white mb-4">
            Welcome to Our Platform
          </h1>
          <p className="text-xl text-white/60">
            Choose the perfect plan for your needs
          </p>
        </div>

        {user && (
          <div className="mb-8">
            <button
              onClick={() => navigate('/dashboard')}
              className="bg-gradient-to-r from-[#00E0FF] to-[#7B2FF7] hover:opacity-90 text-white font-medium py-2.5 px-6 rounded-md transition-opacity"
            >
              Go to Dashboard
            </button>
          </div>
        )}

        {!user && (
          <div className="mb-8 text-center">
            <button
              onClick={() => setShowAuthModal(true)}
              className="bg-gradient-to-r from-[#00E0FF] to-[#7B2FF7] hover:opacity-90 text-white font-medium py-2.5 px-6 rounded-md transition-opacity"
            >
              Sign In / Sign Up
            </button>
          </div>
        )}

        {user && (
          <div className="mb-8">
            <SubscriptionStatus />
          </div>
        )}

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {products.map((product) => (
            <ProductCard key={product.priceId} product={product} />
          ))}
        </div>
      </div>

      <AuthModal
        isOpen={showAuthModal}
        onClose={() => setShowAuthModal(false)}
      />
    </div>
  );
}
