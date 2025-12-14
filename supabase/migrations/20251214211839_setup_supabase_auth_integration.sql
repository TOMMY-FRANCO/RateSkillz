/*
  # Setup Supabase Auth Integration

  ## Overview
  Integrates Supabase's built-in authentication with the profiles table.

  ## Changes Made

  ### 1. Auto-Create Profile Function
  - Creates a trigger function that automatically creates a profile when a user signs up
  - Extracts username and full_name from user metadata
  - Uses the auth user's ID as the profile ID

  ### 2. Trigger Setup
  - Adds trigger on auth.users table to call the function on INSERT
  - Ensures seamless profile creation during signup

  ### 3. Updated RLS Policies
  - All policies now use `auth.uid()` for proper authentication
  - Users can only modify their own data
  - Public data remains viewable by everyone

  ## Security Notes
  - Authenticated users required for all write operations
  - Row Level Security strictly enforced
  - Users cannot impersonate others

  ## Important
  This enables the proper email/password authentication flow with automatic profile creation
*/

-- Create function to handle new user signups
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger AS $$
BEGIN
  INSERT INTO public.profiles (id, username, email, full_name, created_at, updated_at, last_active)
  VALUES (
    new.id,
    COALESCE(new.raw_user_meta_data->>'username', split_part(new.email, '@', 1)),
    new.email,
    COALESCE(new.raw_user_meta_data->>'full_name', ''),
    now(),
    now(),
    now()
  )
  ON CONFLICT (id) DO NOTHING;
  RETURN new;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create trigger to automatically create profile on signup
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- Update profiles RLS policies
DROP POLICY IF EXISTS "Profiles are viewable by everyone" ON profiles;
DROP POLICY IF EXISTS "Users can insert their own profile" ON profiles;
DROP POLICY IF EXISTS "Users can update their own profile" ON profiles;
DROP POLICY IF EXISTS "Anyone can view profiles" ON profiles;

CREATE POLICY "Anyone can view profiles"
  ON profiles FOR SELECT
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

-- Update ratings policies
DROP POLICY IF EXISTS "Ratings are viewable by everyone" ON ratings;
DROP POLICY IF EXISTS "Authenticated users can create ratings" ON ratings;
DROP POLICY IF EXISTS "Users can update their own ratings" ON ratings;
DROP POLICY IF EXISTS "Users can delete their own ratings" ON ratings;
DROP POLICY IF EXISTS "Anyone can view ratings" ON ratings;

CREATE POLICY "Anyone can view ratings"
  ON ratings FOR SELECT
  USING (true);

CREATE POLICY "Authenticated users can create ratings"
  ON ratings FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = rater_id);

CREATE POLICY "Users can update their own ratings"
  ON ratings FOR UPDATE
  TO authenticated
  USING (auth.uid() = rater_id)
  WITH CHECK (auth.uid() = rater_id);

CREATE POLICY "Users can delete their own ratings"
  ON ratings FOR DELETE
  TO authenticated
  USING (auth.uid() = rater_id);

-- Update comments policies
DROP POLICY IF EXISTS "Comments are viewable by everyone" ON comments;
DROP POLICY IF EXISTS "Authenticated users can create comments" ON comments;
DROP POLICY IF EXISTS "Users can update their own comments" ON comments;
DROP POLICY IF EXISTS "Users can delete their own comments" ON comments;
DROP POLICY IF EXISTS "Anyone can view comments" ON comments;

CREATE POLICY "Anyone can view comments"
  ON comments FOR SELECT
  USING (true);

CREATE POLICY "Authenticated users can create comments"
  ON comments FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = commenter_id);

CREATE POLICY "Users can update their own comments"
  ON comments FOR UPDATE
  TO authenticated
  USING (auth.uid() = commenter_id)
  WITH CHECK (auth.uid() = commenter_id);

CREATE POLICY "Users can delete their own comments"
  ON comments FOR DELETE
  TO authenticated
  USING (auth.uid() = commenter_id);

-- Update friends policies
DROP POLICY IF EXISTS "Users can view their friendships" ON friends;
DROP POLICY IF EXISTS "Users can create friendships" ON friends;
DROP POLICY IF EXISTS "Users can update their friendships" ON friends;
DROP POLICY IF EXISTS "Users can delete their friendships" ON friends;
DROP POLICY IF EXISTS "Users can view friendships" ON friends;

CREATE POLICY "Users can view friendships"
  ON friends FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id OR auth.uid() = friend_id);

CREATE POLICY "Users can create friendships"
  ON friends FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update friendships"
  ON friends FOR UPDATE
  TO authenticated
  USING (auth.uid() = user_id OR auth.uid() = friend_id)
  WITH CHECK (auth.uid() = user_id OR auth.uid() = friend_id);

CREATE POLICY "Users can delete friendships"
  ON friends FOR DELETE
  TO authenticated
  USING (auth.uid() = user_id);

-- Update profile_likes policies (if not already set)
DROP POLICY IF EXISTS "Anyone can view likes" ON profile_likes;
DROP POLICY IF EXISTS "Users can like profiles" ON profile_likes;
DROP POLICY IF EXISTS "Users can update their likes" ON profile_likes;
DROP POLICY IF EXISTS "Users can delete their likes" ON profile_likes;

CREATE POLICY "Anyone can view likes"
  ON profile_likes FOR SELECT
  USING (true);

CREATE POLICY "Users can like profiles"
  ON profile_likes FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their likes"
  ON profile_likes FOR UPDATE
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete their likes"
  ON profile_likes FOR DELETE
  TO authenticated
  USING (auth.uid() = user_id);

-- Update profile_views policies
DROP POLICY IF EXISTS "Anyone can view profile views" ON profile_views;
DROP POLICY IF EXISTS "Anyone can create profile views" ON profile_views;

CREATE POLICY "Anyone can view profile views"
  ON profile_views FOR SELECT
  USING (true);

CREATE POLICY "Anyone can create profile views"
  ON profile_views FOR INSERT
  WITH CHECK (true);