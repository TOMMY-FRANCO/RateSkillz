/*
  # Add Overall Rating System

  ## Overview
  This migration adds automatic overall rating calculation and caching to improve performance
  for leaderboards and profile displays.

  ## Changes

  1. New Column
    - `profiles.overall_rating` (integer, default 50)
      - Stores the cached overall rating (average of PAC, SHO, PAS, DRI, DEF, PHY averages)
      - Default 50 for new profiles with no ratings
      - Automatically updated when friends rate the player

  2. New Function: `calculate_overall_rating(player_id UUID)`
    - Calculates the average of all 6 stats for a given player
    - Each stat is the average of all friends' ratings for that stat
    - Returns 50 if no ratings exist (default)
    - Returns rounded integer (1-100)

  3. New Function: `update_overall_rating()`
    - Trigger function that runs after INSERT, UPDATE, or DELETE on ratings table
    - Automatically recalculates and updates the overall_rating for affected players

  4. New Trigger: `ratings_update_overall_rating`
    - Fires after any change to the ratings table
    - Ensures overall_rating is always up-to-date

  ## Benefits
  - Fast leaderboard queries (no need to calculate averages on-the-fly)
  - Consistent rating display across the app
  - Automatic updates - no manual recalculation needed
*/

-- Add overall_rating column to profiles table
ALTER TABLE profiles 
ADD COLUMN IF NOT EXISTS overall_rating INTEGER DEFAULT 50 CHECK (overall_rating >= 1 AND overall_rating <= 100);

-- Create function to calculate overall rating for a player
CREATE OR REPLACE FUNCTION calculate_overall_rating(player_uuid UUID)
RETURNS INTEGER AS $$
DECLARE
  avg_pac NUMERIC;
  avg_sho NUMERIC;
  avg_pas NUMERIC;
  avg_dri NUMERIC;
  avg_def NUMERIC;
  avg_phy NUMERIC;
  overall NUMERIC;
BEGIN
  -- Calculate average for each stat from all friends' ratings
  SELECT 
    COALESCE(AVG(pac), 50),
    COALESCE(AVG(sho), 50),
    COALESCE(AVG(pas), 50),
    COALESCE(AVG(dri), 50),
    COALESCE(AVG(def), 50),
    COALESCE(AVG(phy), 50)
  INTO avg_pac, avg_sho, avg_pas, avg_dri, avg_def, avg_phy
  FROM ratings
  WHERE player_id = player_uuid;

  -- Calculate overall rating as average of the 6 stat averages
  overall := (avg_pac + avg_sho + avg_pas + avg_dri + avg_def + avg_phy) / 6;

  -- Return rounded value
  RETURN ROUND(overall)::INTEGER;
END;
$$ LANGUAGE plpgsql;

-- Create trigger function to automatically update overall rating
CREATE OR REPLACE FUNCTION update_overall_rating()
RETURNS TRIGGER AS $$
BEGIN
  -- Update overall rating for the affected player
  IF TG_OP = 'DELETE' THEN
    UPDATE profiles
    SET overall_rating = calculate_overall_rating(OLD.player_id)
    WHERE id = OLD.player_id;
    RETURN OLD;
  ELSE
    UPDATE profiles
    SET overall_rating = calculate_overall_rating(NEW.player_id)
    WHERE id = NEW.player_id;
    RETURN NEW;
  END IF;
END;
$$ LANGUAGE plpgsql;

-- Create trigger on ratings table
DROP TRIGGER IF EXISTS ratings_update_overall_rating ON ratings;
CREATE TRIGGER ratings_update_overall_rating
  AFTER INSERT OR UPDATE OR DELETE ON ratings
  FOR EACH ROW
  EXECUTE FUNCTION update_overall_rating();

-- Initialize overall_rating for existing profiles
UPDATE profiles
SET overall_rating = calculate_overall_rating(id)
WHERE overall_rating = 50;

-- Add index for faster leaderboard queries
CREATE INDEX IF NOT EXISTS idx_profiles_overall_rating 
  ON profiles(overall_rating DESC);