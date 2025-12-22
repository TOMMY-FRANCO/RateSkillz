/*
  # Complete Coin Balance System - Fix Missing Balance Updates
  
  1. Problem Identified
    - coins table doesn't exist - balances can't be stored
    - Transactions record in coin_transactions but balances never update
    - Users have earned 80.10 coins total but have no spendable balance
    - No automatic triggers to update balances on transaction insert
  
  2. Solution
    - Create coins table to store user balances
    - Create trigger to automatically update balance on transaction insert
    - Create trigger to automatically update coin_pool distributed amount
    - Backfill all existing transactions to set correct balances
  
  3. Tables Created
    - coins: stores each user's coin balance
      - user_id (FK to profiles, unique)
      - balance (decimal, always >= 0)
      - created_at, updated_at
  
  4. Triggers Created
    - update_coin_balance_on_transaction: Updates user balance automatically
    - update_coin_pool_on_transaction: Updates global pool tracking
  
  5. Security
    - Enable RLS on coins table
    - Users can read own balance
    - Only system can update balances (via triggers)
*/

-- Create coins table to store user balances
CREATE TABLE IF NOT EXISTS coins (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES profiles(id) ON DELETE CASCADE UNIQUE NOT NULL,
  balance numeric(10, 2) DEFAULT 0.00 NOT NULL CHECK (balance >= 0),
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Create index for fast lookups
CREATE INDEX IF NOT EXISTS idx_coins_user_id ON coins(user_id);

-- Enable RLS
ALTER TABLE coins ENABLE ROW LEVEL SECURITY;

-- Users can read their own balance
CREATE POLICY "Users can view own coin balance"
  ON coins FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

-- Only triggers/system can update (no direct user updates)
CREATE POLICY "System can manage coin balances"
  ON coins FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

-- Create function to update user balance when transaction is inserted
CREATE OR REPLACE FUNCTION update_coin_balance_on_transaction()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  RAISE NOTICE 'Transaction inserted: user_id=%, amount=%, type=%', 
    NEW.user_id, NEW.amount, NEW.transaction_type;
  
  -- Insert or update the user's balance
  INSERT INTO coins (user_id, balance, created_at, updated_at)
  VALUES (NEW.user_id, NEW.amount, now(), now())
  ON CONFLICT (user_id) 
  DO UPDATE SET 
    balance = coins.balance + NEW.amount,
    updated_at = now();
  
  RAISE NOTICE 'Balance updated for user %', NEW.user_id;
  
  RETURN NEW;
EXCEPTION WHEN OTHERS THEN
  RAISE WARNING 'Error updating coin balance: %', SQLERRM;
  RETURN NEW;
END;
$$;

-- Create trigger on coin_transactions to auto-update balances
DROP TRIGGER IF EXISTS trigger_update_coin_balance_on_transaction ON coin_transactions;
CREATE TRIGGER trigger_update_coin_balance_on_transaction
  AFTER INSERT ON coin_transactions
  FOR EACH ROW
  EXECUTE FUNCTION update_coin_balance_on_transaction();

-- Create function to update coin pool when coins are distributed
CREATE OR REPLACE FUNCTION update_coin_pool_on_transaction()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  -- Only update pool for positive amounts (earnings, not spending)
  IF NEW.amount > 0 THEN
    UPDATE coin_pool
    SET 
      distributed_coins = distributed_coins + NEW.amount,
      remaining_coins = total_coins - (distributed_coins + NEW.amount),
      updated_at = now()
    WHERE id = (SELECT id FROM coin_pool LIMIT 1);
    
    RAISE NOTICE 'Coin pool updated: +% coins distributed', NEW.amount;
  END IF;
  
  RETURN NEW;
EXCEPTION WHEN OTHERS THEN
  RAISE WARNING 'Error updating coin pool: %', SQLERRM;
  RETURN NEW;
END;
$$;

-- Create trigger on coin_transactions to auto-update pool
DROP TRIGGER IF EXISTS trigger_update_coin_pool_on_transaction ON coin_transactions;
CREATE TRIGGER trigger_update_coin_pool_on_transaction
  AFTER INSERT ON coin_transactions
  FOR EACH ROW
  EXECUTE FUNCTION update_coin_pool_on_transaction();

-- Backfill balances for all existing transactions
DO $$
DECLARE
  v_user RECORD;
  v_total_balance numeric;
BEGIN
  RAISE NOTICE '========================================';
  RAISE NOTICE 'BACKFILLING COIN BALANCES FROM EXISTING TRANSACTIONS';
  RAISE NOTICE '========================================';
  
  -- For each user with transactions, calculate their total balance
  FOR v_user IN 
    SELECT 
      user_id,
      SUM(amount) as total_earned,
      COUNT(*) as transaction_count
    FROM coin_transactions
    GROUP BY user_id
  LOOP
    RAISE NOTICE 'Processing user %: % coins from % transactions', 
      v_user.user_id, v_user.total_earned, v_user.transaction_count;
    
    -- Insert or update their balance
    INSERT INTO coins (user_id, balance, created_at, updated_at)
    VALUES (v_user.user_id, v_user.total_earned, now(), now())
    ON CONFLICT (user_id)
    DO UPDATE SET 
      balance = v_user.total_earned,
      updated_at = now();
    
    RAISE NOTICE '✓ Balance set to % for user %', v_user.total_earned, v_user.user_id;
  END LOOP;
  
  RAISE NOTICE '========================================';
  RAISE NOTICE 'BACKFILL COMPLETE';
  RAISE NOTICE '========================================';
END $$;

-- Fix coin pool to match actual distributed amount
DO $$
DECLARE
  v_actual_distributed numeric;
BEGIN
  -- Calculate actual distributed coins from all positive transactions
  SELECT COALESCE(SUM(amount), 0)
  INTO v_actual_distributed
  FROM coin_transactions
  WHERE amount > 0;
  
  RAISE NOTICE 'Actual distributed coins: %', v_actual_distributed;
  
  -- Update coin pool to match
  UPDATE coin_pool
  SET 
    distributed_coins = v_actual_distributed,
    remaining_coins = total_coins - v_actual_distributed,
    updated_at = now()
  WHERE id = (SELECT id FROM coin_pool LIMIT 1);
  
  RAISE NOTICE 'Coin pool corrected to: % distributed, % remaining', 
    v_actual_distributed, (1000000000 - v_actual_distributed);
END $$;

-- Create function to get user's coin balance (helper for frontend)
CREATE OR REPLACE FUNCTION get_user_coin_balance(target_user_id uuid)
RETURNS numeric
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_balance numeric;
BEGIN
  SELECT COALESCE(balance, 0)
  INTO v_balance
  FROM coins
  WHERE user_id = target_user_id;
  
  RETURN COALESCE(v_balance, 0);
END;
$$;

-- Create function to get coin pool stats (for frontend display)
CREATE OR REPLACE FUNCTION get_coin_pool_stats()
RETURNS TABLE (
  total_coins bigint,
  distributed_coins bigint,
  remaining_coins bigint,
  distribution_percentage numeric
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  RETURN QUERY
  SELECT 
    cp.total_coins,
    cp.distributed_coins,
    cp.remaining_coins,
    ROUND((cp.distributed_coins::numeric / cp.total_coins::numeric) * 100, 4) as distribution_percentage
  FROM coin_pool cp
  LIMIT 1;
END;
$$;
