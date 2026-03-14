import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey",
};

const TEST_USERS = [
  {
    email: "tyler.brooks@testplayer.com",
    password: "TestPlayer2026!",
    full_name: "Tyler Brooks",
    username: "tyler_brooks11",
    position: "RW",
    team: "Manchester United",
    number: "11",
    height: "175cm",
    weight: "70kg",
    bio: "Fast winger with clinical finishing ability",
    overall_rating: 74,
    gender: "male",
    age: 22,
    achievements: "Top scorer under-21 league 2024",
    stats: "Goals: 18, Assists: 12, Appearances: 30",
  },
  {
    email: "sofia.reyes@testplayer.com",
    password: "TestPlayer2026!",
    full_name: "Sofia Reyes",
    username: "sofia_reyes9",
    position: "CAM",
    team: "Barcelona FC",
    number: "9",
    height: "165cm",
    weight: "60kg",
    bio: "Creative attacking midfielder with vision",
    overall_rating: 76,
    gender: "female",
    age: 21,
    achievements: "Player of the season 2023-24",
    stats: "Goals: 14, Assists: 20, Appearances: 28",
  },
  {
    email: "jordan.hayes@testplayer.com",
    password: "TestPlayer2026!",
    full_name: "Jordan Hayes",
    username: "jordan_hayes5",
    position: "CDM",
    team: "Atletico Madrid",
    number: "5",
    height: "183cm",
    weight: "80kg",
    bio: "Tenacious defensive midfielder, reads the game perfectly",
    overall_rating: 73,
    gender: "male",
    age: 24,
    achievements: "Best defensive player award 2024",
    stats: "Tackles: 85, Interceptions: 62, Appearances: 32",
  },
  {
    email: "amara.diallo@testplayer.com",
    password: "TestPlayer2026!",
    full_name: "Amara Diallo",
    username: "amara_diallo3",
    position: "LB",
    team: "PSG",
    number: "3",
    height: "179cm",
    weight: "75kg",
    bio: "Attacking full-back with pace and crossing",
    overall_rating: 71,
    gender: "male",
    age: 23,
    achievements: "Young player of the year 2023",
    stats: "Assists: 9, Clean sheets: 14, Appearances: 29",
  },
  {
    email: "nina.kowalski@testplayer.com",
    password: "TestPlayer2026!",
    full_name: "Nina Kowalski",
    username: "nina_kowalski6",
    position: "ST",
    team: "Juventus FC",
    number: "6",
    height: "172cm",
    weight: "67kg",
    bio: "Powerful striker with aerial presence",
    overall_rating: 77,
    gender: "female",
    age: 25,
    achievements: "Golden Boot winner 2023-24, hat-trick vs rivals",
    stats: "Goals: 24, Assists: 8, Appearances: 31",
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
      const { data: existing } = await supabase
        .from("profiles")
        .select("id")
        .eq("email", user.email)
        .maybeSingle();

      if (existing) {
        results.push({ email: user.email, status: "already_exists", userId: existing.id });
        continue;
      }

      const { data: authData, error: authError } = await supabase.auth.admin.createUser({
        email: user.email,
        password: user.password,
        email_confirm: true,
        user_metadata: { full_name: user.full_name },
      });

      if (authError) {
        results.push({ email: user.email, status: "auth_error", error: authError.message });
        continue;
      }

      const userId = authData.user.id;

      await new Promise((resolve) => setTimeout(resolve, 500));

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
          gender: user.gender,
          age: user.age,
          achievements: user.achievements,
          stats: user.stats,
        })
        .eq("id", userId);

      if (profileError) {
        results.push({ email: user.email, userId, status: "profile_error", error: profileError.message });
        continue;
      }

      const { data: existingCard } = await supabase
        .from("card_ownership")
        .select("id")
        .eq("card_user_id", userId)
        .maybeSingle();

      if (!existingCard) {
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
          results.push({ email: user.email, userId, status: "card_error", error: cardError.message });
          continue;
        }
      }

      results.push({ email: user.email, userId, username: user.username, status: "success" });
    }

    return new Response(JSON.stringify({ results }, null, 2), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err: any) {
    return new Response(JSON.stringify({ error: err.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
