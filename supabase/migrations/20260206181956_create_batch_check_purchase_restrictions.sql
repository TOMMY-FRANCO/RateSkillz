/*
  # Batch check card purchase restrictions

  1. New Functions
    - `check_purchase_restrictions_batch(uuid[], uuid)` - checks all card owner restrictions in a single call
      - Takes an array of owner IDs and a single buyer ID
      - Returns a table of (owner_id, is_restricted, reason)
      - Replaces N individual calls to `check_manager_owns_buyer_original_card` with 1 batch call

  2. Performance Impact
    - Eliminates N+1 query problem on the trading dashboard
    - Single round-trip instead of one per listed card
*/

CREATE OR REPLACE FUNCTION check_purchase_restrictions_batch(
  p_owner_ids uuid[],
  p_buyer_id uuid
)
RETURNS TABLE(owner_id uuid, is_restricted boolean, reason text)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
  RETURN QUERY
  SELECT
    o.id AS owner_id,
    CASE WHEN co.owner_id IS NOT NULL THEN true ELSE false END AS is_restricted,
    CASE WHEN co.owner_id IS NOT NULL THEN 'This manager owns one of your original cards. You cannot purchase from them.'::text ELSE NULL END AS reason
  FROM unnest(p_owner_ids) AS o(id)
  LEFT JOIN card_ownership co
    ON co.owner_id = o.id
    AND co.original_owner_id = p_buyer_id
  GROUP BY o.id, co.owner_id;
END;
$$;
