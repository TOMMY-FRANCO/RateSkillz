/*
  # Enforce 500KB size limit on avatars storage bucket

  ## Summary
  Updates the avatars storage bucket configuration to enforce a maximum file
  size of 500KB (512000 bytes), matching the edge function validation limit.
  This prevents users from bypassing the validate-avatar-upload edge function
  by uploading directly to storage.

  ## Changes
  - avatars bucket: file_size_limit set to 512000 (500KB)
  - Allowed MIME types restricted to image/jpeg and image/png only
*/

UPDATE storage.buckets
SET
  file_size_limit = 512000,
  allowed_mime_types = ARRAY['image/jpeg', 'image/png']
WHERE id = 'avatars';
