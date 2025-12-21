import { createClient } from 'npm:@supabase/supabase-js@2.57.4';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-Client-Info, Apikey',
};

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, {
      status: 200,
      headers: corsHeaders,
    });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      return new Response(
        JSON.stringify({ error: 'Missing authorization header' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const token = authHeader.replace('Bearer ', '');
    const { data: { user }, error: userError } = await supabase.auth.getUser(token);

    if (userError || !user) {
      return new Response(
        JSON.stringify({ error: 'Invalid token' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const url = new URL(req.url);
    const path = url.pathname.replace('/coin-operations', '');

    if (path === '/balance' && req.method === 'GET') {
      return await getBalance(supabase, user.id);
    }

    if (path === '/award-comment' && req.method === 'POST') {
      const body = await req.json();
      return await awardCommentCoins(supabase, user.id, body);
    }

    if (path === '/award-ad' && req.method === 'POST') {
      return await awardAdCoins(supabase, user.id);
    }

    if (path === '/transactions' && req.method === 'GET') {
      return await getTransactions(supabase, user.id);
    }

    return new Response(
      JSON.stringify({ error: 'Not found' }),
      { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    console.error('Error:', error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});

async function getBalance(supabase: any, userId: string) {
  const { data, error } = await supabase
    .from('profiles')
    .select('coin_balance')
    .eq('id', userId)
    .single();

  if (error) {
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }

  return new Response(
    JSON.stringify({ balance: parseFloat(data.coin_balance || 0) }),
    { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
  );
}

async function awardCommentCoins(supabase: any, userId: string, body: any) {
  const { profileUserId, commentId } = body;

  if (!profileUserId || !commentId) {
    return new Response(
      JSON.stringify({ error: 'Missing profileUserId or commentId' }),
      { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }

  if (userId === profileUserId) {
    return new Response(
      JSON.stringify({ error: 'Cannot earn coins from own profile' }),
      { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }

  const { data: existingReward } = await supabase
    .from('comment_coin_rewards')
    .select('id')
    .eq('user_id', userId)
    .eq('profile_user_id', profileUserId)
    .maybeSingle();

  if (existingReward) {
    return new Response(
      JSON.stringify({ error: 'Already earned coins from this profile', earned: false }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }

  const { data: pool } = await supabase
    .from('coin_pool')
    .select('*')
    .single();

  if (!pool || pool.remaining_coins < 0.1) {
    return new Response(
      JSON.stringify({ error: 'Insufficient coins in pool' }),
      { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }

  const { error: updateError } = await supabase.rpc('award_comment_coins_transaction', {
    p_user_id: userId,
    p_profile_user_id: profileUserId,
    p_comment_id: commentId,
    p_coins: 0.1
  });

  if (updateError) {
    const { error: rewardError } = await supabase
      .from('comment_coin_rewards')
      .insert({
        user_id: userId,
        profile_user_id: profileUserId,
        comment_id: commentId,
        coins_awarded: 0.1
      });

    if (rewardError) {
      return new Response(
        JSON.stringify({ error: rewardError.message }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const { error: balanceError } = await supabase
      .from('profiles')
      .update({ coin_balance: supabase.rpc('increment_coin_balance', { amount: 0.1 }) })
      .eq('id', userId);

    await supabase
      .from('coin_transactions')
      .insert({
        user_id: userId,
        amount: 0.1,
        transaction_type: 'comment_reward',
        description: 'Earned coins for commenting',
        reference_id: commentId
      });

    await supabase
      .from('coin_pool')
      .update({
        distributed_coins: pool.distributed_coins + 0.1,
        remaining_coins: pool.remaining_coins - 0.1
      })
      .eq('id', pool.id);
  }

  return new Response(
    JSON.stringify({ success: true, earned: true, amount: 0.1 }),
    { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
  );
}

async function awardAdCoins(supabase: any, userId: string) {
  const today = new Date().toISOString().split('T')[0];

  const { data: profile } = await supabase
    .from('profiles')
    .select('last_ad_view_date')
    .eq('id', userId)
    .single();

  if (profile?.last_ad_view_date === today) {
    return new Response(
      JSON.stringify({ error: 'Already watched ad today', earned: false }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }

  const { data: pool } = await supabase
    .from('coin_pool')
    .select('*')
    .single();

  if (!pool || pool.remaining_coins < 10) {
    return new Response(
      JSON.stringify({ error: 'Insufficient coins in pool' }),
      { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }

  const { data: currentBalance } = await supabase
    .from('profiles')
    .select('coin_balance')
    .eq('id', userId)
    .single();

  const newBalance = parseFloat(currentBalance?.coin_balance || 0) + 10;

  await supabase
    .from('profiles')
    .update({ 
      coin_balance: newBalance,
      last_ad_view_date: today 
    })
    .eq('id', userId);

  await supabase
    .from('ad_views')
    .insert({
      user_id: userId,
      coins_awarded: 10
    });

  await supabase
    .from('coin_transactions')
    .insert({
      user_id: userId,
      amount: 10,
      transaction_type: 'ad_reward',
      description: 'Earned coins for watching ad'
    });

  await supabase
    .from('coin_pool')
    .update({
      distributed_coins: pool.distributed_coins + 10,
      remaining_coins: pool.remaining_coins - 10
    })
    .eq('id', pool.id);

  return new Response(
    JSON.stringify({ success: true, earned: true, amount: 10 }),
    { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
  );
}

async function getTransactions(supabase: any, userId: string) {
  const { data, error } = await supabase
    .from('coin_transactions')
    .select('*')
    .eq('user_id', userId)
    .order('created_at', { ascending: false })
    .limit(50);

  if (error) {
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }

  return new Response(
    JSON.stringify({ transactions: data }),
    { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
  );
}