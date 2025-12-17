/*
  # Coin Economy System

  ## Overview
  Complete coin economy implementation with 1 billion coin pool, earning mechanisms, 
  and purchase system.

  ## New Tables
  
  ### `coin_pool`
  - `id` (uuid, primary key) - Pool identifier
  - `total_coins` (bigint) - Total coins available (1 billion)
  - `distributed_coins` (bigint) - Coins distributed to users
  - `remaining_coins` (bigint) - Coins still available
  - `created_at` (timestamptz) - Creation timestamp
  - `updated_at` (timestamptz) - Last update timestamp
  
  ### `coin_transactions`
  - `id` (uuid, primary key) - Transaction ID
  - `user_id` (uuid, foreign key) - User involved in transaction
  - `amount` (decimal) - Coin amount (positive for earning, can show purchase amounts)
  - `transaction_type` (text) - Type: 'comment_reward', 'ad_reward', 'purchase'
  - `description` (text) - Transaction description
  - `reference_id` (uuid, nullable) - Reference to related entity (comment_id, ad_id, payment_id)
  - `payment_provider` (text, nullable) - Stripe, PayPal, etc.
  - `payment_amount` (decimal, nullable) - Real money amount in GBP
  - `created_at` (timestamptz) - Transaction timestamp
  
  ### `comment_coin_rewards`
  - `id` (uuid, primary key) - Record ID
  - `user_id` (uuid, foreign key) - User who commented
  - `profile_user_id` (uuid, foreign key) - Profile owner
  - `comment_id` (uuid, foreign key) - Associated comment
  - `coins_awarded` (decimal) - Amount awarded (0.01)
  - `created_at` (timestamptz) - Award timestamp
  - Unique constraint on (user_id, profile_user_id)
  
  ### `ad_views`
  - `id` (uuid, primary key) - View ID
  - `user_id` (uuid, foreign key) - User who viewed ad
  - `coins_awarded` (decimal) - Amount awarded (10)
  - `created_at` (timestamptz) - View timestamp
  
  ## Table Updates
  
  ### `profiles`
  - Add `coin_balance` (decimal) - User's current coin balance
  - Add `last_ad_view_date` (date, nullable) - Last ad view date for rate limiting
  
  ## Security
  - RLS enabled on all tables
  - Users can only view their own transactions
  - Only authenticated users can access coin features
  - Backend functions handle coin distribution validation
*/

-- Create coin_pool table
CREATE TABLE IF NOT EXISTS coin_pool (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  total_coins bigint NOT NULL DEFAULT 1000000000,
  distributed_coins bigint NOT NULL DEFAULT 0,
  remaining_coins bigint NOT NULL DEFAULT 1000000000,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Create coin_transactions table
CREATE TABLE IF NOT EXISTS coin_transactions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  amount decimal(20, 2) NOT NULL,
  transaction_type text NOT NULL CHECK (transaction_type IN ('comment_reward', 'ad_reward', 'purchase')),
  description text NOT NULL,
  reference_id uuid,
  payment_provider text,
  payment_amount decimal(10, 2),
  created_at timestamptz DEFAULT now()
);

-- Create comment_coin_rewards table
CREATE TABLE IF NOT EXISTS comment_coin_rewards (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  profile_user_id uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  comment_id uuid NOT NULL REFERENCES comments(id) ON DELETE CASCADE,
  coins_awarded decimal(10, 2) NOT NULL DEFAULT 0.01,
  created_at timestamptz DEFAULT now(),
  UNIQUE(user_id, profile_user_id)
);

-- Create ad_views table
CREATE TABLE IF NOT EXISTS ad_views (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  coins_awarded decimal(10, 2) NOT NULL DEFAULT 10,
  created_at timestamptz DEFAULT now()
);

-- Add coin_balance and last_ad_view_date to profiles
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'profiles' AND column_name = 'coin_balance'
  ) THEN
    ALTER TABLE profiles ADD COLUMN coin_balance decimal(20, 2) NOT NULL DEFAULT 0;
  END IF;
  
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'profiles' AND column_name = 'last_ad_view_date'
  ) THEN
    ALTER TABLE profiles ADD COLUMN last_ad_view_date date;
  END IF;
END $$;

-- Initialize coin pool (only if not exists)
INSERT INTO coin_pool (id, total_coins, distributed_coins, remaining_coins)
SELECT 
  gen_random_uuid(),
  1000000000,
  0,
  1000000000
WHERE NOT EXISTS (SELECT 1 FROM coin_pool);

-- Enable RLS on all coin tables
ALTER TABLE coin_pool ENABLE ROW LEVEL SECURITY;
ALTER TABLE coin_transactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE comment_coin_rewards ENABLE ROW LEVEL SECURITY;
ALTER TABLE ad_views ENABLE ROW LEVEL SECURITY;

-- RLS Policies for coin_pool
CREATE POLICY "Anyone can view coin pool"
  ON coin_pool FOR SELECT
  TO authenticated
  USING (true);

-- RLS Policies for coin_transactions
CREATE POLICY "Users can view own transactions"
  ON coin_transactions FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

-- RLS Policies for comment_coin_rewards
CREATE POLICY "Users can view own comment rewards"
  ON comment_coin_rewards FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

-- RLS Policies for ad_views
CREATE POLICY "Users can view own ad views"
  ON ad_views FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_coin_transactions_user_id ON coin_transactions(user_id);
CREATE INDEX IF NOT EXISTS idx_coin_transactions_created_at ON coin_transactions(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_comment_coin_rewards_user_profile ON comment_coin_rewards(user_id, profile_user_id);
CREATE INDEX IF NOT EXISTS idx_ad_views_user_date ON ad_views(user_id, created_at DESC);

-- Function to update coin pool timestamp
CREATE OR REPLACE FUNCTION update_coin_pool_timestamp()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger to auto-update coin pool timestamp
DROP TRIGGER IF EXISTS trigger_update_coin_pool_timestamp ON coin_pool;
CREATE TRIGGER trigger_update_coin_pool_timestamp
  BEFORE UPDATE ON coin_pool
  FOR EACH ROW
  EXECUTE FUNCTION update_coin_pool_timestamp();