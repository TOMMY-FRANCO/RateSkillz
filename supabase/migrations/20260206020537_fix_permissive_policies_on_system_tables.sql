/*
  # Fix permissive always-true policies on system/audit tables

  1. Changes
    - `balance_audit_log`: Replace broad `ALL` policy with separate per-command
      service_role policies (no functional change - was already TO service_role)
    - `username_history`: Replace `TO public WITH CHECK(true)` INSERT with
      service_role-only INSERT (closes security hole where anyone could insert)
    - `balance_recovery_log`: Replace `TO authenticated USING(true)` SELECT with
      service_role-only SELECT (admin data was exposed to all logged-in users;
      frontend accesses this via SECURITY DEFINER RPC, not direct table reads)

  2. Security Impact
    - username_history: Closes INSERT vulnerability (was open to unauthenticated users)
    - balance_recovery_log: Stops leaking admin recovery data to regular users
    - balance_audit_log: No functional change, just cleaner policy structure
    - admin_security_log: Already correctly scoped to service_role, no changes needed
*/

-- ============================================================
-- 1. balance_audit_log: Replace ALL with separate policies
-- ============================================================

DROP POLICY IF EXISTS "Service role can manage audit logs" ON balance_audit_log;

CREATE POLICY "balance_audit_log_service_select"
  ON balance_audit_log FOR SELECT
  TO service_role
  USING (true);

CREATE POLICY "balance_audit_log_service_insert"
  ON balance_audit_log FOR INSERT
  TO service_role
  WITH CHECK (true);

CREATE POLICY "balance_audit_log_service_update"
  ON balance_audit_log FOR UPDATE
  TO service_role
  USING (true)
  WITH CHECK (true);

CREATE POLICY "balance_audit_log_service_delete"
  ON balance_audit_log FOR DELETE
  TO service_role
  USING (true);

-- ============================================================
-- 2. username_history: Restrict INSERT to service_role only
-- ============================================================

DROP POLICY IF EXISTS "System can insert username history" ON username_history;

CREATE POLICY "username_history_service_insert"
  ON username_history FOR INSERT
  TO service_role
  WITH CHECK (true);

-- ============================================================
-- 3. balance_recovery_log: Restrict SELECT to service_role only
-- ============================================================

DROP POLICY IF EXISTS "Admins can view balance recovery logs" ON balance_recovery_log;

CREATE POLICY "balance_recovery_log_service_select"
  ON balance_recovery_log FOR SELECT
  TO service_role
  USING (true);