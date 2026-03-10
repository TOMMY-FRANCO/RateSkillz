/*
  # Add agreed_to_terms column to profiles

  1. Modified Tables
    - `profiles`
      - Added `agreed_to_terms` (boolean, default false) - tracks whether user explicitly agreed to Terms of Service during signup

  2. Notes
    - Uses IF NOT EXISTS check to prevent errors on re-run
    - Does not drop or modify any existing columns
*/

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'profiles' AND column_name = 'agreed_to_terms' AND table_schema = 'public'
  ) THEN
    ALTER TABLE public.profiles ADD COLUMN agreed_to_terms boolean DEFAULT false;
  END IF;
END $$;