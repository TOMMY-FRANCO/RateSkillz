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
      const page = parseInt(url.searchParams.get('page') || '1');
      const limit = parseInt(url.searchParams.get('limit') || '20');
      return await getTransactions(supabase, user.id, page, limit);
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
    .maybeSingle();

  if (error) {
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }

  return new Response(
    JSON.stringify({ balance: parseFloat(data?.coin_balance || 0) }),
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
      amount: 5,
      message: data.message
    }),
    { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
  );
}

async function getTransactions(supabase: any, userId: string, page: number = 1, limit: number = 20) {
  try {
    // Validate pagination parameters
    if (page < 1) page = 1;
    if (limit < 1 || limit > 100) limit = 20;

    const offset = (page - 1) * limit;

    // Get total count for pagination
    const { count, error: countError } = await supabase
      .from('coin_transactions')
      .select('*', { count: 'exact', head: true })
      .eq('user_id', userId);

    if (countError) {
      console.error('Error counting transactions:', countError);
      throw new Error('Failed to count transactions');
    }

    // Fetch transactions (lean query - no heavy columns)
    const { data, error } = await supabase
      .from('coin_transactions')
      .select(`
        id,
        user_id,
        amount,
        transaction_type,
        description,
        created_at,
        balance_after,
        related_user_id
      `)
      .eq('user_id', userId)
      .order('created_at', { ascending: false })
      .range(offset, offset + limit - 1);

    if (error) {
      console.error('Error fetching transactions:', error);
      throw new Error('Failed to fetch transactions');
    }

    // Parse and format transactions
    const transactions = (data || []).map((tx: any) => ({
      id: tx.id,
      user_id: tx.user_id,
      amount: typeof tx.amount === 'string' ? parseFloat(tx.amount) : (tx.amount || 0),
      transaction_type: tx.transaction_type,
      description: tx.description,
      created_at: tx.created_at,
      balance_after: tx.balance_after ? (typeof tx.balance_after === 'string' ? parseFloat(tx.balance_after) : tx.balance_after) : undefined,
      related_user_id: tx.related_user_id,
    }));

    const totalPages = Math.ceil((count || 0) / limit);

    console.log(`Fetched page ${page} of ${totalPages} (${transactions.length} transactions) for user ${userId}`);

    return new Response(
      JSON.stringify({
        transactions,
        pagination: {
          page,
          limit,
          total: count || 0,
          totalPages,
          hasMore: page < totalPages
        }
      }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    console.error('Error in getTransactions:', error);

    // Log error to admin_security_log
    try {
      await supabase.from('admin_security_log').insert({
        event_type: 'transaction_fetch_error',
        user_id: userId,
        details: {
          error: error.message,
          page,
          limit,
          timestamp: new Date().toISOString()
        }
      });
    } catch (logError) {
      console.error('Failed to log error:', logError);
    }

    return new Response(
      JSON.stringify({
        error: 'Failed to fetch transactions. Please try again later.',
        details: error.message
      }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
}
