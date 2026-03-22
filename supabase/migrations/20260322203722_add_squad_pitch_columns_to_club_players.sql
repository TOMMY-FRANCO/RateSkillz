/*
  # Add Squad Pitch Columns to club_players

  ## Overview
  Extends the club_players table with fields needed to display players on a
  visual pitch in a 4-3-3 formation and manage squad slot confirmations.

  ## Changes to club_players
  - pitch_x (numeric 0-100) - horizontal position on pitch as percentage
  - pitch_y (numeric 0-100) - vertical position on pitch as percentage
  - slot_position (text) - label shown on slot e.g. GK, CB, LB, RB, CM, LM, RM, LW, RW, ST
  - is_substitute (boolean, default false) - whether this is a substitute slot
  - is_confirmed (boolean, default false) - whether this slot is confirmed

  ## Write Policies
  Adds INSERT/UPDATE/DELETE policies for authenticated users so the admin UI
  can manage squad slots directly from the browser client.
*/

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'club_players' AND column_name = 'pitch_x'
  ) THEN
    ALTER TABLE club_players ADD COLUMN pitch_x numeric(5,2) DEFAULT 50;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'club_players' AND column_name = 'pitch_y'
  ) THEN
    ALTER TABLE club_players ADD COLUMN pitch_y numeric(5,2) DEFAULT 50;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'club_players' AND column_name = 'slot_position'
  ) THEN
    ALTER TABLE club_players ADD COLUMN slot_position text;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'club_players' AND column_name = 'is_substitute'
  ) THEN
    ALTER TABLE club_players ADD COLUMN is_substitute boolean NOT NULL DEFAULT false;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'club_players' AND column_name = 'is_confirmed'
  ) THEN
    ALTER TABLE club_players ADD COLUMN is_confirmed boolean NOT NULL DEFAULT false;
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'club_players' AND policyname = 'Authenticated users can insert club players'
  ) THEN
    EXECUTE 'CREATE POLICY "Authenticated users can insert club players" ON club_players FOR INSERT TO authenticated WITH CHECK (true)';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'club_players' AND policyname = 'Authenticated users can update club players'
  ) THEN
    EXECUTE 'CREATE POLICY "Authenticated users can update club players" ON club_players FOR UPDATE TO authenticated USING (true) WITH CHECK (true)';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'club_players' AND policyname = 'Authenticated users can delete club players'
  ) THEN
    EXECUTE 'CREATE POLICY "Authenticated users can delete club players" ON club_players FOR DELETE TO authenticated USING (true)';
  END IF;
END $$;
