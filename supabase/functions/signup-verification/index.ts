import 'jsr:@supabase/functions-js/edge-runtime.d.ts';
import { createClient } from 'npm:@supabase/supabase-js@2.49.1';

const supabase = createClient(
  Deno.env.get('SUPABASE_URL') ?? '',
  Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
);

const RECAPTCHA_SECRET_KEY = Deno.env.get('RECAPTCHA_SECRET_KEY');

const corsHeaders = {
  'Access-Control-Allow-Origin': 'https://ratingskill.com',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-Client-Info, Apikey',
};

interface VerificationRequest {
  email: string;
  recaptchaToken: string;
}

interface VerificationResponse {
  success: boolean;
  error?: string;
  checks: {
    rateLimit: boolean;
    emailAvailable: boolean;
    recaptcha: boolean;
  };
}

Deno.serve(async (req: Request) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response(null, {
      status: 200,
      headers: corsHeaders,
    });
  }

  try {
    // Only accept POST requests
    if (req.method !== 'POST') {
      return new Response(
        JSON.stringify({ error: 'Method not allowed' }),
        {
          status: 405,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      );
    }

    const { email, recaptchaToken }: VerificationRequest = await req.json();

    if (!email || !recaptchaToken) {
      return new Response(
        JSON.stringify({ error: 'Email and reCAPTCHA token are required' }),
        {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      );
    }

    // Get client IP address
    const clientIp = req.headers.get('x-forwarded-for')?.split(',')[0].trim() ||
      req.headers.get('x-real-ip') ||
      'unknown';

    console.log(`[Signup Verification] Starting checks for ${email} from IP ${clientIp}`);

    const checks = {
      rateLimit: false,
      emailAvailable: false,
      recaptcha: false,
    };

    // 1. Check rate limit
    console.log('[1/3] Checking rate limit...');
    const { data: rateLimitData, error: rateLimitError } = await supabase
      .rpc('check_signup_rate_limit', { p_ip_address: clientIp });

    if (rateLimitError) {
      console.error('Rate limit check error:', rateLimitError);
      return new Response(
        JSON.stringify({ error: 'Rate limit check failed' }),
        {
          status: 500,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      );
    }

    if (!rateLimitData.allowed) {
      console.log(`Rate limit exceeded for IP ${clientIp}`);
      return new Response(
        JSON.stringify({
          success: false,
          error: 'Too many signup attempts. Please try again tomorrow.',
          checks,
        }),
        {
          status: 429,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      );
    }

    checks.rateLimit = true;
    console.log('✓ Rate limit check passed');

    // 2. Check if email already exists
    console.log('[2/3] Checking email availability...');
    const { data: existingUser, error: emailCheckError } = await supabase.auth.admin.listUsers();

    if (emailCheckError) {
      console.error('Email check error:', emailCheckError);
    } else {
      const emailExists = existingUser?.users?.some(
        (user) => user.email?.toLowerCase() === email.toLowerCase()
      );

      if (emailExists) {
        console.log(`Email already registered: ${email}`);
        return new Response(
          JSON.stringify({
            success: false,
            error: 'Email already registered. Please sign in instead.',
            checks,
          }),
          {
            status: 400,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          }
        );
      }
    }

    checks.emailAvailable = true;
    console.log('✓ Email available');

    // 3. Verify reCAPTCHA
    console.log('[3/3] Verifying reCAPTCHA...');
    if (!RECAPTCHA_SECRET_KEY) {
      console.warn('reCAPTCHA secret key not configured, skipping verification');
      checks.recaptcha = true;
    } else {
      const recaptchaResponse = await fetch(
        'https://www.google.com/recaptcha/api/siteverify',
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/x-www-form-urlencoded',
          },
          body: `secret=${RECAPTCHA_SECRET_KEY}&response=${recaptchaToken}`,
        }
      );

      const recaptchaData = await recaptchaResponse.json();

      console.log('reCAPTCHA verification result:', recaptchaData);

      if (!recaptchaData.success || (recaptchaData.score && recaptchaData.score < 0.5)) {
        console.log(`reCAPTCHA verification failed. Score: ${recaptchaData.score}`);
        return new Response(
          JSON.stringify({
            success: false,
            error: 'Please try again. Verification failed.',
            checks,
          }),
          {
            status: 400,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          }
        );
      }

      checks.recaptcha = true;
      console.log(`✓ reCAPTCHA verified (score: ${recaptchaData.score})`);
    }

    // All checks passed
    console.log(`[Signup Verification] All checks passed for ${email}`);

    // Store IP for rate limiting after successful signup
    // Note: This will be incremented after actual signup succeeds

    return new Response(
      JSON.stringify({
        success: true,
        checks,
        clientIp, // Return IP so frontend can send it with signup
      }),
      {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  } catch (error: any) {
    console.error('Signup verification error:', error);
    return new Response(
      JSON.stringify({ error: error.message || 'Verification failed' }),
      {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  }
});