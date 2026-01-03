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
    let userId = metadata.user_id || metadata.userId;
    const coinsAmount = parseInt(metadata.coins_purchased || metadata.coins || '100');
    const priceGBP = paymentIntent.amount / 100;
    const customerId = typeof paymentIntent.customer === 'string' ? paymentIntent.customer : null;

    // If no user_id in metadata, try to lookup from stripe_customers table
    if (!userId && customerId) {
      console.log(`[${timestamp}] No user_id in metadata, looking up from customer_id: ${customerId}`);

      const { data: customerData, error: customerError } = await supabase
        .rpc('get_user_from_stripe_customer', { p_customer_id: customerId });

      if (customerError) {
        console.error(`[${timestamp}] Error looking up user from customer_id:`, customerError);
      } else if (customerData) {
        userId = customerData;
        console.log(`[${timestamp}] Found user_id from customer: ${userId}`);
      }
    }

    if (!userId) {
      console.error(`[${timestamp}] ERROR: No user_id found in metadata or stripe_customers for payment: ${paymentIntent.id}`);
      console.error(`[${timestamp}] Customer ID: ${customerId || 'none'}`);
      console.error(`[${timestamp}] Metadata: ${JSON.stringify(metadata)}`);
      return;
    }

    console.log(`[${timestamp}] Processing ${coinsAmount} coins for user ${userId} (Payment: £${priceGBP})`);

    // Use the database function to process the purchase (includes duplicate check)
    const { data: result, error: purchaseError } = await supabase
      .rpc('process_stripe_coin_purchase', {
        p_user_id: userId,
        p_coins_amount: coinsAmount,
        p_price_gbp: priceGBP,
        p_payment_intent_id: paymentIntent.id,
        p_customer_id: customerId
      });

    if (purchaseError) {
      console.error(`[${timestamp}] ERROR: Failed to process coin purchase:`, purchaseError);
      throw new Error(`Failed to process coin purchase: ${purchaseError.message}`);
    }

    if (!result.success) {
      if (result.duplicate) {
        console.log(`[${timestamp}] ⚠ Duplicate payment detected, skipping: ${paymentIntent.id}`);
      } else {
        console.error(`[${timestamp}] ERROR: Purchase processing failed: ${result.message}`);
      }
      return;
    }

    console.log(`[${timestamp}] ✓ SUCCESS: Added ${result.coins_added} coins to user ${userId}`);
    console.log(`[${timestamp}] Transaction ID: ${result.transaction_id}`);
    console.log(`[${timestamp}] New balance: ${result.new_balance} coins`);

    // Check updated coin pool status
    const { data: poolData } = await supabase
      .from('coin_pool')
      .select('remaining_coins, distributed_coins')
      .eq('id', '00000000-0000-0000-0000-000000000001')
      .maybeSingle();

    if (poolData) {
      console.log(`[${timestamp}] Coin Pool: ${poolData.remaining_coins} remaining, ${poolData.distributed_coins} distributed`);
    }

  } catch (error: any) {
    const timestamp = new Date().toISOString();
    console.error(`[${timestamp}] CRITICAL ERROR in handleCoinPurchase:`, error.message);
    console.error(`[${timestamp}] Stack:`, error.stack);
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
    let userId = metadata.user_id || metadata.userId;
    const coinsAmount = parseInt(metadata.coins_purchased || metadata.coins || '100');
    const customerId = typeof session.customer === 'string' ? session.customer : null;

    // If payment intent is available, wait for payment_intent.succeeded event
    // This avoids double-processing
    if (session.payment_intent) {
      console.log(`[${timestamp}] Payment intent exists, will be processed by payment_intent.succeeded event`);
      return;
    }

    // Try to lookup user from stripe_customers if not in metadata
    if (!userId && customerId) {
      console.log(`[${timestamp}] No user_id in session metadata, looking up from customer_id: ${customerId}`);

      const { data: customerData, error: customerError } = await supabase
        .rpc('get_user_from_stripe_customer', { p_customer_id: customerId });

      if (customerError) {
        console.error(`[${timestamp}] Error looking up user from customer_id:`, customerError);
      } else if (customerData) {
        userId = customerData;
        console.log(`[${timestamp}] Found user_id from customer: ${userId}`);
      }
    }

    if (!userId) {
      console.error(`[${timestamp}] ERROR: No user_id found in session metadata or stripe_customers: ${session.id}`);
      console.error(`[${timestamp}] Customer ID: ${customerId || 'none'}`);
      return;
    }

    const priceGBP = (session.amount_total || 0) / 100;

    console.log(`[${timestamp}] Processing ${coinsAmount} coins for user ${userId} (Session payment: £${priceGBP})`);

    // Use the database function to process the purchase (includes duplicate check)
    const { data: result, error: purchaseError } = await supabase
      .rpc('process_stripe_coin_purchase', {
        p_user_id: userId,
        p_coins_amount: coinsAmount,
        p_price_gbp: priceGBP,
        p_payment_intent_id: session.id,
        p_customer_id: customerId
      });

    if (purchaseError) {
      console.error(`[${timestamp}] ERROR: Failed to process coin purchase:`, purchaseError);
      throw new Error(`Failed to process coin purchase: ${purchaseError.message}`);
    }

    if (!result.success) {
      if (result.duplicate) {
        console.log(`[${timestamp}] ⚠ Duplicate payment detected, skipping: ${session.id}`);
      } else {
        console.error(`[${timestamp}] ERROR: Purchase processing failed: ${result.message}`);
      }
      return;
    }

    console.log(`[${timestamp}] ✓ SUCCESS: Processed session coin purchase - ${result.coins_added} coins added`);
    console.log(`[${timestamp}] New balance: ${result.new_balance} coins`);

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
