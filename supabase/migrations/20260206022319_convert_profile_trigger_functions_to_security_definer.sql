/*
  # Convert profile trigger functions to SECURITY DEFINER

  1. Changes
    - Convert 7 SECURITY INVOKER trigger functions on `profiles` to SECURITY DEFINER
    - These are all AFTER trigger functions that write to downstream cache/system tables
    - They need elevated privileges to bypass RLS on cache tables like `profile_view_cache`

  2. Functions converted
    - `refresh_searchable_user_cache` - maintains searchable users cache
    - `trg_profiles_change` - syncs profile changes to dependent tables
    - `trg_profiles_for_battles` - maintains battle-related profile data
    - `trg_profiles_leaderboard_change` - updates leaderboard cache
    - `trg_profiles_update_card_cache` - syncs card cache on profile update
    - `trg_profiles_upsert_edit_cache` - maintains edit cache
    - `trg_profiles_upsert_summary` - maintains profile summary/view cache

  3. Functions NOT converted (intentionally left as SECURITY INVOKER)
    - `enforce_admin_access` - BEFORE trigger that validates admin flag; must run as caller to enforce restrictions
    - `set_default_findable_by_age` - BEFORE trigger that sets defaults on the incoming row

  4. Security notes
    - All 7 functions already have `search_path = public, pg_temp` set, preventing search_path injection
    - These are internal system triggers, not user-facing functions
    - They only maintain cache tables and system state
    - SECURITY DEFINER is safe here because the trigger functions are owned by postgres
      and cannot be modified by regular users
*/

ALTER FUNCTION refresh_searchable_user_cache() SECURITY DEFINER;
ALTER FUNCTION trg_profiles_change() SECURITY DEFINER;
ALTER FUNCTION trg_profiles_for_battles() SECURITY DEFINER;
ALTER FUNCTION trg_profiles_leaderboard_change() SECURITY DEFINER;
ALTER FUNCTION trg_profiles_update_card_cache() SECURITY DEFINER;
ALTER FUNCTION trg_profiles_upsert_edit_cache() SECURITY DEFINER;
ALTER FUNCTION trg_profiles_upsert_summary() SECURITY DEFINER;
