/*
  # Create missing table definitions for user_stats, profile_summary, and card_market_cache

  These three tables exist in the live database but were never defined via CREATE TABLE
  in migrations. This migration adds explicit CREATE TABLE IF NOT EXISTS statements
  so that a fresh deployment creates all required tables.

  1. New Tables
    - `user_stats`
      - `id` (uuid, primary key, auto-generated)
      - `user_id` (uuid, unique, references profiles)
      - `pac` (integer, default 50) - pace rating
      - `sho` (integer, default 50) - shooting rating
      - `pas` (integer, default 50) - passing rating
      - `dri` (integer, default 50) - dribbling rating
      - `def` (integer, default 50) - defense rating
      - `phy` (integer, default 50) - physical rating
      - `overall` (integer, default 50) - overall calculated rating
      - `rating_count` (integer, default 0) - number of ratings received
      - `created_at` (timestamptz, default now())
      - `updated_at` (timestamptz, default now())

    - `profile_summary` (denormalized cache of profile + stats + rankings)
      - `user_id` (uuid, primary key, references profiles)
      - `username` (text)
      - `full_name` (text)
      - `avatar_url` (text)
      - `bio` (text)
      - `position` (text)
      - `team` (text)
      - `age` (integer)
      - `overall_rating` (integer)
      - `pac_rating` through `phy_rating` (integer) - six skill ratings
      - `rating_count` (integer)
      - `leaderboard_rank` (integer)
      - `manager_wins` / `manager_losses` (integer)
      - `win_loss_ratio` (numeric)
      - `total_cards_owned` (integer)
      - `total_card_value` / `total_card_royalties` (numeric)
      - `friend_count` (integer)
      - `is_verified`, `is_manager`, `is_admin`, `is_banned`, `is_online` (boolean)
      - `last_seen` (timestamptz)
      - `created_at` / `updated_at` (timestamptz)

    - `card_market_cache` (denormalized cache of card ownership marketplace data)
      - `card_user_id` (uuid, primary key, references card_ownership)
      - `owner_id` (uuid, references profiles)
      - `owner_username` / `owner_avatar` (text)
      - `original_owner_id` (uuid) / `original_owner_username` (text)
      - `current_price` / `base_price` / `last_sale_price` (numeric)
      - `times_traded` (integer)
      - `is_listed_for_sale` / `is_locked_in_battle` (boolean)
      - `locked_in_battle_id` (uuid)
      - `acquired_at` / `updated_at` (timestamptz)
      - `card_user_username` / `card_user_avatar` (text)

  2. Security
    - `user_stats`: RLS enabled
      - SELECT: authenticated users can view all stats
      - INSERT: authenticated users can insert own row only
      - UPDATE: authenticated users can update own row only
    - `profile_summary`: RLS enabled (server-managed cache)
      - SELECT: public read access for all
      - INSERT/UPDATE/DELETE: denied to all client roles (managed by SECURITY DEFINER functions)
    - `card_market_cache`: RLS enabled (server-managed cache)
      - SELECT: public read access for all
      - INSERT/UPDATE/DELETE: denied to all client roles (managed by SECURITY DEFINER functions)

  3. Indexes
    - `user_stats`: unique index on user_id
    - `profile_summary`: indexes on username and overall_rating DESC
    - `card_market_cache`: index on owner_id
*/

-- ============================================================
-- 1. user_stats
-- ============================================================
CREATE TABLE IF NOT EXISTS public.user_stats (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid UNIQUE REFERENCES public.profiles(id),
  pac integer DEFAULT 50,
  sho integer DEFAULT 50,
  pas integer DEFAULT 50,
  dri integer DEFAULT 50,
  def integer DEFAULT 50,
  phy integer DEFAULT 50,
  overall integer DEFAULT 50,
  rating_count integer DEFAULT 0,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE public.user_stats ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'user_stats' AND policyname = 'Anyone can view stats'
  ) THEN
    CREATE POLICY "Anyone can view stats"
      ON public.user_stats FOR SELECT
      TO public
      USING (true);
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'user_stats' AND policyname = 'user_stats_strict_insert'
  ) THEN
    CREATE POLICY "user_stats_strict_insert"
      ON public.user_stats FOR INSERT
      TO authenticated
      WITH CHECK (user_id = (SELECT auth.uid()));
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'user_stats' AND policyname = 'Users can update own stats'
  ) THEN
    CREATE POLICY "Users can update own stats"
      ON public.user_stats FOR UPDATE
      TO authenticated
      USING ((SELECT auth.uid()) = user_id)
      WITH CHECK ((SELECT auth.uid()) = user_id);
  END IF;
END $$;

-- ============================================================
-- 2. profile_summary
-- ============================================================
CREATE TABLE IF NOT EXISTS public.profile_summary (
  user_id uuid PRIMARY KEY REFERENCES public.profiles(id),
  username text,
  full_name text,
  avatar_url text,
  bio text,
  position text,
  team text,
  age integer,
  overall_rating integer,
  pac_rating integer,
  sho_rating integer,
  pas_rating integer,
  dri_rating integer,
  def_rating integer,
  phy_rating integer,
  rating_count integer,
  leaderboard_rank integer,
  manager_wins integer,
  manager_losses integer,
  win_loss_ratio numeric,
  total_cards_owned integer,
  total_card_value numeric,
  total_card_royalties numeric,
  friend_count integer,
  is_verified boolean,
  is_manager boolean,
  is_admin boolean,
  is_banned boolean,
  is_online boolean,
  last_seen timestamptz,
  created_at timestamptz,
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE public.profile_summary ENABLE ROW LEVEL SECURITY;

CREATE INDEX IF NOT EXISTS idx_profile_summary_username
  ON public.profile_summary (username);

CREATE INDEX IF NOT EXISTS idx_profile_summary_overall_rating
  ON public.profile_summary (overall_rating DESC);

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'profile_summary' AND policyname = 'profile_summary_public_select'
  ) THEN
    CREATE POLICY "profile_summary_public_select"
      ON public.profile_summary FOR SELECT
      TO public
      USING (true);
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'profile_summary' AND policyname = 'profile_summary_deny_insert'
  ) THEN
    CREATE POLICY "profile_summary_deny_insert"
      ON public.profile_summary FOR INSERT
      TO public
      WITH CHECK (false);
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'profile_summary' AND policyname = 'profile_summary_deny_update'
  ) THEN
    CREATE POLICY "profile_summary_deny_update"
      ON public.profile_summary FOR UPDATE
      TO public
      USING (false)
      WITH CHECK (false);
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'profile_summary' AND policyname = 'profile_summary_deny_delete'
  ) THEN
    CREATE POLICY "profile_summary_deny_delete"
      ON public.profile_summary FOR DELETE
      TO public
      USING (false);
  END IF;
END $$;

-- ============================================================
-- 3. card_market_cache
-- ============================================================
CREATE TABLE IF NOT EXISTS public.card_market_cache (
  card_user_id uuid PRIMARY KEY REFERENCES public.card_ownership(card_user_id),
  owner_id uuid REFERENCES public.profiles(id),
  owner_username text,
  owner_avatar text,
  original_owner_id uuid,
  original_owner_username text,
  current_price numeric,
  base_price numeric,
  last_sale_price numeric,
  times_traded integer,
  is_listed_for_sale boolean,
  is_locked_in_battle boolean,
  locked_in_battle_id uuid,
  acquired_at timestamptz,
  updated_at timestamptz DEFAULT now(),
  card_user_username text,
  card_user_avatar text
);

ALTER TABLE public.card_market_cache ENABLE ROW LEVEL SECURITY;

CREATE INDEX IF NOT EXISTS idx_card_market_cache_owner_id
  ON public.card_market_cache (owner_id);

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'card_market_cache' AND policyname = 'card_market_cache_public_select'
  ) THEN
    CREATE POLICY "card_market_cache_public_select"
      ON public.card_market_cache FOR SELECT
      TO public
      USING (true);
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'card_market_cache' AND policyname = 'card_market_cache_deny_insert'
  ) THEN
    CREATE POLICY "card_market_cache_deny_insert"
      ON public.card_market_cache FOR INSERT
      TO public
      WITH CHECK (false);
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'card_market_cache' AND policyname = 'card_market_cache_deny_update'
  ) THEN
    CREATE POLICY "card_market_cache_deny_update"
      ON public.card_market_cache FOR UPDATE
      TO public
      USING (false)
      WITH CHECK (false);
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'card_market_cache' AND policyname = 'card_market_cache_deny_delete'
  ) THEN
    CREATE POLICY "card_market_cache_deny_delete"
      ON public.card_market_cache FOR DELETE
      TO public
      USING (false);
  END IF;
END $$;
