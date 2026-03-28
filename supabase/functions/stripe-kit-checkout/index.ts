import 'jsr:@supabase/functions-js/edge-runtime.d.ts';
import Stripe from 'npm:stripe@17.7.0';
import { createClient } from 'npm:@supabase/supabase-js@2.49.1';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-Client-Info, Apikey',
};

function corsResponse(body: string | object | null, status = 200) {
  if (status === 204) {
    return new Response(null, { status, headers: corsHeaders });
  }
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}

Deno.serve(async (req: Request) => {
  try {
    if (req.method === 'OPTIONS') {
      return corsResponse(null, 204);
    }

    if (req.method !== 'POST') {
      return corsResponse({ error: 'Method not allowed' }, 405);
    }

    const stripeSecret = Deno.env.get('STRIPE_SECRET_KEY');
    if (!stripeSecret) {
      return corsResponse({ error: 'Stripe not configured' }, 500);
    }

    const stripe = new Stripe(stripeSecret, {
      appInfo: { name: 'RatingSkill Kit Store', version: '1.0.0' },
    });

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    const { kit_id, user_id, price_id, success_url, cancel_url } = await req.json();

    if (!kit_id || !user_id || !price_id || !success_url || !cancel_url) {
      return corsResponse({ error: 'Missing required parameters' }, 400);
    }

    const { data: kit, error: kitError } = await supabase
      .from('kit_items')
      .select('id, name, price_gbp, stripe_price_id, is_active')
      .eq('id', kit_id)
      .eq('is_active', true)
      .maybeSingle();

    if (kitError || !kit) {
      return corsResponse({ error: 'Kit not found' }, 404);
    }

    if (kit.price_gbp === 0) {
      return corsResponse({ error: 'This kit is free — use equip instead' }, 400);
    }

    const { data: existing } = await supabase
      .from('user_kits')
      .select('id')
      .eq('user_id', user_id)
      .eq('kit_id', kit_id)
      .maybeSingle();

    if (existing) {
      return corsResponse({ error: 'Already owned' }, 400);
    }

    const session = await stripe.checkout.sessions.create({
      mode: 'payment',
      line_items: [{ price: price_id, quantity: 1 }],
      success_url,
      cancel_url,
      metadata: {
        kit_id,
        user_id,
        type: 'kit_purchase',
      },
    });

    return corsResponse({ url: session.url });
  } catch (err: any) {
    console.error('stripe-kit-checkout error:', err);
    return corsResponse({ error: err.message || 'Internal server error' }, 500);
  }
});
