/*
  # Create Football Clubs System

  ## Overview
  Creates tables to store London football clubs, their staff, players, and match history
  for the Scouter "Clubs" tab.

  ## New Tables

  ### football_clubs
  - id (uuid, primary key)
  - name (text) - Club name
  - region (text) - North/East/South/West London
  - gender (text) - mens/womens
  - league (text) - League name
  - borough (text) - London borough
  - description (text) - Short club description
  - badge_url (text) - Club badge image URL
  - is_verified (boolean) - Whether club is verified on platform
  - is_partner (boolean) - Whether club is a partner club
  - created_at (timestamptz)

  ### club_staff
  - id (uuid, primary key)
  - club_id (uuid, FK football_clubs)
  - role (text) - e.g. Manager, Assistant Manager
  - name (text)
  - avatar_url (text)
  - profile_id (uuid, nullable FK to profiles)
  - created_at (timestamptz)

  ### club_players
  - id (uuid, primary key)
  - club_id (uuid, FK football_clubs)
  - name (text)
  - position (text)
  - jersey_number (int)
  - avatar_url (text)
  - profile_id (uuid, nullable FK to profiles)
  - created_at (timestamptz)

  ### club_matches
  - id (uuid, primary key)
  - club_id (uuid, FK football_clubs)
  - match_date (timestamptz)
  - opponent (text)
  - venue (text)
  - is_home (boolean)
  - result (text) - win/loss/draw/upcoming
  - goals_for (int)
  - goals_against (int)
  - tickets_available (boolean)
  - ticket_price (numeric)
  - seats_remaining (int)
  - created_at (timestamptz)

  ## Security
  - RLS enabled on all tables
  - Public read access for all tables (clubs info is public)
  - No write access via RLS (data managed by admins only)
*/

CREATE TABLE IF NOT EXISTS football_clubs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  region text NOT NULL CHECK (region IN ('North', 'East', 'South', 'West')),
  gender text NOT NULL DEFAULT 'mens' CHECK (gender IN ('mens', 'womens')),
  league text,
  borough text,
  description text,
  badge_url text,
  is_verified boolean NOT NULL DEFAULT false,
  is_partner boolean NOT NULL DEFAULT false,
  created_at timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS club_staff (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  club_id uuid NOT NULL REFERENCES football_clubs(id) ON DELETE CASCADE,
  role text NOT NULL,
  name text NOT NULL,
  avatar_url text,
  profile_id uuid REFERENCES profiles(id) ON DELETE SET NULL,
  created_at timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS club_players (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  club_id uuid NOT NULL REFERENCES football_clubs(id) ON DELETE CASCADE,
  name text NOT NULL,
  position text,
  jersey_number integer,
  avatar_url text,
  profile_id uuid REFERENCES profiles(id) ON DELETE SET NULL,
  created_at timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS club_matches (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  club_id uuid NOT NULL REFERENCES football_clubs(id) ON DELETE CASCADE,
  match_date timestamptz NOT NULL,
  opponent text NOT NULL,
  venue text,
  is_home boolean NOT NULL DEFAULT true,
  result text NOT NULL DEFAULT 'upcoming' CHECK (result IN ('win', 'loss', 'draw', 'upcoming')),
  goals_for integer,
  goals_against integer,
  tickets_available boolean NOT NULL DEFAULT false,
  ticket_price numeric(10,2),
  seats_remaining integer,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE football_clubs ENABLE ROW LEVEL SECURITY;
ALTER TABLE club_staff ENABLE ROW LEVEL SECURITY;
ALTER TABLE club_players ENABLE ROW LEVEL SECURITY;
ALTER TABLE club_matches ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can read football clubs"
  ON football_clubs FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Anyone can read club staff"
  ON club_staff FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Anyone can read club players"
  ON club_players FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Anyone can read club matches"
  ON club_matches FOR SELECT
  TO authenticated
  USING (true);

CREATE INDEX IF NOT EXISTS idx_football_clubs_region ON football_clubs(region);
CREATE INDEX IF NOT EXISTS idx_football_clubs_gender ON football_clubs(gender);
CREATE INDEX IF NOT EXISTS idx_club_staff_club_id ON club_staff(club_id);
CREATE INDEX IF NOT EXISTS idx_club_players_club_id ON club_players(club_id);
CREATE INDEX IF NOT EXISTS idx_club_matches_club_id ON club_matches(club_id);
CREATE INDEX IF NOT EXISTS idx_club_matches_result ON club_matches(result);
