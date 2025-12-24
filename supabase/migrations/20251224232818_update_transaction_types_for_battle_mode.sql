/*
  # Update Transaction Types for Battle Mode

  1. Changes
    - Update the coin_transactions table transaction_type constraint
    - Add new transaction types: manager_bonus, battle_win, battle_loss, battle_royalty

  2. Notes
    - Ensures all Battle Mode transactions can be properly recorded
*/

-- Drop the existing constraint
ALTER TABLE coin_transactions DROP CONSTRAINT IF EXISTS coin_transactions_transaction_type_check;

-- Add updated constraint with battle mode transaction types
ALTER TABLE coin_transactions
  ADD CONSTRAINT coin_transactions_transaction_type_check
  CHECK (transaction_type IN (
    'purchase',
    'ad_reward',
    'comment_reward',
    'card_sale',
    'card_purchase',
    'initial_card_creation',
    'card_sale_royalty',
    'balance_correction',
    'manager_bonus',
    'battle_win',
    'battle_loss',
    'battle_royalty'
  ));
