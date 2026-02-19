import "jsr:@supabase/functions-js/edge-runtime.d.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
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

    if (!email || !email.trim()) {
      return new Response(
        JSON.stringify({ success: false, error: "Email is required" }),
        {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email.trim())) {
      return new Response(
        JSON.stringify({ success: false, error: "Invalid email address" }),
        {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    const submittedAt = new Date().toUTCString();
    const userEmail = email.trim().toLowerCase();

    const emailBody = `
      <html>
        <head>
          <style>
            body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
            .container { max-width: 600px; margin: 0 auto; padding: 20px; }
            .header { background: linear-gradient(135deg, #ef4444, #b91c1c); padding: 30px; text-align: center; border-radius: 10px 10px 0 0; }
            .header h1 { color: white; margin: 0; font-size: 24px; }
            .content { background: #f9f9f9; padding: 30px; border-radius: 0 0 10px 10px; }
            .detail { background: #fff; border: 1px solid #e5e7eb; border-radius: 6px; padding: 15px; margin: 15px 0; }
            .label { font-weight: bold; color: #374151; }
            .footer { text-align: center; margin-top: 20px; color: #666; font-size: 12px; }
          </style>
        </head>
        <body>
          <div class="container">
            <div class="header">
              <h1>Account Deletion Request</h1>
            </div>
            <div class="content">
              <p>A user has submitted an account deletion request via the RatingSkill app.</p>
              <div class="detail">
                <p><span class="label">Email Address:</span> ${userEmail}</p>
                <p><span class="label">Request Submitted:</span> ${submittedAt}</p>
                <p><span class="label">Request Type:</span> Account &amp; Data Deletion</p>
              </div>
              <p>Please process this deletion request within 30 days as required.</p>
              <p>Steps to complete:</p>
              <ol>
                <li>Locate the account associated with <strong>${userEmail}</strong></li>
                <li>Delete all user data including profile, transactions, messages, and any associated records</li>
                <li>Confirm deletion is complete</li>
              </ol>
              <p>Best regards,<br>RatingSkill Automated System</p>
            </div>
            <div class="footer">
              <p>This is an automated notification from RatingSkill.</p>
              <p>&copy; 2026 RatingSkill. All rights reserved.</p>
            </div>
          </div>
        </body>
      </html>
    `;

    const resendApiKey = Deno.env.get("RESEND_API_KEY");
    if (resendApiKey) {
      const sendResult = await fetch("https://api.resend.com/emails", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${resendApiKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          from: "RatingSkill <noreply@ratingskill.com>",
          to: "Dev.ratingskill@gmail.com",
          subject: `Account Deletion Request - ${userEmail}`,
          html: emailBody,
        }),
      });

      if (!sendResult.ok) {
        return new Response(
          JSON.stringify({ success: false, error: "Failed to send deletion request" }),
          {
            status: 500,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          }
        );
      }
    }

    return new Response(
      JSON.stringify({ success: true }),
      {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  } catch (_error) {
    return new Response(
      JSON.stringify({ success: false, error: "Failed to process deletion request" }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }
});
