import { supabase } from './supabase';

interface BillingPlugin {
  isAvailable(): Promise<{ available: boolean }>;
  purchase(options: { productId: string }): Promise<{
    purchaseToken: string;
    orderId: string;
    productId: string;
    purchaseState: number;
  }>;
  acknowledgePurchase(options: { purchaseToken: string }): Promise<{ success: boolean }>;
}

export const GOOGLE_PLAY_PRODUCTS = {
  coins_100: { id: 'coins_100', coins: 100, price: 1.00, label: '£1.00' },
  coins_300: { id: 'coins_300', coins: 300, price: 2.00, label: '£2.00' },
} as const;

export type GooglePlayProductId = keyof typeof GOOGLE_PLAY_PRODUCTS;

async function loadCapacitor() {
  const { Capacitor, registerPlugin } = await import('@capacitor/core');
  return { Capacitor, registerPlugin };
}

export async function isGooglePlayBillingAvailable(): Promise<boolean> {
  try {
    const { Capacitor, registerPlugin } = await loadCapacitor();
    if (!Capacitor.isNativePlatform() || Capacitor.getPlatform() !== 'android') {
      return false;
    }
    const Billing = registerPlugin<BillingPlugin>('Billing');
    const result = await Billing.isAvailable();
    return result.available;
  } catch {
    return false;
  }
}

export async function purchaseWithGooglePlay(
  productId: GooglePlayProductId
): Promise<{ success: boolean; coinsAdded: number; newBalance: number; message?: string }> {
  const { registerPlugin } = await loadCapacitor();
  const Billing = registerPlugin<BillingPlugin>('Billing');
  const purchaseResult = await Billing.purchase({ productId });

  if (!purchaseResult.purchaseToken) {
    throw new Error('No purchase token received from Google Play');
  }

  const { data: { session } } = await supabase.auth.getSession();
  if (!session?.access_token) {
    throw new Error('Not authenticated');
  }

  const response = await fetch(
    `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/verify-google-play-purchase`,
    {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${session.access_token}`,
      },
      body: JSON.stringify({
        productId,
        purchaseToken: purchaseResult.purchaseToken,
        orderId: purchaseResult.orderId,
      }),
    }
  );

  const data = await response.json();

  if (!response.ok) {
    throw new Error(data.error || 'Failed to verify purchase');
  }

  return {
    success: true,
    coinsAdded: data.coins_added,
    newBalance: data.new_balance,
    message: data.duplicate ? 'Purchase already processed' : undefined,
  };
}
