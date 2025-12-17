export interface StripeProduct {
  priceId: string;
  name: string;
  description: string;
  mode: 'payment' | 'subscription';
  price: number;
  currency: string;
  currencySymbol: string;
}

export const stripeProducts: StripeProduct[] = [
  {
    priceId: 'price_1SfRhx0eRZe90Xo750VOspur',
    name: 'Product X',
    description: 'x',
    mode: 'payment',
    price: 1.00,
    currency: 'gbp',
    currencySymbol: '£'
  }
];

export function getProductByPriceId(priceId: string): StripeProduct | undefined {
  return stripeProducts.find(product => product.priceId === priceId);
}