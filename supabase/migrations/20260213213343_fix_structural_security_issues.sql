/*
  # Structural Security Fixes

  1. New Indexes (Foreign Keys)
    - `battles.current_turn_user_id` - covering index for FK
    - `battles.winner_id` - covering index for FK
    - `card_discards.card_user_id` - covering index for FK
    - `card_swap_listings.card_user_id` - covering index for FK
    - `card_swap_transactions.card_user_id` - covering index for FK
    - `card_swaps.initiated_by` - covering index for FK
    - `filtered_comments_log.user_id` - covering index for FK
    - `moderation_cases.reporter_id` - covering index for FK
    - `profiles.college_id` - covering index for FK
    - `profiles.secondary_school_id` - covering index for FK
    - `profiles.university_id` - covering index for FK

  2. Function Search Path Fixes
    - `get_reward_logs_count(uuid, text, text)` - set immutable search_path
    - `bot_poll_state_updated_at_trigger()` - set immutable search_path
    - `get_bot_last_check(text)` - set immutable search_path
    - `update_bot_last_check(text, timestamptz)` - set immutable search_path
    - `audit_battle_royalties()` - set immutable search_path (both overloads)

  3. View Security Fix
    - `user_daily_coin_limits` - changed from SECURITY DEFINER to SECURITY INVOKER

  4. RLS Enablement
    - `bot_poll_state` - enabled RLS (accessed only by service_role)

  5. Policy Fixes
    - `signup_rate_limit` - replaced unrestricted USING(true) policy with service_role only
*/

-- 1. Add missing foreign key indexes
CREATE INDEX IF NOT EXISTS idx_battles_current_turn_user_id ON public.battles(current_turn_user_id);
CREATE INDEX IF NOT EXISTS idx_battles_winner_id ON public.battles(winner_id);
CREATE INDEX IF NOT EXISTS idx_card_discards_card_user_id ON public.card_discards(card_user_id);
CREATE INDEX IF NOT EXISTS idx_card_swap_listings_card_user_id ON public.card_swap_listings(card_user_id);
CREATE INDEX IF NOT EXISTS idx_card_swap_transactions_card_user_id ON public.card_swap_transactions(card_user_id);
CREATE INDEX IF NOT EXISTS idx_card_swaps_initiated_by ON public.card_swaps(initiated_by);
CREATE INDEX IF NOT EXISTS idx_filtered_comments_log_user_id ON public.filtered_comments_log(user_id);
CREATE INDEX IF NOT EXISTS idx_moderation_cases_reporter_id ON public.moderation_cases(reporter_id);
CREATE INDEX IF NOT EXISTS idx_profiles_college_id ON public.profiles(college_id);
CREATE INDEX IF NOT EXISTS idx_profiles_secondary_school_id ON public.profiles(secondary_school_id);
CREATE INDEX IF NOT EXISTS idx_profiles_university_id ON public.profiles(university_id);

-- 2. Fix function search paths
ALTER FUNCTION public.get_reward_logs_count(uuid, text, text) SET search_path = public, pg_temp;
ALTER FUNCTION public.bot_poll_state_updated_at_trigger() SET search_path = public, pg_temp;
ALTER FUNCTION public.get_bot_last_check(text) SET search_path = public, pg_temp;
ALTER FUNCTION public.update_bot_last_check(text, timestamptz) SET search_path = public, pg_temp;
ALTER FUNCTION public.audit_battle_royalties() SET search_path = public, pg_temp;
ALTER FUNCTION public.audit_battle_royalties(uuid) SET search_path = public, pg_temp;

-- 3. Fix security definer view
ALTER VIEW public.user_daily_coin_limits SET (security_invoker = on);

-- 4. Enable RLS on bot_poll_state
ALTER TABLE IF EXISTS public.bot_poll_state ENABLE ROW LEVEL SECURITY;

-- 5. Fix signup_rate_limit policy - remove unrestricted access
DROP POLICY IF EXISTS "System can manage rate limits" ON public.signup_rate_limit;
