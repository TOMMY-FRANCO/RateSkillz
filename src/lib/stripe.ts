import { supabase } from './supabase';

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

  const baseUrl = 'https://ratingskill.com';

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
 * Maps coin amounts to Stripe Price IDs
 * Only two packages available: 100 coins (£1.00) and 300 coins (£2.00)
 */
function getCoinPriceId(coins: number, priceGBP: number): string {
  // This is a mapping of coins to Stripe Price IDs
  // Only two packages are active in the shop
  const priceMap: Record<string, string> = {
    '100': 'price_1Spet513eRaZbd3FIFVEtQpE',    // £1.00
    '300': 'price_1Spevl13eRaZbd3Ftn2r6yvv',    // £2.00 (updated from 200 to 300 coins)
  };

  const priceId = priceMap[coins.toString()];

  if (!priceId || priceId.includes('REPLACE')) {
    throw new Error(
      'Stripe Price IDs not configured. Please:\n' +
      '1. Create prices in Stripe Dashboard (https://dashboard.stripe.com/prices)\n' +
      '2. Update the priceMap in src/lib/stripe.ts with actual Price IDs'
    );
  }

  return priceId;
}