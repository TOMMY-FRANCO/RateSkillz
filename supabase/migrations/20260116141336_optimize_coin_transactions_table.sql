/*
  # Optimize Coin Transactions Table

  ## Overview
  This migration optimizes the coin_transactions table by splitting it into two tables:
  1. `coin_transactions` - Lean table with core transaction data
  2. `transaction_details` - Detailed information linked by transaction_id

  ## Changes Made
  1. **New Table: transaction_details**
    - `id` (uuid, primary key)
    - `transaction_id` (uuid, references coin_transactions)
    - `reference_id` (text) - External reference (e.g., Stripe payment intent)
    - `payment_provider` (text) - Payment provider name (e.g., 'stripe')
    - `payment_amount` (decimal) - Real money amount paid
    - `audit_notes` (text) - Detailed audit information
    - `metadata` (jsonb) - Additional flexible data storage
    - `created_at` (timestamptz)

  2. **coin_transactions kept columns**
    - id, user_id, amount, transaction_type, description
    - created_at, balance_after, related_user_id

  3. **coin_transactions removed columns**
    - reference_id, payment_provider, payment_amount, audit_notes
    - (Moved to transaction_details table)

  4. **Performance Improvements**
    - Lean coin_transactions for faster queries
    - Detailed data loaded only when needed
    - Proper indexes on both tables
    - Maintains all relationships and constraints

  ## Data Migration
  - All existing transactions migrate cleanly
  - Details preserved in transaction_details table
  - No data loss during migration
  - Backward compatible queries possible

  ## Security
  - RLS enabled on transaction_details
  - Users can only view their own transaction details
  - Same security model as coin_transactions
*/

-- Step 1: Create transaction_details table
CREATE TABLE IF NOT EXISTS transaction_details (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  transaction_id uuid NOT NULL REFERENCES coin_transactions(id) ON DELETE CASCADE,
  reference_id text,
  payment_provider text,
  payment_amount decimal(10, 2),
  audit_notes text,
  metadata jsonb DEFAULT '{}'::jsonb,
  created_at timestamptz DEFAULT now()
);

-- Step 2: Create indexes for transaction_details
CREATE INDEX IF NOT EXISTS idx_transaction_details_transaction_id
  ON transaction_details(transaction_id);

CREATE INDEX IF NOT EXISTS idx_transaction_details_reference_id
  ON transaction_details(reference_id)
  WHERE reference_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_transaction_details_payment_provider
  ON transaction_details(payment_provider)
  WHERE payment_provider IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_transaction_details_audit_notes
  ON transaction_details USING gin(to_tsvector('english', audit_notes))
  WHERE audit_notes IS NOT NULL;

-- Step 3: Migrate existing data from coin_transactions to transaction_details
INSERT INTO transaction_details (
  transaction_id,
  reference_id,
  payment_provider,
  payment_amount,
  audit_notes,
  created_at
)
SELECT
  id,
  reference_id,
  payment_provider,
  payment_amount,
  audit_notes,
  created_at
FROM coin_transactions
WHERE reference_id IS NOT NULL
   OR payment_provider IS NOT NULL
   OR payment_amount IS NOT NULL
   OR audit_notes IS NOT NULL
ON CONFLICT DO NOTHING;

-- Step 4: Drop old indexes that will be removed
DROP INDEX IF EXISTS idx_coin_transactions_reference_id;
DROP INDEX IF EXISTS idx_coin_transactions_audit_notes;

-- Step 5: Remove heavy columns from coin_transactions
-- Note: We do this after migration to ensure data safety
ALTER TABLE coin_transactions
  DROP COLUMN IF EXISTS reference_id,
  DROP COLUMN IF EXISTS payment_provider,
  DROP COLUMN IF EXISTS payment_amount,
  DROP COLUMN IF EXISTS audit_notes;

-- Step 6: Add comment on transaction_details table
COMMENT ON TABLE transaction_details IS
'Stores detailed information for coin transactions separately to keep coin_transactions lean and performant.
Linked to coin_transactions via transaction_id foreign key.';

-- Step 7: Enable RLS on transaction_details
ALTER TABLE transaction_details ENABLE ROW LEVEL SECURITY;

-- Step 8: Create RLS policies for transaction_details
CREATE POLICY "Users can view their own transaction details"
  ON transaction_details
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM coin_transactions ct
      WHERE ct.id = transaction_details.transaction_id
      AND ct.user_id = auth.uid()
    )
  );

CREATE POLICY "Users can view related user transaction details"
  ON transaction_details
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM coin_transactions ct
      WHERE ct.id = transaction_details.transaction_id
      AND ct.related_user_id = auth.uid()
    )
  );

-- Step 9: Create function to get transaction with details (helper for queries)
CREATE OR REPLACE FUNCTION get_transaction_with_details(transaction_id_param uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  result jsonb;
BEGIN
  SELECT jsonb_build_object(
    'transaction', row_to_json(ct.*),
    'details', row_to_json(td.*)
  )
  INTO result
  FROM coin_transactions ct
  LEFT JOIN transaction_details td ON td.transaction_id = ct.id
  WHERE ct.id = transaction_id_param
  AND ct.user_id = auth.uid();

  RETURN result;
END;
$$;

-- Step 10: Create view for backward compatibility (optional)
CREATE OR REPLACE VIEW coin_transactions_full AS
SELECT
  ct.*,
  td.reference_id,
  td.payment_provider,
  td.payment_amount,
  td.audit_notes,
  td.metadata
FROM coin_transactions ct
LEFT JOIN transaction_details td ON td.transaction_id = ct.id;

-- Step 11: Grant permissions on the view
GRANT SELECT ON coin_transactions_full TO authenticated;

-- Step 12: Add performance indexes to coin_transactions (if not exist)
CREATE INDEX IF NOT EXISTS idx_coin_transactions_user_created
  ON coin_transactions(user_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_coin_transactions_type_created
  ON coin_transactions(transaction_type, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_coin_transactions_related_user
  ON coin_transactions(related_user_id, created_at DESC)
  WHERE related_user_id IS NOT NULL;

-- Step 13: Add table statistics comment
COMMENT ON TABLE coin_transactions IS
'Optimized lean table storing core transaction data.
Detailed information moved to transaction_details table for better performance.
Use coin_transactions_full view for backward compatibility if needed.';
