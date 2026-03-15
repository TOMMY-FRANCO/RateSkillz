/*
  # Create news_articles and news_likes tables

  1. New Tables
    - `news_articles`
      - `id` (uuid, primary key)
      - `title` (text, not null)
      - `content` (text, nullable)
      - `category` (text, not null, default 'general') — values: premier_league, womens, transfers, general, results
      - `likes_count` (integer, default 0)
      - `published_at` (timestamptz, default now())
      - `created_at` (timestamptz, default now())
    - `news_likes`
      - `id` (uuid, primary key)
      - `article_id` (uuid, fk -> news_articles)
      - `user_id` (uuid, fk -> auth.users)
      - `created_at` (timestamptz, default now())
      - unique constraint on (article_id, user_id)

  2. Security
    - RLS enabled on both tables
    - news_articles: anyone authenticated can read; only service role inserts
    - news_likes: authenticated users can read/insert/delete their own rows
    - Trigger to keep likes_count in sync
*/

CREATE TABLE IF NOT EXISTS news_articles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  title text NOT NULL,
  content text,
  category text NOT NULL DEFAULT 'general',
  likes_count integer NOT NULL DEFAULT 0,
  published_at timestamptz DEFAULT now(),
  created_at timestamptz DEFAULT now()
);

ALTER TABLE news_articles ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can read news articles"
  ON news_articles FOR SELECT
  TO authenticated
  USING (true);

CREATE TABLE IF NOT EXISTS news_likes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  article_id uuid NOT NULL REFERENCES news_articles(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at timestamptz DEFAULT now(),
  UNIQUE (article_id, user_id)
);

ALTER TABLE news_likes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can read all news likes"
  ON news_likes FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Users can insert own news likes"
  ON news_likes FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete own news likes"
  ON news_likes FOR DELETE
  TO authenticated
  USING (auth.uid() = user_id);

CREATE OR REPLACE FUNCTION sync_news_likes_count()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    UPDATE news_articles SET likes_count = likes_count + 1 WHERE id = NEW.article_id;
  ELSIF TG_OP = 'DELETE' THEN
    UPDATE news_articles SET likes_count = GREATEST(likes_count - 1, 0) WHERE id = OLD.article_id;
  END IF;
  RETURN NULL;
END;
$$;

DROP TRIGGER IF EXISTS trg_sync_news_likes_count ON news_likes;
CREATE TRIGGER trg_sync_news_likes_count
  AFTER INSERT OR DELETE ON news_likes
  FOR EACH ROW EXECUTE FUNCTION sync_news_likes_count();

CREATE INDEX IF NOT EXISTS idx_news_articles_published_at ON news_articles (published_at DESC);
CREATE INDEX IF NOT EXISTS idx_news_likes_user_id ON news_likes (user_id);
CREATE INDEX IF NOT EXISTS idx_news_likes_article_id ON news_likes (article_id);
