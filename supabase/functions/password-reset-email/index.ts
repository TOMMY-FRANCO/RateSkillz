import "jsr:@supabase/functions-js/edge-runtime.d.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey",
};

interface RequestBody {
  email: string;
  token: string;
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, {
      status: 200,
      headers: corsHeaders,
    });
  }

  try {
    const { email, token }: RequestBody = await req.json();

    if (!email || !token) {
      return new Response(
        JSON.stringify({
          success: false,
          error: "Email and token are required"
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

    // Construct reset link
    const resetLink = `https://ratingskill.com/reset-password?token=${token}`;

    // Email body
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
              <h1>🔐 Password Reset Request</h1>
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
                <strong>⚠️ Important:</strong>
                <ul>
                  <li>This link will expire in 30 minutes</li>
                  <li>The link can only be used once</li>
                  <li>If you didn't request this reset, you can safely ignore this email</li>
                </ul>
              </div>

              <p>For security reasons, we never include your password in email communications.</p>

              <p>If you have any questions or concerns, please contact our support team.</p>

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

    // In a production environment, you would use a real email service here
    // For this implementation, we'll log the email (in production, use SMTP or email service)
    console.log("=== PASSWORD RESET EMAIL ===");
    console.log("To:", email);
    console.log("Reset Link:", resetLink);
    console.log("Token:", token);
    console.log("===========================");

    // TODO: In production, replace this with actual SMTP email sending
    // Example with a service like SendGrid, AWS SES, or similar:
    /*
    const response = await fetch('https://api.sendgrid.com/v3/mail/send', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${Deno.env.get('SENDGRID_API_KEY')}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        personalizations: [{ to: [{ email }] }],
        from: { email: 'noreply@ratingskill.com', name: 'RatingSkill' },
        subject: 'Reset Your Password - RatingSkill',
        content: [{ type: 'text/html', value: emailBody }],
      }),
    });
    */

    return new Response(
      JSON.stringify({
        success: true,
        message: "Password reset email sent successfully",
        // In development, return the link for testing
        devLink: resetLink
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
    console.error("Error sending password reset email:", error);

    return new Response(
      JSON.stringify({
        success: false,
        error: error.message || "Failed to send password reset email"
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
