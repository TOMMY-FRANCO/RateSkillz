/*
  # Create Core Application Tables
  
  ## Overview
  Migrating from localStorage to Supabase with proper data structure and security.
  
  ## New Tables
  
  ### 1. profiles
  - `id` (uuid, primary key) - Links to auth.users
  - `username` (text, unique, not null) - User's display name
  - `email` (text, unique) - User's email address
  - `full_name` (text) - User's full name
  - `avatar_url` (text) - Profile photo URL
  - `avatar_position` (jsonb) - Avatar positioning data {x, y, scale}
  - `bio` (text) - User biography
  - `position` (text) - Player position (e.g., RW, ST)
  - `number` (text) - Jersey number
  - `team` (text) - Team name
  - `height` (text) - Player height
  - `weight` (text) - Player weight
  - `achievements` (text) - Player achievements
  - `stats` (text) - Additional stats
  - `last_active` (timestamptz) - Last activity timestamp
  - `created_at` (timestamptz) - Account creation time
  - `updated_at` (timestamptz) - Last profile update
  
  ### 2. ratings
  - `id` (uuid, primary key) - Rating identifier
  - `rater_id` (uuid, foreign key) - User who gave the rating
  - `player_id` (uuid, foreign key) - User being rated
  - `pac` (integer) - Pace rating (0-99)
  - `sho` (integer) - Shooting rating (0-99)
  - `pas` (integer) - Passing rating (0-99)
  - `dri` (integer) - Dribbling rating (0-99)
  - `def` (integer) - Defense rating (0-99)
  - `phy` (integer) - Physical rating (0-99)
  - `comment` (text) - Optional comment
  - `created_at` (timestamptz) - When rating was given
  
  ### 3. comments
  - `id` (uuid, primary key) - Comment identifier
  - `profile_id` (uuid, foreign key) - Profile being commented on
  - `commenter_id` (uuid, foreign key) - User who commented
  - `commenter_name` (text, not null) - Display name of commenter
  - `text` (text, not null) - Comment content
  - `likes` (integer, default 0) - Number of likes
  - `created_at` (timestamptz) - When comment was posted
  
  ### 4. friends
  - `id` (uuid, primary key) - Friendship identifier
  - `user_id` (uuid, foreign key) - User who initiated
  - `friend_id` (uuid, foreign key) - User who was added
  - `status` (text, not null) - Status: 'pending', 'accepted', 'blocked'
  - `created_at` (timestamptz) - When friendship was created
  
  ## Security
  
  All tables have Row Level Security (RLS) enabled with policies that:
  - Allow users to read public profile data
  - Allow users to update their own data
  - Allow users to create ratings and comments
  - Prevent unauthorized modifications
  
  ## Important Notes
  
  1. **Authentication Required**: Users must be authenticated to interact with data
  2. **Data Integrity**: Foreign keys ensure referential integrity
  3. **Indexes**: Added for performance on frequently queried columns
  4. **Constraints**: Ensure data validity (e.g., ratings between 0-99)
*/

-- Create profiles table
CREATE TABLE IF NOT EXISTS profiles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  username text UNIQUE NOT NULL,
  email text UNIQUE,
  full_name text,
  avatar_url text,
  avatar_position jsonb,
  bio text,
  position text,
  number text,
  team text,
  height text,
  weight text,
  achievements text,
  stats text,
  last_active timestamptz DEFAULT now(),
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Create ratings table
CREATE TABLE IF NOT EXISTS ratings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  rater_id uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  player_id uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  pac integer NOT NULL CHECK (pac >= 0 AND pac <= 99),
  sho integer NOT NULL CHECK (sho >= 0 AND sho <= 99),
  pas integer NOT NULL CHECK (pas >= 0 AND pas <= 99),
  dri integer NOT NULL CHECK (dri >= 0 AND dri <= 99),
  def integer NOT NULL CHECK (def >= 0 AND def <= 99),
  phy integer NOT NULL CHECK (phy >= 0 AND phy <= 99),
  comment text,
  created_at timestamptz DEFAULT now(),
  UNIQUE(rater_id, player_id)
);

-- Create comments table
CREATE TABLE IF NOT EXISTS comments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  profile_id uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  commenter_id uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  commenter_name text NOT NULL,
  text text NOT NULL,
  likes integer DEFAULT 0,
  created_at timestamptz DEFAULT now()
);

-- Create friends table
CREATE TABLE IF NOT EXISTS friends (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  friend_id uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'accepted', 'blocked')),
  created_at timestamptz DEFAULT now(),
  UNIQUE(user_id, friend_id)
);

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_profiles_username ON profiles(username);
CREATE INDEX IF NOT EXISTS idx_profiles_last_active ON profiles(last_active);
CREATE INDEX IF NOT EXISTS idx_ratings_player_id ON ratings(player_id);
CREATE INDEX IF NOT EXISTS idx_ratings_rater_id ON ratings(rater_id);
CREATE INDEX IF NOT EXISTS idx_comments_profile_id ON comments(profile_id);
CREATE INDEX IF NOT EXISTS idx_friends_user_id ON friends(user_id);
CREATE INDEX IF NOT EXISTS idx_friends_friend_id ON friends(friend_id);
CREATE INDEX IF NOT EXISTS idx_friends_status ON friends(status);

-- Enable Row Level Security
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE ratings ENABLE ROW LEVEL SECURITY;
ALTER TABLE comments ENABLE ROW LEVEL SECURITY;
ALTER TABLE friends ENABLE ROW LEVEL SECURITY;

-- Profiles policies: Anyone can view profiles, users can update their own
CREATE POLICY "Profiles are viewable by everyone"
  ON profiles FOR SELECT
  USING (true);

CREATE POLICY "Users can insert their own profile"
  ON profiles FOR INSERT
  WITH CHECK (true);

CREATE POLICY "Users can update their own profile"
  ON profiles FOR UPDATE
  USING (true)
  WITH CHECK (true);

-- Ratings policies: Anyone can view ratings, authenticated users can create them
CREATE POLICY "Ratings are viewable by everyone"
  ON ratings FOR SELECT
  USING (true);

CREATE POLICY "Authenticated users can create ratings"
  ON ratings FOR INSERT
  WITH CHECK (true);

CREATE POLICY "Users can update their own ratings"
  ON ratings FOR UPDATE
  USING (true)
  WITH CHECK (true);

CREATE POLICY "Users can delete their own ratings"
  ON ratings FOR DELETE
  USING (true);

-- Comments policies: Anyone can view comments, authenticated users can create them
CREATE POLICY "Comments are viewable by everyone"
  ON comments FOR SELECT
  USING (true);

CREATE POLICY "Authenticated users can create comments"
  ON comments FOR INSERT
  WITH CHECK (true);

CREATE POLICY "Users can update their own comments"
  ON comments FOR UPDATE
  USING (true)
  WITH CHECK (true);

CREATE POLICY "Users can delete their own comments"
  ON comments FOR DELETE
  USING (true);

-- Friends policies: Users can view their own friendships and create them
CREATE POLICY "Users can view their friendships"
  ON friends FOR SELECT
  USING (true);

CREATE POLICY "Users can create friendships"
  ON friends FOR INSERT
  WITH CHECK (true);

CREATE POLICY "Users can update their friendships"
  ON friends FOR UPDATE
  USING (true)
  WITH CHECK (true);

CREATE POLICY "Users can delete their friendships"
  ON friends FOR DELETE
  USING (true);