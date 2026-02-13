/*
  # Drop Unused Indexes

  Removes 84 indexes that have not been used according to PostgreSQL statistics.
  These unused indexes consume disk space and slow down write operations
  without providing query performance benefits.

  1. Dropped Indexes by Table
    - `ad_watches` - idx_ad_watches_ad_id
    - `admin_access_log` - idx_admin_access_log_user_id
    - `admin_action_logs` - 3 indexes (admin_id, target_user_id, report_id)
    - `admin_action_logs_archive` - 2 indexes (admin_id, target_user_id)
    - `balance_audit_log` - idx_balance_audit_log_transaction_id
    - `balance_recovery_log` - idx_balance_recovery_log_user_id
    - `battles` - 2 indexes (first_player_id, status_players)
    - `battle_royalties` - 2 indexes (battle_id, owner_id)
    - `card_discards` - idx_card_discards_original_owner_id
    - `card_ownership` - 3 indexes (original_owner_id, updated_at, status_owner)
    - `card_swap_listings` - idx_card_swap_listings_user_id
    - `card_swap_transactions` - 3 indexes (swap_id, payer_id, payee_id)
    - `card_swaps` - 5 indexes (manager_a/b_id, card_a/b_user_id, created_at)
    - `card_transactions` - 4 indexes (card_user_id, seller_id, buyer_id, created_at)
    - `coin_transfers` - idx_coin_transfers_conversation_id
    - `comment_coin_rewards` - 2 indexes (comment_id, profile_user_id)
    - `comment_earnings` - idx_comment_earnings_profile_id
    - `comment_votes` - idx_comment_votes_user_id
    - `comments` - 2 indexes (profile_id_new, commenter_id)
    - `critical_review_flags` - 2 indexes (reviewed_by, user)
    - `enforcement_history` - 3 indexes (case_id, user, active)
    - `enforcement_history_archive` - 3 indexes (user_id_created_at, is_active, case_id)
    - `filtered_comments_log` - idx_filtered_comments_log_profile_user_id
    - `friend_requests` - idx_friend_requests_receiver_id
    - `friends` - 3 indexes (created_at, user_status, friend_status)
    - `leaderboard_cache` - idx_leaderboard_cache_updated_at
    - `messages` - 2 indexes (sender_id_new, conversation_created)
    - `moderation_cases` - 2 indexes (resolved_by, status)
    - `moderation_cases_archive` - 2 indexes (status_created_at, target_user_id)
    - `notification_sound_played` - 2 indexes (user_id, notification_id)
    - `notifications` - 2 indexes (actor_id_new, user_read_created)
    - `oauth_accounts` - idx_oauth_accounts_user_id
    - `page_view_coin_rewards` - idx_page_view_coin_rewards_viewer_id
    - `password_resets` - 3 indexes (token, email, user)
    - `profile_likes` - idx_profile_likes_user_id
    - `profile_views` - idx_profile_views_viewer_id
    - `profiles` - idx_profiles_updated_at
    - `profanity_filter` - idx_profanity_filter_active
    - `purchase_requests` - 3 indexes (seller_id, buyer_id, card_user_id)
    - `ratings` - idx_ratings_player_id
    - `reports` - 3 indexes (reported_user_id_new, reporter_id, resolved_by)
    - `reports_archive` - reports_archive_reported_user_id_idx
    - `reward_logs` - idx_reward_logs_transaction_id
    - `sound_toggle_events` - idx_sound_toggle_events_user_id
    - `typing_status` - idx_typing_status_conversation_id
    - `user_notifications` - idx_user_notifications_related_user_id
    - `username_history` - idx_username_history_user_id

  2. Important Notes
    - All drops use IF EXISTS for safety
    - These indexes were identified as unused via pg_stat_user_indexes
    - If any become needed in the future, they can be recreated
*/

DROP INDEX IF EXISTS public.idx_ad_watches_ad_id;
DROP INDEX IF EXISTS public.idx_admin_access_log_user_id;
DROP INDEX IF EXISTS public.idx_admin_action_logs_admin_id;
DROP INDEX IF EXISTS public.idx_admin_action_logs_target_user_id;
DROP INDEX IF EXISTS public.idx_admin_action_logs_report_id;
DROP INDEX IF EXISTS public.idx_balance_audit_log_transaction_id;
DROP INDEX IF EXISTS public.idx_balance_recovery_log_user_id;
DROP INDEX IF EXISTS public.idx_battles_first_player_id;
DROP INDEX IF EXISTS public.idx_battle_royalties_battle_id;
DROP INDEX IF EXISTS public.idx_battle_royalties_owner_id;
DROP INDEX IF EXISTS public.idx_card_discards_original_owner_id;
DROP INDEX IF EXISTS public.idx_card_ownership_original_owner_id;
DROP INDEX IF EXISTS public.idx_card_swap_listings_user_id;
DROP INDEX IF EXISTS public.idx_card_swap_transactions_swap_id;
DROP INDEX IF EXISTS public.idx_card_swap_transactions_payer_id;
DROP INDEX IF EXISTS public.idx_card_swap_transactions_payee_id;
DROP INDEX IF EXISTS public.idx_card_swaps_manager_a_id;
DROP INDEX IF EXISTS public.idx_card_swaps_manager_b_id;
DROP INDEX IF EXISTS public.idx_card_swaps_card_a_user_id;
DROP INDEX IF EXISTS public.idx_card_swaps_card_b_user_id;
DROP INDEX IF EXISTS public.idx_card_transactions_card_user_id;
DROP INDEX IF EXISTS public.idx_card_transactions_seller_id;
DROP INDEX IF EXISTS public.idx_card_transactions_buyer_id;
DROP INDEX IF EXISTS public.idx_coin_transfers_conversation_id;
DROP INDEX IF EXISTS public.idx_comment_coin_rewards_comment_id;
DROP INDEX IF EXISTS public.idx_comments_profile_id_new;
DROP INDEX IF EXISTS public.idx_comments_commenter_id;
DROP INDEX IF EXISTS public.idx_messages_sender_id_new;
DROP INDEX IF EXISTS public.idx_critical_review_flags_reviewed_by;
DROP INDEX IF EXISTS public.idx_enforcement_history_case_id;
DROP INDEX IF EXISTS public.idx_filtered_comments_log_profile_user_id;
DROP INDEX IF EXISTS public.idx_moderation_cases_resolved_by;
DROP INDEX IF EXISTS public.idx_notifications_actor_id_new;
DROP INDEX IF EXISTS public.idx_purchase_requests_seller_id;
DROP INDEX IF EXISTS public.idx_purchase_requests_buyer_id;
DROP INDEX IF EXISTS public.idx_purchase_requests_card_user_id;
DROP INDEX IF EXISTS public.idx_reports_reported_user_id_new;
DROP INDEX IF EXISTS public.idx_reports_reporter_id;
DROP INDEX IF EXISTS public.idx_reports_resolved_by;
DROP INDEX IF EXISTS public.idx_reward_logs_transaction_id;
DROP INDEX IF EXISTS public.idx_user_notifications_related_user_id;
DROP INDEX IF EXISTS public.idx_username_history_user_id;
DROP INDEX IF EXISTS public.idx_card_transactions_created_at;
DROP INDEX IF EXISTS public.idx_card_swaps_created_at;
DROP INDEX IF EXISTS public.idx_friends_created_at;
DROP INDEX IF EXISTS public.idx_reports_created_at;
DROP INDEX IF EXISTS public.idx_profiles_updated_at;
DROP INDEX IF EXISTS public.idx_card_ownership_updated_at;
DROP INDEX IF EXISTS public.idx_leaderboard_cache_updated_at;
DROP INDEX IF EXISTS public.idx_friends_user_status;
DROP INDEX IF EXISTS public.idx_friends_friend_status;
DROP INDEX IF EXISTS public.idx_messages_conversation_created;
DROP INDEX IF EXISTS public.idx_notifications_user_read_created;
DROP INDEX IF EXISTS public.idx_card_ownership_status_owner;
DROP INDEX IF EXISTS public.idx_battles_status_players;
DROP INDEX IF EXISTS public.idx_sound_toggle_events_user_id;
DROP INDEX IF EXISTS public.reports_archive_reported_user_id_idx;
DROP INDEX IF EXISTS public.moderation_cases_archive_status_created_at_idx;
DROP INDEX IF EXISTS public.moderation_cases_archive_target_user_id_idx;
DROP INDEX IF EXISTS public.enforcement_history_archive_user_id_created_at_idx;
DROP INDEX IF EXISTS public.enforcement_history_archive_is_active_idx;
DROP INDEX IF EXISTS public.enforcement_history_archive_case_id_idx;
DROP INDEX IF EXISTS public.idx_moderation_cases_status;
DROP INDEX IF EXISTS public.idx_enforcement_history_user;
DROP INDEX IF EXISTS public.admin_action_logs_archive_admin_id_idx;
DROP INDEX IF EXISTS public.admin_action_logs_archive_target_user_id_idx;
DROP INDEX IF EXISTS public.idx_enforcement_history_active;
DROP INDEX IF EXISTS public.idx_critical_review_flags_user;
DROP INDEX IF EXISTS public.idx_profanity_filter_active;
DROP INDEX IF EXISTS public.idx_notification_sound_played_user_id;
DROP INDEX IF EXISTS public.idx_notification_sound_played_notification_id;
DROP INDEX IF EXISTS public.idx_comment_coin_rewards_profile_user_id;
DROP INDEX IF EXISTS public.idx_comment_earnings_profile_id;
DROP INDEX IF EXISTS public.idx_password_resets_token;
DROP INDEX IF EXISTS public.idx_password_resets_email;
DROP INDEX IF EXISTS public.idx_password_resets_user;
DROP INDEX IF EXISTS public.idx_comment_votes_user_id;
DROP INDEX IF EXISTS public.idx_friend_requests_receiver_id;
DROP INDEX IF EXISTS public.idx_oauth_accounts_user_id;
DROP INDEX IF EXISTS public.idx_page_view_coin_rewards_viewer_id;
DROP INDEX IF EXISTS public.idx_profile_likes_user_id;
DROP INDEX IF EXISTS public.idx_profile_views_viewer_id;
DROP INDEX IF EXISTS public.idx_ratings_player_id;
DROP INDEX IF EXISTS public.idx_typing_status_conversation_id;
