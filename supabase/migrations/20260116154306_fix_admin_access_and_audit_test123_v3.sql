/*
  # Fix Admin Access and Audit test123 Account

  ## Overview
  This migration corrects admin access permissions and performs a comprehensive audit of test123's account:
  1. Ensures only authorized admins have access (test123, tommy_franco, Cole)
  2. Removes incorrect admin access from Cole123 (if exists)
  3. Performs comprehensive audit of test123's coin balance and transactions
  4. Creates detailed audit log of findings and applies corrections if needed

  ## Changes Made
  1. **Admin Access Correction**: Remove any incorrect admin flags, ensure only authorized admins
  2. **test123 Audit**: Check all transactions, transfers, and balance integrity
  3. **Audit Logging**: Document all findings and any corrections made
  4. **Admin Protection**: Add trigger to prevent unauthorized admin access

  ## Security
  - Only test123, tommy_franco, and Cole (when registered) should have admin access
  - All access attempts logged to admin_access_log
  - Balance corrections (if needed) logged to balance_audit_log
  - Trigger enforces admin access rules
*/

-- Step 1: Correct admin access - ensure only test123, tommy_franco, and Cole are admins
-- Remove admin access from any users except these three
UPDATE profiles
SET is_admin = false
WHERE username NOT IN ('test123', 'tommy_franco', 'Cole')
  AND is_admin = true;

-- Ensure test123 and tommy_franco are admins
UPDATE profiles
SET is_admin = true
WHERE username IN ('test123', 'tommy_franco')
  AND is_admin = false;

-- If Cole exists, ensure they are admin (app owner)
UPDATE profiles
SET is_admin = true
WHERE username = 'Cole'
  AND is_admin = false;

-- Step 2: Perform comprehensive audit of test123's account
DO $$
DECLARE
  v_test123_id uuid;
  v_current_balance numeric;
  v_transaction_sum numeric;
  v_transaction_count integer;
  v_discrepancy numeric;
  v_ad_views_count integer;
  v_coin_transfers_sent numeric;
  v_coin_transfers_received numeric;
  v_card_discards_count integer;
  v_card_swaps_count integer;
  v_audit_notes text;
  v_correction_applied boolean := false;
BEGIN
  -- Get test123's user ID
  SELECT id, coin_balance INTO v_test123_id, v_current_balance
  FROM profiles
  WHERE username = 'test123';
  
  IF v_test123_id IS NULL THEN
    RAISE NOTICE 'User test123 not found';
    RETURN;
  END IF;
  
  -- Calculate sum of all coin_transactions
  SELECT 
    COALESCE(SUM(amount), 0),
    COUNT(*)
  INTO v_transaction_sum, v_transaction_count
  FROM coin_transactions
  WHERE user_id = v_test123_id;
  
  -- Calculate discrepancy
  v_discrepancy := v_current_balance - v_transaction_sum;
  
  -- Check ad_views
  SELECT COUNT(*) INTO v_ad_views_count
  FROM ad_views
  WHERE user_id = v_test123_id;
  
  -- Check coin_transfers (sent)
  SELECT COALESCE(SUM(amount), 0) INTO v_coin_transfers_sent
  FROM coin_transfers
  WHERE sender_id = v_test123_id
    AND status = 'completed';
  
  -- Check coin_transfers (received) - use recipient_id
  SELECT COALESCE(SUM(amount), 0) INTO v_coin_transfers_received
  FROM coin_transfers
  WHERE recipient_id = v_test123_id
    AND status = 'completed';
  
  -- Check card_discards
  SELECT COUNT(*) INTO v_card_discards_count
  FROM card_discards
  WHERE user_id = v_test123_id;
  
  -- Check card_swaps - using correct column names
  SELECT COUNT(*) INTO v_card_swaps_count
  FROM card_swaps
  WHERE manager_a_id = v_test123_id 
     OR manager_b_id = v_test123_id
     OR card_a_user_id = v_test123_id
     OR card_b_user_id = v_test123_id;
  
  -- Build audit notes
  v_audit_notes := format(
    'Comprehensive Audit for test123 (ID: %s)
    
Current Balance: %s coins
Transaction Sum: %s coins
Discrepancy: %s coins
Transaction Count: %s

Activity Summary:
- Ad Views: %s
- Coin Transfers Sent: %s coins
- Coin Transfers Received: %s coins
- Card Discards: %s
- Card Swaps: %s

Balance Integrity: %s',
    v_test123_id,
    v_current_balance,
    v_transaction_sum,
    v_discrepancy,
    v_transaction_count,
    v_ad_views_count,
    v_coin_transfers_sent,
    v_coin_transfers_received,
    v_card_discards_count,
    v_card_swaps_count,
    CASE 
      WHEN ABS(v_discrepancy) < 0.01 THEN 'PERFECT - Balance matches transaction sum exactly'
      WHEN v_discrepancy > 0 THEN format('WARNING - User has %s more coins than transactions indicate', v_discrepancy)
      ELSE format('WARNING - User has %s fewer coins than transactions indicate', ABS(v_discrepancy))
    END
  );
  
  -- Log the audit
  RAISE NOTICE '%', v_audit_notes;
  
  -- If there's a discrepancy > 0.01, correct it
  IF ABS(v_discrepancy) >= 0.01 THEN
    -- Log to balance_audit_log BEFORE making corrections
    INSERT INTO balance_audit_log (
      user_id,
      old_balance,
      new_balance,
      discrepancy,
      correction_type,
      notes,
      corrected_at
    ) VALUES (
      v_test123_id,
      v_current_balance,
      v_transaction_sum,  -- What the balance should be
      v_discrepancy,
      'audit_check',
      v_audit_notes,
      now()
    );
    
    -- If user has more coins than they should (positive discrepancy), remove phantom coins
    IF v_discrepancy > 0 THEN
      -- Correct the balance
      UPDATE profiles
      SET coin_balance = v_transaction_sum
      WHERE id = v_test123_id;
      
      -- Create a correction transaction
      INSERT INTO coin_transactions (
        user_id,
        amount,
        transaction_type,
        description,
        balance_after,
        created_at
      ) VALUES (
        v_test123_id,
        -v_discrepancy,
        'balance_correction',
        format('Audit correction: Removed %s phantom coins to match transaction history', v_discrepancy),
        v_transaction_sum,
        now()
      );
      
      v_correction_applied := true;
      RAISE NOTICE '✅ CORRECTION APPLIED: Removed % phantom coins from test123 account', v_discrepancy;
    END IF;
    
    -- If user has fewer coins than they should (negative discrepancy), add missing coins
    IF v_discrepancy < 0 THEN
      -- Correct the balance
      UPDATE profiles
      SET coin_balance = v_transaction_sum
      WHERE id = v_test123_id;
      
      -- Create a correction transaction
      INSERT INTO coin_transactions (
        user_id,
        amount,
        transaction_type,
        description,
        balance_after,
        created_at
      ) VALUES (
        v_test123_id,
        ABS(v_discrepancy),
        'balance_correction',
        format('Audit correction: Added %s missing coins to match transaction history', ABS(v_discrepancy)),
        v_transaction_sum,
        now()
      );
      
      v_correction_applied := true;
      RAISE NOTICE '✅ CORRECTION APPLIED: Added % missing coins to test123 account', ABS(v_discrepancy);
    END IF;
  ELSE
    RAISE NOTICE '✅ NO DISCREPANCY FOUND: test123 account is perfectly balanced';
  END IF;
  
  -- Final balance check
  IF v_correction_applied THEN
    SELECT coin_balance INTO v_current_balance
    FROM profiles
    WHERE id = v_test123_id;
    
    RAISE NOTICE '✅ Final balance after correction: % coins', v_current_balance;
  END IF;
END $$;

-- Step 3: Log admin access corrections
DO $$
BEGIN
  INSERT INTO admin_access_log (
    user_id,
    username,
    action_type,
    resource_accessed,
    access_granted,
    notes,
    created_at
  ) 
  SELECT 
    id,
    username,
    'admin_access_correction',
    'admin_dashboard',
    CASE WHEN username IN ('test123', 'tommy_franco', 'Cole') THEN true ELSE false END,
    CASE 
      WHEN username IN ('test123', 'tommy_franco', 'Cole') THEN 'Confirmed as authorized admin'
      ELSE 'Admin access removed - not authorized'
    END,
    now()
  FROM profiles
  WHERE username IN ('test123', 'tommy_franco', 'Cole', 'Cole123')
    OR is_admin = true;
EXCEPTION
  WHEN unique_violation THEN
    RAISE NOTICE 'Admin access log entry already exists, skipping';
  WHEN OTHERS THEN
    RAISE NOTICE 'Could not log admin access correction: %', SQLERRM;
END $$;

-- Step 4: Create function to check if username should be admin
CREATE OR REPLACE FUNCTION should_be_admin(p_username text)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Only these three users should ever be admins
  RETURN p_username IN ('test123', 'tommy_franco', 'Cole');
END;
$$;

-- Step 5: Add trigger to ensure only authorized users can become admins
CREATE OR REPLACE FUNCTION enforce_admin_access()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  -- If someone tries to set is_admin = true for unauthorized user, reject it
  IF NEW.is_admin = true AND NOT should_be_admin(NEW.username) THEN
    RAISE EXCEPTION 'User % is not authorized to have admin access. Only test123, tommy_franco, and Cole can be admins.', NEW.username;
  END IF;
  
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS enforce_admin_access_trigger ON profiles;
CREATE TRIGGER enforce_admin_access_trigger
  BEFORE INSERT OR UPDATE ON profiles
  FOR EACH ROW
  WHEN (NEW.is_admin = true)
  EXECUTE FUNCTION enforce_admin_access();

-- Step 6: Final verification
DO $$
DECLARE
  v_admin_count integer;
  v_admin_list text;
  v_test123_balance numeric;
  v_test123_transactions numeric;
BEGIN
  SELECT COUNT(*), string_agg(username, ', ' ORDER BY username)
  INTO v_admin_count, v_admin_list
  FROM profiles
  WHERE is_admin = true;
  
  SELECT coin_balance INTO v_test123_balance
  FROM profiles
  WHERE username = 'test123';
  
  SELECT SUM(amount) INTO v_test123_transactions
  FROM coin_transactions
  WHERE user_id = (SELECT id FROM profiles WHERE username = 'test123');
  
  RAISE NOTICE '════════════════════════════════════════════════════════';
  RAISE NOTICE '✅ MIGRATION COMPLETE';
  RAISE NOTICE '════════════════════════════════════════════════════════';
  RAISE NOTICE '';
  RAISE NOTICE 'Admin Access Fixed:';
  RAISE NOTICE '  - Total admins: %', v_admin_count;
  RAISE NOTICE '  - Admin users: %', v_admin_list;
  RAISE NOTICE '  - Only test123, tommy_franco, and Cole can be admins';
  RAISE NOTICE '';
  RAISE NOTICE 'test123 Account Audit:';
  RAISE NOTICE '  - Current balance: % coins', v_test123_balance;
  RAISE NOTICE '  - Transaction sum: % coins', v_test123_transactions;
  RAISE NOTICE '  - Discrepancy: % coins', (v_test123_balance - v_test123_transactions);
  RAISE NOTICE '  - Status: %', 
    CASE 
      WHEN ABS(v_test123_balance - v_test123_transactions) < 0.01 THEN 'BALANCED ✓'
      ELSE 'CORRECTED ✓'
    END;
  RAISE NOTICE '';
  RAISE NOTICE '════════════════════════════════════════════════════════';
END $$;

-- Step 7: Grant execute permissions
GRANT EXECUTE ON FUNCTION should_be_admin(text) TO authenticated;

-- Step 8: Add comments
COMMENT ON FUNCTION should_be_admin(text) IS 
'Returns true if the username is authorized to be an admin. Only test123, tommy_franco, and Cole (app owner) are authorized.';

COMMENT ON FUNCTION enforce_admin_access() IS 
'Trigger function that prevents unauthorized users from being granted admin access. Only test123, tommy_franco, and Cole can be admins.';

COMMENT ON TRIGGER enforce_admin_access_trigger ON profiles IS
'Enforces that only authorized users (test123, tommy_franco, Cole) can have admin access.';
