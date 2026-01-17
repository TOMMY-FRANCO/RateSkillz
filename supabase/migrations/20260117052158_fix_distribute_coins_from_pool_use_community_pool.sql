/*
  # Fix distribute_coins_from_pool to Use Community Pool

  ## Problem
  The distribute_coins_from_pool function is looking for coin_pool with hardcoded ID 
  '00000000-0000-0000-0000-000000000001' which doesn't exist. This causes "Coin pool not initialized" error.

  ## Solution
  Update the function to find the community pool by pool_type='community' instead of hardcoded ID.
  The actual community pool ID is dynamic and should be looked up by type.

  ## Changes
  - Update distribute_coins_from_pool to SELECT FROM coin_pool WHERE pool_type='community'
  - This matches the existing pool structure with type-based lookups
*/

-- Fix distribute_coins_from_pool function to use community pool type
CREATE OR REPLACE FUNCTION distribute_coins_from_pool(
  p_user_id uuid,
  p_amount numeric,
  p_source text,
  p_description text
)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_pool_remaining numeric;
  v_pool_id uuid;
  v_result json;
BEGIN
  -- Get the community pool ID and check remaining coins
  SELECT 
    id,
    (total_coins - distributed_coins) 
  INTO v_pool_id, v_pool_remaining
  FROM coin_pool
  WHERE pool_type = 'community'
  FOR UPDATE;

  IF v_pool_id IS NULL THEN
    RAISE EXCEPTION 'Coin pool not initialized';
  END IF;

  IF v_pool_remaining < p_amount THEN
    RAISE EXCEPTION 'Insufficient coins in pool. Available: %, Requested: %', v_pool_remaining, p_amount;
  END IF;

  -- Mark coins as distributed from pool
  UPDATE coin_pool
  SET 
    distributed_coins = distributed_coins + p_amount,
    remaining_coins = remaining_coins - p_amount,
    updated_at = now()
  WHERE id = v_pool_id;

  -- Record the transaction (trigger will update user balance automatically)
  INSERT INTO coin_transactions (user_id, amount, transaction_type, description)
  VALUES (p_user_id, p_amount, p_source, p_description);

  v_result := json_build_object(
    'success', true,
    'amount', p_amount,
    'pool_remaining', v_pool_remaining - p_amount
  );

  RETURN v_result;

EXCEPTION WHEN OTHERS THEN
  RAISE EXCEPTION 'Failed to distribute coins: %', SQLERRM;
END;
$$;

-- Update function comment
COMMENT ON FUNCTION distribute_coins_from_pool(uuid, numeric, text, text) IS
'Distributes coins from the community rewards pool to a user. Looks up pool by type=community. Triggers handle balance updates automatically.';

-- Log the fix
DO $$
BEGIN
  RAISE NOTICE '════════════════════════════════════════════════════════';
  RAISE NOTICE '✅ FIXED: distribute_coins_from_pool Function';
  RAISE NOTICE '════════════════════════════════════════════════════════';
  RAISE NOTICE '';
  RAISE NOTICE 'Changes Applied:';
  RAISE NOTICE '  ✓ Now uses pool_type=community instead of hardcoded ID';
  RAISE NOTICE '  ✓ Properly updates remaining_coins column';
  RAISE NOTICE '  ✓ Works with restructured coin pool system';
  RAISE NOTICE '';
  RAISE NOTICE '════════════════════════════════════════════════════════';
END $$;
