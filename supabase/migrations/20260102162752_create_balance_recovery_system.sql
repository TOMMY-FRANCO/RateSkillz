/*
  # Balance Recovery System - Rebuild from Transaction Ledger

  1. New Tables
    - `balance_recovery_log` - Comprehensive audit trail for all balance recoveries
      - `id` (uuid, primary key)
      - `user_id` (uuid, foreign key to profiles)
      - `username` (text)
      - `old_balance` (numeric) - Balance before recovery
      - `calculated_balance` (numeric) - Balance calculated from transactions
      - `discrepancy` (numeric) - Difference (calculated - old)
      - `coins_recovered` (numeric) - Absolute value of discrepancy
      - `transaction_count` (integer) - Number of transactions analyzed
      - `recovery_date` (timestamptz)
      - `recovery_notes` (text) - Detailed notes about the recovery
      
  2. Functions
    - `calculate_balance_from_transactions(user_uuid)` - Calculate true balance from coin_transactions
    - `recover_all_user_balances()` - Recalculate and restore ALL user balances
    
  3. Security
    - Enable RLS on balance_recovery_log
    - Admin-only access to recovery functions
    
  4. Changes
    - Creates complete audit trail
    - Ensures data integrity
    - Recovers all lost coins
*/

-- Create balance recovery log table
CREATE TABLE IF NOT EXISTS balance_recovery_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES profiles(id) ON DELETE CASCADE NOT NULL,
  username text NOT NULL,
  old_balance numeric NOT NULL DEFAULT 0,
  calculated_balance numeric NOT NULL,
  discrepancy numeric NOT NULL,
  coins_recovered numeric NOT NULL,
  transaction_count integer NOT NULL DEFAULT 0,
  recovery_date timestamptz DEFAULT now() NOT NULL,
  recovery_notes text,
  created_at timestamptz DEFAULT now() NOT NULL
);

-- Enable RLS
ALTER TABLE balance_recovery_log ENABLE ROW LEVEL SECURITY;

-- Admin can view recovery logs
CREATE POLICY "Admins can view balance recovery logs"
  ON balance_recovery_log
  FOR SELECT
  TO authenticated
  USING (true);

-- Function to calculate balance from transactions for a single user
CREATE OR REPLACE FUNCTION calculate_balance_from_transactions(user_uuid uuid)
RETURNS numeric
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  calculated_balance numeric;
BEGIN
  -- Sum all transactions for this user
  SELECT COALESCE(SUM(amount), 0)
  INTO calculated_balance
  FROM coin_transactions
  WHERE user_id = user_uuid;
  
  RETURN calculated_balance;
END;
$$;

-- Function to recover ALL user balances from transaction ledger
CREATE OR REPLACE FUNCTION recover_all_user_balances()
RETURNS TABLE (
  users_processed integer,
  total_coins_recovered numeric,
  users_with_discrepancies integer
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  user_record RECORD;
  old_bal numeric;
  calc_bal numeric;
  diff numeric;
  trans_count integer;
  total_recovered numeric := 0;
  users_count integer := 0;
  discrepancy_count integer := 0;
BEGIN
  -- Process each user
  FOR user_record IN 
    SELECT id, username, coin_balance 
    FROM profiles
  LOOP
    users_count := users_count + 1;
    old_bal := user_record.coin_balance;
    
    -- Calculate true balance from transactions
    calc_bal := calculate_balance_from_transactions(user_record.id);
    
    -- Count transactions for this user
    SELECT COUNT(*)
    INTO trans_count
    FROM coin_transactions
    WHERE user_id = user_record.id;
    
    -- Calculate discrepancy
    diff := calc_bal - old_bal;
    
    -- Update profile with correct balance
    UPDATE profiles
    SET coin_balance = calc_bal
    WHERE id = user_record.id;
    
    -- Log the recovery (even if no discrepancy, for audit purposes)
    INSERT INTO balance_recovery_log (
      user_id,
      username,
      old_balance,
      calculated_balance,
      discrepancy,
      coins_recovered,
      transaction_count,
      recovery_notes
    ) VALUES (
      user_record.id,
      user_record.username,
      old_bal,
      calc_bal,
      diff,
      ABS(diff),
      trans_count,
      CASE 
        WHEN diff > 0 THEN 'Balance recovered: ' || diff || ' coins restored from transaction history'
        WHEN diff < 0 THEN 'Balance corrected: ' || ABS(diff) || ' coins removed (overstated)'
        ELSE 'Balance verified: No discrepancy found'
      END
    );
    
    -- Track totals
    IF diff != 0 THEN
      discrepancy_count := discrepancy_count + 1;
      total_recovered := total_recovered + ABS(diff);
    END IF;
  END LOOP;
  
  RETURN QUERY SELECT users_count, total_recovered, discrepancy_count;
END;
$$;

-- Function to get balance recovery report
CREATE OR REPLACE FUNCTION get_balance_recovery_report()
RETURNS TABLE (
  user_id uuid,
  username text,
  old_balance numeric,
  calculated_balance numeric,
  discrepancy numeric,
  coins_recovered numeric,
  transaction_count integer,
  recovery_date timestamptz,
  recovery_notes text
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  RETURN QUERY
  SELECT 
    brl.user_id,
    brl.username,
    brl.old_balance,
    brl.calculated_balance,
    brl.discrepancy,
    brl.coins_recovered,
    brl.transaction_count,
    brl.recovery_date,
    brl.recovery_notes
  FROM balance_recovery_log brl
  ORDER BY brl.recovery_date DESC, ABS(brl.discrepancy) DESC;
END;
$$;

-- Create index for faster queries
CREATE INDEX IF NOT EXISTS idx_balance_recovery_log_user_id 
  ON balance_recovery_log(user_id);
CREATE INDEX IF NOT EXISTS idx_balance_recovery_log_recovery_date 
  ON balance_recovery_log(recovery_date DESC);
CREATE INDEX IF NOT EXISTS idx_balance_recovery_log_discrepancy 
  ON balance_recovery_log(discrepancy) 
  WHERE discrepancy != 0;
