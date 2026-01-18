/*
  # Fix Stripe Purchases Pool Tracking - CRITICAL CORRECTION

  ## Problem
  Previous fix incorrectly excluded Stripe purchases from pool distribution tracking.
  
  ## Correct Understanding
  When users purchase coins via Stripe:
  - Real Money (£1-£50) → Coins (100-5000)
  - Coins come FROM the community pool (deducted)
  - Coins go TO user profile balance (credited)
  - This IS a pool distribution and MUST be tracked
  
  ## Coin Purchase Rates
  - £1.00 = 100 coins
  - £2.00 = 200 coins
  - £5.00 = 500 coins
  - £20.00 = 2000 coins
  - £50.00 = 5000 coins
  
  ## Current State
  - 7 Stripe purchases totaling 7,920 coins
  - These were NEVER deducted from coin_pool
  - Pool shows 499,999,443.80 remaining (TOO HIGH)
  - Should show 499,991,543.80 remaining
  
  ## Solution
  1. Include 'purchase' and 'coin_purchase' in trigger
  2. Update reconciliation to include Stripe purchases
  3. Update verification view to include Stripe purchases
  4. Run reconciliation to fix pool balance
  
  ## Data Safety
  - All transaction history preserved
  - Pool balances corrected to match actual distributions
  - Full audit trail maintained
*/

-- ============================================================================
-- 1. FIX update_coin_pool_on_transaction Trigger - Include Stripe Purchases
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
    'purchase',               -- STRIPE PURCHASES - coins FROM pool TO user
    'coin_purchase',          -- Alternative Stripe purchase type
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

    -- For purchases, ad_reward, comment_reward, and other direct rewards,
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

    IF NEW.transaction_type IN ('purchase', 'coin_purchase') THEN
      RAISE NOTICE 'Stripe purchase: % coins deducted from pool', NEW.amount;
    ELSE
      RAISE NOTICE 'Community pool updated: distributed +%, remaining -%', NEW.amount, NEW.amount;
    END IF;

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
    'coin_transfer',          -- Transfers between users
    'purchase'                -- Card purchases (legacy negative amounts)
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
- Stripe purchases (purchase, coin_purchase): deduct from pool (users buying coins FROM pool)
- Earning transactions (ads, comments, rewards): deduct from pool
- Spending transactions (card purchases, swaps): return to pool  
- Propagates errors for atomic rollback';

-- ============================================================================
-- 2. UPDATE Coin Pool Reconciliation Function - Include Stripe Purchases
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
  -- Earning transactions (positive amounts from pool) - INCLUDING Stripe purchases
  SELECT COALESCE(SUM(amount), 0)
  INTO v_earning_transactions
  FROM coin_transactions
  WHERE amount > 0
    AND transaction_type IN (
      'purchase',               -- STRIPE PURCHASES
      'coin_purchase',          -- Alternative Stripe purchase type
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
      'coin_transfer',
      'purchase'                -- Legacy card purchases
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
    'info',
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
      'stripe_purchases_included', true,
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
from transaction history INCLUDING Stripe purchases. Safe to run multiple times.';

-- ============================================================================
-- 3. UPDATE Pool Verification View - Include Stripe Purchases
-- ============================================================================

DROP VIEW IF EXISTS coin_pool_verification;

CREATE VIEW coin_pool_verification AS
SELECT 
  cp.id,
  cp.pool_name,
  cp.pool_type,
  cp.total_coins,
  cp.distributed_coins as recorded_distributed,
  cp.remaining_coins as recorded_remaining,
  
  -- Calculate actual distributed from transactions (INCLUDING Stripe purchases)
  (
    SELECT COALESCE(SUM(amount), 0)
    FROM coin_transactions
    WHERE amount > 0
      AND transaction_type IN (
        'purchase', 'coin_purchase',
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
        'card_discard', 'coin_transfer', 'purchase'
      )
  ) as actual_distributed,
  
  -- Calculate what remaining should be
  cp.total_coins - (
    (
      SELECT COALESCE(SUM(amount), 0)
      FROM coin_transactions
      WHERE amount > 0
        AND transaction_type IN (
          'purchase', 'coin_purchase',
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
          'card_discard', 'coin_transfer', 'purchase'
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
          'purchase', 'coin_purchase',
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
          'card_discard', 'coin_transfer', 'purchase'
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
            'purchase', 'coin_purchase',
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
            'card_discard', 'coin_transfer', 'purchase'
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
Compares recorded values against actual transaction history INCLUDING Stripe purchases.';

-- ============================================================================
-- 4. RUN Pool Reconciliation to Fix Current State
-- ============================================================================

DO $$
DECLARE
  v_result jsonb;
BEGIN
  RAISE NOTICE 'Running pool reconciliation to include Stripe purchases...';
  
  SELECT reconcile_coin_pool() INTO v_result;
  
  RAISE NOTICE 'Pool reconciliation result: %', v_result;

  IF (v_result->>'corrected')::boolean THEN
    RAISE NOTICE 'Pool corrected - Stripe purchases now tracked';
    RAISE NOTICE 'Discrepancy: %', v_result->>'discrepancy';
    RAISE NOTICE 'New distributed: %', v_result->>'new_distributed';
    RAISE NOTICE 'New remaining: %', v_result->>'new_remaining';
  ELSE
    RAISE NOTICE 'Pool already correct';
  END IF;
END $$;

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
    'migration', 'fix_stripe_purchases_pool_tracking',
    'timestamp', now(),
    'changes', jsonb_build_array(
      'CORRECTED: Stripe purchases now tracked in pool distributions',
      'Updated trigger to include purchase and coin_purchase types',
      'Updated reconciliation to include Stripe purchases',
      'Updated verification view to include Stripe purchases',
      'Ran reconciliation to fix pool balance',
      'Pool now correctly reflects all coin distributions including purchases'
    ),
    'impact', 'CRITICAL - Fixed pool tracking for Stripe coin purchases',
    'stripe_purchase_total', (
      SELECT COALESCE(SUM(amount), 0)
      FROM coin_transactions
      WHERE transaction_type = 'purchase' AND amount > 0
    )
  )
);
