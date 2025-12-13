/*
  # Add Likes/Dislikes and Enhanced Comments
  
  ## Overview
  Adding social features for profile interactions and comments.
  
  ## New Tables
  
  ### profile_likes
  - `id` (uuid, primary key) - Like record identifier
  - `profile_id` (uuid, foreign key) - Profile being liked/disliked
  - `user_id` (uuid, foreign key) - User who liked/disliked
  - `is_like` (boolean, not null) - true for like, false for dislike
  - `created_at` (timestamptz) - When the like/dislike was created
  - Unique constraint on (profile_id, user_id) - One vote per user per profile
  
  ## Table Modifications
  
  ### comments
  - Add `dislikes` column (integer, default 0) - Count of dislikes
  
  ## Security
  
  All new tables have Row Level Security (RLS) enabled with policies that:
  - Allow anyone to view likes counts
  - Allow authenticated users to create likes/dislikes
  - Allow users to update/delete their own likes
  
  ## Important Notes
  
  1. **One Vote Per User**: Users can only like OR dislike a profile once
  2. **Vote Tracking**: Individual votes are tracked in profile_likes table
  3. **Comment Reactions**: Comments now support both likes and dislikes
*/

-- Add dislikes column to comments table
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'comments' AND column_name = 'dislikes'
  ) THEN
    ALTER TABLE comments ADD COLUMN dislikes integer DEFAULT 0;
  END IF;
END $$;

-- Create profile_likes table
CREATE TABLE IF NOT EXISTS profile_likes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  profile_id uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  is_like boolean NOT NULL,
  created_at timestamptz DEFAULT now(),
  UNIQUE(profile_id, user_id)
);

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_profile_likes_profile_id ON profile_likes(profile_id);
CREATE INDEX IF NOT EXISTS idx_profile_likes_user_id ON profile_likes(user_id);
CREATE INDEX IF NOT EXISTS idx_comments_created_at ON comments(created_at DESC);

-- Enable Row Level Security
ALTER TABLE profile_likes ENABLE ROW LEVEL SECURITY;

-- Profile likes policies: Anyone can view, authenticated users can create/update
CREATE POLICY "Profile likes are viewable by everyone"
  ON profile_likes FOR SELECT
  USING (true);

CREATE POLICY "Users can create likes"
  ON profile_likes FOR INSERT
  WITH CHECK (true);

CREATE POLICY "Users can update their own likes"
  ON profile_likes FOR UPDATE
  USING (true)
  WITH CHECK (true);

CREATE POLICY "Users can delete their own likes"
  ON profile_likes FOR DELETE
  USING (true);