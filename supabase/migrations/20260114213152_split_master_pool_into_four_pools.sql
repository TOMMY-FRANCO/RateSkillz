/*
  # Split Master Coin Pool into Four Separate Pools

  ## Overview
  Splits the existing 1 billion coin master pool into four separate pools for better
  financial organization and transparency. All user-facing functionality remains unchanged.

  ## Four Pools Created
  1. **Community Rewards Pool** (500M coins, pool_type: community)
     - User-facing pool shown in Coin Shop
     - All user coin distributions come from here
     - Inherits all existing distributed coins from master pool
  
  2. **Operational Liquidity Reserve** (150M coins, pool_type: operational)
     - Backend only, not visible to users
     - For ecosystem development, server maintenance, developer rewards
  
  3. **Growth & Acquisition Treasury** (100M coins, pool_type: growth)
     - Backend only, not visible to users
     - For incentives to new users and growth initiatives
  
  4. **Founder Lock-Up Reserve** (250M coins, pool_type: founder)
     - Backend only, not visible to users
     - Long-term equity reserve

  ## Changes Made
  
  ### 1. Table Structure
  - Add `pool_name` text field (e.g., "Community Rewards Pool")
  - Add `pool_type` enum field (community, operational, growth, founder)
  - Add `description` text field (detailed explanation of pool purpose)
  - Keep existing fields: id, total_coins, distributed_coins, remaining_coins, created_at, updated_at

  ### 2. Pool Records
  - Convert existing master pool (UUID ending in 0001) to Community Rewards Pool
  - Set its total_coins to 500,000,000
  - Keep existing distributed_coins (560.10) and adjust remaining_coins
  - Create three new pool records with unique UUIDs

  ### 3. User Experience
  - Coin Shop displays only Community Rewards Pool
  - All user transactions reference community pool only
  - Other pools hidden from users (admin/backend use only)

  ## Important Notes
  - Total coins across all pools: 1,000,000,000 (same as before)
  - All existing user balances and transactions unchanged
  - All coin distribution logic updated to query community pool specifically
  - Transaction logs will reference which pool coins came from
*/

-- STEP 1: Create pool_type enum
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'pool_type_enum') THEN
    CREATE TYPE pool_type_enum AS ENUM ('community', 'operational', 'growth', 'founder');
  END IF;
END $$;

-- STEP 2: Add new columns to coin_pool table
ALTER TABLE coin_pool 
ADD COLUMN IF NOT EXISTS pool_name text,
ADD COLUMN IF NOT EXISTS pool_type pool_type_enum,
ADD COLUMN IF NOT EXISTS description text;

-- STEP 3: Update existing master pool to become Community Rewards Pool
UPDATE coin_pool
SET 
  pool_name = 'Community Rewards Pool',
  pool_type = 'community',
  description = 'User-facing pool for all community rewards including tutorial completion, verification bonuses, social sharing rewards, ad viewing, comments, and other user earnings. This pool is displayed in the Coin Shop.',
  total_coins = 500000000,
  remaining_coins = 500000000 - distributed_coins,
  updated_at = now()
WHERE id = '00000000-0000-0000-0000-000000000001';

-- STEP 4: Create Operational Liquidity Reserve pool
INSERT INTO coin_pool (
  id,
  pool_name,
  pool_type,
  description,
  total_coins,
  distributed_coins,
  remaining_coins,
  created_at,
  updated_at
) VALUES (
  '00000000-0000-0000-0000-000000000002',
  'Operational Liquidity Reserve',
  'operational',
  'Reserved for ecosystem development, server infrastructure, platform maintenance, developer rewards, and operational expenses. Not visible to end users.',
  150000000,
  0,
  150000000,
  now(),
  now()
)
ON CONFLICT (id) DO NOTHING;

-- STEP 5: Create Growth & Acquisition Treasury pool
INSERT INTO coin_pool (
  id,
  pool_name,
  pool_type,
  description,
  total_coins,
  distributed_coins,
  remaining_coins,
  created_at,
  updated_at
) VALUES (
  '00000000-0000-0000-0000-000000000003',
  'Growth & Acquisition Treasury',
  'growth',
  'Allocated for new user acquisition incentives, referral programs, promotional campaigns, and strategic growth initiatives. Not visible to end users.',
  100000000,
  0,
  100000000,
  now(),
  now()
)
ON CONFLICT (id) DO NOTHING;

-- STEP 6: Create Founder Lock-Up Reserve pool
INSERT INTO coin_pool (
  id,
  pool_name,
  pool_type,
  description,
  total_coins,
  distributed_coins,
  remaining_coins,
  created_at,
  updated_at
) VALUES (
  '00000000-0000-0000-0000-000000000004',
  'Founder Lock-Up Reserve',
  'founder',
  'Long-term equity reserve for founders and early team members. Subject to vesting schedule and lock-up periods. Not visible to end users.',
  250000000,
  0,
  250000000,
  now(),
  now()
)
ON CONFLICT (id) DO NOTHING;

-- STEP 7: Add constraints
ALTER TABLE coin_pool
ALTER COLUMN pool_name SET NOT NULL,
ALTER COLUMN pool_type SET NOT NULL,
ALTER COLUMN description SET NOT NULL;

-- STEP 8: Create unique index on pool_type to ensure one pool per type
CREATE UNIQUE INDEX IF NOT EXISTS idx_coin_pool_type ON coin_pool(pool_type);

-- STEP 9: Create index on pool_type for faster queries
CREATE INDEX IF NOT EXISTS idx_coin_pool_type_lookup ON coin_pool(pool_type) WHERE pool_type = 'community';

-- STEP 10: Add helpful comment
COMMENT ON TABLE coin_pool IS 'Manages four separate coin pools: Community Rewards (500M, user-facing), Operational Reserve (150M), Growth Treasury (100M), and Founder Reserve (250M). Total: 1 billion coins.';
COMMENT ON COLUMN coin_pool.pool_type IS 'Type of pool: community (user-facing), operational (backend), growth (backend), founder (backend)';
COMMENT ON COLUMN coin_pool.pool_name IS 'Human-readable name of the pool';
COMMENT ON COLUMN coin_pool.description IS 'Detailed description of pool purpose and usage';

-- Verify the split was successful
DO $$
DECLARE
  v_total_coins bigint;
  v_community_pool_id uuid;
BEGIN
  -- Check total coins across all pools equals 1 billion
  SELECT SUM(total_coins) INTO v_total_coins FROM coin_pool;
  
  IF v_total_coins != 1000000000 THEN
    RAISE EXCEPTION 'Pool split failed: total coins = %, expected 1000000000', v_total_coins;
  END IF;
  
  -- Verify community pool exists
  SELECT id INTO v_community_pool_id FROM coin_pool WHERE pool_type = 'community';
  
  IF v_community_pool_id IS NULL THEN
    RAISE EXCEPTION 'Community pool not found!';
  END IF;
  
  RAISE NOTICE '✓ Pool split successful: 4 pools created totaling 1 billion coins';
  RAISE NOTICE '✓ Community Rewards Pool (500M) is user-facing';
  RAISE NOTICE '✓ Other 3 pools (500M total) are backend-only';
END $$;
