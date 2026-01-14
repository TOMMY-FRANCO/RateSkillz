/*
  # Remove Inactive Account Auto-Delete System

  ## Summary
  This migration completely removes the automatic inactive account deletion system
  that was previously implemented.

  ## Changes Made
  
  ### 1. Drop Database Functions
  - Drop `update_last_activity()` function
  - Drop `anonymize_deleted_user_references()` function  
  - Drop `process_inactive_account_deletions()` function
  - Drop `check_deletion_warnings()` function
  - Drop `mark_deletion_warning_sent()` function
  - Drop trigger function `trigger_update_last_activity()`

  ### 2. Drop Triggers
  - Drop `update_profile_activity` trigger on profiles table

  ### 3. Drop Indexes
  - Drop `idx_profiles_last_activity` index
  - Drop `idx_profiles_account_status` index
  - Drop `idx_deletion_logs_date` index

  ### 4. Drop Tables
  - Drop `deletion_logs` table (with all policies)

  ### 5. Remove Columns from profiles
  - Remove `last_activity_date` column
  - Remove `account_status` column
  - Remove `scheduled_deletion_date` column
  - Remove `deletion_warning_sent` column

  ## Result
  After this migration:
  - No automatic deletion of inactive accounts
  - No coin forfeiture on deletion
  - No deletion warnings
  - All tracking infrastructure removed
  - User accounts remain intact with all data preserved
*/

-- Drop trigger first
DROP TRIGGER IF EXISTS update_profile_activity ON profiles;

-- Drop functions
DROP FUNCTION IF EXISTS trigger_update_last_activity() CASCADE;
DROP FUNCTION IF EXISTS mark_deletion_warning_sent(uuid) CASCADE;
DROP FUNCTION IF EXISTS check_deletion_warnings() CASCADE;
DROP FUNCTION IF EXISTS process_inactive_account_deletions() CASCADE;
DROP FUNCTION IF EXISTS anonymize_deleted_user_references(uuid) CASCADE;
DROP FUNCTION IF EXISTS update_last_activity(uuid) CASCADE;

-- Drop indexes
DROP INDEX IF EXISTS idx_profiles_last_activity;
DROP INDEX IF EXISTS idx_profiles_account_status;
DROP INDEX IF EXISTS idx_deletion_logs_date;

-- Drop deletion_logs table (including all policies)
DROP TABLE IF EXISTS deletion_logs CASCADE;

-- Remove columns from profiles table
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'profiles' AND column_name = 'last_activity_date'
  ) THEN
    ALTER TABLE profiles DROP COLUMN last_activity_date;
  END IF;

  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'profiles' AND column_name = 'account_status'
  ) THEN
    ALTER TABLE profiles DROP COLUMN account_status;
  END IF;

  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'profiles' AND column_name = 'scheduled_deletion_date'
  ) THEN
    ALTER TABLE profiles DROP COLUMN scheduled_deletion_date;
  END IF;

  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'profiles' AND column_name = 'deletion_warning_sent'
  ) THEN
    ALTER TABLE profiles DROP COLUMN deletion_warning_sent;
  END IF;
END $$;
