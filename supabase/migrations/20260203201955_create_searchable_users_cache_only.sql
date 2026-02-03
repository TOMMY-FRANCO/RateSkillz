/*
  # Create Searchable Users Cache Table

  Test migration for searchable users cache only.
*/

CREATE TABLE IF NOT EXISTS searchable_users_cache (
  id uuid PRIMARY KEY,
  username text NOT NULL,
  avatar_url text,
  overall_rating integer NOT NULL DEFAULT 50,
  position text,
  team text,
  coin_balance numeric NOT NULL DEFAULT 0,
  is_manager boolean NOT NULL DEFAULT false,
  manager_wins integer NOT NULL DEFAULT 0,
  last_active timestamptz NOT NULL DEFAULT now(),
  is_verified boolean NOT NULL DEFAULT false,
  has_social_badge boolean NOT NULL DEFAULT false,
  pac integer DEFAULT 50,
  sho integer DEFAULT 50,
  pas integer DEFAULT 50,
  dri integer DEFAULT 50,
  def integer DEFAULT 50,
  phy integer DEFAULT 50,
  secondary_school_id uuid,
  college_id uuid,
  university_id uuid,
  findable_by_school boolean NOT NULL DEFAULT false,
  search_text tsvector,
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_searchable_users_username ON searchable_users_cache(username);
CREATE INDEX IF NOT EXISTS idx_searchable_users_overall ON searchable_users_cache(overall_rating DESC);

ALTER TABLE searchable_users_cache ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can view searchable users"
  ON searchable_users_cache FOR SELECT
  TO authenticated
  USING (true);
