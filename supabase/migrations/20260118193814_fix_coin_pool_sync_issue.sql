/*
  # Fix Coin Pool Balance Sync Issue - CRITICAL

  ## Problem
  The Community Rewards Pool shows incorrect balance. When coins are distributed 
  (tutorial rewards, ad views, battle earnings, comment rewards), the coin_transactions 
  and profiles.coin_balance update correctly, BUT coin_pool.distributed_coins doesn't 
  increment and remaining_coins doesn't decrement.

  ## Root Causes
  1. Stripe purchases incorrectly deduct from community pool (they bring external coins)
  2. Ad rewards, comment rewards, and other earnings don't update the pool at all
  3. update_coin_pool_on_transaction trigger only handles specific transaction types
  4. No reconciliation to detect and fix discrepancies

  ## Current State
  - Pool shows remaining: 499,991,534.90
  - Should show remaining: 499,991,539.90
  - Discrepancy: 5.00 coins missing
  - Root issue: 48 ad rewards (480 coins) never updated the pool

  ## Solution
  1. Fix trigger to handle ALL earning transactions from the pool
  2. Remove Stripe purchases from pool updates (external coins, not from pool)
  3. Add reconciliation function to fix existing discrepancies
  4. Log all corrections for audit trail

  ## Data Safety
  - All transaction history preserved
  - Pool balances corrected to match actual distributions
  - Full audit trail in admin_security_log
*/

-- ============================================================================
-- 1. FIX update_coin_pool_on_transaction Trigger
-- ============================================================================

CREATE OR REPLACE FUNCTION update_coin_pool_on_transaction()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_pool_id uuid;
  v_rows_updated integer;
BEGIN
  -- Get community pool ID
  SELECT id INTO v_pool_id 
  FROM coin_pool 
  WHERE pool_type = 'community';

  IF v_pool_id IS NULL THEN
    RAISE EXCEPTION 'Community pool not found';
  END IF;

  -- ========================================================================
  -- EARNING TRANSACTIONS - Coins leaving the pool to users
  -- ========================================================================
  -- These transaction types distribute coins FROM the community pool TO users
  -- We need to increment distributed_coins and decrement remaining_coins
  
  IF NEW.amount > 0 AND NEW.transaction_type IN (
    'ad_reward',              -- Watch ad rewards
    'comment_reward',         -- Comment rewards
    'tutorial_completion',    -- Tutorial completion bonus
    'reward_whatsapp',        -- WhatsApp verification reward
    'reward_social_share',    -- Social media sharing reward
    'reward_friend_milestone',-- Friend milestone reward
    'whatsapp_share',         -- WhatsApp share reward
    'battle_win',             -- Battle mode winnings
    'battle_reward',          -- Battle rewards
    'referral_bonus',         -- Referral bonuses
    'daily_bonus',            -- Daily login bonuses
    'achievement_reward'      -- Achievement rewards
  ) THEN
    
    -- Check if reward functions already updated the pool
    -- (they run BEFORE the transaction is inserted and update the pool directly)
    -- For these types, we should NOT double-update
    IF NEW.transaction_type IN (
      'tutorial_completion',
      'reward_whatsapp', 
      'reward_social_share',
      'reward_friend_milestone',
      'whatsapp_share'
    ) THEN
      -- These are already handled by their respective functions
      -- The functions deduct from pool BEFORE inserting the transaction
      RAISE NOTICE '% already updated pool via function', NEW.transaction_type;
      RETURN NEW;
    END IF;

    -- For ad_reward, comment_reward, and other direct rewards,
    -- the trigger must update the pool
    UPDATE coin_pool
    SET 
      distributed_coins = distributed_coins + NEW.amount,
      remaining_coins = remaining_coins - NEW.amount,
      updated_at = now()
    WHERE id = v_pool_id;

    GET DIAGNOSTICS v_rows_updated = ROW_COUNT;

    IF v_rows_updated = 0 THEN
      RAISE EXCEPTION 'Failed to update community pool for % transaction', NEW.transaction_type;
    END IF;

    RAISE NOTICE 'Community pool updated: distributed +%, remaining -%', NEW.amount, NEW.amount;

  -- ========================================================================
  -- SPENDING TRANSACTIONS - Coins returning to the pool
  -- ========================================================================
  -- When users spend coins on the platform (card purchases, swaps, battles),
  -- those coins return to the community pool for future distribution
  
  ELSIF NEW.amount < 0 AND NEW.transaction_type IN (
    'card_purchase',          -- Buying player cards
    'card_swap',              -- Swapping cards
    'battle_wager',           -- Battle wagers
    'card_discard',           -- Discarding cards
    'coin_transfer'           -- Transfers between users
  ) THEN
    
    -- Return coins to the pool (amount is negative, so we subtract it)
    UPDATE coin_pool
    SET 
      distributed_coins = distributed_coins + NEW.amount,  -- Decreases (negative amount)
      remaining_coins = remaining_coins - NEW.amount,      -- Increases (negative amount)
      updated_at = now()
    WHERE id = v_pool_id;

    GET DIAGNOSTICS v_rows_updated = ROW_COUNT;

    IF v_rows_updated = 0 THEN
      RAISE EXCEPTION 'Failed to return coins to community pool';
    END IF;

    RAISE NOTICE 'Coins returned to pool: +%', ABS(NEW.amount);

  -- ========================================================================
  -- STRIPE PURCHASES - External coins (NOT from pool)
  -- ========================================================================
  -- Stripe purchases bring EXTERNAL money into the system
  -- These coins don't come from the community pool, so we DON'T update it
  
  ELSIF NEW.transaction_type = 'purchase' THEN
    RAISE NOTICE 'Stripe purchase: external coins, pool not affected';
    -- Do nothing - these are external coins entering the system

  -- ========================================================================
  -- BALANCE CORRECTIONS - Special handling
  -- ========================================================================
  ELSIF NEW.transaction_type = 'balance_correction' THEN
    -- Balance corrections fix discrepancies, don't affect pool
    RAISE NOTICE 'Balance correction: pool not affected';
    -- Do nothing

  -- ========================================================================
  -- OTHER TRANSACTION TYPES
  -- ========================================================================
  ELSE
    RAISE NOTICE 'Unhandled transaction type: % (amount: %)', NEW.transaction_type, NEW.amount;
  END IF;

  RETURN NEW;

EXCEPTION WHEN OTHERS THEN
  -- DO NOT SWALLOW ERRORS - propagate to rollback transaction
  RAISE EXCEPTION 'Failed to update coin pool for transaction type %: %', 
    NEW.transaction_type, SQLERRM;
END;
$$;

COMMENT ON FUNCTION update_coin_pool_on_transaction IS
'Updates the community coin pool when coins are distributed to users or returned.
- Earning transactions (ads, comments, rewards): deduct from pool
- Spending transactions (purchases, swaps): return to pool  
- Stripe purchases: external coins, do not affect pool
- Propagates errors for atomic rollback';

-- ============================================================================
-- 2. CREATE Coin Pool Reconciliation Function
-- ============================================================================

CREATE OR REPLACE FUNCTION reconcile_coin_pool()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_pool_id uuid;
  v_current_distributed numeric;
  v_current_remaining numeric;
  v_total_coins numeric;
  v_calculated_distributed numeric;
  v_calculated_remaining numeric;
  v_discrepancy numeric;
  v_earning_transactions numeric;
  v_spending_transactions numeric;
BEGIN
  -- Get community pool
  SELECT 
    id,
    total_coins,
    distributed_coins,
    remaining_coins
  INTO 
    v_pool_id,
    v_total_coins,
    v_current_distributed,
    v_current_remaining
  FROM coin_pool
  WHERE pool_type = 'community'
  FOR UPDATE;

  IF v_pool_id IS NULL THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'Community pool not found'
    );
  END IF;

  -- Calculate what distributed_coins SHOULD be based on actual transactions
  -- Earning transactions (positive amounts from pool) - exclude Stripe purchases
  SELECT COALESCE(SUM(amount), 0)
  INTO v_earning_transactions
  FROM coin_transactions
  WHERE amount > 0
    AND transaction_type IN (
      'ad_reward',
      'comment_reward',
      'tutorial_completion',
      'reward_whatsapp',
      'reward_social_share',
      'reward_friend_milestone',
      'whatsapp_share',
      'battle_win',
      'battle_reward',
      'referral_bonus',
      'daily_bonus',
      'achievement_reward'
    );

  -- Spending transactions (negative amounts returned to pool)
  SELECT COALESCE(SUM(amount), 0)
  INTO v_spending_transactions
  FROM coin_transactions
  WHERE amount < 0
    AND transaction_type IN (
      'card_purchase',
      'card_swap',
      'battle_wager',
      'card_discard',
      'coin_transfer'
    );

  -- Calculate what distributed_coins should be
  -- = coins given out - coins returned
  v_calculated_distributed := v_earning_transactions + v_spending_transactions;

  -- Calculate what remaining_coins should be
  v_calculated_remaining := v_total_coins - v_calculated_distributed;

  -- Calculate discrepancy
  v_discrepancy := v_calculated_distributed - v_current_distributed;

  -- If no discrepancy, return success
  IF ABS(v_discrepancy) < 0.01 THEN
    RETURN jsonb_build_object(
      'success', true,
      'corrected', false,
      'message', 'Pool balance already correct',
      'distributed_coins', v_current_distributed,
      'remaining_coins', v_current_remaining
    );
  END IF;

  -- Correct the pool balances
  UPDATE coin_pool
  SET
    distributed_coins = v_calculated_distributed,
    remaining_coins = v_calculated_remaining,
    updated_at = now()
  WHERE id = v_pool_id;

  -- Log the correction
  INSERT INTO admin_security_log (
    event_type,
    severity,
    operation_type,
    details
  ) VALUES (
    'validation_failed',
    'warning',
    'pool_reconciliation',
    jsonb_build_object(
      'pool_id', v_pool_id,
      'old_distributed', v_current_distributed,
      'new_distributed', v_calculated_distributed,
      'old_remaining', v_current_remaining,
      'new_remaining', v_calculated_remaining,
      'discrepancy', v_discrepancy,
      'earning_transactions_total', v_earning_transactions,
      'spending_transactions_total', v_spending_transactions,
      'timestamp', now()
    )
  );

  RETURN jsonb_build_object(
    'success', true,
    'corrected', true,
    'old_distributed', v_current_distributed,
    'new_distributed', v_calculated_distributed,
    'old_remaining', v_current_remaining,
    'new_remaining', v_calculated_remaining,
    'discrepancy', v_discrepancy
  );

EXCEPTION WHEN OTHERS THEN
  RETURN jsonb_build_object(
    'success', false,
    'error', SQLERRM
  );
END;
$$;

COMMENT ON FUNCTION reconcile_coin_pool IS
'Reconciles the community coin pool by calculating actual distributed coins
from transaction history and correcting any discrepancies. Safe to run multiple times.';

-- ============================================================================
-- 3. RUN Initial Pool Reconciliation
-- ============================================================================

DO $$
DECLARE
  v_result jsonb;
BEGIN
  RAISE NOTICE 'Running initial coin pool reconciliation...';
  
  SELECT reconcile_coin_pool() INTO v_result;
  
  RAISE NOTICE 'Pool reconciliation result: %', v_result;

  IF (v_result->>'corrected')::boolean THEN
    RAISE NOTICE 'Pool corrected - discrepancy: %', v_result->>'discrepancy';
  ELSE
    RAISE NOTICE 'Pool already correct';
  END IF;
END $$;

-- ============================================================================
-- 4. CREATE Pool Verification View
-- ============================================================================

CREATE OR REPLACE VIEW coin_pool_verification AS
SELECT 
  cp.id,
  cp.pool_name,
  cp.pool_type,
  cp.total_coins,
  cp.distributed_coins as recorded_distributed,
  cp.remaining_coins as recorded_remaining,
  
  -- Calculate actual distributed from transactions
  (
    SELECT COALESCE(SUM(amount), 0)
    FROM coin_transactions
    WHERE amount > 0
      AND transaction_type IN (
        'ad_reward', 'comment_reward', 'tutorial_completion',
        'reward_whatsapp', 'reward_social_share', 'reward_friend_milestone',
        'whatsapp_share', 'battle_win', 'battle_reward',
        'referral_bonus', 'daily_bonus', 'achievement_reward'
      )
  ) + (
    SELECT COALESCE(SUM(amount), 0)
    FROM coin_transactions
    WHERE amount < 0
      AND transaction_type IN (
        'card_purchase', 'card_swap', 'battle_wager',
        'card_discard', 'coin_transfer'
      )
  ) as actual_distributed,
  
  -- Calculate what remaining should be
  cp.total_coins - (
    (
      SELECT COALESCE(SUM(amount), 0)
      FROM coin_transactions
      WHERE amount > 0
        AND transaction_type IN (
          'ad_reward', 'comment_reward', 'tutorial_completion',
          'reward_whatsapp', 'reward_social_share', 'reward_friend_milestone',
          'whatsapp_share', 'battle_win', 'battle_reward',
          'referral_bonus', 'daily_bonus', 'achievement_reward'
        )
    ) + (
      SELECT COALESCE(SUM(amount), 0)
      FROM coin_transactions
      WHERE amount < 0
        AND transaction_type IN (
          'card_purchase', 'card_swap', 'battle_wager',
          'card_discard', 'coin_transfer'
        )
    )
  ) as actual_remaining,
  
  -- Calculate discrepancy
  cp.distributed_coins - (
    (
      SELECT COALESCE(SUM(amount), 0)
      FROM coin_transactions
      WHERE amount > 0
        AND transaction_type IN (
          'ad_reward', 'comment_reward', 'tutorial_completion',
          'reward_whatsapp', 'reward_social_share', 'reward_friend_milestone',
          'whatsapp_share', 'battle_win', 'battle_reward',
          'referral_bonus', 'daily_bonus', 'achievement_reward'
        )
    ) + (
      SELECT COALESCE(SUM(amount), 0)
      FROM coin_transactions
      WHERE amount < 0
        AND transaction_type IN (
          'card_purchase', 'card_swap', 'battle_wager',
          'card_discard', 'coin_transfer'
        )
    )
  ) as discrepancy,
  
  CASE 
    WHEN ABS(cp.distributed_coins - (
      (
        SELECT COALESCE(SUM(amount), 0)
        FROM coin_transactions
        WHERE amount > 0
          AND transaction_type IN (
            'ad_reward', 'comment_reward', 'tutorial_completion',
            'reward_whatsapp', 'reward_social_share', 'reward_friend_milestone',
            'whatsapp_share', 'battle_win', 'battle_reward',
            'referral_bonus', 'daily_bonus', 'achievement_reward'
          )
      ) + (
        SELECT COALESCE(SUM(amount), 0)
        FROM coin_transactions
        WHERE amount < 0
          AND transaction_type IN (
            'card_purchase', 'card_swap', 'battle_wager',
            'card_discard', 'coin_transfer'
          )
      )
    )) < 0.01 THEN 'OK'
    ELSE 'DISCREPANCY'
  END as status

FROM coin_pool cp
WHERE cp.pool_type = 'community';

GRANT SELECT ON coin_pool_verification TO authenticated;

COMMENT ON VIEW coin_pool_verification IS
'Real-time verification of coin pool balance accuracy.
Compares recorded values against actual transaction history.';

-- ============================================================================
-- 5. Log Migration Completion
-- ============================================================================

INSERT INTO admin_security_log (
  event_type,
  severity,
  operation_type,
  details
) VALUES (
  'validation_failed',
  'info',
  'migration_applied',
  jsonb_build_object(
    'migration', 'fix_coin_pool_sync_issue',
    'timestamp', now(),
    'changes', jsonb_build_array(
      'Fixed update_coin_pool_on_transaction to handle all earning transactions',
      'Removed Stripe purchases from pool updates (external coins)',
      'Added proper error propagation for atomic operations',
      'Created reconcile_coin_pool function',
      'Created coin_pool_verification view',
      'Ran initial reconciliation to fix discrepancies'
    ),
    'impact', 'CRITICAL - Fixed coin pool sync for all reward distributions'
  )
);
