/*
  # Fix reference_id Column Type for Stripe Integration

  1. Problem
    - reference_id column in coin_transactions is uuid type
    - Stripe payment_intent IDs are text (e.g., 'pi_xxxxx')
    - This prevents storing Stripe payment references

  2. Changes
    - Change reference_id from uuid to text
    - This allows storing Stripe payment_intent IDs and other external references
    - Maintains existing index for duplicate checks

  3. Security
    - All existing RLS policies remain unchanged
    - No data loss (existing uuids convert to text)
*/

-- Change reference_id column from uuid to text
ALTER TABLE coin_transactions 
ALTER COLUMN reference_id TYPE text USING reference_id::text;

-- Recreate the index with the new type
DROP INDEX IF EXISTS idx_coin_transactions_reference_id;
CREATE INDEX idx_coin_transactions_reference_id 
ON coin_transactions(reference_id) 
WHERE reference_id IS NOT NULL;

-- Add comment to document the column purpose
COMMENT ON COLUMN coin_transactions.reference_id IS 
'External reference ID (e.g., Stripe payment_intent ID, transaction hash, etc.)';
