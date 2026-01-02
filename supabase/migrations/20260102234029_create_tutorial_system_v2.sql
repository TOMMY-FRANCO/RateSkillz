/*
  # Create Tutorial System

  1. New Tables
    - `tutorial_completions`
      - `id` (uuid, primary key)
      - `user_id` (uuid, references profiles)
      - `completed_at` (timestamptz)
      - `coins_earned` (numeric, default 5)
      - `created_at` (timestamptz)

  2. Security
    - Enable RLS on `tutorial_completions` table
    - Add policy for users to read their own completion status
    - Add policy for users to insert their own completion record

  3. Functions
    - `complete_tutorial(user_uuid)` - Awards 5 coins and logs completion
*/

-- Create tutorial completions table
CREATE TABLE IF NOT EXISTS tutorial_completions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES profiles(id) ON DELETE CASCADE NOT NULL,
  completed_at timestamptz DEFAULT now() NOT NULL,
  coins_earned numeric DEFAULT 5 NOT NULL,
  created_at timestamptz DEFAULT now() NOT NULL,
  UNIQUE(user_id)
);

-- Enable RLS
ALTER TABLE tutorial_completions ENABLE ROW LEVEL SECURITY;

-- Policy: Users can read their own tutorial completion
CREATE POLICY "Users can read own tutorial completion"
  ON tutorial_completions
  FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

-- Policy: Users can insert their own tutorial completion
CREATE POLICY "Users can insert own tutorial completion"
  ON tutorial_completions
  FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

-- Function to complete tutorial and award coins
CREATE OR REPLACE FUNCTION complete_tutorial(user_uuid uuid)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_already_completed boolean;
  v_new_balance numeric;
  v_transaction_id uuid;
BEGIN
  -- Check if already completed
  SELECT EXISTS(
    SELECT 1 FROM tutorial_completions WHERE user_id = user_uuid
  ) INTO v_already_completed;

  IF v_already_completed THEN
    RETURN json_build_object(
      'success', false,
      'message', 'Tutorial already completed'
    );
  END IF;

  -- Award 5 coins to user
  UPDATE profiles
  SET coin_balance = coin_balance + 5
  WHERE id = user_uuid
  RETURNING coin_balance INTO v_new_balance;

  -- Log transaction
  INSERT INTO coin_transactions (
    user_id,
    amount,
    transaction_type,
    description,
    balance_after
  ) VALUES (
    user_uuid,
    5,
    'tutorial_completion',
    'Tutorial completion bonus',
    v_new_balance
  ) RETURNING id INTO v_transaction_id;

  -- Record tutorial completion
  INSERT INTO tutorial_completions (user_id, coins_earned)
  VALUES (user_uuid, 5);

  RETURN json_build_object(
    'success', true,
    'message', 'Tutorial completed! +5 coins earned',
    'new_balance', v_new_balance,
    'coins_earned', 5
  );
END;
$$;
