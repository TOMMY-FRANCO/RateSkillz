/*
  # Add Critical Performance Indexes for 10K+ Users Scale

  1. Purpose
    - Add indexes on foreign key columns that lack indexes (50+ missing)
    - Add indexes on timestamp columns used for range queries and sorting
    - Improve query performance for joins, filters, and date-based queries
    - Prevent performance degradation at 10,000+ users and millions of rows

  2. Missing Foreign Key Indexes (High Priority)
    - Foreign keys without indexes cause full table scans on joins
    - Critical for friend requests, messages, notifications, card transactions, battles

  3. Timestamp Indexes (High Priority)
    - created_at, updated_at columns frequently used in ORDER BY and WHERE clauses
    - Essential for pagination, recent activity queries, and time-based filters

  4. Performance Impact
    - Each index improves join performance from O(n) to O(log n)
    - Reduces query time from seconds to milliseconds at scale
    - Enables efficient pagination and sorting

  Note: Only creating indexes that don't already exist to avoid duplicates
*/

-- =============================================
-- MISSING FOREIGN KEY INDEXES (Critical)
-- =============================================

-- Ad system indexes
CREATE INDEX IF NOT EXISTS idx_ad_watches_ad_id ON ad_watches(ad_id);

-- Admin and moderation indexes
CREATE INDEX IF NOT EXISTS idx_admin_access_log_user_id ON admin_access_log(user_id);
CREATE INDEX IF NOT EXISTS idx_admin_action_logs_admin_id ON admin_action_logs(admin_id);
CREATE INDEX IF NOT EXISTS idx_admin_action_logs_target_user_id ON admin_action_logs(target_user_id);
CREATE INDEX IF NOT EXISTS idx_admin_action_logs_report_id ON admin_action_logs(report_id);

-- Balance and audit indexes
CREATE INDEX IF NOT EXISTS idx_balance_audit_log_transaction_id ON balance_audit_log(transaction_id);
CREATE INDEX IF NOT EXISTS idx_balance_recovery_log_user_id ON balance_recovery_log(user_id);

-- Battle system indexes
CREATE INDEX IF NOT EXISTS idx_battles_first_player_id ON battles(first_player_id);
CREATE INDEX IF NOT EXISTS idx_battles_winner_id ON battles(winner_id);
CREATE INDEX IF NOT EXISTS idx_battles_current_turn_user_id ON battles(current_turn_user_id);

-- Card system indexes
CREATE INDEX IF NOT EXISTS idx_card_discards_card_user_id ON card_discards(card_user_id);
CREATE INDEX IF NOT EXISTS idx_card_discards_original_owner_id ON card_discards(original_owner_id);
CREATE INDEX IF NOT EXISTS idx_card_ownership_original_owner_id ON card_ownership(original_owner_id);
CREATE INDEX IF NOT EXISTS idx_card_swap_listings_user_id ON card_swap_listings(user_id);
CREATE INDEX IF NOT EXISTS idx_card_swap_listings_card_user_id ON card_swap_listings(card_user_id);
CREATE INDEX IF NOT EXISTS idx_card_swap_transactions_swap_id ON card_swap_transactions(swap_id);
CREATE INDEX IF NOT EXISTS idx_card_swap_transactions_payer_id ON card_swap_transactions(payer_id);
CREATE INDEX IF NOT EXISTS idx_card_swap_transactions_payee_id ON card_swap_transactions(payee_id);
CREATE INDEX IF NOT EXISTS idx_card_swap_transactions_card_user_id ON card_swap_transactions(card_user_id);
CREATE INDEX IF NOT EXISTS idx_card_swaps_manager_a_id ON card_swaps(manager_a_id);
CREATE INDEX IF NOT EXISTS idx_card_swaps_manager_b_id ON card_swaps(manager_b_id);
CREATE INDEX IF NOT EXISTS idx_card_swaps_card_a_user_id ON card_swaps(card_a_user_id);
CREATE INDEX IF NOT EXISTS idx_card_swaps_card_b_user_id ON card_swaps(card_b_user_id);
CREATE INDEX IF NOT EXISTS idx_card_swaps_initiated_by ON card_swaps(initiated_by);
CREATE INDEX IF NOT EXISTS idx_card_transactions_card_user_id ON card_transactions(card_user_id);
CREATE INDEX IF NOT EXISTS idx_card_transactions_seller_id ON card_transactions(seller_id);
CREATE INDEX IF NOT EXISTS idx_card_transactions_buyer_id ON card_transactions(buyer_id);

-- Coin and transfer indexes
CREATE INDEX IF NOT EXISTS idx_coin_transfers_conversation_id ON coin_transfers(conversation_id);

-- Comment system indexes
CREATE INDEX IF NOT EXISTS idx_comment_coin_rewards_comment_id ON comment_coin_rewards(comment_id);
CREATE INDEX IF NOT EXISTS idx_comments_profile_id_new ON comments(profile_id);
CREATE INDEX IF NOT EXISTS idx_comments_commenter_id ON comments(commenter_id);

-- Messaging indexes
CREATE INDEX IF NOT EXISTS idx_messages_sender_id_new ON messages(sender_id);

-- Moderation indexes
CREATE INDEX IF NOT EXISTS idx_critical_review_flags_reviewed_by ON critical_review_flags(reviewed_by);
CREATE INDEX IF NOT EXISTS idx_enforcement_history_case_id ON enforcement_history(case_id);
CREATE INDEX IF NOT EXISTS idx_filtered_comments_log_profile_user_id ON filtered_comments_log(profile_user_id);
CREATE INDEX IF NOT EXISTS idx_moderation_cases_resolved_by ON moderation_cases(resolved_by);

-- Notification indexes
CREATE INDEX IF NOT EXISTS idx_notifications_actor_id_new ON notifications(actor_id);

-- Profile relationship indexes
CREATE INDEX IF NOT EXISTS idx_profiles_secondary_school_id ON profiles(secondary_school_id);
CREATE INDEX IF NOT EXISTS idx_profiles_university_id ON profiles(university_id);
CREATE INDEX IF NOT EXISTS idx_profiles_college_id ON profiles(college_id);

-- Purchase request indexes
CREATE INDEX IF NOT EXISTS idx_purchase_requests_seller_id ON purchase_requests(seller_id);
CREATE INDEX IF NOT EXISTS idx_purchase_requests_buyer_id ON purchase_requests(buyer_id);
CREATE INDEX IF NOT EXISTS idx_purchase_requests_card_user_id ON purchase_requests(card_user_id);

-- Report system indexes
CREATE INDEX IF NOT EXISTS idx_reports_reported_user_id_new ON reports(reported_user_id);
CREATE INDEX IF NOT EXISTS idx_reports_reporter_id ON reports(reporter_id);
CREATE INDEX IF NOT EXISTS idx_reports_resolved_by ON reports(resolved_by);

-- Reward indexes
CREATE INDEX IF NOT EXISTS idx_reward_logs_transaction_id ON reward_logs(transaction_id);

-- User notification indexes
CREATE INDEX IF NOT EXISTS idx_user_notifications_related_user_id ON user_notifications(related_user_id);
CREATE INDEX IF NOT EXISTS idx_username_history_user_id ON username_history(user_id);

-- =============================================
-- TIMESTAMP INDEXES (High Priority)
-- =============================================

-- Activity and sorting timestamps
CREATE INDEX IF NOT EXISTS idx_battles_created_at ON battles(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_card_transactions_created_at ON card_transactions(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_card_swaps_created_at ON card_swaps(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_comments_created_at ON comments(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_friends_created_at ON friends(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_messages_created_at_desc ON messages(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_notifications_created_at_desc ON notifications(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_purchase_requests_created_at ON purchase_requests(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_reports_created_at ON reports(created_at DESC);

-- User activity timestamps
CREATE INDEX IF NOT EXISTS idx_user_presence_last_seen ON user_presence(last_seen DESC);
CREATE INDEX IF NOT EXISTS idx_user_status_last_seen ON user_status(last_seen DESC);
CREATE INDEX IF NOT EXISTS idx_profile_summary_last_seen ON profile_summary(last_seen DESC);

-- Updated timestamps for cache invalidation
CREATE INDEX IF NOT EXISTS idx_profiles_updated_at ON profiles(updated_at DESC);
CREATE INDEX IF NOT EXISTS idx_card_ownership_updated_at ON card_ownership(updated_at DESC);
CREATE INDEX IF NOT EXISTS idx_leaderboard_cache_updated_at ON leaderboard_cache(updated_at DESC);

-- =============================================
-- COMPOSITE INDEXES for Common Query Patterns
-- =============================================

-- Friend requests by user and status
CREATE INDEX IF NOT EXISTS idx_friends_user_status ON friends(user_id, status) WHERE status = 'pending';
CREATE INDEX IF NOT EXISTS idx_friends_friend_status ON friends(friend_id, status) WHERE status = 'pending';

-- Messages by conversation and timestamp for pagination
CREATE INDEX IF NOT EXISTS idx_messages_conversation_created ON messages(conversation_id, created_at DESC);

-- Notifications by user, read status, and timestamp
CREATE INDEX IF NOT EXISTS idx_notifications_user_read_created ON notifications(user_id, is_read, created_at DESC);

-- Card ownership for market queries
CREATE INDEX IF NOT EXISTS idx_card_ownership_status_owner ON card_ownership(is_listed_for_sale, owner_id) WHERE is_listed_for_sale = true;

-- Battles by status and participants
CREATE INDEX IF NOT EXISTS idx_battles_status_players ON battles(status, manager1_id, manager2_id);

-- Profile views for analytics
CREATE INDEX IF NOT EXISTS idx_profile_views_profile_viewed ON profile_views(profile_id, viewed_at DESC);

-- =============================================
-- ANALYZE for Query Planner
-- =============================================

-- Update statistics for query planner optimization
ANALYZE friends;
ANALYZE messages;
ANALYZE notifications;
ANALYZE profiles;
ANALYZE coin_transactions;
ANALYZE card_ownership;
ANALYZE battles;
ANALYZE comments;
ANALYZE card_transactions;
