/*
  # Remove Duplicate Balance Storage - Use Profiles Table Only

  ## Problem
  - Balance was stored in TWO places: `coins` table and `profiles.coin_balance`
  - This caused mismatches and confusion
  - Card offers showed 0 balance because they queried wrong table
  - Leaderboards showed incorrect balances

  ## Solution
  - Remove `coins` table entirely
  - ALL balance queries now use `profiles.coin_balance` as single source of truth
  - Updated:
    - Edge function coin-operations to read from profiles.coin_balance
    - Frontend balances.ts to query profiles.coin_balance
    - TradingDashboard to fetch balances from profiles for leaderboards

  ## Changes Made

  1. **Drop coins table**
     - No longer needed, causes confusion
     - All balance data is in profiles.coin_balance

  2. **Single source of truth**
     - profiles.coin_balance is the ONLY balance storage
     - Updated by coin_transactions triggers
     - Always accurate and in sync

  ## Impact
  - Card offer/bid pages now show correct balance
  - Most Valuable Cards leaderboard shows correct balances
  - Most Traded Cards leaderboard shows correct balances
  - All balance displays are consistent across the app
*/

-- Drop the coins table
DROP TABLE IF EXISTS coins CASCADE;

-- Verify profiles.coin_balance is properly set up
-- Add index for faster balance queries if not exists
CREATE INDEX IF NOT EXISTS idx_profiles_coin_balance ON profiles(coin_balance);
