/*
  # Fix card trading functions: reference_id, coins table, and double-counting

  1. Fixed Functions
    - `purchase_card_at_fixed_price` - removed reference_id from coin_transactions INSERTs
    - `approve_purchase_request` - removed reference_id from coin_transactions INSERTs
    - `buy_myself_out` - removed reference_id, removed manual balance update (trigger handles it)
    - `create_battle_challenge` - removed reference_id, removed manual balance update
    - `accept_battle_challenge` - removed reference_id, removed manual balance update
    - `settle_battle` - removed reference_id, removed manual balance updates for STEP A
    - `cancel_battle` - removed reference_id, removed manual balance update
    - `discard_card` - removed manual balance updates (trigger handles it)
    - `accept_card_swap` - replaced coins table with profiles.coin_balance, removed fees/price changes per spec
    - `create_purchase_request` - replaced coins table with profiles.coin_balance
    - `audit_battle_royalties` - removed reference_id reads from coin_transactions
    - `correct_tommy_franco_comment_reward` - removed reference_id, removed manual balance updates

  2. Bug Fixes
    - Removed `reference_id` column from all coin_transactions INSERTs (column does not exist)
    - Replaced references to non-existent `coins` table with `profiles.coin_balance`
    - Removed manual `UPDATE profiles SET coin_balance` where trigger already handles it
    - Fixed swap logic: no coins change hands, no price change (per spec)

  3. Important Notes
    - The trigger `update_coin_balance_on_transaction` automatically updates profiles.coin_balance
      on every INSERT into coin_transactions (except coin_transfer_sent/received)
    - Functions must NOT manually update coin_balance AND insert into coin_transactions
    - The `reference_id` column exists on `transaction_details` table, not `coin_transactions`
*/

-- ============================================================
-- 1. purchase_card_at_fixed_price - remove reference_id only
-- ============================================================
CREATE OR REPLACE FUNCTION public.purchase_card_at_fixed_price(p_card_user_id uuid, p_buyer_id uuid)
 RETURNS json
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
DECLARE
v_seller_id uuid;
v_original_owner_id uuid;
v_current_price numeric;
v_new_price numeric;
v_buyer_balance numeric;
v_times_traded integer;
v_is_first_sale boolean;
v_seller_payment numeric;
v_royalty_payment numeric := 0;
v_transaction_id uuid;
v_result json;
BEGIN
PERFORM validate_coin_amount(1, p_buyer_id, 'card_purchase', 1000000);
PERFORM validate_coin_amount(1, p_card_user_id, 'card_purchase', 1000000);

SELECT owner_id, current_price, times_traded, original_owner_id
INTO v_seller_id, v_current_price, v_times_traded, v_original_owner_id
FROM card_ownership
WHERE card_user_id = p_card_user_id
FOR UPDATE;

IF NOT FOUND THEN
RAISE EXCEPTION 'Card not found';
END IF;

IF v_original_owner_id IS NULL THEN
v_original_owner_id := p_card_user_id;
UPDATE card_ownership
SET original_owner_id = p_card_user_id
WHERE card_user_id = p_card_user_id;
END IF;

v_is_first_sale := (v_times_traded = 0);

IF p_buyer_id = v_seller_id THEN
RAISE EXCEPTION 'Cannot buy your own card';
END IF;

IF p_buyer_id = v_original_owner_id AND NOT v_is_first_sale THEN
RAISE EXCEPTION 'You cannot buy your own card back from a manager';
END IF;

SELECT coin_balance INTO v_buyer_balance
FROM profiles
WHERE id = p_buyer_id
FOR UPDATE;

PERFORM validate_coin_amount(v_current_price, p_buyer_id, 'card_purchase', 1000000);

IF v_buyer_balance IS NULL OR v_buyer_balance < v_current_price THEN
RAISE EXCEPTION 'Insufficient coins. You have % but need %',
COALESCE(v_buyer_balance, 0), v_current_price;
END IF;

IF v_is_first_sale THEN
v_seller_payment := v_current_price;
v_royalty_payment := 0;
ELSE
IF v_seller_id = v_original_owner_id THEN
v_seller_payment := v_current_price;
v_royalty_payment := 0;
ELSE
v_seller_payment := v_current_price - 5.00;
v_royalty_payment := 5.00;
END IF;
END IF;

v_new_price := v_current_price + 10.00;

INSERT INTO coin_transactions (user_id, amount, transaction_type, description)
VALUES (
p_buyer_id,
-v_current_price,
'card_purchase',
'Purchased card at fixed price of ' || v_current_price || ' coins'
);

INSERT INTO coin_transactions (user_id, amount, transaction_type, description)
VALUES (
v_seller_id,
v_seller_payment,
'card_sale',
'Sold card at fixed price (received ' || v_seller_payment || ' of ' || v_current_price || ')'
);

IF v_royalty_payment > 0 AND v_seller_id != v_original_owner_id THEN
INSERT INTO coin_transactions (user_id, amount, transaction_type, description)
VALUES (
v_original_owner_id,
v_royalty_payment,
'card_royalty',
'Royalty from card resale (' || v_royalty_payment || ' coins)'
);
END IF;

UPDATE card_ownership
SET
owner_id = p_buyer_id,
current_price = v_new_price,
times_traded = times_traded + 1,
last_purchase_price = v_current_price,
acquired_at = now(),
updated_at = now()
WHERE card_user_id = p_card_user_id;

INSERT INTO card_transactions (
card_user_id, seller_id, buyer_id, sale_price, transaction_type,
card_value_at_sale, previous_value, new_value
) VALUES (
p_card_user_id, v_seller_id, p_buyer_id, v_current_price,
CASE WHEN v_is_first_sale THEN 'initial_purchase' ELSE 'sale' END,
v_current_price, v_current_price, v_new_price
) RETURNING id INTO v_transaction_id;

v_result := json_build_object(
'success', true,
'transaction_id', v_transaction_id,
'previous_value', v_current_price,
'new_value', v_new_price,
'paid_amount', v_current_price,
'seller_received', v_seller_payment,
'royalty_paid', v_royalty_payment,
'is_first_sale', v_is_first_sale
);

RETURN v_result;
END;
$function$;

-- ============================================================
-- 2. approve_purchase_request - remove reference_id only
-- ============================================================
CREATE OR REPLACE FUNCTION public.approve_purchase_request(p_request_id uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
DECLARE
v_request record;
v_ownership record;
v_buyer_balance numeric;
v_new_price numeric;
v_is_first_sale boolean;
v_seller_payment numeric;
v_royalty_amount numeric := 0;
v_original_owner_id uuid;
BEGIN
SELECT * INTO v_request FROM purchase_requests
WHERE id = p_request_id AND status = 'pending';

IF NOT FOUND THEN
RETURN jsonb_build_object('success', false, 'error', 'Request not found or already processed');
END IF;

SELECT * INTO v_ownership FROM card_ownership
WHERE card_user_id = v_request.card_user_id
FOR UPDATE;

IF NOT FOUND THEN
RETURN jsonb_build_object('success', false, 'error', 'Card not found');
END IF;

IF v_ownership.owner_id != v_request.seller_id THEN
RETURN jsonb_build_object('success', false, 'error', 'Ownership has changed');
END IF;

SELECT coin_balance INTO v_buyer_balance
FROM profiles
WHERE id = v_request.buyer_id
FOR UPDATE;

IF v_buyer_balance IS NULL OR v_buyer_balance < v_request.requested_price THEN
RETURN jsonb_build_object('success', false, 'error', 'Buyer has insufficient coins');
END IF;

v_original_owner_id := COALESCE(v_ownership.original_owner_id, v_request.card_user_id);
v_is_first_sale := (v_ownership.times_traded = 0 AND v_request.seller_id = v_request.card_user_id);
v_new_price := v_ownership.current_price + 10.00;

IF v_is_first_sale THEN
v_seller_payment := v_request.requested_price;
v_royalty_amount := 0;
ELSE
IF v_request.seller_id = v_original_owner_id THEN
v_seller_payment := v_request.requested_price;
v_royalty_amount := 0;
ELSE
v_seller_payment := v_request.requested_price - 5.00;
v_royalty_amount := 5.00;
END IF;
END IF;

INSERT INTO coin_transactions (user_id, amount, transaction_type, description)
VALUES (
v_request.buyer_id,
-v_request.requested_price,
'card_purchase',
'Purchased card via request at ' || v_request.requested_price || ' coins'
);

INSERT INTO coin_transactions (user_id, amount, transaction_type, description)
VALUES (
v_request.seller_id,
v_seller_payment,
'card_sale',
'Sold card via request (received ' || v_seller_payment || ' of ' || v_request.requested_price || ')'
);

IF v_royalty_amount > 0 AND v_request.seller_id != v_original_owner_id THEN
INSERT INTO coin_transactions (user_id, amount, transaction_type, description)
VALUES (
v_original_owner_id,
v_royalty_amount,
'card_royalty',
'Royalty from card resale (' || v_royalty_amount || ' coins)'
);
END IF;

IF v_ownership.original_owner_id IS NULL THEN
UPDATE card_ownership
SET original_owner_id = v_request.card_user_id
WHERE card_user_id = v_request.card_user_id;
END IF;

UPDATE card_ownership
SET
owner_id = v_request.buyer_id,
current_price = v_new_price,
times_traded = times_traded + 1,
last_sale_price = v_request.requested_price,
last_purchase_price = v_request.requested_price,
is_listed_for_sale = false,
acquired_at = now(),
updated_at = now()
WHERE card_user_id = v_request.card_user_id;

INSERT INTO card_transactions (
card_user_id, seller_id, buyer_id, sale_price, transaction_type,
card_value_at_sale, previous_value, new_value
) VALUES (
v_request.card_user_id, v_request.seller_id, v_request.buyer_id,
v_request.requested_price,
CASE WHEN v_is_first_sale THEN 'initial_purchase' ELSE 'purchase_request_sale' END,
v_request.requested_price, v_ownership.current_price, v_new_price
);

UPDATE purchase_requests
SET status = 'approved', response_date = now()
WHERE id = p_request_id;

INSERT INTO notifications (user_id, actor_id, type, message, metadata)
VALUES (
v_request.buyer_id,
v_request.seller_id,
'purchase_approved',
'approved your purchase request',
jsonb_build_object(
'request_id', p_request_id,
'amount', v_request.requested_price,
'card_user_id', v_request.card_user_id,
'new_price', v_new_price,
'royalty_paid', v_royalty_amount
)
);

RETURN jsonb_build_object(
'success', true,
'new_owner', v_request.buyer_id,
'sale_price', v_request.requested_price,
'seller_received', v_seller_payment,
'new_price', v_new_price,
'is_first_sale', v_is_first_sale,
'royalty_paid', v_royalty_amount
);
END;
$function$;

-- ============================================================
-- 3. buy_myself_out - remove reference_id + fix double-counting
-- ============================================================
CREATE OR REPLACE FUNCTION public.buy_myself_out(p_card_user_id uuid, p_original_owner_id uuid)
 RETURNS json
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
DECLARE
v_current_holder_id uuid;
v_original_owner_id uuid;
v_current_price numeric;
v_total_cost numeric;
v_payment_to_holder numeric := 100.00;
v_buyer_balance numeric;
v_transaction_id uuid;
v_dump_pool_id uuid;
v_result json;
BEGIN
SELECT id INTO v_dump_pool_id
FROM resource_pools
WHERE pool_name = 'DUMP';

IF v_dump_pool_id IS NULL THEN
RAISE EXCEPTION 'DUMP pool not found. Please contact support.';
END IF;

SELECT owner_id, current_price, original_owner_id
INTO v_current_holder_id, v_current_price, v_original_owner_id
FROM card_ownership
WHERE card_user_id = p_card_user_id
FOR UPDATE;

IF NOT FOUND THEN
RAISE EXCEPTION 'Card not found';
END IF;

IF p_original_owner_id != v_original_owner_id THEN
RAISE EXCEPTION 'Only the original card owner can buy themselves out';
END IF;

IF p_original_owner_id != p_card_user_id THEN
RAISE EXCEPTION 'You can only buy out your own card';
END IF;

IF p_original_owner_id = v_current_holder_id THEN
RAISE EXCEPTION 'You already own this card';
END IF;

v_total_cost := v_current_price + v_payment_to_holder;

SELECT coin_balance INTO v_buyer_balance
FROM profiles
WHERE id = p_original_owner_id;

IF v_buyer_balance IS NULL OR v_buyer_balance < v_total_cost THEN
RAISE EXCEPTION 'Insufficient coins. You have % but need % (card price % + payment to holder %)',
COALESCE(v_buyer_balance, 0), v_total_cost, v_current_price, v_payment_to_holder;
END IF;

INSERT INTO coin_transactions (user_id, amount, transaction_type, description)
VALUES (
p_original_owner_id,
-v_total_cost,
'card_buyout',
'Bought back own card (' || v_current_price || ' coins to DUMP + ' || v_payment_to_holder || ' coins to holder)'
);

INSERT INTO coin_transactions (user_id, amount, transaction_type, description)
VALUES (
v_current_holder_id,
v_payment_to_holder,
'card_buyout_payment',
'Received 100 coins from card buyout'
);

INSERT INTO coin_transactions (user_id, amount, transaction_type, description)
VALUES (
p_original_owner_id,
v_current_price,
'card_buyout_dump',
'Card reclamation fee to DUMP pool (' || v_current_price || ' coins)'
);

UPDATE resource_pools
SET
total_coins = total_coins + v_current_price,
updated_at = now()
WHERE id = v_dump_pool_id;

IF NOT FOUND THEN
RAISE EXCEPTION 'Failed to update DUMP pool';
END IF;

UPDATE card_ownership
SET
owner_id = p_original_owner_id,
times_traded = times_traded + 1,
last_purchase_price = v_total_cost,
acquired_at = now(),
updated_at = now()
WHERE card_user_id = p_card_user_id;

INSERT INTO card_transactions (
card_user_id,
seller_id,
buyer_id,
sale_price,
transaction_type,
card_value_at_sale,
previous_value,
new_value
)
VALUES (
p_card_user_id,
v_current_holder_id,
p_original_owner_id,
v_total_cost,
'buyout',
v_current_price,
v_current_price,
v_current_price
)
RETURNING id INTO v_transaction_id;

INSERT INTO admin_security_log (
event_type,
severity,
operation_type,
details
) VALUES (
'validation_failed',
'info',
'card_buyout',
jsonb_build_object(
'transaction_id', v_transaction_id,
'card_user_id', p_card_user_id,
'buyer_id', p_original_owner_id,
'seller_id', v_current_holder_id,
'total_cost', v_total_cost,
'payment_to_holder', v_payment_to_holder,
'payment_to_dump', v_current_price,
'dump_pool_routing', 'direct',
'community_pool_involved', false,
'coins_burned', 0,
'transaction_type', 'direct_user_payment',
'timestamp', now()
)
);

v_result := json_build_object(
'success', true,
'transaction_id', v_transaction_id,
'card_price', v_current_price,
'payment_to_holder', v_payment_to_holder,
'total_cost', v_total_cost,
'coins_burned', 0,
'payment_to_dump', v_current_price,
'dump_pool_active', true,
'community_pool_involved', false,
'transaction_type', 'direct_user_payment'
);

RETURN v_result;

EXCEPTION WHEN OTHERS THEN
RAISE EXCEPTION 'Buyout failed: %', SQLERRM;
END;
$function$;

-- ============================================================
-- 4. create_battle_challenge - remove reference_id + fix double-counting
-- ============================================================
CREATE OR REPLACE FUNCTION public.create_battle_challenge(p_challenger_id uuid, p_opponent_id uuid, p_wager_amount numeric)
 RETURNS json
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
DECLARE
v_battle_id uuid;
v_challenger_balance numeric;
BEGIN
IF p_challenger_id = p_opponent_id THEN
RETURN json_build_object('success', false, 'error', 'Cannot challenge yourself');
END IF;

IF p_wager_amount < 50 OR p_wager_amount > 200 THEN
RETURN json_build_object('success', false, 'error', 'Wager must be between 50 and 200 coins');
END IF;

IF NOT check_manager_status(p_challenger_id) THEN
RETURN json_build_object('success', false, 'error', 'You must own 5+ cards to battle');
END IF;

IF NOT check_manager_status(p_opponent_id) THEN
RETURN json_build_object('success', false, 'error', 'Opponent must own 5+ cards');
END IF;

IF EXISTS (
SELECT 1 FROM battles
WHERE status IN ('waiting', 'active')
AND (manager1_id IN (p_challenger_id, p_opponent_id)
OR manager2_id IN (p_challenger_id, p_opponent_id))
) THEN
RETURN json_build_object('success', false, 'error', 'A player already has an active battle');
END IF;

SELECT coin_balance INTO v_challenger_balance
FROM profiles WHERE id = p_challenger_id FOR UPDATE;

IF v_challenger_balance < p_wager_amount THEN
RETURN json_build_object('success', false, 'error', 'Insufficient coins for wager');
END IF;

INSERT INTO battles (manager1_id, manager2_id, wager_amount, status)
VALUES (p_challenger_id, p_opponent_id, p_wager_amount, 'waiting')
RETURNING id INTO v_battle_id;

INSERT INTO coin_transactions (user_id, amount, transaction_type, description)
VALUES (p_challenger_id, -p_wager_amount, 'battle_wager', 'Battle wager escrowed');

RETURN json_build_object('success', true, 'battle_id', v_battle_id);

EXCEPTION WHEN OTHERS THEN
RETURN json_build_object('success', false, 'error', SQLERRM);
END;
$function$;

-- ============================================================
-- 5. accept_battle_challenge - remove reference_id + fix double-counting
-- ============================================================
CREATE OR REPLACE FUNCTION public.accept_battle_challenge(p_battle_id uuid, p_accepter_id uuid)
 RETURNS json
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
DECLARE
v_battle record;
v_accepter_balance numeric;
v_first_player uuid;
BEGIN
SELECT * INTO v_battle FROM battles
WHERE id = p_battle_id AND status = 'waiting' FOR UPDATE;

IF NOT FOUND THEN
RETURN json_build_object('success', false, 'error', 'Battle not found or already started');
END IF;

IF v_battle.manager2_id != p_accepter_id THEN
RETURN json_build_object('success', false, 'error', 'You are not the opponent in this battle');
END IF;

SELECT coin_balance INTO v_accepter_balance
FROM profiles WHERE id = p_accepter_id FOR UPDATE;

IF v_accepter_balance < v_battle.wager_amount THEN
RETURN json_build_object('success', false, 'error', 'Insufficient coins for wager');
END IF;

INSERT INTO coin_transactions (user_id, amount, transaction_type, description)
VALUES (p_accepter_id, -v_battle.wager_amount, 'battle_wager', 'Battle wager escrowed');

v_first_player := CASE WHEN random() < 0.5
THEN v_battle.manager1_id ELSE v_battle.manager2_id END;

UPDATE battles SET
status = 'active',
first_player_id = v_first_player,
current_turn_user_id = v_first_player,
turn_started_at = now()
WHERE id = p_battle_id;

RETURN json_build_object('success', true, 'first_player_id', v_first_player);

EXCEPTION WHEN OTHERS THEN
RETURN json_build_object('success', false, 'error', SQLERRM);
END;
$function$;

-- ============================================================
-- 6. settle_battle - remove reference_id + fix double-counting
-- ============================================================
CREATE OR REPLACE FUNCTION public.settle_battle(p_battle_id uuid, p_winner_id uuid)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
DECLARE
v_battle record;
v_loser_id uuid;
v_wager numeric;
v_total_pot numeric;
v_royalty_total numeric := 25;
v_royalty_per_card numeric := 5;
v_winner_payout numeric;
v_card record;
v_card_count integer := 0;
v_royalty_id uuid;
BEGIN
SELECT * INTO v_battle FROM battles WHERE id = p_battle_id;

IF NOT FOUND THEN
RAISE WARNING 'Battle not found: %', p_battle_id;
RETURN;
END IF;

v_wager := v_battle.wager_amount;
v_total_pot := v_wager * 2;
v_winner_payout := v_total_pot - v_royalty_total;

v_loser_id := CASE
WHEN p_winner_id = v_battle.manager1_id THEN v_battle.manager2_id
ELSE v_battle.manager1_id
END;

INSERT INTO coin_transactions (user_id, amount, transaction_type, description)
VALUES (
v_battle.manager1_id,
-v_wager,
'battle_wager',
format('Battle wager (%s coins)', v_wager)
);

INSERT INTO coin_transactions (user_id, amount, transaction_type, description)
VALUES (
v_battle.manager2_id,
-v_wager,
'battle_wager',
format('Battle wager (%s coins)', v_wager)
);

FOR v_card IN
SELECT co.id as card_id, co.original_owner_id, co.card_user_id
FROM card_ownership co
WHERE co.owner_id = p_winner_id
AND co.original_owner_id IS NOT NULL
ORDER BY co.acquired_at DESC
LIMIT 5
LOOP
v_card_count := v_card_count + 1;

INSERT INTO battle_royalties (battle_id, card_id, owner_id, amount, paid_at)
VALUES (p_battle_id, v_card.card_id, v_card.original_owner_id, v_royalty_per_card, now())
RETURNING id INTO v_royalty_id;

INSERT INTO coin_transactions (user_id, amount, transaction_type, description)
VALUES (
v_card.original_owner_id,
v_royalty_per_card,
'battle_royalty',
format('Battle royalty for card used in winning team')
);

END LOOP;

IF v_card_count < 5 THEN
v_winner_payout := v_total_pot - (v_card_count * v_royalty_per_card);
END IF;

INSERT INTO coin_transactions (user_id, amount, transaction_type, description)
VALUES (
p_winner_id,
v_winner_payout,
'battle_win',
format('Won battle (%s coin wager) - received %s after royalties', v_wager, v_winner_payout)
);

INSERT INTO coin_transactions (user_id, amount, transaction_type, description)
VALUES (
v_loser_id,
0,
'battle_loss',
format('Lost battle (%s coin wager)', v_wager)
);

UPDATE profiles
SET
manager_wins = manager_wins + 1,
total_battle_earnings = total_battle_earnings + v_winner_payout
WHERE id = p_winner_id;

UPDATE profiles
SET manager_losses = manager_losses + 1
WHERE id = v_loser_id;

UPDATE card_ownership
SET
is_locked_in_battle = false,
locked_since = NULL,
locked_in_battle_id = NULL
WHERE locked_in_battle_id = p_battle_id;

INSERT INTO admin_security_log (event_type, severity, operation_type, details)
VALUES (
'validation_failed',
'info',
'battle_settlement',
jsonb_build_object(
'battle_id', p_battle_id,
'winner_id', p_winner_id,
'loser_id', v_loser_id,
'wager', v_wager,
'total_pot', v_total_pot,
'royalties_paid', v_card_count * v_royalty_per_card,
'winner_payout', v_winner_payout,
'cards_paid_royalty', v_card_count,
'timestamp', now()
)
);

EXCEPTION WHEN OTHERS THEN
INSERT INTO admin_security_log (event_type, severity, operation_type, details)
VALUES (
'suspicious_activity',
'high',
'battle_settlement_error',
jsonb_build_object(
'battle_id', p_battle_id,
'winner_id', p_winner_id,
'error', SQLERRM,
'timestamp', now()
)
);
RAISE;
END;
$function$;

-- ============================================================
-- 7. cancel_battle - remove reference_id + fix double-counting
-- ============================================================
CREATE OR REPLACE FUNCTION public.cancel_battle(p_battle_id uuid, p_user_id uuid)
 RETURNS json
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
DECLARE
v_battle record;
BEGIN
SELECT * INTO v_battle FROM battles
WHERE id = p_battle_id AND status = 'waiting' FOR UPDATE;

IF NOT FOUND THEN
RETURN json_build_object('success', false, 'error', 'Battle not found or not cancellable');
END IF;

IF v_battle.manager1_id != p_user_id THEN
RETURN json_build_object('success', false, 'error', 'Only the challenger can cancel');
END IF;

INSERT INTO coin_transactions (user_id, amount, transaction_type, description)
VALUES (p_user_id, v_battle.wager_amount, 'battle_win', 'Battle wager refunded (cancelled)');

DELETE FROM battles WHERE id = p_battle_id;

RETURN json_build_object('success', true);

EXCEPTION WHEN OTHERS THEN
RETURN json_build_object('success', false, 'error', SQLERRM);
END;
$function$;

-- ============================================================
-- 8. discard_card - fix double-counting (remove manual balance updates)
-- ============================================================
CREATE OR REPLACE FUNCTION public.discard_card(p_user_id uuid, p_card_ownership_id uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
DECLARE
v_card_record RECORD;
v_user_balance numeric;
v_total_cost numeric;
v_card_price numeric;
v_bonus numeric := 10;
v_original_owner_id uuid;
v_new_card_value numeric;
v_discard_id uuid;
BEGIN
SELECT
co.card_user_id,
co.owner_id,
co.original_owner_id,
co.current_price,
co.is_locked_in_battle,
p.username as player_username,
p.full_name as player_full_name
INTO v_card_record
FROM card_ownership co
INNER JOIN profiles p ON co.card_user_id = p.id
WHERE co.id = p_card_ownership_id;

IF NOT FOUND THEN
RETURN jsonb_build_object(
'success', false,
'error', 'Card not found'
);
END IF;

IF v_card_record.owner_id != p_user_id THEN
RETURN jsonb_build_object(
'success', false,
'error', 'You do not own this card'
);
END IF;

IF COALESCE(v_card_record.is_locked_in_battle, false) = true THEN
RETURN jsonb_build_object(
'success', false,
'error', 'Cannot discard card locked in battle'
);
END IF;

SELECT COALESCE(coin_balance, 0) INTO v_user_balance
FROM profiles
WHERE id = p_user_id;

v_card_price := v_card_record.current_price;
v_total_cost := v_card_price + v_bonus;

IF v_user_balance < v_total_cost THEN
RETURN jsonb_build_object(
'success', false,
'error', 'Insufficient coins. You need ' || v_total_cost || ' coins to discard this card.'
);
END IF;

v_original_owner_id := v_card_record.original_owner_id;
v_new_card_value := v_card_price + 10;

UPDATE card_ownership
SET current_price = v_new_card_value
WHERE card_user_id = v_card_record.card_user_id;

INSERT INTO card_discards (
user_id,
card_user_id,
original_owner_id,
card_price_at_discard,
bonus_amount,
total_paid,
card_value_before,
card_value_after
) VALUES (
p_user_id,
v_card_record.card_user_id,
v_original_owner_id,
v_card_price,
v_bonus,
v_total_cost,
v_card_price,
v_new_card_value
) RETURNING id INTO v_discard_id;

INSERT INTO coin_transactions (
user_id,
amount,
transaction_type,
description,
related_user_id
) VALUES (
p_user_id,
-v_total_cost,
'card_discard',
'Discarded card: ' || v_card_record.player_username || ' (Price: ' || v_card_price || ' + Bonus: ' || v_bonus || ')',
v_original_owner_id
);

IF v_original_owner_id IS NOT NULL AND v_original_owner_id != p_user_id THEN
INSERT INTO coin_transactions (
user_id,
amount,
transaction_type,
description,
related_user_id
) VALUES (
v_original_owner_id,
v_total_cost,
'card_discard_payment',
'Received discard payment for card: ' || v_card_record.player_username,
p_user_id
);
END IF;

DELETE FROM card_ownership
WHERE id = p_card_ownership_id;

RETURN jsonb_build_object(
'success', true,
'discard_id', v_discard_id,
'card_user_id', v_card_record.card_user_id,
'total_paid', v_total_cost,
'card_price', v_card_price,
'bonus', v_bonus,
'original_owner_id', v_original_owner_id,
'new_card_value', v_new_card_value
);

EXCEPTION
WHEN OTHERS THEN
RETURN jsonb_build_object(
'success', false,
'error', 'Discard failed: ' || SQLERRM
);
END;
$function$;

-- ============================================================
-- 9. accept_card_swap - replace coins table, remove fees/price changes
-- ============================================================
CREATE OR REPLACE FUNCTION public.accept_card_swap(p_swap_id uuid, p_acceptor_id uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
DECLARE
v_swap record;
BEGIN
SELECT * INTO v_swap
FROM card_swaps
WHERE id = p_swap_id
AND status = 'pending'
AND (manager_a_id = p_acceptor_id OR manager_b_id = p_acceptor_id)
AND initiated_by != p_acceptor_id;

IF NOT FOUND THEN
RETURN jsonb_build_object(
'success', false,
'error', 'Swap not found or already processed'
);
END IF;

UPDATE card_ownership
SET owner_id = v_swap.manager_b_id,
acquired_at = now(),
is_listed_for_sale = false,
asking_price = NULL
WHERE card_user_id = v_swap.card_a_user_id;

UPDATE card_ownership
SET owner_id = v_swap.manager_a_id,
acquired_at = now(),
is_listed_for_sale = false,
asking_price = NULL
WHERE card_user_id = v_swap.card_b_user_id;

UPDATE card_swaps
SET status = 'completed',
completed_at = now()
WHERE id = p_swap_id;

UPDATE card_swap_listings
SET status = 'swapped'
WHERE card_user_id IN (v_swap.card_a_user_id, v_swap.card_b_user_id)
AND status = 'active';

RETURN jsonb_build_object(
'success', true,
'swap_id', p_swap_id
);

EXCEPTION
WHEN OTHERS THEN
RETURN jsonb_build_object(
'success', false,
'error', 'Swap failed: ' || SQLERRM
);
END;
$function$;

-- ============================================================
-- 10. create_purchase_request - replace coins table with profiles
-- ============================================================
CREATE OR REPLACE FUNCTION public.create_purchase_request(p_card_user_id uuid, p_buyer_id uuid, p_requested_price numeric, p_request_type text DEFAULT 'not_bought'::text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
DECLARE
v_ownership record;
v_request_id uuid;
v_buyer_balance numeric;
BEGIN
IF p_card_user_id = p_buyer_id THEN
RETURN jsonb_build_object('success', false, 'error', 'Cannot purchase your own card');
END IF;

SELECT * INTO v_ownership
FROM card_ownership
WHERE card_user_id = p_card_user_id;

IF NOT FOUND THEN
RETURN jsonb_build_object('success', false, 'error', 'Card not found');
END IF;

SELECT coin_balance INTO v_buyer_balance
FROM profiles
WHERE id = p_buyer_id;

IF COALESCE(v_buyer_balance, 0) < p_requested_price THEN
RETURN jsonb_build_object('success', false, 'error', 'Insufficient coins');
END IF;

IF EXISTS (
SELECT 1 FROM purchase_requests
WHERE card_user_id = p_card_user_id
AND buyer_id = p_buyer_id
AND status = 'pending'
) THEN
RETURN jsonb_build_object('success', false, 'error', 'You already have a pending request for this card');
END IF;

INSERT INTO purchase_requests (
card_user_id,
buyer_id,
seller_id,
requested_price,
request_type
) VALUES (
p_card_user_id,
p_buyer_id,
v_ownership.owner_id,
p_requested_price,
p_request_type
) RETURNING id INTO v_request_id;

INSERT INTO notifications (user_id, actor_id, type, message, metadata)
VALUES (
v_ownership.owner_id,
p_buyer_id,
'purchase_request',
'sent you a purchase request for your card',
jsonb_build_object('request_id', v_request_id, 'amount', p_requested_price, 'card_user_id', p_card_user_id)
);

RETURN jsonb_build_object('success', true, 'request_id', v_request_id);
END;
$function$;

-- ============================================================
-- 11. audit_battle_royalties (table-returning overload) - remove reference_id reads
-- ============================================================
CREATE OR REPLACE FUNCTION public.audit_battle_royalties(p_battle_id uuid DEFAULT NULL::uuid)
 RETURNS TABLE(battle_id uuid, winner_id uuid, loser_id uuid, wager_amount numeric, expected_royalties numeric, actual_royalties_paid numeric, royalty_recipients integer, winner_received numeric, loser_lost numeric, status text)
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
BEGIN
RETURN QUERY
SELECT
b.id as battle_id,
b.winner_id,
CASE WHEN b.winner_id = b.manager1_id THEN b.manager2_id ELSE b.manager1_id END as loser_id,
b.wager_amount,
25::numeric as expected_royalties,
COALESCE((SELECT SUM(br.amount) FROM battle_royalties br WHERE br.battle_id = b.id), 0) as actual_royalties_paid,
COALESCE((SELECT COUNT(*)::integer FROM battle_royalties br WHERE br.battle_id = b.id), 0) as royalty_recipients,
COALESCE((
SELECT ct.amount FROM coin_transactions ct
WHERE ct.user_id = b.winner_id AND ct.transaction_type = 'battle_win'
AND ct.created_at >= b.completed_at - interval '1 minute'
AND ct.created_at <= b.completed_at + interval '1 minute'
LIMIT 1
), 0) as winner_received,
COALESCE((
SELECT ABS(ct.amount) FROM coin_transactions ct
WHERE ct.transaction_type = 'battle_wager'
AND ct.user_id = CASE WHEN b.winner_id = b.manager1_id THEN b.manager2_id ELSE b.manager1_id END
AND ct.created_at >= b.created_at - interval '1 minute'
AND ct.created_at <= COALESCE(b.completed_at, now()) + interval '1 minute'
LIMIT 1
), 0) as loser_lost,
b.status::text
FROM battles b
WHERE b.status IN ('completed', 'forfeited')
AND (p_battle_id IS NULL OR b.id = p_battle_id)
ORDER BY b.completed_at DESC
LIMIT 50;
END;
$function$;

-- ============================================================
-- 12. correct_tommy_franco_comment_reward - remove reference_id + fix double-counting
-- ============================================================
CREATE OR REPLACE FUNCTION public.correct_tommy_franco_comment_reward()
 RETURNS json
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
DECLARE
v_user_id uuid;
v_pool_id uuid;
v_current_balance numeric;
v_old_reward numeric := 0.10;
v_new_reward numeric := 1.0;
v_adjustment numeric := 0.90;
v_pool_remaining numeric;
v_ref_id text;
BEGIN
SELECT id, coin_balance INTO v_user_id, v_current_balance
FROM profiles
WHERE username = 'tommy_franco';

IF v_user_id IS NULL THEN
RETURN json_build_object(
'success', false,
'error', 'User TOMMY_FRANCO not found'
);
END IF;

SELECT id, remaining_coins INTO v_pool_id, v_pool_remaining
FROM coin_pool
ORDER BY created_at DESC
LIMIT 1;

IF v_pool_remaining < v_adjustment THEN
RETURN json_build_object(
'success', false,
'error', 'Insufficient coins in pool'
);
END IF;

UPDATE coin_pool
SET
distributed_coins = distributed_coins - v_old_reward,
remaining_coins = remaining_coins + v_old_reward,
updated_at = now()
WHERE id = v_pool_id;

SELECT id::text INTO v_ref_id FROM comment_coin_rewards WHERE user_id = v_user_id LIMIT 1;

INSERT INTO coin_transactions (
user_id,
amount,
transaction_type,
description
) VALUES (
v_user_id,
-v_old_reward,
'comment_reward',
'Correction: Reversal of old comment reward rate (0.10 coins)'
);

UPDATE coin_pool
SET
distributed_coins = distributed_coins + v_new_reward,
remaining_coins = remaining_coins - v_new_reward,
updated_at = now()
WHERE id = v_pool_id;

INSERT INTO coin_transactions (
user_id,
amount,
transaction_type,
description
) VALUES (
v_user_id,
v_new_reward,
'comment_reward',
'Correction: Updated comment reward rate (1.0 coin)'
);

UPDATE comment_coin_rewards
SET coins_awarded = v_new_reward
WHERE user_id = v_user_id;

SELECT coin_balance INTO v_current_balance
FROM profiles
WHERE id = v_user_id;

RETURN json_build_object(
'success', true,
'user_id', v_user_id,
'old_balance', v_current_balance - v_adjustment,
'adjustment', v_adjustment,
'new_balance', v_current_balance,
'old_reward', v_old_reward,
'new_reward', v_new_reward,
'message', 'Successfully corrected TOMMY_FRANCO comment reward'
);

EXCEPTION WHEN OTHERS THEN
RETURN json_build_object(
'success', false,
'error', SQLERRM,
'detail', 'Transaction rolled back'
);
END;
$function$;
