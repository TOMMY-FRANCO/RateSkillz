/*
  # Create Profanity Filter System for Comments

  ## Overview
  Implements a comprehensive profanity filter with RegEx pattern matching, variation detection,
  and audit logging. All processing runs server-side without external API calls.

  ## New Tables
  1. **profanity_filter**
     - `id` (uuid, primary key)
     - `word` (text, the banned word/phrase)
     - `pattern` (text, RegEx pattern for matching)
     - `severity` (text: low, medium, high)
     - `is_active` (boolean)
     - `created_at` (timestamptz)
     - `updated_at` (timestamptz)

  2. **filtered_comments_log**
     - `id` (uuid, primary key)
     - `user_id` (uuid, references profiles)
     - `profile_user_id` (uuid, the profile being commented on)
     - `comment_text` (text, the rejected comment)
     - `matched_words` (text[], array of matched patterns)
     - `filter_reason` (text: profanity, url, spam)
     - `created_at` (timestamptz)

  ## Features
  - RegEx pattern matching for banned words
  - Leetspeak/variation detection (e.g., "a" → "@", "1", "4")
  - Spacing variation detection (e.g., "b a d" → "bad")
  - URL/link detection
  - Audit logging for all blocked attempts
  - Graceful failure (allows comment if filter errors)

  ## Security
  - Server-side processing only
  - Admin-only access to filter management
  - Public read access to check if filter is active
  - Comprehensive audit trail
*/

-- ============================================================================
-- STEP 1: Create profanity_filter table
-- ============================================================================

CREATE TABLE IF NOT EXISTS profanity_filter (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  word text NOT NULL,
  pattern text NOT NULL,
  severity text NOT NULL DEFAULT 'medium',
  is_active boolean DEFAULT true,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),

  CONSTRAINT valid_severity CHECK (severity IN ('low', 'medium', 'high')),
  UNIQUE(word)
);

CREATE INDEX IF NOT EXISTS idx_profanity_filter_active ON profanity_filter(is_active) WHERE is_active = true;

-- ============================================================================
-- STEP 2: Create filtered_comments_log table
-- ============================================================================

CREATE TABLE IF NOT EXISTS filtered_comments_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  profile_user_id uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  comment_text text NOT NULL,
  matched_words text[],
  filter_reason text NOT NULL,
  created_at timestamptz DEFAULT now(),

  CONSTRAINT valid_filter_reason CHECK (filter_reason IN ('profanity', 'url', 'spam', 'pattern_match'))
);

CREATE INDEX IF NOT EXISTS idx_filtered_comments_log_user ON filtered_comments_log(user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_filtered_comments_log_created ON filtered_comments_log(created_at DESC);

-- ============================================================================
-- STEP 3: Enable RLS
-- ============================================================================

ALTER TABLE profanity_filter ENABLE ROW LEVEL SECURITY;
ALTER TABLE filtered_comments_log ENABLE ROW LEVEL SECURITY;

-- ============================================================================
-- STEP 4: RLS Policies for profanity_filter
-- ============================================================================

-- Admins can manage profanity filter
CREATE POLICY "Admins can manage profanity filter"
  ON profanity_filter FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE id = auth.uid() AND is_admin = true
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE id = auth.uid() AND is_admin = true
    )
  );

-- ============================================================================
-- STEP 5: RLS Policies for filtered_comments_log
-- ============================================================================

-- Users can view their own filtered attempts
CREATE POLICY "Users can view own filtered comments"
  ON filtered_comments_log FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

-- Admins can view all filtered comments
CREATE POLICY "Admins can view all filtered comments"
  ON filtered_comments_log FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE id = auth.uid() AND is_admin = true
    )
  );

-- System can create filtered comment logs
CREATE POLICY "System can create filtered logs"
  ON filtered_comments_log FOR INSERT
  TO authenticated
  WITH CHECK (true);

-- ============================================================================
-- STEP 6: Populate initial profanity filter list
-- ============================================================================

INSERT INTO profanity_filter (word, pattern, severity, is_active) VALUES
  -- High severity offensive terms
  ('n-word', 'n[i1!]gg[e3a@]r', 'high', true),
  ('f-word', 'f[u*]ck', 'high', true),
  ('sh-word', 'sh[i1!]t', 'medium', true),
  ('b-word', 'b[i1!]tch', 'medium', true),
  ('a-word', '@ss', 'medium', true),
  
  -- Slurs and hate speech (high severity)
  ('racial-slur-1', 'f[a@4]gg[o0]t', 'high', true),
  ('racial-slur-2', 'r[e3]t[a@4]rd', 'high', true),
  
  -- Spam patterns
  ('url-pattern', 'https?:\/\/', 'low', true),
  ('www-pattern', 'www\.', 'low', true),
  ('dot-com', '\.com|\.net|\.org', 'low', true),
  
  -- Common variations
  ('fuck-variations', 'f[u*\.\-_@]c?k', 'high', true),
  ('shit-variations', 's[h\-_]i[t\-_]', 'medium', true),
  ('damn-variations', 'd[a@4]mn', 'low', true),
  ('hell-variations', 'h[e3]ll', 'low', true),
  ('crap-variations', 'cr[a@4]p', 'low', true)
ON CONFLICT (word) DO NOTHING;

-- ============================================================================
-- STEP 7: Create helper function to normalize text for checking
-- ============================================================================

CREATE OR REPLACE FUNCTION normalize_text_for_filter(input_text text)
RETURNS text
LANGUAGE plpgsql
IMMUTABLE
AS $$
BEGIN
  -- Convert to lowercase
  input_text := lower(input_text);
  
  -- Remove extra spaces (multiple spaces to single space)
  input_text := regexp_replace(input_text, '\s+', ' ', 'g');
  
  -- Remove spaces between letters (for "b a d w o r d" type evasion)
  -- We'll keep the original and also create a no-space version for checking
  
  RETURN input_text;
END;
$$;

-- ============================================================================
-- STEP 8: Create profanity check function
-- ============================================================================

CREATE OR REPLACE FUNCTION check_comment_profanity(
  p_comment_text text,
  p_user_id uuid,
  p_profile_user_id uuid
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_normalized_text text;
  v_no_space_text text;
  v_filter_record RECORD;
  v_matched_words text[] := ARRAY[]::text[];
  v_has_url boolean := false;
  v_url_pattern text := 'https?:\/\/|www\.|\.com|\.net|\.org|\.co\.uk|bit\.ly|tinyurl';
BEGIN
  -- Normalize the text for checking
  v_normalized_text := normalize_text_for_filter(p_comment_text);
  
  -- Create version with no spaces (to catch "b a d" style evasion)
  v_no_space_text := regexp_replace(v_normalized_text, '\s', '', 'g');
  
  -- Check for URLs first (separate check)
  IF v_normalized_text ~* v_url_pattern THEN
    v_has_url := true;
    v_matched_words := array_append(v_matched_words, 'URL_DETECTED');
  END IF;
  
  -- Check against active profanity patterns
  FOR v_filter_record IN
    SELECT word, pattern, severity
    FROM profanity_filter
    WHERE is_active = true
    ORDER BY severity DESC
  LOOP
    -- Check both normalized text and no-space version
    IF v_normalized_text ~* v_filter_record.pattern OR v_no_space_text ~* v_filter_record.pattern THEN
      v_matched_words := array_append(v_matched_words, v_filter_record.word);
    END IF;
  END LOOP;
  
  -- If any matches found, log and reject
  IF array_length(v_matched_words, 1) > 0 OR v_has_url THEN
    -- Log the filtered comment
    INSERT INTO filtered_comments_log (
      user_id,
      profile_user_id,
      comment_text,
      matched_words,
      filter_reason
    ) VALUES (
      p_user_id,
      p_profile_user_id,
      p_comment_text,
      v_matched_words,
      CASE 
        WHEN v_has_url THEN 'url'
        ELSE 'profanity'
      END
    );
    
    -- Return rejection
    RETURN jsonb_build_object(
      'allowed', false,
      'reason', CASE 
        WHEN v_has_url THEN 'Your comment contains links or URLs which are not allowed.'
        ELSE 'Your comment contains inappropriate language. Please revise and try again.'
      END,
      'matched_count', array_length(v_matched_words, 1)
    );
  END IF;
  
  -- Comment passed all filters
  RETURN jsonb_build_object(
    'allowed', true,
    'reason', NULL
  );
  
EXCEPTION
  WHEN OTHERS THEN
    -- On error, log it but allow the comment (graceful degradation)
    INSERT INTO filtered_comments_log (
      user_id,
      profile_user_id,
      comment_text,
      matched_words,
      filter_reason
    ) VALUES (
      p_user_id,
      p_profile_user_id,
      p_comment_text,
      ARRAY['FILTER_ERROR: ' || SQLERRM],
      'spam'
    );
    
    -- Allow comment on filter error
    RETURN jsonb_build_object(
      'allowed', true,
      'reason', NULL,
      'filter_error', true
    );
END;
$$;

-- ============================================================================
-- STEP 9: Create trigger function to check comments before insert
-- ============================================================================

CREATE OR REPLACE FUNCTION trigger_check_comment_profanity()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_check_result jsonb;
  v_user_id uuid;
BEGIN
  -- Get the user_id from auth context
  v_user_id := auth.uid();
  
  -- Skip filter for admins
  IF EXISTS (SELECT 1 FROM profiles WHERE id = v_user_id AND is_admin = true) THEN
    RETURN NEW;
  END IF;
  
  -- Check the comment
  v_check_result := check_comment_profanity(
    NEW.comment_text,
    NEW.user_id,
    NEW.profile_user_id
  );
  
  -- If not allowed, raise exception with custom message
  IF NOT (v_check_result->>'allowed')::boolean THEN
    RAISE EXCEPTION '%', v_check_result->>'reason';
  END IF;
  
  -- Comment passed, allow insertion
  RETURN NEW;
END;
$$;

-- Drop existing trigger if it exists
DROP TRIGGER IF EXISTS trigger_check_comment_before_insert ON comments;

-- Create trigger on comments table
CREATE TRIGGER trigger_check_comment_before_insert
  BEFORE INSERT ON comments
  FOR EACH ROW
  EXECUTE FUNCTION trigger_check_comment_profanity();

-- ============================================================================
-- STEP 10: Create admin function to get filtered comments stats
-- ============================================================================

CREATE OR REPLACE FUNCTION get_filtered_comments_stats()
RETURNS TABLE (
  total_filtered bigint,
  filtered_today bigint,
  filtered_this_week bigint,
  top_reasons jsonb,
  recent_logs jsonb
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_user_id uuid;
  v_is_admin boolean;
BEGIN
  v_user_id := auth.uid();
  
  -- Verify admin status
  SELECT is_admin INTO v_is_admin
  FROM profiles WHERE id = v_user_id;
  
  IF NOT v_is_admin THEN
    RAISE EXCEPTION 'Unauthorized - admin access required';
  END IF;
  
  RETURN QUERY
  SELECT
    (SELECT COUNT(*) FROM filtered_comments_log),
    (SELECT COUNT(*) FROM filtered_comments_log WHERE created_at >= CURRENT_DATE),
    (SELECT COUNT(*) FROM filtered_comments_log WHERE created_at >= CURRENT_DATE - INTERVAL '7 days'),
    (
      SELECT jsonb_agg(reason_stats)
      FROM (
        SELECT 
          filter_reason,
          COUNT(*) as count
        FROM filtered_comments_log
        GROUP BY filter_reason
        ORDER BY count DESC
        LIMIT 5
      ) reason_stats
    ),
    (
      SELECT jsonb_agg(log_entry)
      FROM (
        SELECT
          fcl.id,
          fcl.user_id,
          p.username,
          fcl.comment_text,
          fcl.matched_words,
          fcl.filter_reason,
          fcl.created_at
        FROM filtered_comments_log fcl
        JOIN profiles p ON p.id = fcl.user_id
        ORDER BY fcl.created_at DESC
        LIMIT 20
      ) log_entry
    );
END;
$$;

-- ============================================================================
-- STEP 11: Create function to add/remove filter words (admin only)
-- ============================================================================

CREATE OR REPLACE FUNCTION manage_profanity_filter(
  p_action text,
  p_word text,
  p_pattern text DEFAULT NULL,
  p_severity text DEFAULT 'medium'
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_user_id uuid;
  v_is_admin boolean;
BEGIN
  v_user_id := auth.uid();
  
  -- Verify admin status
  SELECT is_admin INTO v_is_admin
  FROM profiles WHERE id = v_user_id;
  
  IF NOT v_is_admin THEN
    RETURN jsonb_build_object('success', false, 'error', 'Unauthorized - admin access required');
  END IF;
  
  IF p_action = 'add' THEN
    INSERT INTO profanity_filter (word, pattern, severity, is_active)
    VALUES (p_word, COALESCE(p_pattern, p_word), p_severity, true)
    ON CONFLICT (word) DO UPDATE
    SET pattern = EXCLUDED.pattern,
        severity = EXCLUDED.severity,
        is_active = true,
        updated_at = now();
    
    RETURN jsonb_build_object('success', true, 'message', 'Filter word added');
    
  ELSIF p_action = 'remove' THEN
    UPDATE profanity_filter
    SET is_active = false, updated_at = now()
    WHERE word = p_word;
    
    RETURN jsonb_build_object('success', true, 'message', 'Filter word deactivated');
    
  ELSIF p_action = 'activate' THEN
    UPDATE profanity_filter
    SET is_active = true, updated_at = now()
    WHERE word = p_word;
    
    RETURN jsonb_build_object('success', true, 'message', 'Filter word activated');
    
  ELSE
    RETURN jsonb_build_object('success', false, 'error', 'Invalid action');
  END IF;
  
EXCEPTION
  WHEN OTHERS THEN
    RETURN jsonb_build_object('success', false, 'error', SQLERRM);
END;
$$;

-- ============================================================================
-- STEP 12: Grant permissions
-- ============================================================================

GRANT EXECUTE ON FUNCTION check_comment_profanity(text, uuid, uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION get_filtered_comments_stats() TO authenticated;
GRANT EXECUTE ON FUNCTION manage_profanity_filter(text, text, text, text) TO authenticated;

-- ============================================================================
-- STEP 13: Add comments for documentation
-- ============================================================================

COMMENT ON TABLE profanity_filter IS
'Stores banned words and patterns with RegEx support for comment filtering. Includes variation detection.';

COMMENT ON TABLE filtered_comments_log IS
'Audit log of all blocked comment attempts with matched patterns and reasons.';

COMMENT ON FUNCTION check_comment_profanity(text, uuid, uuid) IS
'Checks comment text for profanity, URLs, and spam patterns. Returns allowed/rejected status.';

COMMENT ON FUNCTION get_filtered_comments_stats() IS
'Admin-only function returning statistics about filtered comments.';

COMMENT ON FUNCTION manage_profanity_filter(text, text, text, text) IS
'Admin-only function to add, remove, or modify profanity filter entries.';
