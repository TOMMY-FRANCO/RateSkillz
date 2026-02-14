import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2.57.4";

const corsHeaders = {
  "Access-Control-Allow-Origin": "https://ratingskill.com",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey",
};

interface RequestBody {
  email: string;
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, {
      status: 200,
      headers: corsHeaders,
    });
  }

  try {
    const { email }: RequestBody = await req.json();

    if (!email) {
      return new Response(
        JSON.stringify({ success: false, error: "Email is required" }),
        {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    const supabaseAdmin = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
      { auth: { autoRefreshToken: false, persistSession: false } }
    );

    const { data, error: rpcError } = await supabaseAdmin.rpc(
      "request_password_reset",
      { p_email: email.trim().toLowerCase() }
    );

    if (rpcError) {
      return new Response(
        JSON.stringify({ success: false, error: "Failed to process request" }),
        {
          status: 500,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    if (!data?.success) {
      return new Response(
        JSON.stringify({
          success: false,
          error: data?.error || "Failed to process request",
        }),
        {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    if (data.reset_id) {
      const { data: token } = await supabaseAdmin.rpc(
        "get_reset_token_by_id",
        { p_reset_id: data.reset_id }
      );

      if (token) {
        const resetLink = `https://ratingskill.com/reset-password?token=${token}`;

        const emailBody = `
          <html>
            <head>
              <style>
                body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
                .container { max-width: 600px; margin: 0 auto; padding: 20px; }
                .header { background: linear-gradient(135deg, #00E0FF, #00FF85); padding: 30px; text-align: center; border-radius: 10px 10px 0 0; }
                .header h1 { color: white; margin: 0; font-size: 28px; }
                .content { background: #f9f9f9; padding: 30px; border-radius: 0 0 10px 10px; }
                .button { display: inline-block; padding: 15px 30px; background: linear-gradient(135deg, #00E0FF, #00FF85); color: white; text-decoration: none; border-radius: 5px; font-weight: bold; margin: 20px 0; }
                .footer { text-align: center; margin-top: 30px; color: #666; font-size: 12px; }
                .warning { background: #fff3cd; border-left: 4px solid #ffc107; padding: 15px; margin: 20px 0; }
              </style>
            </head>
            <body>
              <div class="container">
                <div class="header">
                  <h1>Password Reset Request</h1>
                </div>
                <div class="content">
                  <p>Hello,</p>
                  <p>We received a request to reset your password for your RatingSkill account.</p>
                  <p>Click the button below to reset your password:</p>
                  <div style="text-align: center;">
                    <a href="${resetLink}" class="button">Reset Your Password</a>
                  </div>
                  <p>Or copy and paste this link into your browser:</p>
                  <p style="word-break: break-all; color: #00E0FF;">${resetLink}</p>
                  <div class="warning">
                    <strong>Important:</strong>
                    <ul>
                      <li>This link will expire in 30 minutes</li>
                      <li>The link can only be used once</li>
                      <li>If you didn't request this reset, you can safely ignore this email</li>
                    </ul>
                  </div>
                  <p>For security reasons, we never include your password in email communications.</p>
                  <p>Best regards,<br>The RatingSkill Team</p>
                </div>
                <div class="footer">
                  <p>This is an automated message. Please do not reply to this email.</p>
                  <p>&copy; 2026 RatingSkill. All rights reserved.</p>
                </div>
              </div>
            </body>
          </html>
        `;

        const resendApiKey = Deno.env.get("RESEND_API_KEY");
        if (resendApiKey) {
          await fetch("https://api.resend.com/emails", {
            method: "POST",
            headers: {
              Authorization: `Bearer ${resendApiKey}`,
              "Content-Type": "application/json",
            },
            body: JSON.stringify({
              from: "RatingSkill <noreply@ratingskill.com>",
              to: email.trim().toLowerCase(),
              subject: "Reset Your Password - RatingSkill",
              html: emailBody,
            }),
          });
        }
      }
    }

    return new Response(
      JSON.stringify({
        success: true,
        message: "If an account exists with that email, a reset link has been sent.",
      }),
      {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  } catch (_error) {
    return new Response(
      JSON.stringify({
        success: false,
        error: "Failed to process password reset request",
      }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }
});
