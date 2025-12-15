/*
  # Create comment votes system

  1. New Tables
    - `comment_votes`
      - `id` (uuid, primary key) - Unique identifier
      - `comment_id` (uuid, foreign key) - References comments.id
      - `user_id` (uuid, foreign key) - User who voted
      - `is_upvote` (boolean) - true for upvote, false for downvote
      - `created_at` (timestamptz) - When vote was created
      - Unique constraint on (comment_id, user_id) - One vote per user per comment
  
  2. Security
    - Enable RLS on comment_votes table
    - Users can view all comment votes
    - Users can insert their own votes
    - Users can update their own votes
    - Users can delete their own votes
  
  3. Functions
    - Trigger to update comment likes/dislikes count when votes change
*/

CREATE TABLE IF NOT EXISTS comment_votes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  comment_id uuid NOT NULL REFERENCES comments(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  is_upvote boolean NOT NULL,
  created_at timestamptz DEFAULT now(),
  UNIQUE(comment_id, user_id)
);

ALTER TABLE comment_votes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can view comment votes"
  ON comment_votes FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Users can insert own votes"
  ON comment_votes FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own votes"
  ON comment_votes FOR UPDATE
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete own votes"
  ON comment_votes FOR DELETE
  TO authenticated
  USING (auth.uid() = user_id);

CREATE INDEX IF NOT EXISTS idx_comment_votes_comment_id ON comment_votes(comment_id);
CREATE INDEX IF NOT EXISTS idx_comment_votes_user_id ON comment_votes(user_id);

CREATE OR REPLACE FUNCTION update_comment_vote_counts()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  IF (TG_OP = 'DELETE') THEN
    UPDATE comments
    SET 
      likes = (SELECT COUNT(*) FROM comment_votes WHERE comment_id = OLD.comment_id AND is_upvote = true),
      dislikes = (SELECT COUNT(*) FROM comment_votes WHERE comment_id = OLD.comment_id AND is_upvote = false)
    WHERE id = OLD.comment_id;
    RETURN OLD;
  ELSIF (TG_OP = 'UPDATE') THEN
    UPDATE comments
    SET 
      likes = (SELECT COUNT(*) FROM comment_votes WHERE comment_id = NEW.comment_id AND is_upvote = true),
      dislikes = (SELECT COUNT(*) FROM comment_votes WHERE comment_id = NEW.comment_id AND is_upvote = false)
    WHERE id = NEW.comment_id;
    RETURN NEW;
  ELSIF (TG_OP = 'INSERT') THEN
    UPDATE comments
    SET 
      likes = (SELECT COUNT(*) FROM comment_votes WHERE comment_id = NEW.comment_id AND is_upvote = true),
      dislikes = (SELECT COUNT(*) FROM comment_votes WHERE comment_id = NEW.comment_id AND is_upvote = false)
    WHERE id = NEW.comment_id;
    RETURN NEW;
  END IF;
  RETURN NULL;
END;
$$;

DROP TRIGGER IF EXISTS comment_votes_update_counts ON comment_votes;
CREATE TRIGGER comment_votes_update_counts
  AFTER INSERT OR UPDATE OR DELETE ON comment_votes
  FOR EACH ROW
  EXECUTE FUNCTION update_comment_vote_counts();