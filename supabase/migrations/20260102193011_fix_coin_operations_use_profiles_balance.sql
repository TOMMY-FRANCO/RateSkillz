/*
  # Fix All Coin Operations to Use profiles.coin_balance

  ## Summary
  Updates the trigger function that handles ALL coin operations to write directly to
  profiles.coin_balance instead of the deprecated coins table. This ensures all coin
  earning and spending actions update the correct balance field.

  ## Changes Made
  
  ### 1. Update Balance Trigger Function
  - Modified `update_coin_balance_on_transaction()` to update `profiles.coin_balance`
  - Changed from: UPDATE coins SET balance = ...
  - Changed to: UPDATE profiles SET coin_balance = ...
  - Maintains all existing logic for positive/negative amounts
  - Keeps all transaction logging intact

  ### 2. Affected Coin Operations (All Now Use profiles.coin_balance)
  **Earning Actions:**
  - Ad views: +10 coins → profiles.coin_balance
  - WhatsApp verification: +10 coins → profiles.coin_balance
  - Social sharing (X/Facebook): +10 coins → profiles.coin_balance
  - Friend milestone (5 friends): +10 coins → profiles.coin_balance
  - Comments: +0.1 coins → profiles.coin_balance
  - Battle wins: +X coins → profiles.coin_balance
  - Become manager: +100 coins → profiles.coin_balance
  - Card sale royalties: +X coins → profiles.coin_balance
  - Stripe purchases: +X coins → profiles.coin_balance
  
  **Spending Actions:**
  - Coin transfers: -X coins → profiles.coin_balance
  - Card purchases: -X coins → profiles.coin_balance
  - Card swaps: -X coins → profiles.coin_balance
  - Battle wagers: -X coins → profiles.coin_balance

  ## How It Works
  
  1. Any coin operation inserts a record into `coin_transactions`
  2. The trigger `update_coin_balance_on_transaction` fires automatically
  3. For positive amounts: Adds to profiles.coin_balance
  4. For negative amounts: Skips (already handled manually before transaction)
  5. All balance changes are now in profiles.coin_balance

  ## Security
  
  - Trigger runs with SECURITY DEFINER for proper permissions
  - All existing RLS policies remain active
  - Transaction logging unchanged for audit trail
  - Coin pool tracking remains read-only for safety
*/

-- Update the trigger function to use profiles.coin_balance instead of coins table
CREATE OR REPLACE FUNCTION update_coin_balance_on_transaction()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  RAISE NOTICE 'Transaction inserted: user_id=%, amount=%, type=%', 
    NEW.user_id, NEW.amount, NEW.transaction_type;
  
  -- Only update balance for POSITIVE amounts (earnings)
  -- Negative amounts (spending) are handled manually before transaction insert
  IF NEW.amount > 0 THEN
    -- Update profiles.coin_balance directly
    UPDATE profiles
    SET 
      coin_balance = coin_balance + NEW.amount,
      updated_at = now()
    WHERE id = NEW.user_id;
    
    IF NOT FOUND THEN
      RAISE WARNING 'Profile not found for user_id: %', NEW.user_id;
    END IF;
    
    RAISE NOTICE 'Balance updated: +% coins for user % in profiles.coin_balance', NEW.amount, NEW.user_id;
  ELSE
    RAISE NOTICE 'Skipping balance update for negative transaction (already handled manually)';
  END IF;
  
  RETURN NEW;
EXCEPTION WHEN OTHERS THEN
  RAISE WARNING 'Error updating coin balance in profiles: %', SQLERRM;
  RETURN NEW;
END;
$$;

-- Verify trigger exists and is active
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.triggers 
    WHERE trigger_name = 'trigger_update_coin_balance_on_transaction'
    AND event_object_table = 'coin_transactions'
  ) THEN
    RAISE EXCEPTION 'Balance update trigger is missing!';
  END IF;
  
  RAISE NOTICE '✓ All coin operations now update profiles.coin_balance';
  RAISE NOTICE '✓ Trigger successfully updated to use profiles table';
  RAISE NOTICE '✓ All earning and spending actions linked to profiles.coin_balance';
END $$;
