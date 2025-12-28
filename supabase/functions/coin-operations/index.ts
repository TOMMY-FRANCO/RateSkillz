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
    .from('coins')
    .select('balance')
    .eq('user_id', userId)
    .maybeSingle();

  if (error) {
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }

  return new Response(
    JSON.stringify({ balance: parseFloat(data?.balance || 0) }),
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
      JSON.stringify({ error: 'Cannot earn coins from own profile', earned: false }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }

  const { data, error } = await supabase.rpc('earn_coins_from_comment', {
    p_user_id: userId,
    p_profile_id: profileUserId
  });

  if (error) {
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }

  if (!data.success) {
    return new Response(
      JSON.stringify({ 
        earned: false, 
        error: data.error,
        message: data.message 
      }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }

  return new Response(
    JSON.stringify({
      success: true,
      earned: true,
      amount: 0.1,
      message: data.message
    }),
    { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
  );
}

async function awardAdCoins(supabase: any, userId: string) {
  const { data, error } = await supabase.rpc('earn_coins_from_ad', {
    p_user_id: userId
  });

  if (error) {
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }

  if (!data.success) {
    return new Response(
      JSON.stringify({ 
        earned: false, 
        error: data.error,
        message: data.message || 'Failed to award ad coins'
      }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }

  return new Response(
    JSON.stringify({ 
      success: true, 
      earned: true, 
      amount: 10,
      message: data.message
    }),
    { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
  );
}

async function getTransactions(supabase: any, userId: string) {
  const { data, error } = await supabase
    .from('coin_transactions')
    .select(`
      id,
      user_id,
      amount::numeric,
      transaction_type,
      description,
      payment_provider,
      payment_amount::numeric,
      created_at,
      balance_after::numeric
    `)
    .eq('user_id', userId)
    .order('created_at', { ascending: false })
    .limit(50);

  if (error) {
    console.error('Error fetching transactions:', error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }

  const transactions = (data || []).map((tx: any) => {
    const parsedTx = {
      id: tx.id,
      user_id: tx.user_id,
      amount: typeof tx.amount === 'string' ? parseFloat(tx.amount) : (tx.amount || 0),
      transaction_type: tx.transaction_type,
      description: tx.description,
      payment_provider: tx.payment_provider,
      payment_amount: tx.payment_amount ? (typeof tx.payment_amount === 'string' ? parseFloat(tx.payment_amount) : tx.payment_amount) : undefined,
      created_at: tx.created_at,
      balance_after: tx.balance_after ? (typeof tx.balance_after === 'string' ? parseFloat(tx.balance_after) : tx.balance_after) : undefined,
    };
    return parsedTx;
  });

  console.log(`Fetched ${transactions.length} transactions for user ${userId}`);
  console.log('Sample transaction:', transactions[0]);
  console.log('Transaction sum:', transactions.reduce((sum, tx) => sum + tx.amount, 0));

  return new Response(
    JSON.stringify({ transactions }),
    { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
  );
}
