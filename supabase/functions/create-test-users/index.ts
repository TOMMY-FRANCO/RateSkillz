import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
  "Access-Control-Allow-Headers":
    "Content-Type, Authorization, X-Client-Info, Apikey",
};

const TEST_USERS = [
  {
    email: "marcus.silva@testplayer.com",
    password: "TestPlayer2026!",
    full_name: "Marcus Silva",
    username: "marcus_silva10",
    position: "ST",
    team: "Arsenal FC",
    number: "10",
    height: "182cm",
    weight: "78kg",
    bio: "Striker with pace and finishing",
    overall_rating: 72,
  },
  {
    email: "jade.oconnor@testplayer.com",
    password: "TestPlayer2026!",
    full_name: "Jade O'Connor",
    username: "jade_oconnor7",
    position: "LW",
    team: "Chelsea FC",
    number: "7",
    height: "170cm",
    weight: "65kg",
    bio: "Tricky winger with flair",
    overall_rating: 68,
  },
  {
    email: "kai.tanaka@testplayer.com",
    password: "TestPlayer2026!",
    full_name: "Kai Tanaka",
    username: "kai_tanaka8",
    position: "CM",
    team: "Liverpool FC",
    number: "8",
    height: "176cm",
    weight: "72kg",
    bio: "Box-to-box midfielder",
    overall_rating: 75,
  },
  {
    email: "zara.ahmed@testplayer.com",
    password: "TestPlayer2026!",
    full_name: "Zara Ahmed",
    username: "zara_ahmed4",
    position: "CB",
    team: "Man City FC",
    number: "4",
    height: "178cm",
    weight: "74kg",
    bio: "Rock solid defender",
    overall_rating: 70,
  },
  {
    email: "leo.martinez@testplayer.com",
    password: "TestPlayer2026!",
    full_name: "Leo Martinez",
    username: "leo_martinez1",
    position: "GK",
    team: "Tottenham FC",
    number: "1",
    height: "190cm",
    weight: "85kg",
    bio: "Shot stopper with great reflexes",
    overall_rating: 71,
  },
];

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 200, headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

    const supabase = createClient(supabaseUrl, serviceRoleKey, {
      auth: { autoRefreshToken: false, persistSession: false },
    });

    const results: any[] = [];

    for (const user of TEST_USERS) {
      const { data: authData, error: authError } =
        await supabase.auth.admin.createUser({
          email: user.email,
          password: user.password,
          email_confirm: true,
          user_metadata: { full_name: user.full_name },
        });

      if (authError) {
        results.push({
          email: user.email,
          status: "auth_error",
          error: authError.message,
        });
        continue;
      }

      const userId = authData.user.id;

      const { error: profileError } = await supabase
        .from("profiles")
        .update({
          username: user.username,
          full_name: user.full_name,
          position: user.position,
          team: user.team,
          number: user.number,
          height: user.height,
          weight: user.weight,
          bio: user.bio,
          overall_rating: user.overall_rating,
          coin_balance: 100,
          username_customized: true,
          tutorial_completed: true,
          agreed_to_terms: true,
          terms_accepted_at: new Date().toISOString(),
        })
        .eq("id", userId);

      if (profileError) {
        results.push({
          email: user.email,
          userId,
          status: "profile_error",
          error: profileError.message,
        });
        continue;
      }

      const { error: cardError } = await supabase
        .from("card_ownership")
        .insert({
          card_user_id: userId,
          owner_id: userId,
          original_owner_id: userId,
          current_price: 20,
          base_price: 20,
          is_listed_for_sale: true,
          times_traded: 0,
          last_purchase_price: 20,
        });

      if (cardError) {
        results.push({
          email: user.email,
          userId,
          status: "card_error",
          error: cardError.message,
        });
        continue;
      }

      results.push({
        email: user.email,
        userId,
        username: user.username,
        status: "success",
      });
    }

    return new Response(JSON.stringify({ results }, null, 2), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err: any) {
    return new Response(
      JSON.stringify({ error: err.message }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }
});
