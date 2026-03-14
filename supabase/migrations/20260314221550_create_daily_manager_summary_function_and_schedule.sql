/*
  # Create daily manager summary notification function and schedule

  ## Summary
  Creates a function that sends each card user a daily summary notification
  showing who currently manages their card and what it's worth. Scheduled
  via pg_cron to run daily at 16:00 UTC.

  ## Changes

  ### New Function: send_daily_manager_summaries()
  - Queries card_ownership for all cards where owner_id != card_user_id
  - Inserts a 'transaction' / 'gold' notification for each card user
  - Message format: "Daily Summary Your card is currently managed by @ownername and is worth X coins."
  - Only inserts if the user has a manager (owner != card user)
  - Skips users who already received a summary today (idempotent)

  ### pg_cron schedule
  - Runs send_daily_manager_summaries() daily at 16:00 UTC
  - Job name: 'daily-manager-summary'

  ## Notes
  - notification_type 'transaction' is valid in existing constraint
  - activity_feed_type 'gold' shows in the Achievements section of ActivityFeed
  - No RLS changes needed (function is SECURITY DEFINER)
*/

CREATE OR REPLACE FUNCTION send_daily_manager_summaries()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_record RECORD;
  v_owner_username text;
  v_message text;
  v_today date := current_date;
BEGIN
  FOR v_record IN
    SELECT
      co.card_user_id,
      co.owner_id,
      co.current_price
    FROM card_ownership co
    WHERE co.card_user_id != co.owner_id
  LOOP
    IF EXISTS (
      SELECT 1 FROM user_notifications
      WHERE user_id = v_record.card_user_id
        AND notification_type = 'transaction'
        AND activity_feed_type = 'gold'
        AND message LIKE 'Daily Summary%'
        AND created_at::date = v_today
    ) THEN
      CONTINUE;
    END IF;

    SELECT username INTO v_owner_username
    FROM profiles
    WHERE id = v_record.owner_id;

    IF v_owner_username IS NULL THEN
      CONTINUE;
    END IF;

    v_message := 'Daily Summary Your card is currently managed by @' ||
      v_owner_username ||
      ' and is worth ' ||
      ROUND(v_record.current_price)::text ||
      ' coins.';

    INSERT INTO user_notifications (
      user_id,
      notification_type,
      message,
      activity_feed_type,
      is_read
    ) VALUES (
      v_record.card_user_id,
      'transaction',
      v_message,
      'gold',
      false
    );
  END LOOP;
END;
$$;

-- Schedule daily at 16:00 UTC using pg_cron
SELECT cron.schedule(
  'daily-manager-summary',
  '0 16 * * *',
  $$SELECT send_daily_manager_summaries()$$
)
WHERE NOT EXISTS (
  SELECT 1 FROM cron.job WHERE jobname = 'daily-manager-summary'
);
