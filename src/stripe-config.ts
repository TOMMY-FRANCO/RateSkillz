export interface StripeProduct {
  id: string;
  priceId: string;
  name: string;
  description: string;
  price: number;
  currency: string;
  currencySymbol: string;
  mode: 'payment' | 'subscription';
}

export const STRIPE_PRODUCTS: StripeProduct[] = [
  {
    id: 'prod_Tch66NqoDoNosP',
    priceId: 'price_1SfRhx0eRZe90Xo750VOspur',
    name: 'Product X',
    description: 'x',
    price: 1.00,
    currency: 'gbp',
    currencySymbol: '£',
    mode: 'payment'
  }
];

export const getProductById = (id: string): StripeProduct | undefined => {
  return STRIPE_PRODUCTS.find(product => product.id === id);
};

export const getProductByPriceId = (priceId: string): StripeProduct | undefined => {
  return STRIPE_PRODUCTS.find(product => product.priceId === priceId);
};