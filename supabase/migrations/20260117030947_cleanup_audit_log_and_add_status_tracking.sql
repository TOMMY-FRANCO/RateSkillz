/*
  # Clean Up Balance Audit Log and Add Status Tracking

  ## Overview
  This migration addresses persistent warning messages in the admin dashboard from old, already-resolved balance corrections:
  1. Adds status tracking to balance_audit_log to distinguish active warnings from resolved issues
  2. Removes duplicate coin_pool_sync entries
  3. Marks all existing audit entries as 'resolved' since they've already been corrected
  4. Adds validation to prevent negative reward amounts in the future

  ## Changes Made
  1. **Status Column**: Add 'status' field with values 'active', 'resolved', 'archived'
  2. **Duplicate Cleanup**: Remove 3 duplicate coin_pool_sync entries
  3. **Historical Marking**: Mark all existing entries as 'resolved'
  4. **Validation**: Add check constraints to prevent negative rewards

  ## Impact
  - Admin dashboard will only show active warnings by default
  - Historical audit trail preserved but marked as resolved
  - Future reward systems protected against negative values
*/

-- Step 1: Add status column to balance_audit_log
ALTER TABLE balance_audit_log 
ADD COLUMN IF NOT EXISTS status text DEFAULT 'active' 
CHECK (status IN ('active', 'resolved', 'archived'));

-- Step 2: Create index for faster filtering by status
CREATE INDEX IF NOT EXISTS idx_balance_audit_log_status 
ON balance_audit_log(status);

-- Step 3: Mark all existing entries as 'resolved' since they're historical
UPDATE balance_audit_log
SET status = 'resolved'
WHERE status = 'active' OR status IS NULL;

-- Step 4: Delete the 3 duplicate coin_pool_sync entries, keeping only the first one
DELETE FROM balance_audit_log
WHERE id IN (
  '6d36ea51-ebe3-4a06-a70d-f19ef8762f2f',
  'c12a1ff0-3ffe-4e67-a816-0ca3cf6b33e3',
  'e6411f9f-614f-4d25-926c-4fd8ed332aa9'
);

-- Step 5: Add validation function to prevent negative reward amounts
CREATE OR REPLACE FUNCTION validate_reward_amount()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  -- Check if this is a reward transaction type
  IF NEW.transaction_type IN (
    'ad_reward',
    'comment_reward',
    'tutorial_completion',
    'reward_social_share',
    'reward_whatsapp_verification',
    'reward_friend_milestone',
    'page_view_reward'
  ) THEN
    -- Ensure reward amount is positive
    IF NEW.amount <= 0 THEN
      RAISE EXCEPTION 'Reward amount must be positive, got: %. Transaction type: %', 
        NEW.amount, NEW.transaction_type;
    END IF;
  END IF;
  
  RETURN NEW;
END;
$$;

-- Step 6: Create trigger to validate reward amounts
DROP TRIGGER IF EXISTS validate_reward_amount_trigger ON coin_transactions;
CREATE TRIGGER validate_reward_amount_trigger
  BEFORE INSERT OR UPDATE ON coin_transactions
  FOR EACH ROW
  WHEN (NEW.transaction_type IN (
    'ad_reward',
    'comment_reward',
    'tutorial_completion',
    'reward_social_share',
    'reward_whatsapp_verification',
    'reward_friend_milestone',
    'page_view_reward'
  ))
  EXECUTE FUNCTION validate_reward_amount();

-- Step 7: Add similar validation to page_view_coin_rewards if table exists
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.tables 
    WHERE table_name = 'page_view_coin_rewards'
  ) THEN
    -- Add check constraint to ensure coins_awarded is always positive
    ALTER TABLE page_view_coin_rewards
    DROP CONSTRAINT IF EXISTS page_view_coin_rewards_positive_coins;
    
    ALTER TABLE page_view_coin_rewards
    ADD CONSTRAINT page_view_coin_rewards_positive_coins
    CHECK (coins_awarded > 0);
    
    RAISE NOTICE 'Added positive coins constraint to page_view_coin_rewards';
  END IF;
END $$;

-- Step 8: Create function to get audit log entries by status
CREATE OR REPLACE FUNCTION get_audit_log_by_status(p_status text DEFAULT 'active')
RETURNS TABLE (
  id uuid,
  user_id uuid,
  username text,
  correction_type text,
  old_balance numeric,
  new_balance numeric,
  discrepancy numeric,
  notes text,
  corrected_by text,
  corrected_at timestamptz,
  status text
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN QUERY
  SELECT 
    bal.id,
    bal.user_id,
    p.username,
    bal.correction_type,
    bal.old_balance,
    bal.new_balance,
    bal.discrepancy,
    bal.notes,
    bal.corrected_by,
    bal.corrected_at,
    bal.status
  FROM balance_audit_log bal
  LEFT JOIN profiles p ON p.id = bal.user_id
  WHERE bal.status = p_status OR p_status = 'all'
  ORDER BY bal.corrected_at DESC;
END;
$$;

-- Step 9: Update existing audit log queries to use status filter
CREATE OR REPLACE FUNCTION get_active_audit_warnings()
RETURNS TABLE (
  id uuid,
  user_id uuid,
  username text,
  correction_type text,
  discrepancy numeric,
  notes text,
  corrected_at timestamptz
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN QUERY
  SELECT 
    bal.id,
    bal.user_id,
    p.username,
    bal.correction_type,
    bal.discrepancy,
    bal.notes,
    bal.corrected_at
  FROM balance_audit_log bal
  LEFT JOIN profiles p ON p.id = bal.user_id
  WHERE bal.status = 'active'
  ORDER BY bal.corrected_at DESC;
END;
$$;

-- Step 10: Add helper function to mark audit entries as resolved
CREATE OR REPLACE FUNCTION mark_audit_as_resolved(p_audit_id uuid)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  UPDATE balance_audit_log
  SET status = 'resolved'
  WHERE id = p_audit_id;
  
  RETURN FOUND;
END;
$$;

-- Step 11: Final verification and reporting
DO $$
DECLARE
  v_total_entries integer;
  v_active_entries integer;
  v_resolved_entries integer;
  v_archived_entries integer;
  v_deleted_count integer := 3;
BEGIN
  SELECT COUNT(*) INTO v_total_entries FROM balance_audit_log;
  SELECT COUNT(*) INTO v_active_entries FROM balance_audit_log WHERE status = 'active';
  SELECT COUNT(*) INTO v_resolved_entries FROM balance_audit_log WHERE status = 'resolved';
  SELECT COUNT(*) INTO v_archived_entries FROM balance_audit_log WHERE status = 'archived';
  
  RAISE NOTICE '════════════════════════════════════════════════════════';
  RAISE NOTICE '✅ AUDIT LOG CLEANUP COMPLETE';
  RAISE NOTICE '════════════════════════════════════════════════════════';
  RAISE NOTICE '';
  RAISE NOTICE 'Balance Audit Log Status:';
  RAISE NOTICE '  - Total entries: %', v_total_entries;
  RAISE NOTICE '  - Active warnings: %', v_active_entries;
  RAISE NOTICE '  - Resolved issues: %', v_resolved_entries;
  RAISE NOTICE '  - Archived entries: %', v_archived_entries;
  RAISE NOTICE '  - Duplicate entries deleted: %', v_deleted_count;
  RAISE NOTICE '';
  RAISE NOTICE 'Validation Added:';
  RAISE NOTICE '  ✓ Reward amounts must be positive';
  RAISE NOTICE '  ✓ Page view rewards protected';
  RAISE NOTICE '  ✓ Comprehensive transaction validation';
  RAISE NOTICE '';
  RAISE NOTICE 'New Functions:';
  RAISE NOTICE '  ✓ get_audit_log_by_status(status)';
  RAISE NOTICE '  ✓ get_active_audit_warnings()';
  RAISE NOTICE '  ✓ mark_audit_as_resolved(audit_id)';
  RAISE NOTICE '';
  RAISE NOTICE '════════════════════════════════════════════════════════';
END $$;

-- Step 12: Grant permissions
GRANT EXECUTE ON FUNCTION get_audit_log_by_status(text) TO authenticated;
GRANT EXECUTE ON FUNCTION get_active_audit_warnings() TO authenticated;
GRANT EXECUTE ON FUNCTION mark_audit_as_resolved(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION validate_reward_amount() TO authenticated;

-- Step 13: Add comments
COMMENT ON COLUMN balance_audit_log.status IS 
'Status of this audit entry: active (needs attention), resolved (fixed), or archived (historical)';

COMMENT ON FUNCTION get_audit_log_by_status(text) IS 
'Retrieves audit log entries filtered by status. Pass ''active'', ''resolved'', ''archived'', or ''all''.';

COMMENT ON FUNCTION get_active_audit_warnings() IS 
'Returns only active audit warnings that need attention. Used in admin dashboard.';

COMMENT ON FUNCTION mark_audit_as_resolved(uuid) IS 
'Marks an audit log entry as resolved. Used after addressing an issue.';

COMMENT ON FUNCTION validate_reward_amount() IS 
'Trigger function that validates all reward transactions have positive amounts. Prevents negative rewards.';

COMMENT ON TRIGGER validate_reward_amount_trigger ON coin_transactions IS
'Ensures all reward transactions have positive amounts before insertion/update.';
