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
    // Handle OPTIONS request for CORS preflight
    if (req.method === 'OPTIONS') {
      return new Response(null, { status: 204 });
    }

    if (req.method !== 'POST') {
      return new Response('Method not allowed', { status: 405 });
    }

    // get the signature from the header
    const signature = req.headers.get('stripe-signature');

    if (!signature) {
      return new Response('No signature found', { status: 400 });
    }

    // get the raw body
    const body = await req.text();

    // verify the webhook signature
    let event: Stripe.Event;

    try {
      event = await stripe.webhooks.constructEventAsync(body, signature, stripeWebhookSecret);
    } catch (error: any) {
      console.error(`Webhook signature verification failed: ${error.message}`);
      return new Response(`Webhook signature verification failed: ${error.message}`, { status: 400 });
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
  console.log(`[${timestamp}] Processing event: ${event.type}`);

  const stripeData = event?.data?.object ?? {};

  if (!stripeData) {
    console.warn('No data object found in event');
    return;
  }

  // Handle payment_intent.succeeded for coin purchases
  if (event.type === 'payment_intent.succeeded') {
    const paymentIntent = stripeData as Stripe.PaymentIntent;

    // Only process non-invoice payments (one-time coin purchases)
    if (paymentIntent.invoice === null) {
      await handleCoinPurchase(paymentIntent);
      return;
    }
  }

  // Handle checkout.session.completed for both subscriptions and coin purchases
  if (event.type === 'checkout.session.completed') {
    const session = stripeData as Stripe.Checkout.Session;

    if (session.mode === 'payment') {
      // This is a one-time payment (coin purchase)
      await handleCoinPurchaseSession(session);
      return;
    } else if (session.mode === 'subscription') {
      // Handle subscription
      if (session.customer && typeof session.customer === 'string') {
        console.info(`Starting subscription sync for customer: ${session.customer}`);
        await syncCustomerFromStripe(session.customer);
      }
      return;
    }
  }

  // Legacy handling for other subscription events
  if (!('customer' in stripeData)) {
    return;
  }

  const { customer: customerId } = stripeData;

  if (!customerId || typeof customerId !== 'string') {
    console.error(`No customer received on event: ${JSON.stringify(event)}`);
  } else {
    let isSubscription = true;

    if (event.type === 'checkout.session.completed') {
      const { mode } = stripeData as Stripe.Checkout.Session;
      isSubscription = mode === 'subscription';
      console.info(`Processing ${isSubscription ? 'subscription' : 'one-time payment'} checkout session`);
    }

    if (isSubscription) {
      console.info(`Starting subscription sync for customer: ${customerId}`);
      await syncCustomerFromStripe(customerId);
    }
  }
}

/**
 * Handles coin purchase when payment_intent.succeeded event is received
 * This is called after the payment is confirmed by Stripe
 */
async function handleCoinPurchase(paymentIntent: Stripe.PaymentIntent) {
  try {
    const timestamp = new Date().toISOString();
    console.log(`[${timestamp}] Processing coin purchase from payment_intent: ${paymentIntent.id}`);

    // Extract metadata from payment intent
    const metadata = paymentIntent.metadata || {};
    const userId = metadata.user_id || metadata.userId;
    const coinsAmount = parseInt(metadata.coins_purchased || metadata.coins || '100');
    const priceGBP = paymentIntent.amount / 100; // Convert from pence to pounds

    if (!userId) {
      console.error(`[${timestamp}] No user_id found in payment_intent metadata: ${paymentIntent.id}`);
      return;
    }

    console.log(`[${timestamp}] Adding ${coinsAmount} coins to user ${userId} (Payment: £${priceGBP})`);

    // Check if coin pool has enough coins
    const { data: poolData, error: poolError } = await supabase
      .from('coin_pool')
      .select('remaining_coins, distributed_coins, total_coins')
      .limit(1)
      .maybeSingle();

    if (poolError) {
      console.error(`[${timestamp}] Error checking coin pool:`, poolError);
      // Don't block the purchase, just log the warning
    } else if (poolData && poolData.remaining_coins < coinsAmount) {
      console.warn(`[${timestamp}] COIN POOL LOW: Only ${poolData.remaining_coins} coins remaining, but user purchased ${coinsAmount}`);
      // Continue anyway - don't punish user for pool misconfiguration
    }

    // Insert transaction record - triggers will automatically update balance and pool
    const { data: transaction, error: transactionError } = await supabase
      .from('coin_transactions')
      .insert({
        user_id: userId,
        amount: coinsAmount,
        transaction_type: 'purchase',
        description: `Purchased ${coinsAmount} coins for £${priceGBP.toFixed(2)}`,
        reference_id: paymentIntent.id,
        payment_provider: 'stripe',
        payment_amount: priceGBP,
      })
      .select()
      .single();

    if (transactionError) {
      console.error(`[${timestamp}] ERROR: Failed to create coin transaction:`, transactionError);
      throw new Error(`Failed to record coin purchase: ${transactionError.message}`);
    }

    console.log(`[${timestamp}] ✓ Successfully added ${coinsAmount} coins to user ${userId}`);
    console.log(`[${timestamp}] Transaction ID: ${transaction.id}`);

    // Verify balance was updated (optional check)
    const { data: updatedBalance, error: balanceError } = await supabase
      .from('profiles')
      .select('coin_balance')
      .eq('id', userId)
      .single();

    if (!balanceError && updatedBalance) {
      console.log(`[${timestamp}] User ${userId} new balance: ${updatedBalance.coin_balance} coins`);
    }

  } catch (error: any) {
    const timestamp = new Date().toISOString();
    console.error(`[${timestamp}] ERROR in handleCoinPurchase:`, error.message);
    // Log to error tracking (you could add an error_logs table here)
    throw error;
  }
}

/**
 * Handles coin purchase from checkout.session.completed event
 * This provides additional context from the checkout session
 */
async function handleCoinPurchaseSession(session: Stripe.Checkout.Session) {
  try {
    const timestamp = new Date().toISOString();
    console.log(`[${timestamp}] Processing coin purchase from session: ${session.id}`);

    const metadata = session.metadata || {};
    const userId = metadata.user_id || metadata.userId;
    const coinsAmount = parseInt(metadata.coins_purchased || metadata.coins || '100');
    const customerId = typeof session.customer === 'string' ? session.customer : null;

    if (!userId) {
      console.error(`[${timestamp}] No user_id found in session metadata: ${session.id}`);
      return;
    }

    // If payment intent is available, wait for payment_intent.succeeded event
    // This avoids double-processing
    if (session.payment_intent) {
      console.log(`[${timestamp}] Payment intent exists, will be processed by payment_intent.succeeded event`);
      return;
    }

    // If no payment intent, process here (shouldn't normally happen for card payments)
    const priceGBP = (session.amount_total || 0) / 100;

    console.log(`[${timestamp}] Adding ${coinsAmount} coins to user ${userId} (Session payment: £${priceGBP})`);

    const { data: transaction, error: transactionError } = await supabase
      .from('coin_transactions')
      .insert({
        user_id: userId,
        amount: coinsAmount,
        transaction_type: 'purchase',
        description: `Purchased ${coinsAmount} coins for £${priceGBP.toFixed(2)}`,
        reference_id: session.id,
        payment_provider: 'stripe',
        payment_amount: priceGBP,
      })
      .select()
      .single();

    if (transactionError) {
      console.error(`[${timestamp}] ERROR: Failed to create coin transaction:`, transactionError);
      throw new Error(`Failed to record coin purchase: ${transactionError.message}`);
    }

    console.log(`[${timestamp}] ✓ Successfully processed session coin purchase`);

  } catch (error: any) {
    const timestamp = new Date().toISOString();
    console.error(`[${timestamp}] ERROR in handleCoinPurchaseSession:`, error.message);
    throw error;
  }
}

// based on the excellent https://github.com/t3dotgg/stripe-recommendations
async function syncCustomerFromStripe(customerId: string) {
  try {
    // fetch latest subscription data from Stripe
    const subscriptions = await stripe.subscriptions.list({
      customer: customerId,
      limit: 1,
      status: 'all',
      expand: ['data.default_payment_method'],
    });

    // TODO verify if needed
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

    // assumes that a customer can only have a single subscription
    const subscription = subscriptions.data[0];

    // store subscription state
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