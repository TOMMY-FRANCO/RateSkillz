export interface StripeProduct {
  id: string;
  priceId: string;
  name: string;
  description: string;
  price: number;
  coins?: number;
  currency: string;
  currencySymbol: string;
  mode: 'payment' | 'subscription';
}

export const STRIPE_COIN_PRODUCTS: StripeProduct[] = [
  {
    id: 'coin_starter',
    priceId: 'price_1Spet513eRaZbd3FIFVEtQpE',
    name: '100 Coins',
    description: 'Starter pack',
    price: 1.00,
    coins: 100,
    currency: 'gbp',
    currencySymbol: '£',
    mode: 'payment'
  },
  {
    id: 'coin_value',
    priceId: 'price_1Spevl13eRaZbd3Ftn2r6yvv',
    name: '300 Coins',
    description: 'Most popular value pack',
    price: 2.00,
    coins: 300,
    currency: 'gbp',
    currencySymbol: '£',
    mode: 'payment'
  }
];

export const STRIPE_PRODUCTS: StripeProduct[] = [
  ...STRIPE_COIN_PRODUCTS
];

export const getProductById = (id: string): StripeProduct | undefined => {
  return STRIPE_PRODUCTS.find(product => product.id === id);
};

export const getProductByPriceId = (priceId: string): StripeProduct | undefined => {
  return STRIPE_PRODUCTS.find(product => product.priceId === priceId);
};

export const getCoinProductByAmount = (coins: number): StripeProduct | undefined => {
  return STRIPE_COIN_PRODUCTS.find(product => product.coins === coins);
};