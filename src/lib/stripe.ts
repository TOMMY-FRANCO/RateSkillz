import { supabase } from './supabase';
import { getAppUrl } from './appConfig';
import { getCoinProductByAmount } from '../stripe-config';

interface CreateCheckoutSessionParams {
  priceId: string;
  mode: 'payment' | 'subscription';
  successUrl: string;
  cancelUrl: string;
  metadata?: Record<string, string>;
}

interface CheckoutSessionResponse {
  sessionId: string;
  url: string;
}

export async function createCheckoutSession(params: CreateCheckoutSessionParams): Promise<CheckoutSessionResponse> {
  const { data: { session } } = await supabase.auth.getSession();

  if (!session?.access_token) {
    throw new Error('User not authenticated');
  }

  const response = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/stripe-checkout`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${session.access_token}`,
    },
    body: JSON.stringify({
      price_id: params.priceId,
      mode: params.mode,
      success_url: params.successUrl,
      cancel_url: params.cancelUrl,
      metadata: params.metadata,
    }),
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.error || 'Failed to create checkout session');
  }

  return response.json();
}

/**
 * Creates a Stripe checkout session for purchasing coins
 * @param coins - Number of coins to purchase
 * @param priceGBP - Price in GBP (pounds)
 * @returns Checkout session with redirect URL
 */
export async function createCoinPurchaseCheckout(coins: number, priceGBP: number): Promise<CheckoutSessionResponse> {
  const priceId = getCoinPriceId(coins, priceGBP);

  const baseUrl = getAppUrl();

  return createCheckoutSession({
    priceId,
    mode: 'payment',
    successUrl: `${baseUrl}/checkout/success?session_id={CHECKOUT_SESSION_ID}&coins=${coins}`,
    cancelUrl: `${baseUrl}/shop`,
    metadata: {
      coins_purchased: coins.toString(),
      price_gbp: priceGBP.toString(),
    },
  });
}

/**
 * Maps coin amounts to Stripe Price IDs from centralized stripe-config.ts
 * Only two packages available: 100 coins (£1.00) and 300 coins (£2.00)
 */
function getCoinPriceId(coins: number, priceGBP: number): string {
  const product = getCoinProductByAmount(coins);

  if (!product) {
    throw new Error(
      `No Stripe product configured for ${coins} coins at £${priceGBP}. ` +
      'Please update STRIPE_COIN_PRODUCTS in src/stripe-config.ts'
    );
  }

  if (product.price !== priceGBP) {
    console.warn(
      `Price mismatch: Expected £${product.price} for ${coins} coins, but got £${priceGBP}. ` +
      'Using configured price.'
    );
  }

  return product.priceId;
}