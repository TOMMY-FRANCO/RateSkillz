/*
  # Optimize RLS policies: Replace bare auth.uid() with (SELECT auth.uid())

  1. Performance Optimization
    - Replaces all bare `auth.uid()` calls in RLS policy expressions with `(SELECT auth.uid())`
    - This ensures PostgreSQL evaluates `auth.uid()` once per query rather than once per row
    - Significant performance improvement for tables with many rows

  2. Scope
    - Affects all RLS policies in the public schema that use bare `auth.uid()`
    - Policies already using `(SELECT auth.uid())` wrapper are left unchanged
    - No functional changes - only performance optimization

  3. Method
    - Uses ALTER POLICY to update USING and WITH CHECK expressions in-place
    - Uses negative lookbehind regex to avoid double-wrapping already-optimized calls
    - Safe and idempotent - running again after first application has no effect

  4. Tables affected
    - ad_views, admin_action_logs, balance_audit_log, battle_royalties, battles
    - card_discards, card_ownership, card_swap_listings, card_swap_transactions, card_swaps
    - card_transactions, coin_pool, coin_transfers, colleges, comment_earnings
    - comment_votes, conversations, friend_requests, friends, messages
    - notification_counts, oauth_accounts, page_view_coin_rewards, profile_likes
    - profiles, purchase_requests, ratings, reports, resource_pools
    - reward_logs, schools, social_links, stripe_customers, stripe_orders
    - stripe_subscriptions, transaction_details, tutorial_completions, typing_status
    - universities, user_notifications, user_status, username_history, verification_logs
*/

DO $$
DECLARE
  r RECORD;
  new_qual TEXT;
  new_check TEXT;
  has_qual_change BOOLEAN;
  has_check_change BOOLEAN;
  alter_sql TEXT;
  updated_count INTEGER := 0;
BEGIN
  FOR r IN
    SELECT schemaname, tablename, policyname, qual, with_check
    FROM pg_policies
    WHERE schemaname = 'public'
      AND (
        (qual ~ '(?<!SELECT )auth\.uid\(\)')
        OR (with_check ~ '(?<!SELECT )auth\.uid\(\)')
      )
    ORDER BY tablename, policyname
  LOOP
    has_qual_change := false;
    has_check_change := false;
    alter_sql := NULL;

    IF r.qual IS NOT NULL AND r.qual ~ '(?<!SELECT )auth\.uid\(\)' THEN
      new_qual := regexp_replace(r.qual, '(?<!SELECT )auth\.uid\(\)', '(SELECT auth.uid())', 'g');
      has_qual_change := true;
    END IF;

    IF r.with_check IS NOT NULL AND r.with_check ~ '(?<!SELECT )auth\.uid\(\)' THEN
      new_check := regexp_replace(r.with_check, '(?<!SELECT )auth\.uid\(\)', '(SELECT auth.uid())', 'g');
      has_check_change := true;
    END IF;

    IF has_qual_change AND has_check_change THEN
      alter_sql := format(
        'ALTER POLICY %I ON %I.%I USING (%s) WITH CHECK (%s)',
        r.policyname, r.schemaname, r.tablename, new_qual, new_check
      );
    ELSIF has_qual_change THEN
      alter_sql := format(
        'ALTER POLICY %I ON %I.%I USING (%s)',
        r.policyname, r.schemaname, r.tablename, new_qual
      );
    ELSIF has_check_change THEN
      alter_sql := format(
        'ALTER POLICY %I ON %I.%I WITH CHECK (%s)',
        r.policyname, r.schemaname, r.tablename, new_check
      );
    END IF;

    IF alter_sql IS NOT NULL THEN
      EXECUTE alter_sql;
      updated_count := updated_count + 1;
    END IF;
  END LOOP;

  RAISE NOTICE 'Updated % RLS policies with (SELECT auth.uid()) optimization', updated_count;
END $$;