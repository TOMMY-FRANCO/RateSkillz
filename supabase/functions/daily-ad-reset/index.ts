import { createClient } from 'npm:@supabase/supabase-js@2.57.4';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-Client-Info, Apikey, X-Reset-Secret',
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
    const resetSecret = Deno.env.get('DAILY_RESET_SECRET') || 'default-reset-secret-change-me';

    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Verify authorization - either service role key or secret header
    const authHeader = req.headers.get('Authorization');
    const resetSecretHeader = req.headers.get('X-Reset-Secret');

    const isAuthorized =
      (authHeader && authHeader.includes(supabaseServiceKey)) ||
      (resetSecretHeader && resetSecretHeader === resetSecret);

    if (!isAuthorized) {
      return new Response(
        JSON.stringify({
          error: 'Unauthorized. This endpoint requires service role key or reset secret.',
          timestamp: new Date().toISOString()
        }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Call the reset function
    const { data, error } = await supabase.rpc('reset_daily_ad_views');

    if (error) {
      console.error('Error calling reset_daily_ad_views:', error);

      return new Response(
        JSON.stringify({
          success: false,
          error: error.message,
          timestamp: new Date().toISOString()
        }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log('Daily ad reset completed:', data);

    return new Response(
      JSON.stringify({
        ...data,
        timestamp: new Date().toISOString(),
        gmt_time: new Date().toLocaleString('en-GB', { timeZone: 'UTC', hour12: false })
      }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Error in daily-ad-reset function:', error);

    return new Response(
      JSON.stringify({
        success: false,
        error: error.message,
        timestamp: new Date().toISOString()
      }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
