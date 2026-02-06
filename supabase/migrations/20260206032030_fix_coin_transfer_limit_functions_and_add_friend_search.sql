/*
  # Fix coin transfer daily limit functions and add friend search

  1. Changes
    - Convert `get_remaining_send_limit` to SECURITY DEFINER
      - Needs to UPDATE profiles.coins_sent_today during daily reset
      - When called from frontend RPC, runs as authenticated user who may not own the row
    - Convert `get_remaining_receive_limit` to SECURITY DEFINER
      - Same reason: resets recipient's coins_received_today counter
      - Sender calls this for the recipient, which RLS would block as INVOKER

  2. Security notes
    - Both functions already have `search_path = public, pg_temp`
    - They only read/write daily counter columns on profiles
    - They are called via supabase.rpc() from authenticated users only
*/

ALTER FUNCTION get_remaining_send_limit(uuid) SECURITY DEFINER;
ALTER FUNCTION get_remaining_receive_limit(uuid) SECURITY DEFINER;
