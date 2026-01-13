/*
  # Add tutorial_completion Transaction Type

  1. Problem
    - The complete_tutorial function tries to create a transaction with type 'tutorial_completion'
    - But this type is not in the CHECK constraint for coin_transactions
    - This causes the function to fail with a constraint violation
    
  2. Solution
    - Drop existing transaction_type constraint
    - Recreate with 'tutorial_completion' added to the list
    
  3. Transaction Types
    - All existing types preserved
    - Added: 'tutorial_completion'
*/

-- Drop existing constraint
ALTER TABLE coin_transactions 
  DROP CONSTRAINT IF EXISTS coin_transactions_transaction_type_check;

-- Add updated constraint with tutorial_completion
ALTER TABLE coin_transactions 
  ADD CONSTRAINT coin_transactions_transaction_type_check 
  CHECK (transaction_type IN (
    'comment_reward',
    'ad_view',
    'ad_reward',
    'purchase',
    'card_sale',
    'card_purchase',
    'coin_purchase',
    'card_royalty',
    'balance_correction',
    'battle_wager',
    'battle_win',
    'coin_transfer_sent',
    'coin_transfer_received',
    'card_swap',
    'card_discard',
    'reward_whatsapp',
    'reward_social_share',
    'reward_friend_milestone',
    'whatsapp_share',
    'whatsapp_share_retroactive_credit',
    'purchase_request_sale',
    'tutorial_completion'
  ));
