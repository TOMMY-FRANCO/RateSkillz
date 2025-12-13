/*
  # Add Profile Views Tracking

  ## Overview
  Adding ability to track profile views with visitor information and timestamps.

  ## New Tables

  ### profile_views
  - `id` (uuid, primary key) - View record identifier
  - `profile_id` (uuid, foreign key) - Profile being viewed
  - `viewer_id` (uuid, foreign key, nullable) - User who viewed (null for anonymous)
  - `viewed_at` (timestamptz) - When the profile was viewed
  - Index on profile_id for efficient counting

  ## Security

  Profile views table has Row Level Security (RLS) enabled with policies that:
  - Allow anyone to view all records (for counting views)
  - Allow authenticated users to create view records
  - Prevent modification or deletion of view records

  ## Important Notes

  1. **Anonymous Views**: Viewers can be anonymous (viewer_id is nullable)
  2. **Multiple Views**: Same user can view a profile multiple times (tracked separately)
  3. **Read-Only History**: Views cannot be deleted or modified once created
  4. **Performance**: Indexed for fast counting and querying
*/

-- Create profile_views table
CREATE TABLE IF NOT EXISTS profile_views (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  profile_id uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  viewer_id uuid REFERENCES profiles(id) ON DELETE SET NULL,
  viewed_at timestamptz DEFAULT now()
);

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_profile_views_profile_id ON profile_views(profile_id);
CREATE INDEX IF NOT EXISTS idx_profile_views_viewer_id ON profile_views(viewer_id);
CREATE INDEX IF NOT EXISTS idx_profile_views_viewed_at ON profile_views(viewed_at DESC);

-- Enable Row Level Security
ALTER TABLE profile_views ENABLE ROW LEVEL SECURITY;

-- Profile views policies: Anyone can view, authenticated users can create
CREATE POLICY "Profile views are viewable by everyone"
  ON profile_views FOR SELECT
  USING (true);

CREATE POLICY "Users can create profile views"
  ON profile_views FOR INSERT
  TO authenticated
  WITH CHECK (true);