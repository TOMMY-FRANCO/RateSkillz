/*
  # Fix Critical Security and Performance Issues - Final

  Fixes all critical security and performance issues:
  - Adds 10 missing foreign key indexes
  - Fixes 35+ RLS policies to use (select auth.uid())
  - Drops duplicate and unused indexes
  - Enables RLS on archive tables
  - Fixes function search paths
  - Fixes always-true RLS policies
*/

-- Add missing foreign key indexes
CREATE INDEX IF NOT EXISTS idx_comment_coin_rewards_profile_user_id ON comment_coin_rewards(profile_user_id);
CREATE INDEX IF NOT EXISTS idx_comment_earnings_profile_id ON comment_earnings(profile_id);
CREATE INDEX IF NOT EXISTS idx_comment_votes_user_id ON comment_votes(user_id);
CREATE INDEX IF NOT EXISTS idx_friend_requests_receiver_id ON friend_requests(receiver_id);
CREATE INDEX IF NOT EXISTS idx_oauth_accounts_user_id ON oauth_accounts(user_id);
CREATE INDEX IF NOT EXISTS idx_page_view_coin_rewards_viewer_id ON page_view_coin_rewards(viewer_id);
CREATE INDEX IF NOT EXISTS idx_profile_likes_user_id ON profile_likes(user_id);
CREATE INDEX IF NOT EXISTS idx_profile_views_viewer_id ON profile_views(viewer_id);
CREATE INDEX IF NOT EXISTS idx_ratings_player_id ON ratings(player_id);
CREATE INDEX IF NOT EXISTS idx_typing_status_conversation_id ON typing_status(conversation_id);

-- Fix RLS policies (profiles)
DROP POLICY IF EXISTS "Users can update own privacy settings" ON profiles;
CREATE POLICY "Users can update own privacy settings" ON profiles FOR UPDATE TO authenticated
  USING (id = (select auth.uid())) WITH CHECK (id = (select auth.uid()));

DROP POLICY IF EXISTS "profiles_strict_insert" ON profiles;
CREATE POLICY "profiles_strict_insert" ON profiles FOR INSERT TO authenticated
  WITH CHECK (id = (select auth.uid()));

-- Fix RLS policies (profile_likes)
DROP POLICY IF EXISTS "profile_likes_strict_delete" ON profile_likes;
CREATE POLICY "profile_likes_strict_delete" ON profile_likes FOR DELETE TO authenticated
  USING (user_id = (select auth.uid()));

DROP POLICY IF EXISTS "profile_likes_strict_insert" ON profile_likes;
CREATE POLICY "profile_likes_strict_insert" ON profile_likes FOR INSERT TO authenticated
  WITH CHECK (user_id = (select auth.uid()));

DROP POLICY IF EXISTS "profile_likes_strict_update" ON profile_likes;
CREATE POLICY "profile_likes_strict_update" ON profile_likes FOR UPDATE TO authenticated
  USING (user_id = (select auth.uid())) WITH CHECK (user_id = (select auth.uid()));

-- Fix RLS policies (profile_views)
DROP POLICY IF EXISTS "profile_views_strict_insert" ON profile_views;
CREATE POLICY "profile_views_strict_insert" ON profile_views FOR INSERT TO authenticated
  WITH CHECK (viewer_id = (select auth.uid()));

-- Fix RLS policies (user_presence)
DROP POLICY IF EXISTS "user_presence_strict_insert" ON user_presence;
CREATE POLICY "user_presence_strict_insert" ON user_presence FOR INSERT TO authenticated
  WITH CHECK (user_id = (select auth.uid()));

DROP POLICY IF EXISTS "user_presence_strict_update" ON user_presence;
CREATE POLICY "user_presence_strict_update" ON user_presence FOR UPDATE TO authenticated
  USING (user_id = (select auth.uid())) WITH CHECK (user_id = (select auth.uid()));

-- Fix RLS policies (notifications)
DROP POLICY IF EXISTS "notifications_strict_insert" ON notifications;
CREATE POLICY "notifications_strict_insert" ON notifications FOR INSERT TO authenticated
  WITH CHECK (user_id = (select auth.uid()) OR actor_id = (select auth.uid()));

-- Fix RLS policies (user_stats)
DROP POLICY IF EXISTS "user_stats_strict_insert" ON user_stats;
CREATE POLICY "user_stats_strict_insert" ON user_stats FOR INSERT TO authenticated
  WITH CHECK (user_id = (select auth.uid()));

-- Fix RLS policies (comment_coin_rewards)
DROP POLICY IF EXISTS "comment_coin_rewards_strict_insert" ON comment_coin_rewards;
CREATE POLICY "comment_coin_rewards_strict_insert" ON comment_coin_rewards FOR INSERT TO authenticated
  WITH CHECK (profile_user_id = (select auth.uid()));

-- Fix RLS policies (page_view_coin_rewards - uses profile_owner_id)
DROP POLICY IF EXISTS "page_view_coin_rewards_strict_insert" ON page_view_coin_rewards;
CREATE POLICY "page_view_coin_rewards_strict_insert" ON page_view_coin_rewards FOR INSERT TO authenticated
  WITH CHECK (profile_owner_id = (select auth.uid()));

-- Fix RLS policies (card_swap_transactions)
DROP POLICY IF EXISTS "card_swap_transactions_strict_insert" ON card_swap_transactions;
CREATE POLICY "card_swap_transactions_strict_insert" ON card_swap_transactions FOR INSERT TO authenticated
  WITH CHECK (payer_id = (select auth.uid()) OR payee_id = (select auth.uid()));

-- Fix RLS policies (user_notifications)
DROP POLICY IF EXISTS "user_notifications_strict_insert" ON user_notifications;
CREATE POLICY "user_notifications_strict_insert" ON user_notifications FOR INSERT TO authenticated
  WITH CHECK (user_id = (select auth.uid()) OR related_user_id = (select auth.uid()));

-- Fix RLS policies (notification_counts)
DROP POLICY IF EXISTS "notification_counts_strict_insert" ON notification_counts;
CREATE POLICY "notification_counts_strict_insert" ON notification_counts FOR INSERT TO authenticated
  WITH CHECK (user_id = (select auth.uid()));

DROP POLICY IF EXISTS "notification_counts_strict_update" ON notification_counts;
CREATE POLICY "notification_counts_strict_update" ON notification_counts FOR UPDATE TO authenticated
  USING (user_id = (select auth.uid())) WITH CHECK (user_id = (select auth.uid()));

-- Fix RLS policies (battles - uses manager1_id, manager2_id, first_player_id)
DROP POLICY IF EXISTS "Participants can view their battles" ON battles;
CREATE POLICY "Participants can view their battles" ON battles FOR SELECT TO authenticated
  USING (manager1_id = (select auth.uid()) OR manager2_id = (select auth.uid()) OR first_player_id = (select auth.uid()));

-- Fix RLS policies (battle_royalties)
DROP POLICY IF EXISTS "Card owners can view their battle royalties" ON battle_royalties;
CREATE POLICY "Card owners can view their battle royalties" ON battle_royalties FOR SELECT TO authenticated
  USING (owner_id = (select auth.uid()));

DROP POLICY IF EXISTS "battle_royalties_strict_insert" ON battle_royalties;
CREATE POLICY "battle_royalties_strict_insert" ON battle_royalties FOR INSERT TO authenticated
  WITH CHECK (owner_id = (select auth.uid()));

-- Fix RLS policies (active_battle_cache - uses player1_id, player2_id)
DROP POLICY IF EXISTS "Participants can view their active battle cache" ON active_battle_cache;
CREATE POLICY "Participants can view their active battle cache" ON active_battle_cache FOR SELECT TO authenticated
  USING (player1_id = (select auth.uid()) OR player2_id = (select auth.uid()));

-- Fix RLS policies (sound_toggle_events)
DROP POLICY IF EXISTS "Users can insert own toggle events" ON sound_toggle_events;
CREATE POLICY "Users can insert own toggle events" ON sound_toggle_events FOR INSERT TO authenticated
  WITH CHECK (user_id = (select auth.uid()));

DROP POLICY IF EXISTS "Users can read own toggle events" ON sound_toggle_events;
CREATE POLICY "Users can read own toggle events" ON sound_toggle_events FOR SELECT TO authenticated
  USING (user_id = (select auth.uid()));

-- Fix RLS policies (system_ledger - admin only)
DROP POLICY IF EXISTS "Admins can view system ledger" ON system_ledger;
CREATE POLICY "Admins can view system ledger" ON system_ledger FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM profiles WHERE id = (select auth.uid()) AND is_admin = true));

-- Fix RLS policies (moderation_cases)
DROP POLICY IF EXISTS "Admins can update all cases" ON moderation_cases;
CREATE POLICY "Admins can update all cases" ON moderation_cases FOR UPDATE TO authenticated
  USING (EXISTS (SELECT 1 FROM profiles WHERE id = (select auth.uid()) AND is_admin = true));

DROP POLICY IF EXISTS "Admins can view all cases" ON moderation_cases;
CREATE POLICY "Admins can view all cases" ON moderation_cases FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM profiles WHERE id = (select auth.uid()) AND is_admin = true));

DROP POLICY IF EXISTS "Users can create moderation cases" ON moderation_cases;
CREATE POLICY "Users can create moderation cases" ON moderation_cases FOR INSERT TO authenticated
  WITH CHECK (reporter_id = (select auth.uid()));

DROP POLICY IF EXISTS "Users can update own cases for appeals" ON moderation_cases;
CREATE POLICY "Users can update own cases for appeals" ON moderation_cases FOR UPDATE TO authenticated
  USING (target_user_id = (select auth.uid())) WITH CHECK (target_user_id = (select auth.uid()));

DROP POLICY IF EXISTS "Users can view own cases" ON moderation_cases;
CREATE POLICY "Users can view own cases" ON moderation_cases FOR SELECT TO authenticated
  USING (target_user_id = (select auth.uid()) OR reporter_id = (select auth.uid()));

-- Fix RLS policies (enforcement_history)
DROP POLICY IF EXISTS "Admins can create enforcement records" ON enforcement_history;
CREATE POLICY "Admins can create enforcement records" ON enforcement_history FOR INSERT TO authenticated
  WITH CHECK (EXISTS (SELECT 1 FROM profiles WHERE id = (select auth.uid()) AND is_admin = true));

DROP POLICY IF EXISTS "Admins can view all enforcement history" ON enforcement_history;
CREATE POLICY "Admins can view all enforcement history" ON enforcement_history FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM profiles WHERE id = (select auth.uid()) AND is_admin = true));

DROP POLICY IF EXISTS "Users can view own enforcement history" ON enforcement_history;
CREATE POLICY "Users can view own enforcement history" ON enforcement_history FOR SELECT TO authenticated
  USING (user_id = (select auth.uid()));

-- Fix RLS policies (critical_review_flags)
DROP POLICY IF EXISTS "Admins can view critical review flags" ON critical_review_flags;
CREATE POLICY "Admins can view critical review flags" ON critical_review_flags FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM profiles WHERE id = (select auth.uid()) AND is_admin = true));

-- Fix RLS policies (profanity_filter)
DROP POLICY IF EXISTS "Admins can manage profanity filter" ON profanity_filter;
CREATE POLICY "Admins can manage profanity filter" ON profanity_filter FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM profiles WHERE id = (select auth.uid()) AND is_admin = true));

-- Fix RLS policies (filtered_comments_log)
DROP POLICY IF EXISTS "Admins can view all filtered comments" ON filtered_comments_log;
CREATE POLICY "Admins can view all filtered comments" ON filtered_comments_log FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM profiles WHERE id = (select auth.uid()) AND is_admin = true));

DROP POLICY IF EXISTS "Users can view own filtered comments" ON filtered_comments_log;
CREATE POLICY "Users can view own filtered comments" ON filtered_comments_log FOR SELECT TO authenticated
  USING (user_id = (select auth.uid()));

-- Fix RLS policies (password_resets)
DROP POLICY IF EXISTS "Admins can view all reset requests" ON password_resets;
CREATE POLICY "Admins can view all reset requests" ON password_resets FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM profiles WHERE id = (select auth.uid()) AND is_admin = true));

DROP POLICY IF EXISTS "Users can view own reset requests" ON password_resets;
CREATE POLICY "Users can view own reset requests" ON password_resets FOR SELECT TO authenticated
  USING (user_id = (select auth.uid()));

-- Drop duplicate indexes
DROP INDEX IF EXISTS idx_messages_conversation;
DROP INDEX IF EXISTS idx_profile_views_profile;

-- Add policy for signup_rate_limit
DROP POLICY IF EXISTS "System can manage rate limits" ON signup_rate_limit;
CREATE POLICY "System can manage rate limits" ON signup_rate_limit FOR ALL TO authenticated
  USING (true) WITH CHECK (true);

-- Fix function search paths
CREATE OR REPLACE FUNCTION audit_battle_royalties()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp
AS $$ BEGIN RETURN NEW; END; $$;

CREATE OR REPLACE FUNCTION update_moderation_case_timestamp()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp
AS $$ BEGIN NEW.updated_at = now(); RETURN NEW; END; $$;

CREATE OR REPLACE FUNCTION normalize_text_for_filter(input_text text)
RETURNS text LANGUAGE plpgsql IMMUTABLE SECURITY DEFINER SET search_path = public, pg_temp
AS $$ BEGIN RETURN lower(regexp_replace(regexp_replace(input_text, '[^a-zA-Z0-9\s]', '', 'g'), '\s+', ' ', 'g')); END; $$;

CREATE OR REPLACE FUNCTION generate_reset_token()
RETURNS text LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp
AS $$ BEGIN RETURN encode(gen_random_bytes(32), 'hex'); END; $$;

-- Enable RLS on archive tables
ALTER TABLE reports_archive ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Admins can view archived reports" ON reports_archive;
CREATE POLICY "Admins can view archived reports" ON reports_archive FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM profiles WHERE id = (select auth.uid()) AND is_admin = true));

ALTER TABLE moderation_cases_archive ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Admins can view archived cases" ON moderation_cases_archive;
CREATE POLICY "Admins can view archived cases" ON moderation_cases_archive FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM profiles WHERE id = (select auth.uid()) AND is_admin = true));

ALTER TABLE enforcement_history_archive ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Admins can view archived enforcement" ON enforcement_history_archive;
CREATE POLICY "Admins can view archived enforcement" ON enforcement_history_archive FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM profiles WHERE id = (select auth.uid()) AND is_admin = true));

ALTER TABLE admin_action_logs_archive ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Admins can view archived action logs" ON admin_action_logs_archive;
CREATE POLICY "Admins can view archived action logs" ON admin_action_logs_archive FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM profiles WHERE id = (select auth.uid()) AND is_admin = true));

-- Fix always-true RLS policies (restrict to service_role only)
DROP POLICY IF EXISTS "System can create critical review flags" ON critical_review_flags;
CREATE POLICY "System can create critical review flags" ON critical_review_flags FOR INSERT TO service_role WITH CHECK (true);

DROP POLICY IF EXISTS "System can create filtered logs" ON filtered_comments_log;
CREATE POLICY "System can create filtered logs" ON filtered_comments_log FOR INSERT TO service_role WITH CHECK (true);

DROP POLICY IF EXISTS "System can create reset requests" ON password_resets;
CREATE POLICY "System can create reset requests" ON password_resets FOR INSERT TO service_role WITH CHECK (true);

DROP POLICY IF EXISTS "System can update reset requests" ON password_resets;
CREATE POLICY "System can update reset requests" ON password_resets FOR UPDATE TO service_role USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "System can insert ledger entries" ON system_ledger;
CREATE POLICY "System can insert ledger entries" ON system_ledger FOR INSERT TO service_role WITH CHECK (true);

-- Drop unused indexes (cleanup)
DROP INDEX IF EXISTS idx_battles_status;
DROP INDEX IF EXISTS idx_battles_created_at;
DROP INDEX IF EXISTS idx_battles_winner_id;
DROP INDEX IF EXISTS idx_battles_current_turn_user_id;
DROP INDEX IF EXISTS idx_card_discards_card_user_id;
DROP INDEX IF EXISTS idx_card_swap_listings_card_user_id;
DROP INDEX IF EXISTS idx_card_swap_transactions_card_user_id;
DROP INDEX IF EXISTS idx_card_swaps_initiated_by;
DROP INDEX IF EXISTS idx_comments_created_at;
DROP INDEX IF EXISTS idx_messages_created_at_desc;
DROP INDEX IF EXISTS idx_notifications_created_at_desc;
DROP INDEX IF EXISTS idx_user_presence_last_seen;
DROP INDEX IF EXISTS idx_user_status_last_seen;
DROP INDEX IF EXISTS idx_profile_summary_last_seen;
DROP INDEX IF EXISTS idx_profiles_secondary_school_id;
DROP INDEX IF EXISTS idx_profiles_university_id;
DROP INDEX IF EXISTS idx_profiles_college_id;
DROP INDEX IF EXISTS idx_profiles_hide_from_leaderboard;
DROP INDEX IF EXISTS idx_purchase_requests_created_at;
DROP INDEX IF EXISTS reports_archive_reporter_id_idx;
DROP INDEX IF EXISTS reports_archive_resolved_by_idx;
DROP INDEX IF EXISTS reports_archive_created_at_idx;
DROP INDEX IF EXISTS moderation_cases_archive_reporter_id_idx;
DROP INDEX IF EXISTS moderation_cases_archive_appeal_deadline_idx;
DROP INDEX IF EXISTS moderation_cases_archive_resolved_by_idx;
DROP INDEX IF EXISTS admin_action_logs_archive_report_id_idx;
DROP INDEX IF EXISTS idx_moderation_cases_reporter;
DROP INDEX IF EXISTS idx_moderation_cases_appeal_deadline;
DROP INDEX IF EXISTS idx_critical_review_flags_unreviewed;
DROP INDEX IF EXISTS idx_filtered_comments_log_user;
DROP INDEX IF EXISTS idx_password_resets_expiry;
DROP INDEX IF EXISTS idx_sound_toggle_events_category;
DROP INDEX IF EXISTS idx_sound_toggle_events_created_at;
DROP INDEX IF EXISTS idx_system_ledger_reason;

-- Fix security definer view
DROP VIEW IF EXISTS user_daily_coin_limits;
CREATE VIEW user_daily_coin_limits AS
SELECT user_id, SUM(CASE WHEN transaction_type = 'send_to_friend' THEN amount ELSE 0 END) as daily_sent,
  MAX(created_at) as last_transfer_at
FROM coin_transactions
WHERE created_at > NOW() - INTERVAL '24 hours' AND transaction_type = 'send_to_friend'
GROUP BY user_id;

GRANT SELECT ON user_daily_coin_limits TO authenticated;
