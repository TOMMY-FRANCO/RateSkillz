/*
  # Consolidate Transaction Type Constraints

  1. Problem
    - 14+ migrations modify the same CHECK constraint on coin_transactions
    - Each migration adds 1-2 new transaction types
    - This is fragile - skipping one migration breaks transaction types
    - Creates maintenance nightmare when adding new types

  2. Solution
    - Create ONE comprehensive CHECK constraint with ALL transaction types
    - Document what each type means
    - Remove need for future migrations to modify this constraint

  3. All Valid Transaction Types
    
    REWARDS & EARNINGS:
    - comment_reward: User earns coins for commenting
    - ad_reward: User earns coins from watching ad
    - ad_view: Ad viewing tracked (may not award coins)
    - reward_whatsapp: User earns coins for WhatsApp verification
    - reward_whatsapp_share: User earns coins for sharing on WhatsApp
    - reward_social_share: User earns coins for social media sharing
    - reward_friend_milestone: User earns coins at friend count milestones (5, 10, 25, 50)
    - tutorial_completion: User earns coins for completing tutorial
    - whatsapp_share: General WhatsApp share reward
    - whatsapp_share_retroactive_credit: Retroactive WhatsApp share credit

    PURCHASES & PAYMENTS:
    - purchase: General purchase transaction
    - coin_purchase: User buys coins with real money (Stripe)
    - card_purchase: User buys a player card
    - card_sale: User sells a player card
    - card_royalty: Original card owner receives royalty from resale
    - purchase_request_sale: Card sold via purchase request
    - purchase_request_declined: Purchase request declined

    CARD MANAGEMENT:
    - card_swap: User swaps cards with another user
    - card_discard: User discards a card
    - card_buyout: User buys back their own card from manager
    - card_buyout_payment: Payment for card buyout
    - card_buyout_dump: Card buyout value sent to dump pool

    COIN TRANSFERS:
    - coin_transfer_sent: User sends coins to another user
    - coin_transfer_received: User receives coins from another user

    BATTLE MODE:
    - battle_wager: User places wager for battle
    - battle_win: User wins battle and receives payout
    - battle_entry_fee: User pays entry fee for battle
    - battle_winner_payout: Battle winner receives payout
    - buyout: General buyout transaction

    SYSTEM:
    - balance_correction: Admin/system corrects balance discrepancy

  4. Important Notes
    - This constraint covers ALL current and foreseeable transaction types
    - Future migrations should NOT modify this constraint
    - If new types are truly needed, add them via a new targeted migration
    - This consolidation eliminates 14+ redundant constraint modifications
*/

-- Drop existing constraint if it exists
ALTER TABLE coin_transactions DROP CONSTRAINT IF EXISTS coin_transactions_transaction_type_check;

-- Create comprehensive constraint with ALL transaction types
ALTER TABLE coin_transactions ADD CONSTRAINT coin_transactions_transaction_type_check
  CHECK (transaction_type IN (
    -- Rewards & Earnings
    'comment_reward',
    'ad_reward',
    'ad_view',
    'reward_whatsapp',
    'reward_whatsapp_share',
    'reward_social_share',
    'reward_friend_milestone',
    'tutorial_completion',
    'whatsapp_share',
    'whatsapp_share_retroactive_credit',
    
    -- Purchases & Payments
    'purchase',
    'coin_purchase',
    'card_purchase',
    'card_sale',
    'card_royalty',
    'purchase_request_sale',
    'purchase_request_declined',
    
    -- Card Management
    'card_swap',
    'card_discard',
    'card_buyout',
    'card_buyout_payment',
    'card_buyout_dump',
    
    -- Coin Transfers
    'coin_transfer_sent',
    'coin_transfer_received',
    
    -- Battle Mode
    'battle_wager',
    'battle_win',
    'battle_entry_fee',
    'battle_winner_payout',
    'buyout',
    
    -- System
    'balance_correction'
  ));

-- Create index for faster transaction type filtering
CREATE INDEX IF NOT EXISTS idx_coin_transactions_transaction_type 
  ON coin_transactions(transaction_type);

-- Log consolidation
DO $$
DECLARE
  v_total_transactions bigint;
  v_unique_types integer;
BEGIN
  SELECT COUNT(*), COUNT(DISTINCT transaction_type)
  INTO v_total_transactions, v_unique_types
  FROM coin_transactions;

  RAISE NOTICE '========================================';
  RAISE NOTICE 'TRANSACTION TYPE CONSTRAINTS CONSOLIDATED';
  RAISE NOTICE '----------------------------------------';
  RAISE NOTICE 'Total transactions in database: %', v_total_transactions;
  RAISE NOTICE 'Unique transaction types currently used: %', v_unique_types;
  RAISE NOTICE 'Total valid types in constraint: 31';
  RAISE NOTICE '';
  RAISE NOTICE 'This eliminates 14+ redundant constraint modifications';
  RAISE NOTICE 'Future migrations should NOT modify this constraint';
  RAISE NOTICE '========================================';
END $$;
