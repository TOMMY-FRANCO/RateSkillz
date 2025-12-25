import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey",
};

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, {
      status: 200,
      headers: corsHeaders,
    });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    console.log("Starting inactive account deletion process...");

    // Step 1: Check for users needing deletion warnings (76 days inactive)
    const { data: warningUsers, error: warningError } = await supabase
      .rpc("check_deletion_warnings");

    if (warningError) {
      console.error("Error checking deletion warnings:", warningError);
    } else if (warningUsers && warningUsers.length > 0) {
      console.log(`Found ${warningUsers.length} users needing deletion warnings`);
      
      for (const user of warningUsers) {
        // Create notification for user
        const { error: notifError } = await supabase
          .from("user_notifications")
          .insert({
            user_id: user.user_id,
            notification_type: "setting_change",
            message: `Your account will be deleted in 14 days due to inactivity. Log in to prevent deletion.`,
            is_read: false,
          });

        if (notifError) {
          console.error(`Failed to create notification for user ${user.username}:`, notifError);
        }

        // Mark warning as sent
        const { error: markError } = await supabase
          .rpc("mark_deletion_warning_sent", { user_id: user.user_id });

        if (markError) {
          console.error(`Failed to mark warning sent for user ${user.username}:`, markError);
        } else {
          console.log(`Sent deletion warning to user ${user.username}`);
        }
      }
    }

    // Step 2: Process inactive account deletions (90+ days inactive)
    const { data: deletionResult, error: deletionError } = await supabase
      .rpc("process_inactive_account_deletions");

    if (deletionError) {
      console.error("Error processing deletions:", deletionError);
      return new Response(
        JSON.stringify({
          success: false,
          error: deletionError.message,
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

    const result = deletionResult?.[0] || { deleted_count: 0, coins_returned: 0 };

    console.log(`Deletion process completed:`);
    console.log(`- Accounts deleted: ${result.deleted_count}`);
    console.log(`- Coins returned to pool: ${result.coins_returned}`);

    return new Response(
      JSON.stringify({
        success: true,
        warnings_sent: warningUsers?.length || 0,
        accounts_deleted: result.deleted_count,
        coins_returned: result.coins_returned,
        timestamp: new Date().toISOString(),
      }),
      {
        headers: {
          ...corsHeaders,
          "Content-Type": "application/json",
        },
      }
    );
  } catch (error) {
    console.error("Unexpected error:", error);
    return new Response(
      JSON.stringify({
        success: false,
        error: error instanceof Error ? error.message : "Unknown error",
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
