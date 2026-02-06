/*
  # Fix upsert_profile_summary RECORD field bug

  1. Problem
    - Function declares `card_stats` as RECORD, populated by a SELECT with fields `cnt` and `total_value`
    - Second query tries to assign `card_stats.total_card_royalties` which doesn't exist in the record
    - PL/pgSQL records are structurally fixed after first assignment; you cannot add new fields
    - Error: `record "card_stats" has no field "total_card_royalties"`

  2. Fix
    - Add separate `v_total_royalties` variable for the royalties sum
    - Replace all references to `card_stats.total_card_royalties` with `v_total_royalties`
    - Remove STRICT modifier (unnecessary for aggregate queries)

  3. Impact
    - Fixes profile INSERT trigger chain that was broken for all roles
    - Allows `trg_profiles_upsert_summary` to complete successfully
*/

CREATE OR REPLACE FUNCTION public.upsert_profile_summary(p_user_id uuid)
RETURNS void
LANGUAGE plpgsql
SET search_path TO 'public', 'pg_temp'
AS $function$
DECLARE
  card_stats RECORD;
  v_total_royalties numeric;
  lb_rank integer;
  usr_status RECORD;
BEGIN
  SELECT COUNT(*) as cnt, COALESCE(SUM(COALESCE(current_price, base_price)),0) as total_value
  INTO card_stats
  FROM public.card_ownership
  WHERE owner_id = p_user_id;

  SELECT COALESCE(SUM(amount),0) INTO v_total_royalties
  FROM public.battle_royalties br
  WHERE br.owner_id = p_user_id;

  SELECT rank INTO lb_rank FROM public.leaderboard_cache WHERE user_id = p_user_id LIMIT 1;

  SELECT is_online, last_seen INTO usr_status FROM public.user_status WHERE user_id = p_user_id LIMIT 1;

  INSERT INTO public.profile_summary (
    user_id, username, full_name, avatar_url, bio, position, team, age,
    overall_rating, pac_rating, sho_rating, pas_rating, dri_rating, def_rating, phy_rating, rating_count,
    leaderboard_rank, manager_wins, manager_losses, win_loss_ratio,
    total_cards_owned, total_card_value, total_card_royalties, friend_count,
    is_verified, is_manager, is_admin, is_banned, is_online, last_seen, created_at, updated_at
  )
  SELECT
    p.id,
    p.username,
    p.full_name,
    p.avatar_url,
    p.bio,
    p.position,
    p.team,
    p.age,
    us.overall,
    us.pac,
    us.sho,
    us.pas,
    us.dri,
    us.def,
    us.phy,
    us.rating_count,
    lb_rank,
    p.manager_wins,
    p.manager_losses,
    CASE WHEN p.manager_losses IS NULL OR p.manager_losses = 0 THEN p.manager_wins::numeric
         ELSE ROUND((p.manager_wins::numeric / NULLIF(p.manager_losses,0))::numeric,3)
    END as win_loss_ratio,
    card_stats.cnt,
    card_stats.total_value,
    COALESCE(v_total_royalties, 0),
    p.friend_count,
    p.is_verified,
    p.is_manager,
    p.is_admin,
    p.is_banned,
    COALESCE(usr_status.is_online, false),
    usr_status.last_seen,
    p.created_at,
    now()
  FROM public.profiles p
  LEFT JOIN public.user_stats us ON us.user_id = p.id
  WHERE p.id = p_user_id
  ON CONFLICT (user_id) DO UPDATE SET
    username = EXCLUDED.username,
    full_name = EXCLUDED.full_name,
    avatar_url = EXCLUDED.avatar_url,
    bio = EXCLUDED.bio,
    position = EXCLUDED.position,
    team = EXCLUDED.team,
    age = EXCLUDED.age,
    overall_rating = EXCLUDED.overall_rating,
    pac_rating = EXCLUDED.pac_rating,
    sho_rating = EXCLUDED.sho_rating,
    pas_rating = EXCLUDED.pas_rating,
    dri_rating = EXCLUDED.dri_rating,
    def_rating = EXCLUDED.def_rating,
    phy_rating = EXCLUDED.phy_rating,
    rating_count = EXCLUDED.rating_count,
    leaderboard_rank = EXCLUDED.leaderboard_rank,
    manager_wins = EXCLUDED.manager_wins,
    manager_losses = EXCLUDED.manager_losses,
    win_loss_ratio = EXCLUDED.win_loss_ratio,
    total_cards_owned = EXCLUDED.total_cards_owned,
    total_card_value = EXCLUDED.total_card_value,
    total_card_royalties = EXCLUDED.total_card_royalties,
    friend_count = EXCLUDED.friend_count,
    is_verified = EXCLUDED.is_verified,
    is_manager = EXCLUDED.is_manager,
    is_admin = EXCLUDED.is_admin,
    is_banned = EXCLUDED.is_banned,
    is_online = EXCLUDED.is_online,
    last_seen = EXCLUDED.last_seen,
    created_at = EXCLUDED.created_at,
    updated_at = EXCLUDED.updated_at;
END;
$function$;
