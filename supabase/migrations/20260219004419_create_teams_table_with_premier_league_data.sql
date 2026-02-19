/*
  # Create teams table with Premier League data

  1. New Tables
    - `teams`
      - `id` (uuid, primary key)
      - `team_name` (text, unique, not null)
      - `created_at` (timestamptz)

  2. Data
    - Inserts all 20 Premier League teams sorted alphabetically

  3. Security
    - Enable RLS
    - Public read-only access (team names are not sensitive)
*/

CREATE TABLE IF NOT EXISTS public.teams (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  team_name text NOT NULL UNIQUE,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE public.teams ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can read teams"
  ON public.teams
  FOR SELECT
  TO authenticated
  USING (true);

INSERT INTO public.teams (team_name) VALUES
  ('Arsenal'),
  ('Aston Villa'),
  ('Bournemouth'),
  ('Brentford'),
  ('Brighton & Hove Albion'),
  ('Chelsea'),
  ('Crystal Palace'),
  ('Everton'),
  ('Fulham'),
  ('Ipswich Town'),
  ('Leicester City'),
  ('Liverpool'),
  ('Manchester City'),
  ('Manchester United'),
  ('Newcastle United'),
  ('Nottingham Forest'),
  ('Southampton'),
  ('Tottenham Hotspur'),
  ('West Ham United'),
  ('Wolverhampton Wanderers')
ON CONFLICT (team_name) DO NOTHING;
