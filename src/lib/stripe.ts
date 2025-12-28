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
  // Note: You need to create Stripe Price IDs for each coin package in your Stripe Dashboard
  // For now, using a placeholder - replace with actual price IDs from Stripe
  const priceId = getCoinPriceId(coins, priceGBP);

  const currentUrl = window.location.origin;

  return createCheckoutSession({
    priceId,
    mode: 'payment',
    successUrl: `${currentUrl}/checkout/success?coins=${coins}`,
    cancelUrl: `${currentUrl}/shop`,
    metadata: {
      coins_purchased: coins.toString(),
      price_gbp: priceGBP.toString(),
    },
  });
}

/**
 * Maps coin amounts to Stripe Price IDs
 * You MUST create these prices in your Stripe Dashboard and update this mapping
 */
function getCoinPriceId(coins: number, priceGBP: number): string {
  // This is a mapping of coins to Stripe Price IDs
  // You need to create these in Stripe Dashboard: https://dashboard.stripe.com/prices
  const priceMap: Record<string, string> = {
    '100': 'price_REPLACE_WITH_ACTUAL_STRIPE_PRICE_ID_100',    // £1.00
    '200': 'price_REPLACE_WITH_ACTUAL_STRIPE_PRICE_ID_200',    // £2.00
    '500': 'price_REPLACE_WITH_ACTUAL_STRIPE_PRICE_ID_500',    // £5.00
    '2000': 'price_REPLACE_WITH_ACTUAL_STRIPE_PRICE_ID_2000',  // £20.00
    '5000': 'price_REPLACE_WITH_ACTUAL_STRIPE_PRICE_ID_5000',  // £50.00
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