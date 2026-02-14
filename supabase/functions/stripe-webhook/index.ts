import 'jsr:@supabase/functions-js/edge-runtime.d.ts';
import Stripe from 'npm:stripe@17.7.0';
import { createClient } from 'npm:@supabase/supabase-js@2.49.1';

const stripeSecret = Deno.env.get('STRIPE_SECRET_KEY')!;
const stripeWebhookSecret = Deno.env.get('STRIPE_WEBHOOK_SECRET')!;

const stripe = new Stripe(stripeSecret, {
  appInfo: {
    name: 'Bolt Integration',
    version: '1.0.0',
  },
});

const supabase = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!);

Deno.serve(async (req) => {
  try {
    if (req.method === 'OPTIONS') {
      return new Response(null, { status: 204 });
    }

    if (req.method !== 'POST') {
      return new Response('Method not allowed', { status: 405 });
    }

    const signature = req.headers.get('stripe-signature');

    if (!signature) {
      console.error('No Stripe signature header found');
      return new Response('No signature found', { status: 400 });
    }

    const body = await req.text();

    let event: Stripe.Event;

    try {
      event = await stripe.webhooks.constructEventAsync(body, signature, stripeWebhookSecret);
      console.log(`Webhook event received: ${event.type} (${event.id})`);
    } catch (error: any) {
      console.error('Webhook signature verification failed');
      return new Response('Webhook signature verification failed', { status: 400 });
    }

    EdgeRuntime.waitUntil(handleEvent(event));

    return Response.json({ received: true });
  } catch (error: any) {
    console.error('Error processing webhook:', error);
    return Response.json({ error: error.message }, { status: 500 });
  }
});

async function handleEvent(event: Stripe.Event) {
  const timestamp = new Date().toISOString();
  console.log(`\n${'='.repeat(80)}`);
  console.log(`[${timestamp}] WEBHOOK EVENT RECEIVED: ${event.type}`);
  console.log(`[${timestamp}] Event ID: ${event.id}`);
  console.log(`${'='.repeat(80)}\n`);

  const stripeData = event?.data?.object ?? {};

  if (!stripeData) {
    console.warn('No data object found in event');
    return;
  }

  if (event.type === 'payment_intent.succeeded') {
    const paymentIntent = stripeData as Stripe.PaymentIntent;
    console.log(`[${timestamp}] Payment Intent Succeeded - ID: ${paymentIntent.id}`);
    console.log(`[${timestamp}] Amount: ${paymentIntent.amount / 100} ${paymentIntent.currency.toUpperCase()}`);
    console.log(`[${timestamp}] Invoice field: ${paymentIntent.invoice || 'null'}`);
    console.log(`[${timestamp}] Metadata:`, JSON.stringify(paymentIntent.metadata || {}, null, 2));

    const hasCoinMetadata = paymentIntent.metadata &&
      (paymentIntent.metadata.coins_purchased || paymentIntent.metadata.coins);

    console.log(`[${timestamp}] Has coin purchase metadata: ${!!hasCoinMetadata}`);

    if (hasCoinMetadata) {
      console.log(`[${timestamp}] ✅ COIN PURCHASE DETECTED (via metadata) - Processing purchase`);
      await handleCoinPurchase(paymentIntent);
      return;
    }

    if (paymentIntent.invoice === null) {
      console.log(`[${timestamp}] One-time payment with no coin metadata - processing as coin purchase`);
      await handleCoinPurchase(paymentIntent);
      return;
    } else {
      console.log(`[${timestamp}] This is an invoice payment (subscription) - skipping coin purchase logic`);
    }
  }

  if (event.type === 'checkout.session.completed') {
    const session = stripeData as Stripe.Checkout.Session;
    console.log(`[${timestamp}] Checkout Session Completed - ID: ${session.id}`);
    console.log(`[${timestamp}] Mode: ${session.mode}`);
    console.log(`[${timestamp}] Payment Status: ${session.payment_status}`);
    console.log(`[${timestamp}] Session Metadata:`, JSON.stringify(session.metadata || {}, null, 2));

    const hasCoinMetadata = session.metadata &&
      (session.metadata.coins_purchased || session.metadata.coins);

    console.log(`[${timestamp}] Has coin purchase metadata: ${!!hasCoinMetadata}`);

    if (hasCoinMetadata && session.mode === 'payment') {
      console.log(`[${timestamp}] ✅ COIN PURCHASE DETECTED (session with metadata) - Processing purchase`);
      await handleCoinPurchaseSession(session);
      return;
    }

    if (session.mode === 'payment') {
      console.log(`[${timestamp}] One-time payment mode - processing as coin purchase`);
      await handleCoinPurchaseSession(session);
      return;
    } else if (session.mode === 'subscription') {
      console.log(`[${timestamp}] This is a subscription - syncing customer`);
      if (session.customer && typeof session.customer === 'string') {
        await syncCustomerFromStripe(session.customer);
      }
      return;
    }
  }

  if (!('customer' in stripeData)) {
    console.log(`[${timestamp}] No customer in event data - skipping`);
    return;
  }

  const { customer: customerId } = stripeData;

  if (!customerId || typeof customerId !== 'string') {
    console.error(`[${timestamp}] No valid customer received on event: ${JSON.stringify(event)}`);
  } else {
    let isSubscription = true;

    if (event.type === 'checkout.session.completed') {
      const { mode } = stripeData as Stripe.Checkout.Session;
      isSubscription = mode === 'subscription';
    }

    if (isSubscription) {
      console.info(`[${timestamp}] Starting subscription sync for customer: ${customerId}`);
      await syncCustomerFromStripe(customerId);
    }
  }
}

async function handleCoinPurchase(paymentIntent: Stripe.PaymentIntent) {
  const timestamp = new Date().toISOString();

  try {
    console.log(`\n${'*'.repeat(80)}`);
    console.log(`[${timestamp}] PROCESSING COIN PURCHASE FROM PAYMENT INTENT`);
    console.log(`[${timestamp}] Payment Intent ID: ${paymentIntent.id}`);
    console.log(`${'*'.repeat(80)}\n`);

    const metadata = paymentIntent.metadata || {};
    console.log(`[${timestamp}] Metadata received:`, JSON.stringify(metadata, null, 2));

    let userId = metadata.user_id || metadata.userId;
    const coinsAmount = parseInt(metadata.coins_purchased || metadata.coins || '100');
    const priceGBP = paymentIntent.amount / 100;
    const customerId = typeof paymentIntent.customer === 'string' ? paymentIntent.customer : null;

    console.log(`[${timestamp}] Initial user_id from metadata: ${userId || 'NOT FOUND'}`);
    console.log(`[${timestamp}] Coins amount: ${coinsAmount}`);
    console.log(`[${timestamp}] Price: £${priceGBP}`);
    console.log(`[${timestamp}] Customer ID: ${customerId || 'NOT FOUND'}`);

    if (!userId && customerId) {
      console.log(`[${timestamp}] No user_id in metadata - attempting customer lookup...`);

      const { data: customerData, error: customerError } = await supabase
        .rpc('get_user_from_stripe_customer', { p_customer_id: customerId });

      if (customerError) {
        console.error(`[${timestamp}] ❌ Error looking up user from customer_id:`, customerError);
      } else if (customerData) {
        userId = customerData;
        console.log(`[${timestamp}] ✅ Found user_id from customer lookup: ${userId}`);
      } else {
        console.error(`[${timestamp}] ❌ No user found for customer_id: ${customerId}`);
      }
    }

    if (!userId) {
      console.error(`\n${'!'.repeat(80)}`);
      console.error(`[${timestamp}] CRITICAL ERROR: NO USER_ID FOUND`);
      console.error(`[${timestamp}] Payment Intent: ${paymentIntent.id}`);
      console.error(`[${timestamp}] Customer ID: ${customerId || 'none'}`);
      console.error(`[${timestamp}] Metadata: ${JSON.stringify(metadata)}`);
      console.error(`${'!'.repeat(80)}\n`);
      return;
    }

    console.log(`\n[${timestamp}] Calling database function to process purchase...`);
    console.log(`[${timestamp}] User ID: ${userId}`);
    console.log(`[${timestamp}] Coins: ${coinsAmount}`);
    console.log(`[${timestamp}] Price: £${priceGBP}`);
    console.log(`[${timestamp}] Reference: ${paymentIntent.id}`);

    const { data: result, error: purchaseError } = await supabase
      .rpc('process_stripe_coin_purchase', {
        p_user_id: userId,
        p_coins_amount: coinsAmount,
        p_price_gbp: priceGBP,
        p_payment_intent_id: paymentIntent.id,
        p_customer_id: customerId
      });

    if (purchaseError) {
      console.error(`\n${'!'.repeat(80)}`);
      console.error(`[${timestamp}] DATABASE ERROR:`, purchaseError);
      console.error(`[${timestamp}] Error message: ${purchaseError.message}`);
      console.error(`[${timestamp}] Error details:`, JSON.stringify(purchaseError, null, 2));
      console.error(`${'!'.repeat(80)}\n`);
      throw new Error(`Failed to process coin purchase: ${purchaseError.message}`);
    }

    console.log(`\n[${timestamp}] Database function result:`, JSON.stringify(result, null, 2));

    if (!result) {
      console.error(`[${timestamp}] ❌ No result returned from database function`);
      return;
    }

    if (!result.success) {
      if (result.duplicate) {
        console.log(`\n${'~'.repeat(80)}`);
        console.log(`[${timestamp}] ⚠️  DUPLICATE PAYMENT DETECTED`);
        console.log(`[${timestamp}] Payment Intent: ${paymentIntent.id}`);
        console.log(`[${timestamp}] This payment was already processed - skipping`);
        console.log(`${'~'.repeat(80)}\n`);
      } else {
        console.error(`\n${'!'.repeat(80)}`);
        console.error(`[${timestamp}] ❌ PURCHASE FAILED: ${result.message}`);
        console.error(`${'!'.repeat(80)}\n`);
      }
      return;
    }

    console.log(`\n${'✓'.repeat(80)}`);
    console.log(`[${timestamp}] ✅ SUCCESS - COINS CREDITED`);
    console.log(`[${timestamp}] User ID: ${userId}`);
    console.log(`[${timestamp}] Coins Added: ${result.coins_added}`);
    console.log(`[${timestamp}] New Balance: ${result.new_balance}`);
    console.log(`[${timestamp}] Transaction ID: ${result.transaction_id}`);
    console.log(`${'✓'.repeat(80)}\n`);

    const { data: poolData } = await supabase
      .from('coin_pool')
      .select('remaining_coins, distributed_coins')
      .eq('id', '00000000-0000-0000-0000-000000000001')
      .maybeSingle();

    if (poolData) {
      console.log(`[${timestamp}] 💰 Coin Pool Status:`);
      console.log(`[${timestamp}]    Remaining: ${poolData.remaining_coins}`);
      console.log(`[${timestamp}]    Distributed: ${poolData.distributed_coins}`);
    }

  } catch (error: any) {
    console.error(`\n${'X'.repeat(80)}`);
    console.error(`[${timestamp}] CRITICAL ERROR IN handleCoinPurchase`);
    console.error(`[${timestamp}] Error Message: ${error.message}`);
    console.error(`[${timestamp}] Stack Trace:`, error.stack);
    console.error(`${'X'.repeat(80)}\n`);
    throw error;
  }
}

async function handleCoinPurchaseSession(session: Stripe.Checkout.Session) {
  const timestamp = new Date().toISOString();

  try {
    console.log(`\n${'*'.repeat(80)}`);
    console.log(`[${timestamp}] PROCESSING COIN PURCHASE FROM CHECKOUT SESSION`);
    console.log(`[${timestamp}] Session ID: ${session.id}`);
    console.log(`${'*'.repeat(80)}\n`);

    const metadata = session.metadata || {};
    console.log(`[${timestamp}] Session metadata:`, JSON.stringify(metadata, null, 2));

    let userId = metadata.user_id || metadata.userId;
    const coinsAmount = parseInt(metadata.coins_purchased || metadata.coins || '100');
    const customerId = typeof session.customer === 'string' ? session.customer : null;

    console.log(`[${timestamp}] Payment Intent: ${session.payment_intent || 'NOT SET'}`);

    if (session.payment_intent) {
      console.log(`[${timestamp}] ⏸️  Payment intent exists - will be processed by payment_intent.succeeded event`);
      console.log(`[${timestamp}] Skipping session processing to avoid duplicate`);
      return;
    }

    console.log(`[${timestamp}] No payment intent - processing from session`);

    if (!userId && customerId) {
      console.log(`[${timestamp}] No user_id in session metadata - attempting customer lookup...`);

      const { data: customerData, error: customerError } = await supabase
        .rpc('get_user_from_stripe_customer', { p_customer_id: customerId });

      if (customerError) {
        console.error(`[${timestamp}] ❌ Error looking up user:`, customerError);
      } else if (customerData) {
        userId = customerData;
        console.log(`[${timestamp}] ✅ Found user_id from customer: ${userId}`);
      }
    }

    if (!userId) {
      console.error(`\n${'!'.repeat(80)}`);
      console.error(`[${timestamp}] CRITICAL ERROR: NO USER_ID FOUND`);
      console.error(`[${timestamp}] Session ID: ${session.id}`);
      console.error(`[${timestamp}] Customer ID: ${customerId || 'none'}`);
      console.error(`${'!'.repeat(80)}\n`);
      return;
    }

    const priceGBP = (session.amount_total || 0) / 100;

    console.log(`\n[${timestamp}] Calling database function...`);
    console.log(`[${timestamp}] User: ${userId}, Coins: ${coinsAmount}, Price: £${priceGBP}`);

    const { data: result, error: purchaseError } = await supabase
      .rpc('process_stripe_coin_purchase', {
        p_user_id: userId,
        p_coins_amount: coinsAmount,
        p_price_gbp: priceGBP,
        p_payment_intent_id: session.id,
        p_customer_id: customerId
      });

    if (purchaseError) {
      console.error(`[${timestamp}] ❌ DATABASE ERROR:`, purchaseError);
      throw new Error(`Failed to process: ${purchaseError.message}`);
    }

    if (!result || !result.success) {
      if (result?.duplicate) {
        console.log(`[${timestamp}] ⚠️  Duplicate payment - already processed`);
      } else {
        console.error(`[${timestamp}] ❌ Purchase failed: ${result?.message}`);
      }
      return;
    }

    console.log(`\n${'✓'.repeat(80)}`);
    console.log(`[${timestamp}] ✅ SUCCESS - Session coin purchase processed`);
    console.log(`[${timestamp}] Coins Added: ${result.coins_added}`);
    console.log(`[${timestamp}] New Balance: ${result.new_balance}`);
    console.log(`${'✓'.repeat(80)}\n`);

  } catch (error: any) {
    console.error(`\n${'X'.repeat(80)}`);
    console.error(`[${timestamp}] ERROR in handleCoinPurchaseSession`);
    console.error(`[${timestamp}] Message: ${error.message}`);
    console.error(`${'X'.repeat(80)}\n`);
    throw error;
  }
}

async function syncCustomerFromStripe(customerId: string) {
  try {
    const subscriptions = await stripe.subscriptions.list({
      customer: customerId,
      limit: 1,
      status: 'all',
      expand: ['data.default_payment_method'],
    });

    if (subscriptions.data.length === 0) {
      console.info(`No active subscriptions found for customer: ${customerId}`);
      const { error: noSubError } = await supabase.from('stripe_subscriptions').upsert(
        {
          customer_id: customerId,
          subscription_status: 'not_started',
        },
        {
          onConflict: 'customer_id',
        },
      );

      if (noSubError) {
        console.error('Error updating subscription status:', noSubError);
        throw new Error('Failed to update subscription status in database');
      }
    }

    const subscription = subscriptions.data[0];

    const { error: subError } = await supabase.from('stripe_subscriptions').upsert(
      {
        customer_id: customerId,
        subscription_id: subscription.id,
        price_id: subscription.items.data[0].price.id,
        current_period_start: subscription.current_period_start,
        current_period_end: subscription.current_period_end,
        cancel_at_period_end: subscription.cancel_at_period_end,
        ...(subscription.default_payment_method && typeof subscription.default_payment_method !== 'string'
          ? {
              payment_method_brand: subscription.default_payment_method.card?.brand ?? null,
              payment_method_last4: subscription.default_payment_method.card?.last4 ?? null,
            }
          : {}),
        status: subscription.status,
      },
      {
        onConflict: 'customer_id',
      },
    );

    if (subError) {
      console.error('Error syncing subscription:', subError);
      throw new Error('Failed to sync subscription in database');
    }
    console.info(`Successfully synced subscription for customer: ${customerId}`);
  } catch (error) {
    console.error(`Failed to sync subscription for customer ${customerId}:`, error);
    throw error;
  }
}
