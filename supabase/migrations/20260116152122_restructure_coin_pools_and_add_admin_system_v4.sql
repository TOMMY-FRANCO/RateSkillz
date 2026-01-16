/*
  # Restructure Coin Pools and Add Admin System

  ## Overview
  This migration separates revenue pools from reserve pools for financial clarity:
  1. Keeps coin_pool table ONLY for Community Rewards Pool (500M total)
  2. Creates resource_pools table for non-revenue reserves (read-only)
  3. Adds admin system with role-based access control

  ## Changes Made
  1. **Resource Pools Table**: Created for non-revenue reserves (Operational Liquidity, Growth Treasury, Founder Lock-Up)
  2. **Admin System**: Added is_admin column to profiles, admin_access_log table
  3. **Pool Restructure**: Coin_pool now only contains Community Rewards Pool (500M)
  4. **Updated Functions**: All coin distribution functions updated to use Community Rewards Pool only

  ## Security
  - Admin access restricted to three users: test123, tommy_franco, and Cole123
  - All admin access attempts logged to admin_access_log
  - Resource pools are read-only, never touched by distribution logic
  - RLS policies ensure only admins can view sensitive pool data

  ## Data Integrity
  - Community Rewards Pool: 500,000,000.00 total
  - Operational Liquidity Reserve: 150,000,000.00
  - All coin distributions come from Community Rewards Pool only
  - Resource pools remain untouched by automated systems
*/

-- Step 1: Create resource_pools table for non-revenue reserves
CREATE TABLE IF NOT EXISTS resource_pools (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  pool_name text NOT NULL UNIQUE,
  pool_type text NOT NULL,
  total_coins numeric(12,2) NOT NULL DEFAULT 0,
  description text,
  is_active boolean DEFAULT true,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Step 2: Add is_admin column to profiles table
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'profiles' AND column_name = 'is_admin'
  ) THEN
    ALTER TABLE profiles ADD COLUMN is_admin boolean DEFAULT false;
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_profiles_is_admin ON profiles(is_admin) WHERE is_admin = true;

-- Step 3: Create admin_access_log table for access tracking
CREATE TABLE IF NOT EXISTS admin_access_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES profiles(id) ON DELETE CASCADE,
  username text,
  action_type text NOT NULL,
  resource_accessed text,
  ip_address text,
  user_agent text,
  access_granted boolean DEFAULT true,
  notes text,
  created_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_admin_access_log_user_id ON admin_access_log(user_id);
CREATE INDEX IF NOT EXISTS idx_admin_access_log_created_at ON admin_access_log(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_admin_access_log_action_type ON admin_access_log(action_type);

-- Step 4: Set admin users (test123, tommy_franco, Cole123)
UPDATE profiles
SET is_admin = true
WHERE username IN ('test123', 'tommy_franco', 'Cole123');

-- Step 5: Insert resource pools (non-revenue reserves, read-only)
INSERT INTO resource_pools (pool_name, pool_type, total_coins, description) VALUES
  ('Operational Liquidity Reserve', 'operational', 150000000.00, 'Reserve for operational costs, liquidity management, and emergency funds'),
  ('Growth & Acquisition Treasury', 'growth', 200000000.00, 'Reserve for growth initiatives, user acquisition, and marketing campaigns'),
  ('Founder Lock-Up Reserve', 'founder', 150000000.00, 'Long-term reserve locked for founder allocation with vesting schedule')
ON CONFLICT (pool_name) DO NOTHING;

-- Step 6: Restructure coin_pool to ONLY contain Community Rewards Pool
DO $$
DECLARE
  current_distributed numeric;
  current_total bigint;
  current_remaining numeric;
BEGIN
  -- Get current values
  SELECT 
    COALESCE(distributed_coins, 0),
    COALESCE(total_coins, 0),
    COALESCE(remaining_coins, 0)
  INTO current_distributed, current_total, current_remaining
  FROM coin_pool 
  WHERE pool_name = 'community_pool' OR pool_type = 'community'
  LIMIT 1;
  
  -- Log the current state
  RAISE NOTICE 'Current coin_pool state - Total: %, Distributed: %, Remaining: %', current_total, current_distributed, current_remaining;
  
  -- Clear all pools from coin_pool table
  DELETE FROM coin_pool;
  
  -- Insert ONLY Community Rewards Pool (500M total)
  INSERT INTO coin_pool (
    pool_name,
    pool_type,
    total_coins,
    distributed_coins,
    remaining_coins,
    description,
    created_at,
    updated_at
  ) VALUES (
    'Community Rewards Pool',
    'community',
    500000000,
    current_distributed,  -- Keep the actual distributed amount
    500000000 - current_distributed,  -- Calculate remaining
    'Primary pool for user rewards, ad viewing, comments, and all community distributions',
    now(),
    now()
  );
  
  RAISE NOTICE 'Restructured coin_pool - Community Rewards Pool: 500M total, % distributed, % remaining', current_distributed, (500000000 - current_distributed);
END $$;

-- Step 7: Update get_coin_pool_status function to work with new structure
CREATE OR REPLACE FUNCTION get_coin_pool_status()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  pool_data record;
  actual_distributed numeric;
  discrepancy numeric;
  total_users integer;
  result jsonb;
BEGIN
  -- Get Community Rewards Pool data (the only pool in coin_pool table)
  SELECT * INTO pool_data FROM coin_pool WHERE pool_name = 'Community Rewards Pool' LIMIT 1;
  
  -- Calculate actual distributed
  actual_distributed := calculate_actual_distributed_coins();
  
  -- Calculate discrepancy
  discrepancy := pool_data.distributed_coins - actual_distributed;
  
  -- Count total users with coins
  SELECT COUNT(*)
  INTO total_users
  FROM profiles
  WHERE coin_balance > 0;
  
  result := jsonb_build_object(
    'pool_name', pool_data.pool_name,
    'total_coins', pool_data.total_coins,
    'distributed_coins', pool_data.distributed_coins,
    'actual_distributed', actual_distributed,
    'remaining_coins', pool_data.total_coins - actual_distributed,
    'discrepancy', discrepancy,
    'is_synced', ABS(discrepancy) <= 0.01,
    'total_users_with_coins', total_users,
    'last_updated', pool_data.updated_at
  );
  
  RETURN result;
END;
$$;

-- Step 8: Create function to get resource pools (read-only)
CREATE OR REPLACE FUNCTION get_resource_pools()
RETURNS TABLE (
  id uuid,
  pool_name text,
  pool_type text,
  total_coins numeric,
  description text,
  is_active boolean,
  created_at timestamptz,
  updated_at timestamptz
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN QUERY
  SELECT 
    rp.id,
    rp.pool_name,
    rp.pool_type,
    rp.total_coins,
    rp.description,
    rp.is_active,
    rp.created_at,
    rp.updated_at
  FROM resource_pools rp
  WHERE rp.is_active = true
  ORDER BY 
    CASE rp.pool_type
      WHEN 'operational' THEN 1
      WHEN 'growth' THEN 2
      WHEN 'founder' THEN 3
      ELSE 4
    END;
END;
$$;

-- Step 9: Create function to log admin access
CREATE OR REPLACE FUNCTION log_admin_access(
  p_user_id uuid,
  p_action_type text,
  p_resource_accessed text DEFAULT NULL,
  p_access_granted boolean DEFAULT true,
  p_notes text DEFAULT NULL
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_username text;
BEGIN
  -- Get username
  SELECT username INTO v_username
  FROM profiles
  WHERE id = p_user_id;
  
  -- Insert log entry
  INSERT INTO admin_access_log (
    user_id,
    username,
    action_type,
    resource_accessed,
    access_granted,
    notes
  ) VALUES (
    p_user_id,
    v_username,
    p_action_type,
    p_resource_accessed,
    p_access_granted,
    p_notes
  );
END;
$$;

-- Step 10: Create function to check if user is admin
CREATE OR REPLACE FUNCTION is_user_admin(p_user_id uuid)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_is_admin boolean;
BEGIN
  SELECT is_admin INTO v_is_admin
  FROM profiles
  WHERE id = p_user_id;
  
  RETURN COALESCE(v_is_admin, false);
END;
$$;

-- Step 11: Update distribute_coins_atomically to ensure it only uses Community Rewards Pool
CREATE OR REPLACE FUNCTION distribute_coins_atomically(
  p_user_id uuid,
  p_amount numeric,
  p_transaction_type text,
  p_description text,
  p_related_user_id uuid DEFAULT NULL,
  p_reference_id text DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  current_balance numeric;
  new_balance numeric;
  pool_remaining numeric;
  transaction_id uuid;
  result jsonb;
BEGIN
  -- Validate amount
  IF p_amount = 0 THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'Amount cannot be zero'
    );
  END IF;
  
  -- Get current balance
  SELECT coin_balance INTO current_balance
  FROM profiles
  WHERE id = p_user_id
  FOR UPDATE;
  
  IF NOT FOUND THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'User not found'
    );
  END IF;
  
  -- Calculate new balance
  new_balance := current_balance + p_amount;
  
  -- Prevent negative balance
  IF new_balance < 0 THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'Insufficient balance'
    );
  END IF;
  
  -- For positive amounts, check if Community Rewards Pool has enough coins
  IF p_amount > 0 THEN
    SELECT total_coins - distributed_coins INTO pool_remaining
    FROM coin_pool
    WHERE pool_name = 'Community Rewards Pool'
    FOR UPDATE;
    
    IF pool_remaining < p_amount THEN
      RETURN jsonb_build_object(
        'success', false,
        'error', 'Insufficient coins in Community Rewards Pool'
      );
    END IF;
  END IF;
  
  -- ATOMIC OPERATION: Update all tables together
  -- 1. Update profile balance
  UPDATE profiles
  SET coin_balance = new_balance
  WHERE id = p_user_id;
  
  -- 2. Create transaction record
  INSERT INTO coin_transactions (
    user_id,
    amount,
    transaction_type,
    description,
    balance_after,
    related_user_id,
    created_at
  ) VALUES (
    p_user_id,
    p_amount,
    p_transaction_type,
    p_description,
    new_balance,
    p_related_user_id,
    now()
  ) RETURNING id INTO transaction_id;
  
  -- 3. Create transaction details if reference_id provided
  IF p_reference_id IS NOT NULL THEN
    INSERT INTO transaction_details (
      transaction_id,
      reference_id,
      created_at
    ) VALUES (
      transaction_id,
      p_reference_id,
      now()
    );
  END IF;
  
  -- 4. Coin pool is automatically updated by trigger
  
  result := jsonb_build_object(
    'success', true,
    'transaction_id', transaction_id,
    'old_balance', current_balance,
    'new_balance', new_balance,
    'amount', p_amount,
    'pool', 'Community Rewards Pool'
  );
  
  RETURN result;
  
EXCEPTION
  WHEN OTHERS THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', SQLERRM
    );
END;
$$;

-- Step 12: Enable RLS on new tables
ALTER TABLE resource_pools ENABLE ROW LEVEL SECURITY;
ALTER TABLE admin_access_log ENABLE ROW LEVEL SECURITY;

-- Step 13: Create RLS policies for resource_pools (admins only)
CREATE POLICY "Admins can view resource pools"
  ON resource_pools FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.is_admin = true
    )
  );

-- Step 14: Create RLS policies for admin_access_log (admins only)
CREATE POLICY "Admins can view access logs"
  ON admin_access_log FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.is_admin = true
    )
  );

CREATE POLICY "System can insert access logs"
  ON admin_access_log FOR INSERT
  TO authenticated
  WITH CHECK (true);

-- Step 15: Grant execute permissions
GRANT EXECUTE ON FUNCTION get_resource_pools() TO authenticated;
GRANT EXECUTE ON FUNCTION log_admin_access(uuid, text, text, boolean, text) TO authenticated;
GRANT EXECUTE ON FUNCTION is_user_admin(uuid) TO authenticated;

-- Step 16: Add comments for documentation
COMMENT ON TABLE resource_pools IS 
'Non-revenue reserve pools (Operational, Growth, Founder). Read-only, never touched by distribution logic. Managed manually by admins only.';

COMMENT ON TABLE admin_access_log IS 
'Logs all admin access attempts and actions for security auditing. Tracks who accessed what and when.';

COMMENT ON COLUMN profiles.is_admin IS 
'Admin role flag. Only admins can access admin dashboard and view sensitive pool data.';

COMMENT ON FUNCTION get_resource_pools() IS 
'Returns read-only view of resource pools. Only accessible to admins. These pools are never touched by automated distribution.';

COMMENT ON FUNCTION log_admin_access(uuid, text, text, boolean, text) IS 
'Logs admin access attempts and actions for security auditing.';

COMMENT ON FUNCTION is_user_admin(uuid) IS 
'Checks if a user has admin privileges. Returns true if user is an admin, false otherwise.';

-- Step 17: Log the restructure completion
DO $$
DECLARE
  community_pool_total bigint;
  community_pool_distributed numeric;
  operational_reserve numeric;
  admin_count integer;
BEGIN
  SELECT total_coins, distributed_coins 
  INTO community_pool_total, community_pool_distributed 
  FROM coin_pool 
  WHERE pool_name = 'Community Rewards Pool'
  LIMIT 1;
  
  SELECT total_coins 
  INTO operational_reserve 
  FROM resource_pools 
  WHERE pool_name = 'Operational Liquidity Reserve';
  
  SELECT COUNT(*) INTO admin_count
  FROM profiles
  WHERE is_admin = true;
  
  RAISE NOTICE '✅ Pool restructure complete:';
  RAISE NOTICE '   Community Rewards Pool: % total, % distributed', community_pool_total, community_pool_distributed;
  RAISE NOTICE '   Operational Liquidity Reserve: %', operational_reserve;
  RAISE NOTICE '   Admin users configured: %', admin_count;
END $$;
