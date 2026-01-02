/*
  # Fix Coin Pool Display to Calculate from profiles.coin_balance

  ## Summary
  Updates the `get_coin_pool_stats()` function to calculate distributed coins from the
  sum of all user balances in profiles.coin_balance. This ensures the pool display shows
  the true distributed amount based on actual user balances.

  ## Changes Made
  
  ### 1. Update get_coin_pool_stats() Function
  - Changed from: Reading `distributed_coins` from coin_pool table
  - Changed to: Calculating SUM(coin_balance) from profiles table
  - Total pool: Still 1,000,000,000 (constant)
  - Distributed: SUM of all profiles.coin_balance (actual distributed amount)
  - Remaining: total_coins - distributed (calculated)
  - Distribution percentage: (distributed / total) * 100

  ## How It Works
  
  **Coin Pool Distribution Display:**
  - Total Pool: 1,000,000,000 (fixed)
  - Distributed to Users: SUM(profiles.coin_balance) (real-time calculation)
  - Available: 1,000,000,000 - SUM(profiles.coin_balance) (calculated)
  - Percentage: Shows how much of the pool has been distributed
  
  **Updates in Real-Time:**
  - When any user earns coins → profiles.coin_balance increases → distributed increases
  - When users trade coins → balances move between users → distributed stays same
  - When users spend on features → balances decrease → coins return to pool
  
  ## Security
  
  - Function reads from profiles table (public data)
  - No writes to coin_pool (read-only for safety)
  - Coin pool serves as audit trail only
  - All balance operations use profiles.coin_balance
*/

-- Drop the existing function first to avoid return type conflicts
DROP FUNCTION IF EXISTS get_coin_pool_stats();

-- Recreate the function to calculate distributed coins from profiles.coin_balance
CREATE OR REPLACE FUNCTION get_coin_pool_stats()
RETURNS TABLE (
  total_coins bigint,
  distributed_coins numeric,
  remaining_coins numeric,
  distribution_percentage numeric
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_total_coins CONSTANT bigint := 1000000000;
  v_distributed numeric;
  v_remaining numeric;
  v_percentage numeric;
BEGIN
  -- Calculate distributed coins as sum of all user balances
  SELECT COALESCE(SUM(coin_balance), 0)
  INTO v_distributed
  FROM profiles;
  
  -- Calculate remaining coins
  v_remaining := v_total_coins - v_distributed;
  
  -- Calculate distribution percentage
  IF v_total_coins > 0 THEN
    v_percentage := ROUND((v_distributed::numeric / v_total_coins::numeric) * 100, 4);
  ELSE
    v_percentage := 0;
  END IF;
  
  -- Return the stats
  RETURN QUERY
  SELECT 
    v_total_coins as total_coins,
    v_distributed as distributed_coins,
    v_remaining as remaining_coins,
    v_percentage as distribution_percentage;
END;
$$;

-- Verify the function works correctly
DO $$
DECLARE
  v_stats record;
BEGIN
  -- Test the function
  SELECT * INTO v_stats FROM get_coin_pool_stats();
  
  RAISE NOTICE 'Coin Pool Stats Function Updated Successfully';
  RAISE NOTICE 'Total Pool: % coins', v_stats.total_coins;
  RAISE NOTICE 'Distributed: % coins (sum of all profiles.coin_balance)', v_stats.distributed_coins;
  RAISE NOTICE 'Available: % coins', v_stats.remaining_coins;
  RAISE NOTICE 'Distribution: % percent', v_stats.distribution_percentage;
  RAISE NOTICE 'Pool display now calculates from actual user balances';
END $$;
