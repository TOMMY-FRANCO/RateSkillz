/*
  # Club Chat System - RLS Policies and Indexes

  1. Tables involved
     - `club_chat_messages` — messages scoped to team + chat_date
     - `club_chat_reports` — per-message flag reports
     - `club_match_settings` — match info per team (admin-managed)

  2. Security
     - Enable RLS on all three tables
     - club_chat_messages: authenticated users can SELECT (any team), INSERT their own, no UPDATE/DELETE
     - club_chat_reports: authenticated users can INSERT their own report, SELECT their own
     - club_match_settings: authenticated users can SELECT; only admins or test users can INSERT/UPDATE

  3. Performance indexes
     - club_chat_messages(team, chat_date) for fast day-scoped queries
     - club_match_settings(team) for fast lookup
*/

ALTER TABLE club_chat_messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE club_chat_reports ENABLE ROW LEVEL SECURITY;
ALTER TABLE club_match_settings ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'club_chat_messages' AND policyname = 'Authenticated users can read club chat messages'
  ) THEN
    CREATE POLICY "Authenticated users can read club chat messages"
      ON club_chat_messages FOR SELECT
      TO authenticated
      USING (true);
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'club_chat_messages' AND policyname = 'Users can insert their own club chat messages'
  ) THEN
    CREATE POLICY "Users can insert their own club chat messages"
      ON club_chat_messages FOR INSERT
      TO authenticated
      WITH CHECK (auth.uid() = user_id);
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'club_chat_reports' AND policyname = 'Users can insert their own chat reports'
  ) THEN
    CREATE POLICY "Users can insert their own chat reports"
      ON club_chat_reports FOR INSERT
      TO authenticated
      WITH CHECK (auth.uid() = reporter_id);
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'club_chat_reports' AND policyname = 'Users can read their own chat reports'
  ) THEN
    CREATE POLICY "Users can read their own chat reports"
      ON club_chat_reports FOR SELECT
      TO authenticated
      USING (auth.uid() = reporter_id);
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'club_match_settings' AND policyname = 'Authenticated users can read match settings'
  ) THEN
    CREATE POLICY "Authenticated users can read match settings"
      ON club_match_settings FOR SELECT
      TO authenticated
      USING (true);
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'club_match_settings' AND policyname = 'Admins can insert match settings'
  ) THEN
    CREATE POLICY "Admins can insert match settings"
      ON club_match_settings FOR INSERT
      TO authenticated
      WITH CHECK (
        EXISTS (
          SELECT 1 FROM profiles
          WHERE profiles.id = auth.uid()
          AND (profiles.is_admin = true OR profiles.username IN ('test123', 'tommy_franco'))
        )
      );
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'club_match_settings' AND policyname = 'Admins can update match settings'
  ) THEN
    CREATE POLICY "Admins can update match settings"
      ON club_match_settings FOR UPDATE
      TO authenticated
      USING (
        EXISTS (
          SELECT 1 FROM profiles
          WHERE profiles.id = auth.uid()
          AND (profiles.is_admin = true OR profiles.username IN ('test123', 'tommy_franco'))
        )
      )
      WITH CHECK (
        EXISTS (
          SELECT 1 FROM profiles
          WHERE profiles.id = auth.uid()
          AND (profiles.is_admin = true OR profiles.username IN ('test123', 'tommy_franco'))
        )
      );
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_club_chat_messages_team_date ON club_chat_messages(team, chat_date);
CREATE INDEX IF NOT EXISTS idx_club_chat_messages_created_at ON club_chat_messages(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_club_match_settings_team ON club_match_settings(team);
