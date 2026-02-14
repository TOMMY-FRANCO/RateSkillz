/*
  # Create Avatars Storage Bucket

  ## Overview
  Creates the 'avatars' storage bucket for storing user profile pictures.
  
  ## Changes
  1. Creates a public storage bucket named 'avatars'
  2. Sets file size limit to 5MB
  3. Allows image file types only (jpg, jpeg, png, gif, webp)
  
  ## Security
  - Bucket is public for read access
  - RLS policies (from previous migration) control upload/delete permissions
  - Users can only upload to their own user ID folder
  
  ## Migration Note
  This migration creates the bucket infrastructure. Existing base64 avatar_url
  values in profiles table will need to be migrated separately or can be 
  replaced as users update their profiles.
*/

-- Create the avatars bucket if it doesn't exist
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'avatars',
  'avatars',
  true,
  5242880, -- 5MB limit
  ARRAY['image/jpeg', 'image/jpg', 'image/png', 'image/gif', 'image/webp']
)
ON CONFLICT (id) DO NOTHING;