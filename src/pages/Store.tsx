import React from 'react';
import { ShoppingBag } from 'lucide-react';
import { STRIPE_PRODUCTS } from '../stripe-config';
import { ProductCard } from '../components/ProductCard';

export function Store() {
  return (
    <div className="min-h-screen bg-gray-50 py-8">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="text-center mb-12">
          <div className="flex items-center justify-center mb-4">
            <ShoppingBag className="w-12 h-12 text-blue-600" />
          </div>
          <h1 className="text-4xl font-bold text-gray-900 mb-4">Store</h1>
          <p className="text-xl text-gray-600 max-w-2xl mx-auto">
            Purchase premium features and unlock exclusive content
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
          {STRIPE_PRODUCTS.map((product) => (
            <ProductCard key={product.id} product={product} />
          ))}
        </div>
      </div>
    </div>
  );
}