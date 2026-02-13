/*
  # Fix RLS Policies and Consolidate Duplicate Permissive Policies

  1. Auth.uid() Optimization
    - `notification_sound_preferences` - 3 policies updated to use (select auth.uid())
    - `notification_sound_played` - 2 policies updated to use (select auth.uid())

  2. Duplicate Policy Consolidation (identical policies merged)
    - `battle_royalties` SELECT - removed duplicate "Users can view their royalties"
    - `battles` SELECT - removed narrower "Users can view their own battles"
    - `notification_counts` UPDATE - removed duplicate "notification_counts_strict_update"
    - `profiles` UPDATE - removed duplicate "Users can update own privacy settings"
    - `active_battle_cache` SELECT - removed redundant authenticated policy (public policy covers it)

  3. Dual-Policy Merges (combined into single OR-based policies)
    - `coin_transfers` SELECT - merged sent/received into one policy
    - `transaction_details` SELECT - merged own/related into one policy
    - `card_ownership` UPDATE - merged service/owner into one policy
    - `enforcement_history` SELECT - merged admin/user into one policy
    - `filtered_comments_log` SELECT - merged admin/user into one policy
    - `moderation_cases` SELECT and UPDATE - merged admin/user into one policy each
    - `password_resets` SELECT - merged admin/user into one policy
    - `reports` SELECT - merged admin/user into one policy

  4. ALL Policy Splits (replaced ALL with specific INSERT/UPDATE/DELETE)
    - `colleges` - split admin ALL into INSERT, UPDATE, DELETE
    - `schools` - split admin ALL into INSERT, UPDATE, DELETE
    - `universities` - split admin ALL into INSERT, UPDATE, DELETE
    - `tier_badges` - dropped redundant ALL policy (service_role bypasses RLS)
*/

-- ============================================================
-- Part A: Fix auth.uid() -> (select auth.uid()) optimization
-- ============================================================

-- notification_sound_preferences
DROP POLICY IF EXISTS "Users can view own sound preferences" ON public.notification_sound_preferences;
CREATE POLICY "Users can view own sound preferences"
  ON public.notification_sound_preferences FOR SELECT TO authenticated
  USING ((select auth.uid()) = user_id);

DROP POLICY IF EXISTS "Users can insert own sound preferences" ON public.notification_sound_preferences;
CREATE POLICY "Users can insert own sound preferences"
  ON public.notification_sound_preferences FOR INSERT TO authenticated
  WITH CHECK ((select auth.uid()) = user_id);

DROP POLICY IF EXISTS "Users can update own sound preferences" ON public.notification_sound_preferences;
CREATE POLICY "Users can update own sound preferences"
  ON public.notification_sound_preferences FOR UPDATE TO authenticated
  USING ((select auth.uid()) = user_id)
  WITH CHECK ((select auth.uid()) = user_id);

-- notification_sound_played
DROP POLICY IF EXISTS "Users can view own played sounds" ON public.notification_sound_played;
CREATE POLICY "Users can view own played sounds"
  ON public.notification_sound_played FOR SELECT TO authenticated
  USING ((select auth.uid()) = user_id);

DROP POLICY IF EXISTS "Users can insert own played sounds" ON public.notification_sound_played;
CREATE POLICY "Users can insert own played sounds"
  ON public.notification_sound_played FOR INSERT TO authenticated
  WITH CHECK ((select auth.uid()) = user_id);

-- ============================================================
-- Part B: Drop duplicate/redundant policies
-- ============================================================

DROP POLICY IF EXISTS "Users can view their royalties" ON public.battle_royalties;

DROP POLICY IF EXISTS "Users can view their own battles" ON public.battles;

DROP POLICY IF EXISTS "notification_counts_strict_update" ON public.notification_counts;

DROP POLICY IF EXISTS "Users can update own privacy settings" ON public.profiles;

DROP POLICY IF EXISTS "Participants can view their active battle cache" ON public.active_battle_cache;

-- ============================================================
-- Part C: Merge dual SELECT/UPDATE policies into single policies
-- ============================================================

-- coin_transfers: combine sent + received SELECT
DROP POLICY IF EXISTS "Users can view own sent transfers" ON public.coin_transfers;
DROP POLICY IF EXISTS "Users can view own received transfers" ON public.coin_transfers;
CREATE POLICY "Users can view own transfers"
  ON public.coin_transfers FOR SELECT TO authenticated
  USING ((select auth.uid()) = sender_id OR (select auth.uid()) = recipient_id);

-- transaction_details: combine own + related SELECT
DROP POLICY IF EXISTS "Users can view their own transaction details" ON public.transaction_details;
DROP POLICY IF EXISTS "Users can view related user transaction details" ON public.transaction_details;
CREATE POLICY "Users can view own transaction details"
  ON public.transaction_details FOR SELECT TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.coin_transactions ct
    WHERE ct.id = transaction_details.transaction_id
    AND (ct.user_id = (select auth.uid()) OR ct.related_user_id = (select auth.uid()))
  ));

-- card_ownership: combine service + owner UPDATE
DROP POLICY IF EXISTS "Service can update card ownership" ON public.card_ownership;
DROP POLICY IF EXISTS "Users can update their card ownership" ON public.card_ownership;
CREATE POLICY "Authorized users can update card ownership"
  ON public.card_ownership FOR UPDATE TO authenticated
  USING (
    (select auth.uid()) = owner_id
    OR ((select auth.jwt()) ->> 'role') = 'service'
  )
  WITH CHECK (
    (select auth.uid()) = owner_id
    OR ((select auth.jwt()) ->> 'role') = 'service'
  );

-- enforcement_history: combine admin + user SELECT
DROP POLICY IF EXISTS "Admins can view all enforcement history" ON public.enforcement_history;
DROP POLICY IF EXISTS "Users can view own enforcement history" ON public.enforcement_history;
CREATE POLICY "Users and admins can view enforcement history"
  ON public.enforcement_history FOR SELECT TO authenticated
  USING (
    user_id = (select auth.uid())
    OR EXISTS (SELECT 1 FROM public.profiles WHERE id = (select auth.uid()) AND is_admin = true)
  );

-- filtered_comments_log: combine admin + user SELECT
DROP POLICY IF EXISTS "Admins can view all filtered comments" ON public.filtered_comments_log;
DROP POLICY IF EXISTS "Users can view own filtered comments" ON public.filtered_comments_log;
CREATE POLICY "Users and admins can view filtered comments"
  ON public.filtered_comments_log FOR SELECT TO authenticated
  USING (
    user_id = (select auth.uid())
    OR EXISTS (SELECT 1 FROM public.profiles WHERE id = (select auth.uid()) AND is_admin = true)
  );

-- moderation_cases: combine admin + user SELECT
DROP POLICY IF EXISTS "Admins can view all cases" ON public.moderation_cases;
DROP POLICY IF EXISTS "Users can view own cases" ON public.moderation_cases;
CREATE POLICY "Users and admins can view moderation cases"
  ON public.moderation_cases FOR SELECT TO authenticated
  USING (
    target_user_id = (select auth.uid())
    OR reporter_id = (select auth.uid())
    OR EXISTS (SELECT 1 FROM public.profiles WHERE id = (select auth.uid()) AND is_admin = true)
  );

-- moderation_cases: combine admin + user UPDATE
DROP POLICY IF EXISTS "Admins can update all cases" ON public.moderation_cases;
DROP POLICY IF EXISTS "Users can update own cases for appeals" ON public.moderation_cases;
CREATE POLICY "Users and admins can update moderation cases"
  ON public.moderation_cases FOR UPDATE TO authenticated
  USING (
    target_user_id = (select auth.uid())
    OR EXISTS (SELECT 1 FROM public.profiles WHERE id = (select auth.uid()) AND is_admin = true)
  )
  WITH CHECK (
    target_user_id = (select auth.uid())
    OR EXISTS (SELECT 1 FROM public.profiles WHERE id = (select auth.uid()) AND is_admin = true)
  );

-- password_resets: combine admin + user SELECT
DROP POLICY IF EXISTS "Admins can view all reset requests" ON public.password_resets;
DROP POLICY IF EXISTS "Users can view own reset requests" ON public.password_resets;
CREATE POLICY "Users and admins can view reset requests"
  ON public.password_resets FOR SELECT TO authenticated
  USING (
    user_id = (select auth.uid())
    OR EXISTS (SELECT 1 FROM public.profiles WHERE id = (select auth.uid()) AND is_admin = true)
  );

-- reports: combine admin + user SELECT
DROP POLICY IF EXISTS "Admins can view all reports" ON public.reports;
DROP POLICY IF EXISTS "Users can view own reports" ON public.reports;
CREATE POLICY "Users and admins can view reports"
  ON public.reports FOR SELECT TO authenticated
  USING (
    (select auth.uid()) = reporter_id
    OR EXISTS (SELECT 1 FROM public.profiles WHERE id = (select auth.uid()) AND is_admin = true)
  );

-- ============================================================
-- Part D: Replace ALL admin policies with specific operations
-- ============================================================

-- colleges
DROP POLICY IF EXISTS "Only admins can manage colleges" ON public.colleges;
CREATE POLICY "Admins can insert colleges"
  ON public.colleges FOR INSERT TO authenticated
  WITH CHECK (EXISTS (
    SELECT 1 FROM public.profiles
    WHERE id = (select auth.uid()) AND username = ANY(ARRAY['test123','admin'])
  ));
CREATE POLICY "Admins can update colleges"
  ON public.colleges FOR UPDATE TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.profiles
    WHERE id = (select auth.uid()) AND username = ANY(ARRAY['test123','admin'])
  ))
  WITH CHECK (EXISTS (
    SELECT 1 FROM public.profiles
    WHERE id = (select auth.uid()) AND username = ANY(ARRAY['test123','admin'])
  ));
CREATE POLICY "Admins can delete colleges"
  ON public.colleges FOR DELETE TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.profiles
    WHERE id = (select auth.uid()) AND username = ANY(ARRAY['test123','admin'])
  ));

-- schools
DROP POLICY IF EXISTS "Only admins can manage schools" ON public.schools;
CREATE POLICY "Admins can insert schools"
  ON public.schools FOR INSERT TO authenticated
  WITH CHECK (EXISTS (
    SELECT 1 FROM public.profiles
    WHERE id = (select auth.uid()) AND username = ANY(ARRAY['test123','admin'])
  ));
CREATE POLICY "Admins can update schools"
  ON public.schools FOR UPDATE TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.profiles
    WHERE id = (select auth.uid()) AND username = ANY(ARRAY['test123','admin'])
  ))
  WITH CHECK (EXISTS (
    SELECT 1 FROM public.profiles
    WHERE id = (select auth.uid()) AND username = ANY(ARRAY['test123','admin'])
  ));
CREATE POLICY "Admins can delete schools"
  ON public.schools FOR DELETE TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.profiles
    WHERE id = (select auth.uid()) AND username = ANY(ARRAY['test123','admin'])
  ));

-- universities
DROP POLICY IF EXISTS "Only admins can manage universities" ON public.universities;
CREATE POLICY "Admins can insert universities"
  ON public.universities FOR INSERT TO authenticated
  WITH CHECK (EXISTS (
    SELECT 1 FROM public.profiles
    WHERE id = (select auth.uid()) AND username = ANY(ARRAY['test123','admin'])
  ));
CREATE POLICY "Admins can update universities"
  ON public.universities FOR UPDATE TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.profiles
    WHERE id = (select auth.uid()) AND username = ANY(ARRAY['test123','admin'])
  ))
  WITH CHECK (EXISTS (
    SELECT 1 FROM public.profiles
    WHERE id = (select auth.uid()) AND username = ANY(ARRAY['test123','admin'])
  ));
CREATE POLICY "Admins can delete universities"
  ON public.universities FOR DELETE TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.profiles
    WHERE id = (select auth.uid()) AND username = ANY(ARRAY['test123','admin'])
  ));

-- tier_badges: drop redundant ALL policy (service_role bypasses RLS)
DROP POLICY IF EXISTS "tier_badges_strict_all" ON public.tier_badges;
