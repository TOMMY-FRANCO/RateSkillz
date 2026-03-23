/*
  # Predictions System - RLS Policies & Settle Function

  1. Enables RLS on all three prediction tables
  2. Creates access policies:
     - prediction_matches: public read, admin insert/update
     - predictions: public read, authenticated insert (own), authenticated update (own cancel), admin update
     - prediction_slots: public read, admin insert/update
  3. Adds `prediction_reward` to the coin_transactions transaction_type constraint
  4. Creates `settle_prediction_match` function that:
     - Sets the result on prediction_matches
     - Sets status to 'settled'
     - Marks each prediction as correct/incorrect
     - Pays 10 coins from Community Rewards Pool to correct predictors via distribute_coins_atomically
*/

-- Enable RLS
ALTER TABLE prediction_matches ENABLE ROW LEVEL SECURITY;
ALTER TABLE predictions ENABLE ROW LEVEL SECURITY;
ALTER TABLE prediction_slots ENABLE ROW LEVEL SECURITY;

-- prediction_matches policies
CREATE POLICY "Anyone authenticated can read prediction matches"
  ON prediction_matches FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Admins can insert prediction matches"
  ON prediction_matches FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE id = auth.uid()
      AND username IN ('test123', 'tommy_franco')
    )
  );

CREATE POLICY "Admins can update prediction matches"
  ON prediction_matches FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE id = auth.uid()
      AND username IN ('test123', 'tommy_franco')
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE id = auth.uid()
      AND username IN ('test123', 'tommy_franco')
    )
  );

-- prediction_slots policies
CREATE POLICY "Anyone authenticated can read prediction slots"
  ON prediction_slots FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Admins can insert prediction slots"
  ON prediction_slots FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE id = auth.uid()
      AND username IN ('test123', 'tommy_franco')
    )
  );

CREATE POLICY "Admins can update prediction slots"
  ON prediction_slots FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE id = auth.uid()
      AND username IN ('test123', 'tommy_franco')
    )
  )
  WITH CHECK (true);

CREATE POLICY "Trigger/function can update prediction slots"
  ON prediction_slots FOR UPDATE
  TO service_role
  USING (true)
  WITH CHECK (true);

-- predictions policies
CREATE POLICY "Anyone authenticated can read predictions"
  ON predictions FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Authenticated users can insert own predictions"
  ON predictions FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can cancel own predictions"
  ON predictions FOR UPDATE
  TO authenticated
  USING (auth.uid() = user_id AND is_cancelled = false)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Admins can update predictions for settlement"
  ON predictions FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE id = auth.uid()
      AND username IN ('test123', 'tommy_franco')
    )
  )
  WITH CHECK (true);

-- Add prediction_reward transaction type if not already present
DO $$
BEGIN
  ALTER TABLE coin_transactions
    DROP CONSTRAINT IF EXISTS coin_transactions_transaction_type_check;
EXCEPTION WHEN OTHERS THEN NULL;
END $$;

ALTER TABLE coin_transactions
  ADD CONSTRAINT coin_transactions_transaction_type_check
  CHECK (transaction_type IN (
    'ad_reward', 'balance_correction', 'battle_wager', 'battle_win',
    'card_discard', 'card_discard_payment', 'card_purchase', 'card_royalty',
    'card_sale', 'coin_debt_repayment', 'coin_purchase', 'coin_refund',
    'coin_transfer_received', 'coin_transfer_sent', 'comment_reward',
    'purchase', 'reward_friend_milestone', 'reward_social_share',
    'reward_whatsapp', 'signup_bonus', 'tutorial_completion',
    'whatsapp_share', 'prediction_reward', 'manager_bonus',
    'battle_draw_refund', 'battle_loss'
  ));

-- Function: settle_prediction_match
-- Called by admin to close a match and pay winners
CREATE OR REPLACE FUNCTION settle_prediction_match(
  p_match_id uuid,
  p_result text
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_caller_username text;
  v_match_status text;
  v_winner_record RECORD;
  v_winners_paid integer := 0;
  v_payout_amount numeric := 10;
  v_payout_result jsonb;
BEGIN
  -- Verify caller is admin
  SELECT username INTO v_caller_username
  FROM profiles WHERE id = auth.uid();

  IF v_caller_username NOT IN ('test123', 'tommy_franco') THEN
    RETURN jsonb_build_object('success', false, 'error', 'Unauthorized');
  END IF;

  -- Verify result value
  IF p_result NOT IN ('home', 'away', 'draw') THEN
    RETURN jsonb_build_object('success', false, 'error', 'Invalid result. Must be home, away, or draw');
  END IF;

  -- Verify match is open
  SELECT status INTO v_match_status FROM prediction_matches WHERE id = p_match_id;
  IF v_match_status IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'Match not found');
  END IF;
  IF v_match_status = 'settled' THEN
    RETURN jsonb_build_object('success', false, 'error', 'Match already settled');
  END IF;

  -- Update match
  UPDATE prediction_matches
  SET status = 'settled', result = p_result
  WHERE id = p_match_id;

  -- Mark all predictions correct/incorrect
  UPDATE predictions
  SET is_correct = (prediction = p_result)
  WHERE match_id = p_match_id AND is_cancelled = false;

  -- Pay winners
  FOR v_winner_record IN
    SELECT user_id FROM predictions
    WHERE match_id = p_match_id
      AND prediction = p_result
      AND is_cancelled = false
  LOOP
    -- Use distribute_coins_atomically to credit winner
    SELECT distribute_coins_atomically(
      v_winner_record.user_id,
      v_payout_amount,
      'prediction_reward',
      'Prediction correct! Won ' || v_payout_amount || ' coins',
      NULL,
      NULL
    ) INTO v_payout_result;

    IF (v_payout_result->>'success')::boolean THEN
      -- Mark coins as awarded on prediction row
      UPDATE predictions
      SET coins_awarded = v_payout_amount
      WHERE match_id = p_match_id
        AND user_id = v_winner_record.user_id
        AND is_cancelled = false;

      v_winners_paid := v_winners_paid + 1;
    END IF;
  END LOOP;

  RETURN jsonb_build_object(
    'success', true,
    'result', p_result,
    'winners_paid', v_winners_paid,
    'coins_per_winner', v_payout_amount
  );

EXCEPTION WHEN OTHERS THEN
  RETURN jsonb_build_object('success', false, 'error', SQLERRM);
END;
$$;
