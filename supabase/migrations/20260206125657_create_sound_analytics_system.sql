/*
  # Sound Analytics System

  1. New Tables
    - `sound_toggle_events`
      - `id` (uuid, primary key)
      - `user_id` (uuid, references auth.users)
      - `category` (text) - master, transactions, battles, notifications
      - `enabled` (boolean) - new toggle state
      - `created_at` (timestamptz)

  2. Security
    - Enable RLS on `sound_toggle_events`
    - Users can insert their own events
    - Users can read their own events
    - No update/delete allowed

  3. Functions
    - `get_sound_analytics` - returns aggregate toggle percentages
*/

CREATE TABLE IF NOT EXISTS sound_toggle_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id),
  category text NOT NULL CHECK (category IN ('master', 'transactions', 'battles', 'notifications')),
  enabled boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_sound_toggle_events_user_id ON sound_toggle_events(user_id);
CREATE INDEX IF NOT EXISTS idx_sound_toggle_events_category ON sound_toggle_events(category);
CREATE INDEX IF NOT EXISTS idx_sound_toggle_events_created_at ON sound_toggle_events(created_at DESC);

ALTER TABLE sound_toggle_events ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can insert own toggle events"
  ON sound_toggle_events FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can read own toggle events"
  ON sound_toggle_events FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

CREATE OR REPLACE FUNCTION get_sound_analytics()
RETURNS TABLE (
  category text,
  total_users bigint,
  enabled_users bigint,
  enabled_pct numeric
)
LANGUAGE sql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
  WITH latest_per_user AS (
    SELECT DISTINCT ON (user_id, ste.category)
      user_id,
      ste.category,
      enabled
    FROM sound_toggle_events ste
    ORDER BY user_id, ste.category, created_at DESC
  )
  SELECT
    lpu.category,
    COUNT(*)::bigint AS total_users,
    COUNT(*) FILTER (WHERE enabled)::bigint AS enabled_users,
    ROUND(
      COUNT(*) FILTER (WHERE enabled)::numeric / NULLIF(COUNT(*), 0) * 100, 1
    ) AS enabled_pct
  FROM latest_per_user lpu
  GROUP BY lpu.category
  ORDER BY lpu.category;
$$;
