/*
  # Update Transaction Type Constraint

  ## Summary
  Expands the transaction_type CHECK constraint to support all transaction types used in the system.

  ## Current Issue
  The CHECK constraint only allows: comment_reward, ad_reward, purchase, page_view_reward
  But the system also uses: card_purchase, card_sale, card_royalty
  This causes card trading transactions to fail.

  ## Changes Made
  Drop old restrictive constraint and create new one that allows all valid transaction types:
  - comment_reward: Earned from commenting on profiles
  - ad_reward: Earned from watching ads
  - purchase: Buying coins with real money
  - page_view_reward: Earned from page views (legacy, may not be used)
  - card_purchase: Buying a player card (negative amount)
  - card_sale: Selling a player card (positive amount)
  - card_royalty: Original owner receiving royalty from card resale

  ## Note
  This fix allows card trading to work properly without constraint violations.
*/

-- Drop the old restrictive constraint
ALTER TABLE coin_transactions 
DROP CONSTRAINT IF EXISTS coin_transactions_transaction_type_check;

-- Create new expanded constraint
ALTER TABLE coin_transactions
ADD CONSTRAINT coin_transactions_transaction_type_check
CHECK (transaction_type IN (
  'comment_reward',
  'ad_reward',
  'purchase',
  'page_view_reward',
  'card_purchase',
  'card_sale',
  'card_royalty'
));

-- Verify constraint was added
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints 
    WHERE table_name = 'coin_transactions' 
    AND constraint_name = 'coin_transactions_transaction_type_check'
  ) THEN
    RAISE EXCEPTION 'Failed to add transaction type constraint';
  END IF;
  
  RAISE NOTICE 'Transaction type constraint updated successfully';
  RAISE NOTICE 'Allowed types: comment_reward, ad_reward, purchase, page_view_reward, card_purchase, card_sale, card_royalty';
END $$;
