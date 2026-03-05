/*
  # Create Daily Quiz System

  1. New Tables
    - `quiz_results`
      - `id` (uuid, primary key)
      - `user_id` (uuid, references auth.users)
      - `score` (integer, 0-10)
      - `coins_earned` (integer, 0-10)
      - `completed_at` (timestamptz, defaults to now())

  2. New Functions
    - `complete_quiz(p_user_id uuid, p_score integer)` - Records quiz result,
      deducts coins from community pool, credits user balance, inserts
      coin_transaction with type 'coin_purchase', and inserts a notification.

  3. Security
    - Enable RLS on `quiz_results`
    - Users can only read their own quiz results
    - Insert only via the `complete_quiz` function (security definer)

  4. Important Notes
    - Quiz resets daily at 7am UK time
    - Score equals coins earned (max 10)
    - Coins come from the community rewards pool
*/

CREATE TABLE IF NOT EXISTS quiz_results (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id),
  score integer NOT NULL DEFAULT 0 CHECK (score >= 0 AND score <= 10),
  coins_earned integer NOT NULL DEFAULT 0 CHECK (coins_earned >= 0 AND coins_earned <= 10),
  completed_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_quiz_results_user_id ON quiz_results(user_id);
CREATE INDEX IF NOT EXISTS idx_quiz_results_completed_at ON quiz_results(completed_at);
CREATE INDEX IF NOT EXISTS idx_quiz_results_user_completed ON quiz_results(user_id, completed_at DESC);

ALTER TABLE quiz_results ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own quiz results"
  ON quiz_results FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

CREATE OR REPLACE FUNCTION complete_quiz(p_user_id uuid, p_score integer)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_coins integer;
  v_new_balance numeric;
  v_pool_remaining numeric;
  v_today_start timestamptz;
  v_already_completed boolean;
BEGIN
  IF p_score < 0 OR p_score > 10 THEN
    RETURN jsonb_build_object('success', false, 'error', 'Invalid score');
  END IF;

  v_today_start := (now() AT TIME ZONE 'Europe/London')::date::timestamptz AT TIME ZONE 'Europe/London'
    + INTERVAL '7 hours';
  IF (now() AT TIME ZONE 'Europe/London')::time < '07:00:00'::time THEN
    v_today_start := v_today_start - INTERVAL '1 day';
  END IF;

  SELECT EXISTS (
    SELECT 1 FROM quiz_results
    WHERE user_id = p_user_id
    AND completed_at >= v_today_start
  ) INTO v_already_completed;

  IF v_already_completed THEN
    RETURN jsonb_build_object('success', false, 'error', 'Quiz already completed today');
  END IF;

  v_coins := p_score;

  IF v_coins > 0 THEN
    SELECT remaining_coins INTO v_pool_remaining
    FROM coin_pool
    WHERE pool_type = 'community'
    FOR UPDATE;

    IF v_pool_remaining IS NULL OR v_pool_remaining < v_coins THEN
      v_coins := GREATEST(0, COALESCE(v_pool_remaining, 0))::integer;
    END IF;

    IF v_coins > 0 THEN
      UPDATE coin_pool
      SET remaining_coins = remaining_coins - v_coins,
          distributed_coins = distributed_coins + v_coins,
          updated_at = now()
      WHERE pool_type = 'community';

      UPDATE profiles
      SET coin_balance = coin_balance + v_coins
      WHERE id = p_user_id
      RETURNING coin_balance INTO v_new_balance;

      INSERT INTO coin_transactions (user_id, amount, transaction_type, description, balance_after)
      VALUES (p_user_id, v_coins, 'coin_purchase',
              'Daily Quiz reward: ' || p_score || '/10 correct',
              v_new_balance);
    END IF;
  END IF;

  INSERT INTO quiz_results (user_id, score, coins_earned)
  VALUES (p_user_id, p_score, v_coins);

  INSERT INTO user_notifications (user_id, notification_type, message)
  VALUES (p_user_id, 'quiz_complete',
          'You scored ' || p_score || '/10 on the Daily Quiz and earned ' || v_coins || ' coins!');

  RETURN jsonb_build_object(
    'success', true,
    'score', p_score,
    'coins_earned', v_coins,
    'new_balance', COALESCE(v_new_balance, 0)
  );
END;
$$;
