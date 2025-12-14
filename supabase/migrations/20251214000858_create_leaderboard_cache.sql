/*
  # Create Leaderboard Cache System

  ## Overview
  This migration creates a leaderboard cache table for optimal performance when displaying
  the top 150 players. The cache automatically updates when ratings change.

  ## Changes

  1. New Table: `leaderboard`
    - `rank` (integer, primary key) - Player's position (1-150)
    - `profile_id` (uuid, foreign key) - Reference to profiles table
    - `overall_rating` (integer) - Cached overall rating
    - `previous_rank` (integer, nullable) - Previous rank for showing movement
    - `username` (text) - Cached username for faster queries
    - `full_name` (text) - Cached full name for faster queries
    - `avatar_url` (text, nullable) - Cached avatar for faster queries
    - `position` (text, nullable) - Player position (RW, ST, etc.)
    - `team` (text, nullable) - Player team
    - `updated_at` (timestamptz) - Last update timestamp

  2. New Function: `refresh_leaderboard()`
    - Recalculates the top 150 players by overall_rating
    - Updates rank positions and tracks rank changes
    - Caches frequently accessed profile data
    - Called automatically when ratings change

  3. New Trigger: `ratings_refresh_leaderboard`
    - Fires after any rating change
    - Ensures leaderboard stays up-to-date

  4. Security
    - Enable RLS on leaderboard table
    - Allow all authenticated users to view leaderboard
    - Only the system can update leaderboard data

  ## Benefits
  - Lightning-fast leaderboard queries (no joins or calculations)
  - Automatic updates when ratings change
  - Track rank movements over time
  - Reduced database load for leaderboard views
*/

-- Create leaderboard cache table
CREATE TABLE IF NOT EXISTS leaderboard (
  rank INTEGER PRIMARY KEY CHECK (rank >= 1 AND rank <= 150),
  profile_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  overall_rating INTEGER NOT NULL,
  previous_rank INTEGER,
  username TEXT NOT NULL,
  full_name TEXT NOT NULL,
  avatar_url TEXT,
  position TEXT,
  team TEXT,
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Create index for fast lookups
CREATE INDEX IF NOT EXISTS idx_leaderboard_profile_id ON leaderboard(profile_id);
CREATE INDEX IF NOT EXISTS idx_leaderboard_overall_rating ON leaderboard(overall_rating DESC);

-- Enable RLS
ALTER TABLE leaderboard ENABLE ROW LEVEL SECURITY;

-- Allow all authenticated users to view leaderboard
CREATE POLICY "Anyone can view leaderboard"
  ON leaderboard FOR SELECT
  TO authenticated
  USING (true);

-- Create function to refresh leaderboard cache
CREATE OR REPLACE FUNCTION refresh_leaderboard()
RETURNS void AS $$
DECLARE
  v_rank INTEGER := 1;
  v_profile RECORD;
BEGIN
  -- Create a temporary table with the new rankings
  CREATE TEMP TABLE IF NOT EXISTS temp_leaderboard AS
  SELECT
    ROW_NUMBER() OVER (ORDER BY p.overall_rating DESC, p.created_at ASC) AS new_rank,
    p.id AS profile_id,
    p.overall_rating,
    p.username,
    p.full_name,
    p.avatar_url,
    p.position,
    p.team,
    l.rank AS old_rank
  FROM profiles p
  LEFT JOIN leaderboard l ON l.profile_id = p.id
  WHERE p.overall_rating IS NOT NULL
  ORDER BY p.overall_rating DESC, p.created_at ASC
  LIMIT 150;

  -- Update existing entries and insert new ones
  DELETE FROM leaderboard;
  
  INSERT INTO leaderboard (
    rank,
    profile_id,
    overall_rating,
    previous_rank,
    username,
    full_name,
    avatar_url,
    position,
    team,
    updated_at
  )
  SELECT
    new_rank,
    profile_id,
    overall_rating,
    old_rank,
    username,
    full_name,
    avatar_url,
    position,
    team,
    now()
  FROM temp_leaderboard;

  -- Clean up
  DROP TABLE IF EXISTS temp_leaderboard;
END;
$$ LANGUAGE plpgsql;

-- Create trigger function to refresh leaderboard after rating changes
CREATE OR REPLACE FUNCTION trigger_refresh_leaderboard()
RETURNS TRIGGER AS $$
BEGIN
  PERFORM refresh_leaderboard();
  RETURN NULL;
END;
$$ LANGUAGE plpgsql;

-- Create trigger on ratings table
DROP TRIGGER IF EXISTS ratings_refresh_leaderboard ON ratings;
CREATE TRIGGER ratings_refresh_leaderboard
  AFTER INSERT OR UPDATE OR DELETE ON ratings
  FOR EACH STATEMENT
  EXECUTE FUNCTION trigger_refresh_leaderboard();

-- Initialize leaderboard with current data
SELECT refresh_leaderboard();