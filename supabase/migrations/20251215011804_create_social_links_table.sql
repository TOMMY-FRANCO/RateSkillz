/*
  # Create social_links table

  1. New Tables
    - `social_links`
      - `id` (uuid, primary key) - Unique identifier for the social link record
      - `user_id` (uuid, foreign key) - References profiles.id
      - `instagram_url` (text, nullable) - Instagram profile URL or username
      - `youtube_url` (text, nullable) - YouTube channel URL
      - `facebook_url` (text, nullable) - Facebook profile URL
      - `twitter_url` (text, nullable) - Twitter/X profile URL or username
      - `tiktok_url` (text, nullable) - TikTok profile URL or username
      - `created_at` (timestamptz) - When the record was created
      - `updated_at` (timestamptz) - When the record was last updated
  
  2. Security
    - Enable RLS on `social_links` table
    - Add policy for users to read all social links (public viewing)
    - Add policy for users to insert their own social links
    - Add policy for users to update their own social links
    - Add policy for users to delete their own social links
  
  3. Constraints
    - One row per user (unique constraint on user_id)
    - Foreign key constraint to ensure user exists
*/

CREATE TABLE IF NOT EXISTS social_links (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  instagram_url text,
  youtube_url text,
  facebook_url text,
  twitter_url text,
  tiktok_url text,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  UNIQUE(user_id)
);

ALTER TABLE social_links ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can view social links"
  ON social_links FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Users can insert own social links"
  ON social_links FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own social links"
  ON social_links FOR UPDATE
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete own social links"
  ON social_links FOR DELETE
  TO authenticated
  USING (auth.uid() = user_id);

CREATE INDEX IF NOT EXISTS idx_social_links_user_id ON social_links(user_id);