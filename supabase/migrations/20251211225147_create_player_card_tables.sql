/*
  # Create Player Card Rating System Tables

  ## Overview
  This migration creates the core database structure for a FIFA-style player card rating application.

  ## New Tables
  
  ### 1. profiles
  - `id` (uuid, primary key) - Links to auth.users
  - `username` (text, unique) - User's unique username
  - `full_name` (text) - User's full name
  - `avatar_url` (text) - Profile picture URL
  - `location` (text) - User's location
  - `school` (text) - User's school
  - `college` (text) - User's college
  - `bio` (text) - User biography
  - `created_at` (timestamptz) - Account creation timestamp
  - `updated_at` (timestamptz) - Last update timestamp

  ### 2. friendships
  - `id` (uuid, primary key) - Unique friendship ID
  - `requester_id` (uuid) - User who sent the friend request
  - `receiver_id` (uuid) - User who received the friend request
  - `status` (text) - Status: 'pending', 'accepted', 'declined'
  - `created_at` (timestamptz) - Request creation timestamp
  - `updated_at` (timestamptz) - Status update timestamp

  ### 3. ratings
  - `id` (uuid, primary key) - Unique rating ID
  - `rated_user_id` (uuid) - User being rated
  - `rater_user_id` (uuid) - User giving the rating
  - `pac` (integer) - Pace rating (1-100)
  - `sho` (integer) - Shooting rating (1-100)
  - `pas` (integer) - Passing rating (1-100)
  - `dri` (integer) - Dribbling rating (1-100)
  - `def` (integer) - Defense rating (1-100)
  - `phy` (integer) - Physical rating (1-100)
  - `created_at` (timestamptz) - Rating creation timestamp
  - `updated_at` (timestamptz) - Rating update timestamp

  ### 4. comments
  - `id` (uuid, primary key) - Unique comment ID
  - `profile_user_id` (uuid) - Profile owner
  - `commenter_user_id` (uuid) - User who commented
  - `content` (text) - Comment content
  - `created_at` (timestamptz) - Comment creation timestamp

  ### 5. likes
  - `id` (uuid, primary key) - Unique like ID
  - `profile_user_id` (uuid) - Profile owner
  - `liker_user_id` (uuid) - User who liked/disliked
  - `is_like` (boolean) - true for like, false for dislike
  - `created_at` (timestamptz) - Like creation timestamp

  ## Security
  - Enable RLS on all tables
  - Users can read their own profile
  - Users can update their own profile
  - Users can view profiles of friends
  - Authenticated users can send friend requests
  - Users can manage their own friendships
  - Only friends can rate users
  - Users can view their own ratings (anonymized)
  - Users can comment on friends' profiles
  - Users can delete comments on their own profile
*/

-- Create profiles table
CREATE TABLE IF NOT EXISTS profiles (
  id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  username text UNIQUE NOT NULL,
  full_name text,
  avatar_url text,
  location text,
  school text,
  college text,
  bio text,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Create friendships table
CREATE TABLE IF NOT EXISTS friendships (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  requester_id uuid REFERENCES profiles(id) ON DELETE CASCADE NOT NULL,
  receiver_id uuid REFERENCES profiles(id) ON DELETE CASCADE NOT NULL,
  status text DEFAULT 'pending' CHECK (status IN ('pending', 'accepted', 'declined')),
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  UNIQUE(requester_id, receiver_id)
);

-- Create ratings table
CREATE TABLE IF NOT EXISTS ratings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  rated_user_id uuid REFERENCES profiles(id) ON DELETE CASCADE NOT NULL,
  rater_user_id uuid REFERENCES profiles(id) ON DELETE CASCADE NOT NULL,
  pac integer CHECK (pac >= 1 AND pac <= 100) NOT NULL,
  sho integer CHECK (sho >= 1 AND sho <= 100) NOT NULL,
  pas integer CHECK (pas >= 1 AND pas <= 100) NOT NULL,
  dri integer CHECK (dri >= 1 AND dri <= 100) NOT NULL,
  def integer CHECK (def >= 1 AND def <= 100) NOT NULL,
  phy integer CHECK (phy >= 1 AND phy <= 100) NOT NULL,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  UNIQUE(rated_user_id, rater_user_id)
);

-- Create comments table
CREATE TABLE IF NOT EXISTS comments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  profile_user_id uuid REFERENCES profiles(id) ON DELETE CASCADE NOT NULL,
  commenter_user_id uuid REFERENCES profiles(id) ON DELETE CASCADE NOT NULL,
  content text NOT NULL,
  created_at timestamptz DEFAULT now()
);

-- Create likes table
CREATE TABLE IF NOT EXISTS likes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  profile_user_id uuid REFERENCES profiles(id) ON DELETE CASCADE NOT NULL,
  liker_user_id uuid REFERENCES profiles(id) ON DELETE CASCADE NOT NULL,
  is_like boolean NOT NULL,
  created_at timestamptz DEFAULT now(),
  UNIQUE(profile_user_id, liker_user_id)
);

-- Enable Row Level Security
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE friendships ENABLE ROW LEVEL SECURITY;
ALTER TABLE ratings ENABLE ROW LEVEL SECURITY;
ALTER TABLE comments ENABLE ROW LEVEL SECURITY;
ALTER TABLE likes ENABLE ROW LEVEL SECURITY;

-- Profiles policies
CREATE POLICY "Users can view all profiles"
  ON profiles FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Users can insert their own profile"
  ON profiles FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = id);

CREATE POLICY "Users can update their own profile"
  ON profiles FOR UPDATE
  TO authenticated
  USING (auth.uid() = id)
  WITH CHECK (auth.uid() = id);

-- Friendships policies
CREATE POLICY "Users can view their own friendships"
  ON friendships FOR SELECT
  TO authenticated
  USING (auth.uid() = requester_id OR auth.uid() = receiver_id);

CREATE POLICY "Users can create friend requests"
  ON friendships FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = requester_id);

CREATE POLICY "Users can update friendships they're part of"
  ON friendships FOR UPDATE
  TO authenticated
  USING (auth.uid() = requester_id OR auth.uid() = receiver_id)
  WITH CHECK (auth.uid() = requester_id OR auth.uid() = receiver_id);

CREATE POLICY "Users can delete their own friend requests"
  ON friendships FOR DELETE
  TO authenticated
  USING (auth.uid() = requester_id OR auth.uid() = receiver_id);

-- Ratings policies
CREATE POLICY "Users can view ratings for their profile"
  ON ratings FOR SELECT
  TO authenticated
  USING (auth.uid() = rated_user_id);

CREATE POLICY "Friends can rate users"
  ON ratings FOR INSERT
  TO authenticated
  WITH CHECK (
    auth.uid() = rater_user_id AND
    EXISTS (
      SELECT 1 FROM friendships
      WHERE status = 'accepted'
      AND ((requester_id = auth.uid() AND receiver_id = rated_user_id)
           OR (receiver_id = auth.uid() AND requester_id = rated_user_id))
    )
  );

CREATE POLICY "Users can update their own ratings"
  ON ratings FOR UPDATE
  TO authenticated
  USING (auth.uid() = rater_user_id)
  WITH CHECK (auth.uid() = rater_user_id);

-- Comments policies
CREATE POLICY "Users can view comments on any profile"
  ON comments FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Friends can comment on profiles"
  ON comments FOR INSERT
  TO authenticated
  WITH CHECK (
    auth.uid() = commenter_user_id AND
    (auth.uid() = profile_user_id OR
     EXISTS (
       SELECT 1 FROM friendships
       WHERE status = 'accepted'
       AND ((requester_id = auth.uid() AND receiver_id = profile_user_id)
            OR (receiver_id = auth.uid() AND requester_id = profile_user_id))
     ))
  );

CREATE POLICY "Profile owners can delete comments on their profile"
  ON comments FOR DELETE
  TO authenticated
  USING (auth.uid() = profile_user_id);

-- Likes policies
CREATE POLICY "Users can view likes on any profile"
  ON likes FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Users can like/dislike profiles"
  ON likes FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = liker_user_id);

CREATE POLICY "Users can update their own likes"
  ON likes FOR UPDATE
  TO authenticated
  USING (auth.uid() = liker_user_id)
  WITH CHECK (auth.uid() = liker_user_id);

CREATE POLICY "Users can delete their own likes"
  ON likes FOR DELETE
  TO authenticated
  USING (auth.uid() = liker_user_id);

-- Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_profiles_username ON profiles(username);
CREATE INDEX IF NOT EXISTS idx_friendships_requester ON friendships(requester_id);
CREATE INDEX IF NOT EXISTS idx_friendships_receiver ON friendships(receiver_id);
CREATE INDEX IF NOT EXISTS idx_friendships_status ON friendships(status);
CREATE INDEX IF NOT EXISTS idx_ratings_rated_user ON ratings(rated_user_id);
CREATE INDEX IF NOT EXISTS idx_ratings_rater_user ON ratings(rater_user_id);
CREATE INDEX IF NOT EXISTS idx_comments_profile_user ON comments(profile_user_id);
CREATE INDEX IF NOT EXISTS idx_likes_profile_user ON likes(profile_user_id);

-- Create updated_at trigger function
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create triggers for updated_at
CREATE TRIGGER update_profiles_updated_at
  BEFORE UPDATE ON profiles
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_friendships_updated_at
  BEFORE UPDATE ON friendships
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_ratings_updated_at
  BEFORE UPDATE ON ratings
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();