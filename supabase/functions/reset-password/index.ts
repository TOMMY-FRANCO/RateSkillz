import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2.57.4";

const corsHeaders = {
  "Access-Control-Allow-Origin": "https://ratingskill.com",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey",
};

interface RequestBody {
  token: string;
  new_password: string;
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, {
      status: 200,
      headers: corsHeaders,
    });
  }

  try {
    const { token, new_password }: RequestBody = await req.json();

    if (!token || !new_password) {
      return new Response(
        JSON.stringify({
          success: false,
          error: "Token and new password are required"
        }),
        {
          status: 400,
          headers: {
            ...corsHeaders,
            "Content-Type": "application/json",
          },
        }
      );
    }

    // Validate password length
    if (new_password.length < 8) {
      return new Response(
        JSON.stringify({
          success: false,
          error: "Password must be at least 8 characters long"
        }),
        {
          status: 400,
          headers: {
            ...corsHeaders,
            "Content-Type": "application/json",
          },
        }
      );
    }

    // Create Supabase admin client
    const supabaseAdmin = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
      {
        auth: {
          autoRefreshToken: false,
          persistSession: false
        }
      }
    );

    // Verify the token
    const { data: verifyData, error: verifyError } = await supabaseAdmin
      .rpc('verify_reset_token', { p_token: token });

    if (verifyError) {
      console.error("Token verification error:", verifyError);
      return new Response(
        JSON.stringify({
          success: false,
          error: "Failed to verify reset token"
        }),
        {
          status: 500,
          headers: {
            ...corsHeaders,
            "Content-Type": "application/json",
          },
        }
      );
    }

    if (!verifyData || !verifyData.valid) {
      return new Response(
        JSON.stringify({
          success: false,
          error: verifyData?.error || "Invalid or expired reset token"
        }),
        {
          status: 400,
          headers: {
            ...corsHeaders,
            "Content-Type": "application/json",
          },
        }
      );
    }

    const userId = verifyData.user_id;

    // Update the user's password using admin API
    const { error: updateError } = await supabaseAdmin.auth.admin.updateUserById(
      userId,
      { password: new_password }
    );

    if (updateError) {
      console.error("Password update error:", updateError);
      return new Response(
        JSON.stringify({
          success: false,
          error: "Failed to update password"
        }),
        {
          status: 500,
          headers: {
            ...corsHeaders,
            "Content-Type": "application/json",
          },
        }
      );
    }

    // Mark the token as used
    const { error: markError } = await supabaseAdmin
      .rpc('mark_token_used', { p_token: token });

    if (markError) {
      console.error("Error marking token as used:", markError);
      // Don't fail the request if we can't mark the token
    }

    // Log the password reset for security audit
    await supabaseAdmin
      .from('security_event_log')
      .insert({
        user_id: userId,
        event_type: 'password_reset',
        severity: 'info',
        description: 'Password reset completed successfully',
        metadata: { token_used: token.substring(0, 8) + '...' }
      })
      .then(() => {})
      .catch((err) => console.error("Failed to log security event:", err));

    return new Response(
      JSON.stringify({
        success: true,
        message: "Password reset successfully"
      }),
      {
        status: 200,
        headers: {
          ...corsHeaders,
          "Content-Type": "application/json",
        },
      }
    );
  } catch (error) {
    console.error("Error resetting password:", error);

    return new Response(
      JSON.stringify({
        success: false,
        error: error.message || "Failed to reset password"
      }),
      {
        status: 500,
        headers: {
          ...corsHeaders,
          "Content-Type": "application/json",
        },
      }
    );
  }
});
