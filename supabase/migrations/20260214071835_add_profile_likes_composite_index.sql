/*
  # Add Composite Index on profile_likes

  1. Performance Optimization
    - Adds composite index on profile_likes(profile_id, user_id)
    - Speeds up duplicate-check queries when users try to like a profile
    - Improves query performance for checking if a user has already liked a profile

  2. Important Notes
    - Uses IF NOT EXISTS to prevent errors if index already exists
    - Index covers both columns used in WHERE clauses for like checks
*/

CREATE INDEX IF NOT EXISTS idx_profile_likes_profile_user 
  ON profile_likes(profile_id, user_id);
