/*
  # Fix card names on trading pages - add card subject username to cache

  1. Problem
    - Cards on trading page show no name because `card_market_cache` has no column
      for the card subject's (card_user_id) username
    - Code was incorrectly using `original_owner_username` which is NULL for 3 cards
      where `original_owner_id` was never set during profile creation

  2. Changes
    - Add `card_user_username` column to `card_market_cache` for the card subject's username
    - Add `card_user_avatar` column for the card subject's avatar
    - Backfill NULL `original_owner_id` values (set to `card_user_id` for self-owned cards)
    - Populate new columns from profiles table
    - Update `upsert_card_market_cache` function to include card subject data
    - Update profile change trigger to also sync `card_user_username` and `card_user_avatar`

  3. Modified Tables
    - `card_market_cache`: added `card_user_username` (text), `card_user_avatar` (text)

  4. Modified Functions
    - `upsert_card_market_cache`: now JOINs on card_user_id to populate card subject fields
    - `trg_profiles_update_card_cache`: now also updates card_user_username/avatar
*/

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'card_market_cache' AND column_name = 'card_user_username'
  ) THEN
    ALTER TABLE public.card_market_cache ADD COLUMN card_user_username text;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'card_market_cache' AND column_name = 'card_user_avatar'
  ) THEN
    ALTER TABLE public.card_market_cache ADD COLUMN card_user_avatar text;
  END IF;
END $$;

UPDATE public.card_ownership
SET original_owner_id = card_user_id
WHERE original_owner_id IS NULL;

UPDATE public.card_market_cache
SET original_owner_id = card_user_id
WHERE original_owner_id IS NULL;

UPDATE public.card_market_cache cmc
SET
  card_user_username = p.username,
  card_user_avatar = p.avatar_url,
  updated_at = now()
FROM public.profiles p
WHERE p.id = cmc.card_user_id;

UPDATE public.card_market_cache cmc
SET
  original_owner_username = p.username,
  updated_at = now()
FROM public.profiles p
WHERE p.id = cmc.original_owner_id
  AND cmc.original_owner_username IS NULL;

CREATE OR REPLACE FUNCTION public.upsert_card_market_cache(p_card_user_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
  INSERT INTO public.card_market_cache (
    card_user_id, owner_id, owner_username, owner_avatar,
    original_owner_id, original_owner_username,
    card_user_username, card_user_avatar,
    current_price, base_price, last_sale_price, times_traded,
    is_listed_for_sale, is_locked_in_battle, locked_in_battle_id,
    acquired_at, updated_at
  )
  SELECT
    co.card_user_id,
    co.owner_id,
    p_owner.username AS owner_username,
    p_owner.avatar_url AS owner_avatar,
    co.original_owner_id,
    p_orig.username AS original_owner_username,
    p_card.username AS card_user_username,
    p_card.avatar_url AS card_user_avatar,
    co.current_price,
    co.base_price,
    co.last_sale_price,
    co.times_traded,
    co.is_listed_for_sale,
    co.is_locked_in_battle,
    co.locked_in_battle_id,
    co.acquired_at,
    now()
  FROM public.card_ownership co
  LEFT JOIN public.profiles p_owner ON p_owner.id = co.owner_id
  LEFT JOIN public.profiles p_orig ON p_orig.id = co.original_owner_id
  LEFT JOIN public.profiles p_card ON p_card.id = co.card_user_id
  WHERE co.card_user_id = p_card_user_id
  ON CONFLICT (card_user_id) DO UPDATE SET
    owner_id = EXCLUDED.owner_id,
    owner_username = EXCLUDED.owner_username,
    owner_avatar = EXCLUDED.owner_avatar,
    original_owner_id = EXCLUDED.original_owner_id,
    original_owner_username = EXCLUDED.original_owner_username,
    card_user_username = EXCLUDED.card_user_username,
    card_user_avatar = EXCLUDED.card_user_avatar,
    current_price = EXCLUDED.current_price,
    base_price = EXCLUDED.base_price,
    last_sale_price = EXCLUDED.last_sale_price,
    times_traded = EXCLUDED.times_traded,
    is_listed_for_sale = EXCLUDED.is_listed_for_sale,
    is_locked_in_battle = EXCLUDED.is_locked_in_battle,
    locked_in_battle_id = EXCLUDED.locked_in_battle_id,
    acquired_at = EXCLUDED.acquired_at,
    updated_at = EXCLUDED.updated_at;
END;
$$;

CREATE OR REPLACE FUNCTION public.trg_profiles_update_card_cache()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
  UPDATE public.card_market_cache
  SET owner_username = NEW.username,
      owner_avatar = NEW.avatar_url,
      updated_at = now()
  WHERE owner_id = NEW.id;

  UPDATE public.card_market_cache
  SET original_owner_username = NEW.username,
      updated_at = now()
  WHERE original_owner_id = NEW.id;

  UPDATE public.card_market_cache
  SET card_user_username = NEW.username,
      card_user_avatar = NEW.avatar_url,
      updated_at = now()
  WHERE card_user_id = NEW.id;

  RETURN NEW;
END;
$$;
