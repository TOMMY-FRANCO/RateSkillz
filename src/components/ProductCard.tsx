import React from 'react';
import { StripeProduct } from '../stripe-config';
import { StripeCheckout } from './StripeCheckout';

interface ProductCardProps {
  product: StripeProduct;
}

export function ProductCard({ product }: ProductCardProps) {
  return (
    <div className="bg-white rounded-lg shadow-md p-6 border border-gray-200">
      <div className="mb-4">
        <h3 className="text-xl font-bold text-gray-900 mb-2">{product.name}</h3>
        <p className="text-gray-600 mb-3">{product.description}</p>
        <div className="text-2xl font-bold text-blue-600 mb-4">
          {product.currencySymbol}{product.price.toFixed(2)}
        </div>
      </div>
      
      <StripeCheckout product={product} />
    </div>
  );
}