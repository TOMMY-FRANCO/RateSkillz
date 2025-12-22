/*
  # Fix Coin Pool to Support Decimal Values
  
  1. Problem
    - distributed_coins is bigint, rounds 80.10 to 80
    - Can't track fractional coins (comment rewards are 0.1)
  
  2. Solution
    - Change distributed_coins to numeric(12,2)
    - Change remaining_coins to numeric(12,2)
    - Update to correct value of 80.10
*/

-- Change column types to support decimals
ALTER TABLE coin_pool 
  ALTER COLUMN distributed_coins TYPE numeric(12,2);

ALTER TABLE coin_pool 
  ALTER COLUMN remaining_coins TYPE numeric(12,2);

-- Set correct distributed amount
UPDATE coin_pool
SET 
  distributed_coins = 80.10,
  remaining_coins = total_coins - 80.10,
  updated_at = now();
