/*
  # Update Coin Pool Display to Show Community Rewards Pool Only

  ## Overview
  Updates the `get_coin_pool_stats()` function to display only the Community Rewards Pool
  (500 million coins) to users. This aligns with the four-pool split where only the community
  pool is user-facing.

  ## Changes Made
  
  ### 1. Update get_coin_pool_stats() Function
  - Changed total_coins from 1,000,000,000 to 500,000,000
  - Distributed coins still calculated from SUM(profiles.coin_balance)
  - Remaining coins: 500,000,000 - distributed (from community pool)
  - Distribution percentage: (distributed / 500,000,000) * 100

  ## Result
  Users see in Coin Shop:
  - Total Pool: 500,000,000 coins (Community Rewards Pool only)
  - Distributed: Actual coins in user balances
  - Available: Community pool remaining coins
  - Other pools (Operational, Growth, Founder) are backend-only
*/

-- Drop the existing function
DROP FUNCTION IF EXISTS get_coin_pool_stats();

-- Recreate the function to show only Community Rewards Pool (500M)
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
  v_total_coins CONSTANT bigint := 500000000; -- Community Rewards Pool only
  v_distributed numeric;
  v_remaining numeric;
  v_percentage numeric;
BEGIN
  -- Calculate distributed coins as sum of all user balances
  SELECT COALESCE(SUM(coin_balance), 0)
  INTO v_distributed
  FROM profiles;
  
  -- Calculate remaining coins in community pool
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

-- Add helpful comment
COMMENT ON FUNCTION get_coin_pool_stats IS 'Returns stats for Community Rewards Pool only (500M coins). Other pools (Operational 150M, Growth 100M, Founder 250M) are backend-only and not shown to users.';

-- Verify the function works correctly
DO $$
DECLARE
  v_stats record;
BEGIN
  -- Test the function
  SELECT * INTO v_stats FROM get_coin_pool_stats();
  
  RAISE NOTICE 'Coin Pool Display Updated Successfully';
  RAISE NOTICE 'Users now see: Community Rewards Pool (500M coins)';
  RAISE NOTICE 'Total Pool: % coins', v_stats.total_coins;
  RAISE NOTICE 'Distributed: % coins (from user balances)', v_stats.distributed_coins;
  RAISE NOTICE 'Available: % coins', v_stats.remaining_coins;
  RAISE NOTICE 'Distribution: % percent complete', v_stats.distribution_percentage;
  RAISE NOTICE 'Other pools (650M) hidden from users';
END $$;
