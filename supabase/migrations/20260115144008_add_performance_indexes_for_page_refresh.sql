/*
  # Add Performance Indexes for Page Refresh Optimization
  
  ## Purpose
  Optimize database queries for faster page loads and refresh operations.
  Add indexes on frequently queried columns to improve app responsiveness.
  
  ## New Indexes
  
  1. **profiles table indexes**
     - idx_profiles_username: Fast username lookups for profile pages
     - idx_profiles_last_active: Quick online status checks
     - idx_profiles_overall_rating: Leaderboard queries optimization
     - idx_profiles_is_manager: Manager-specific queries
     - idx_profiles_coin_balance: Already exists from previous migration
  
  2. **friends table indexes**
     - idx_friends_user_status: Friend list queries with status filter
     - idx_friends_friend_status: Reverse friend lookups
     - idx_friends_status: Status-based queries
  
  3. **ratings table indexes**
     - idx_ratings_player: Ratings for specific players
     - idx_ratings_rater_player: Unique rating lookups
  
  4. **comments table indexes**
     - idx_comments_profile: Comments on profiles
     - idx_comments_created: Recent comments first
  
  5. **notifications table indexes**
     - idx_notifications_user_unread: Unread notifications
     - idx_notifications_user_created: Recent notifications
  
  6. **card_ownership table indexes**
     - idx_card_ownership_owner: Cards owned by user
     - idx_card_ownership_listed: Cards available for sale
  
  7. **messages table indexes**
     - idx_messages_conversation: Messages in conversation
     - idx_messages_recipient_unread: Unread message counts
  
  ## Performance Impact
  - Faster profile page loads (username lookups)
  - Quicker friend list rendering
  - Improved notification badge updates
  - Faster leaderboard queries
  - Better trading dashboard performance
*/

-- profiles table indexes
CREATE INDEX IF NOT EXISTS idx_profiles_username ON profiles(username) WHERE username IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_profiles_last_active ON profiles(last_active DESC) WHERE last_active IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_profiles_overall_rating ON profiles(overall_rating DESC NULLS LAST) WHERE overall_rating IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_profiles_is_manager ON profiles(is_manager) WHERE is_manager = true;

-- friends table indexes
CREATE INDEX IF NOT EXISTS idx_friends_user_status ON friends(user_id, status);
CREATE INDEX IF NOT EXISTS idx_friends_friend_status ON friends(friend_id, status);
CREATE INDEX IF NOT EXISTS idx_friends_status ON friends(status) WHERE status = 'pending';

-- ratings table indexes
CREATE INDEX IF NOT EXISTS idx_ratings_player ON ratings(player_id);
CREATE INDEX IF NOT EXISTS idx_ratings_rater_player ON ratings(rater_id, player_id);

-- comments table indexes
CREATE INDEX IF NOT EXISTS idx_comments_profile ON comments(profile_id);
CREATE INDEX IF NOT EXISTS idx_comments_created ON comments(created_at DESC);

-- notifications table indexes
CREATE INDEX IF NOT EXISTS idx_notifications_user_unread ON notifications(user_id, is_read, created_at DESC) WHERE is_read = false;
CREATE INDEX IF NOT EXISTS idx_notifications_user_created ON notifications(user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_notifications_type ON notifications(type, user_id);

-- card_ownership table indexes
CREATE INDEX IF NOT EXISTS idx_card_ownership_owner ON card_ownership(owner_id);
CREATE INDEX IF NOT EXISTS idx_card_ownership_listed ON card_ownership(is_listed_for_sale, current_price) WHERE is_listed_for_sale = true;
CREATE INDEX IF NOT EXISTS idx_card_ownership_card_user ON card_ownership(card_user_id);

-- messages table indexes
CREATE INDEX IF NOT EXISTS idx_messages_conversation ON messages(conversation_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_messages_recipient_unread ON messages(recipient_id, is_read, created_at DESC) WHERE is_read = false;

-- coin_transactions table indexes
CREATE INDEX IF NOT EXISTS idx_coin_transactions_user ON coin_transactions(user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_coin_transactions_type ON coin_transactions(transaction_type, user_id);

-- user_presence table indexes
CREATE INDEX IF NOT EXISTS idx_user_presence_last_seen ON user_presence(last_seen DESC);

-- conversations table indexes
CREATE INDEX IF NOT EXISTS idx_conversations_user_one ON conversations(user_one_id, last_message_at DESC);
CREATE INDEX IF NOT EXISTS idx_conversations_user_two ON conversations(user_two_id, last_message_at DESC);

-- profile_views table indexes
CREATE INDEX IF NOT EXISTS idx_profile_views_profile ON profile_views(profile_id, viewed_at DESC);
CREATE INDEX IF NOT EXISTS idx_profile_views_viewer ON profile_views(viewer_id, viewed_at DESC);
