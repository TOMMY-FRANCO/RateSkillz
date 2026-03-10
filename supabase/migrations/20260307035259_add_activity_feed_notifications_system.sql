/*
  # Add Activity Feed Notifications System

  1. Schema Changes
    - Add `activity_feed_type` text column to `user_notifications` table
    - Values: 'gold', 'blue', 'red' for colour-coded feed display

  2. Modified Functions
    - `check_and_upgrade_to_manager`: inserts manager promotion notification (gold)
    - `handle_new_user`: inserts welcome notification (gold)
    - `claim_friend_milestone_reward_v2`: inserts milestone notification (gold)
    - `increment_comments_count`: inserts comment notification (blue)
    - `claim_whatsapp_verification_reward`: inserts verification notification (gold)
    - `mark_token_used`: inserts password change notification (red)

  3. New Functions / Triggers
    - `notify_on_profile_like`: trigger function on profile_likes INSERT, inserts like notification (blue)
    - Trigger `profile_like_notification_trigger` on profile_likes

  4. Important Notes
    - No new tables created
    - All notifications go into existing `user_notifications` table
    - `activity_feed_type` column distinguishes activity feed items from other notifications
*/

-- 1. Add activity_feed_type column to user_notifications
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'user_notifications' AND column_name = 'activity_feed_type'
  ) THEN
    ALTER TABLE user_notifications ADD COLUMN activity_feed_type text;
  END IF;
END $$;

-- 2. Update check_and_upgrade_to_manager to insert notification
CREATE OR REPLACE FUNCTION check_and_upgrade_to_manager()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  card_count integer;
  user_is_manager boolean;
BEGIN
  SELECT COUNT(*) INTO card_count
  FROM card_ownership
  WHERE owner_id = NEW.owner_id;

  SELECT is_manager INTO user_is_manager
  FROM profiles
  WHERE id = NEW.owner_id;

  IF card_count >= 5 AND (user_is_manager IS NULL OR user_is_manager = false) THEN
    UPDATE profiles
    SET is_manager = true,
        manager_upgrade_date = now()
    WHERE id = NEW.owner_id;

    INSERT INTO coin_transactions (user_id, amount, transaction_type, description)
    VALUES (
      NEW.owner_id,
      100,
      'balance_correction',
      'Manager upgrade bonus - earned by obtaining 5+ cards'
    );

    INSERT INTO user_notifications (user_id, notification_type, message, activity_feed_type)
    VALUES (
      NEW.owner_id,
      'achievement',
      'Promotion Alert! 👔 You are now a Manager. +100 coins have been added to your account.',
      'gold'
    );
  END IF;

  RETURN NEW;
END;
$$;

-- 3. Update handle_new_user to insert welcome notification
CREATE OR REPLACE FUNCTION handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_username text;
  v_retry_count integer := 0;
  v_max_retries integer := 5;
  v_success boolean := false;
  v_error_message text;
BEGIN
  WHILE v_retry_count < v_max_retries AND NOT v_success LOOP
    BEGIN
      v_username := generate_username(NEW.id);
      
      INSERT INTO profiles (
        id,
        username,
        email,
        full_name,
        avatar_url,
        bio,
        balance
      ) VALUES (
        NEW.id,
        v_username,
        NEW.email,
        COALESCE(NEW.raw_user_meta_data->>'full_name', ''),
        COALESCE(NEW.raw_user_meta_data->>'avatar_url', ''),
        '',
        100
      );
      
      v_success := true;
      
    EXCEPTION
      WHEN unique_violation THEN
        v_retry_count := v_retry_count + 1;
        IF v_retry_count >= v_max_retries THEN
          RAISE EXCEPTION 'Failed to generate unique username after % attempts', v_max_retries;
        END IF;
      WHEN OTHERS THEN
        GET STACKED DIAGNOSTICS v_error_message = MESSAGE_TEXT;
        RAISE WARNING 'Error in handle_new_user: %', v_error_message;
        RAISE;
    END;
  END LOOP;
  
  PERFORM initialize_notification_sound_preferences(NEW.id);
  
  INSERT INTO tutorial_state (user_id, completed, coin_pool_rewarded)
  VALUES (NEW.id, false, false)
  ON CONFLICT (user_id) DO NOTHING;

  INSERT INTO user_notifications (user_id, notification_type, message, activity_feed_type)
  VALUES (
    NEW.id,
    'achievement',
    'Welcome to the family! 🚀 Your journey starts here.',
    'gold'
  );
  
  RETURN NEW;
EXCEPTION
  WHEN OTHERS THEN
    GET STACKED DIAGNOSTICS v_error_message = MESSAGE_TEXT;
    RAISE WARNING 'Fatal error in handle_new_user: %', v_error_message;
    RAISE;
END;
$$;

-- 4. Update claim_friend_milestone_reward_v2 to insert milestone notifications
CREATE OR REPLACE FUNCTION claim_friend_milestone_reward_v2(
  p_user_id uuid,
  p_milestone_level integer
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_already_claimed boolean;
  v_friend_count integer;
  v_pool_balance numeric;
  v_reward_amount numeric;
  v_transaction_id uuid;
  v_new_balance numeric;
  v_pool_id uuid;
  v_reward_type text;
  v_notification_message text;
BEGIN
  CASE p_milestone_level
    WHEN 5 THEN
      v_reward_amount := 10.00;
      v_reward_type := 'friend_milestone_5';
      v_notification_message := 'Squad Goals! 🖐️ 5 friends joined. +10 coins awarded.';
    WHEN 10 THEN
      v_reward_amount := 20.00;
      v_reward_type := 'friend_milestone_10';
      v_notification_message := 'You''re popular! 🙌 10 friends joined. +20 coins awarded.';
    WHEN 25 THEN
      v_reward_amount := 50.00;
      v_reward_type := 'friend_milestone_25';
      v_notification_message := 'Social Star! ⭐ 25 friends joined. +50 coins awarded.';
    WHEN 50 THEN
      v_reward_amount := 100.00;
      v_reward_type := 'friend_milestone_50';
      v_notification_message := 'Network King! 👑 50 friends joined. +100 coins awarded.';
    ELSE
      RETURN jsonb_build_object(
        'success', false,
        'error', 'Invalid milestone level: ' || p_milestone_level
      );
  END CASE;

  SELECT EXISTS(
    SELECT 1 FROM reward_logs
    WHERE user_id = p_user_id
      AND reward_type = v_reward_type
      AND milestone_level = p_milestone_level
      AND status = 'claimed'
  ) INTO v_already_claimed;

  IF v_already_claimed THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'Milestone ' || p_milestone_level || ' reward already claimed'
    );
  END IF;

  SELECT friend_count INTO v_friend_count
  FROM profiles
  WHERE id = p_user_id;

  IF v_friend_count < p_milestone_level THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'User has only ' || v_friend_count || ' friends, needs ' || p_milestone_level,
      'friend_count', v_friend_count
    );
  END IF;

  SELECT id, remaining_coins INTO v_pool_id, v_pool_balance
  FROM coin_pool
  WHERE pool_type = 'community'
  FOR UPDATE;

  IF v_pool_balance IS NULL OR v_pool_balance < v_reward_amount THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'Insufficient coins in community pool'
    );
  END IF;

  UPDATE coin_pool
  SET
    distributed_coins = distributed_coins + v_reward_amount,
    remaining_coins = remaining_coins - v_reward_amount,
    updated_at = now()
  WHERE id = v_pool_id;

  INSERT INTO coin_transactions (
    user_id,
    amount,
    transaction_type,
    description
  ) VALUES (
    p_user_id,
    v_reward_amount,
    'reward_friend_milestone',
    'Friend Milestone: ' || p_milestone_level || ' Friends (+' || v_reward_amount || ' coins)'
  ) RETURNING id INTO v_transaction_id;

  SELECT coin_balance INTO v_new_balance
  FROM profiles
  WHERE id = p_user_id;

  INSERT INTO reward_logs (
    user_id,
    reward_type,
    amount,
    milestone_level,
    status,
    transaction_id
  ) VALUES (
    p_user_id,
    v_reward_type,
    v_reward_amount::integer,
    p_milestone_level,
    'claimed',
    v_transaction_id
  );

  INSERT INTO admin_security_log (
    user_id,
    event_type,
    operation_type,
    severity,
    details
  ) VALUES (
    p_user_id,
    'friend_milestone_reward',
    'Friend milestone reward claimed: ' || p_milestone_level || ' friends',
    'info',
    jsonb_build_object(
      'milestone_level', p_milestone_level,
      'reward_amount', v_reward_amount,
      'friend_count', v_friend_count,
      'transaction_id', v_transaction_id
    )
  );

  INSERT INTO user_notifications (user_id, notification_type, message, activity_feed_type)
  VALUES (p_user_id, 'achievement', v_notification_message, 'gold');

  RETURN jsonb_build_object(
    'success', true,
    'milestone_level', p_milestone_level,
    'reward_amount', v_reward_amount,
    'new_balance', v_new_balance,
    'transaction_id', v_transaction_id,
    'friend_count', v_friend_count
  );
EXCEPTION WHEN OTHERS THEN
  INSERT INTO admin_security_log (
    user_id,
    event_type,
    operation_type,
    severity,
    details
  ) VALUES (
    p_user_id,
    'friend_milestone_error',
    'Error claiming friend milestone reward: ' || SQLERRM,
    'low',
    jsonb_build_object(
      'milestone_level', p_milestone_level,
      'error', SQLERRM
    )
  );

  RETURN jsonb_build_object(
    'success', false,
    'error', 'Error claiming reward: ' || SQLERRM
  );
END;
$$;

-- 5. Create trigger function for profile likes notification
CREATE OR REPLACE FUNCTION notify_on_profile_like()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
  IF NEW.is_like = true AND NEW.user_id != NEW.profile_id THEN
    INSERT INTO user_notifications (user_id, notification_type, related_user_id, message, activity_feed_type)
    VALUES (
      NEW.profile_id,
      'social',
      NEW.user_id,
      'Someone just gave you a like! ⭐ Check your profile.',
      'blue'
    );
  END IF;
  RETURN NEW;
END;
$$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_trigger WHERE tgname = 'profile_like_notification_trigger'
  ) THEN
    CREATE TRIGGER profile_like_notification_trigger
      AFTER INSERT ON profile_likes
      FOR EACH ROW
      EXECUTE FUNCTION notify_on_profile_like();
  END IF;
END $$;

-- 6. Update increment_comments_count to also insert comment notification
CREATE OR REPLACE FUNCTION increment_comments_count()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
  UPDATE profiles
  SET comments_count = COALESCE(comments_count, 0) + 1
  WHERE id = NEW.profile_id;

  IF NEW.user_id IS DISTINCT FROM NEW.profile_id THEN
    INSERT INTO user_notifications (user_id, notification_type, related_user_id, message, activity_feed_type)
    VALUES (
      NEW.profile_id,
      'social',
      NEW.user_id,
      'You''ve been mentioned! 💬 Someone commented on your profile.',
      'blue'
    );
  END IF;

  RETURN NEW;
END;
$$;

-- 7. Update claim_whatsapp_verification_reward to insert verification notification
CREATE OR REPLACE FUNCTION claim_whatsapp_verification_reward(p_user_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_already_claimed boolean;
  v_pool_balance numeric;
  v_reward_amount numeric := 10.00;
  v_transaction_id uuid;
  v_new_balance numeric;
  v_pool_id uuid;
BEGIN
  SELECT EXISTS (
    SELECT 1 FROM reward_logs 
    WHERE user_id = p_user_id 
    AND reward_type = 'whatsapp_verify' 
    AND status = 'claimed'
  ) INTO v_already_claimed;

  IF v_already_claimed THEN
    RETURN jsonb_build_object('success', false, 'error', 'Reward already claimed');
  END IF;

  SELECT id, remaining_coins INTO v_pool_id, v_pool_balance 
  FROM coin_pool 
  WHERE pool_type = 'community'
  FOR UPDATE;
  
  IF v_pool_balance IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'Community pool not found');
  END IF;

  IF v_pool_balance < v_reward_amount THEN
    RETURN jsonb_build_object('success', false, 'error', 'Insufficient coins in community pool');
  END IF;

  UPDATE coin_pool 
  SET 
    distributed_coins = distributed_coins + v_reward_amount,
    remaining_coins = remaining_coins - v_reward_amount,
    updated_at = now()
  WHERE id = v_pool_id;

  INSERT INTO coin_transactions (
    user_id,
    amount,
    transaction_type,
    description
  ) VALUES (
    p_user_id,
    v_reward_amount,
    'reward_whatsapp',
    'WhatsApp Verification Reward'
  ) RETURNING id INTO v_transaction_id;

  SELECT coin_balance INTO v_new_balance
  FROM profiles
  WHERE id = p_user_id;

  INSERT INTO reward_logs (
    user_id,
    reward_type,
    amount,
    status,
    transaction_id
  ) VALUES (
    p_user_id,
    'whatsapp_verify',
    v_reward_amount::integer,
    'claimed',
    v_transaction_id
  );

  UPDATE profiles 
  SET 
    is_verified = true,
    verification_date = now()
  WHERE id = p_user_id;

  INSERT INTO user_notifications (user_id, notification_type, message, activity_feed_type)
  VALUES (p_user_id, 'achievement', 'Verified! ✅ Your profile has been officially verified.', 'gold');

  RETURN jsonb_build_object(
    'success', true, 
    'amount', v_reward_amount,
    'new_balance', v_new_balance,
    'transaction_id', v_transaction_id
  );
EXCEPTION WHEN OTHERS THEN
  RETURN jsonb_build_object(
    'success', false,
    'error', 'Error claiming reward: ' || SQLERRM
  );
END;
$$;

-- 8. Update mark_token_used to insert password change notification
CREATE OR REPLACE FUNCTION mark_token_used(
  p_token text
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_user_id uuid;
BEGIN
  UPDATE password_resets
  SET used_at = now()
  WHERE reset_token = p_token
  AND used_at IS NULL
  AND token_expiry > now()
  RETURNING user_id INTO v_user_id;
  
  IF v_user_id IS NULL THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'Invalid or expired token'
    );
  END IF;

  INSERT INTO user_notifications (user_id, notification_type, message, activity_feed_type)
  VALUES (v_user_id, 'security', 'Security Check: 🛡️ Your password was successfully updated.', 'red');
  
  RETURN jsonb_build_object(
    'success', true,
    'user_id', v_user_id
  );
  
EXCEPTION
  WHEN OTHERS THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', SQLERRM
    );
END;
$$;
