/*
  # Fix function search paths: Add pg_temp to all public functions

  1. Security Hardening
    - Adds `pg_temp` to the search_path of all functions in the public schema
    - Prevents a temp schema hijack attack where a malicious user creates a temp table
      or function that shadows a public one, potentially executing arbitrary code
    - Standard PostgreSQL security best practice

  2. Scope
    - Affects all functions in the public schema that have search_path=public but not pg_temp
    - Sets search_path to `public, pg_temp` (the recommended secure default)
    - No functional changes - only security hardening

  3. Method
    - Uses ALTER FUNCTION to update search_path in-place
    - Safe and idempotent - running again after first application has no effect
*/

DO $$
DECLARE
  r RECORD;
  updated_count INTEGER := 0;
BEGIN
  FOR r IN
    SELECT p.proname, pg_get_function_identity_arguments(p.oid) as args
    FROM pg_proc p
    JOIN pg_namespace n ON p.pronamespace = n.oid
    WHERE n.nspname = 'public'
      AND (
        p.proconfig IS NULL
        OR (
          array_to_string(p.proconfig, ',') LIKE '%search_path%'
          AND array_to_string(p.proconfig, ',') NOT LIKE '%pg_temp%'
        )
      )
    ORDER BY p.proname
  LOOP
    EXECUTE format(
      'ALTER FUNCTION public.%I(%s) SET search_path = public, pg_temp',
      r.proname, r.args
    );
    updated_count := updated_count + 1;
  END LOOP;

  RAISE NOTICE 'Updated % functions with search_path = public, pg_temp', updated_count;
END $$;