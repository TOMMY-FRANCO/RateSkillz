/*
  # Add New Battle Mode Transaction Types

  ## Overview
  Adds transaction types for the new skill-based battle mode system.

  ## Changes Made
  - Add battle_loss transaction type (for losing battle wager)
  - Add battle_royalty transaction type (for card royalty payments)
  - Keep existing battle_win type

  ## Transaction Types Added
  - battle_loss: When a player loses a battle and loses their wager
  - battle_royalty: When card owners receive 5 coin royalties from battles
*/

-- Drop the old constraint
ALTER TABLE coin_transactions 
DROP CONSTRAINT IF EXISTS coin_transactions_transaction_type_check;

-- Add new constraint with battle transaction types
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
  'battle_loss',
  'battle_royalty',
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
  'tutorial_completion',
  'card_buyout',
  'card_buyout_payment'
));

-- Verification
DO $$
BEGIN
  RAISE NOTICE 'Battle transaction types added successfully';
  RAISE NOTICE 'New types: battle_loss, battle_royalty';
  RAISE NOTICE 'Existing type retained: battle_win';
END $$;
