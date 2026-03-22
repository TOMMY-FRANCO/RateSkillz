/*
  # Add Social Media URL Columns to football_clubs

  ## Summary
  Adds six social media URL columns to the football_clubs table so admins
  can link each club's social profiles.

  ## New Columns (all nullable text)
  - instagram_url
  - facebook_url
  - twitter_url
  - tiktok_url
  - youtube_url
  - threads_url
*/

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'football_clubs' AND column_name = 'instagram_url') THEN
    ALTER TABLE football_clubs ADD COLUMN instagram_url text;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'football_clubs' AND column_name = 'facebook_url') THEN
    ALTER TABLE football_clubs ADD COLUMN facebook_url text;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'football_clubs' AND column_name = 'twitter_url') THEN
    ALTER TABLE football_clubs ADD COLUMN twitter_url text;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'football_clubs' AND column_name = 'tiktok_url') THEN
    ALTER TABLE football_clubs ADD COLUMN tiktok_url text;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'football_clubs' AND column_name = 'youtube_url') THEN
    ALTER TABLE football_clubs ADD COLUMN youtube_url text;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'football_clubs' AND column_name = 'threads_url') THEN
    ALTER TABLE football_clubs ADD COLUMN threads_url text;
  END IF;
END $$;
