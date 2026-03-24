/*
  # Create wall_post_reports table

  ## Summary
  Creates a reporting system for wall posts, allowing users to flag inappropriate content for admin review.

  ## New Tables
  - `wall_post_reports`
    - `id` (uuid, primary key)
    - `post_id` (uuid, FK → wall_posts.id, cascade delete)
    - `reporter_id` (uuid, FK → profiles.id, cascade delete)
    - `reason` (text) — one of: Hate Speech, Bullying/Harassment, Spam, Inappropriate Content, Other
    - `status` (text, default 'pending') — pending | dismissed | reviewed
    - `resolved_by` (uuid, nullable, FK → profiles.id)
    - `resolved_at` (timestamptz, nullable)
    - `created_at` (timestamptz, default now())

  ## Security
  - RLS enabled with restrictive policies
  - Authenticated users can insert reports and read their own reports
  - Admin reads all; admin can update status/resolved fields
*/

CREATE TABLE IF NOT EXISTS wall_post_reports (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  post_id uuid NOT NULL REFERENCES wall_posts(id) ON DELETE CASCADE,
  reporter_id uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  reason text NOT NULL,
  status text NOT NULL DEFAULT 'pending',
  resolved_by uuid REFERENCES profiles(id) ON DELETE SET NULL,
  resolved_at timestamptz,
  created_at timestamptz DEFAULT now(),
  CONSTRAINT wall_post_reports_reason_check CHECK (reason IN ('Hate Speech', 'Bullying/Harassment', 'Spam', 'Inappropriate Content', 'Other')),
  CONSTRAINT wall_post_reports_status_check CHECK (status IN ('pending', 'dismissed', 'reviewed')),
  UNIQUE (post_id, reporter_id)
);

ALTER TABLE wall_post_reports ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can insert reports"
  ON wall_post_reports FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = reporter_id);

CREATE POLICY "Users can read their own reports"
  ON wall_post_reports FOR SELECT
  TO authenticated
  USING (auth.uid() = reporter_id);

CREATE POLICY "Admins can read all reports"
  ON wall_post_reports FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE id = auth.uid() AND is_admin = true
    )
  );

CREATE POLICY "Admins can update report status"
  ON wall_post_reports FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE id = auth.uid() AND is_admin = true
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE id = auth.uid() AND is_admin = true
    )
  );

CREATE INDEX IF NOT EXISTS idx_wall_post_reports_post_id ON wall_post_reports(post_id);
CREATE INDEX IF NOT EXISTS idx_wall_post_reports_status ON wall_post_reports(status);
CREATE INDEX IF NOT EXISTS idx_wall_post_reports_reporter_id ON wall_post_reports(reporter_id);
