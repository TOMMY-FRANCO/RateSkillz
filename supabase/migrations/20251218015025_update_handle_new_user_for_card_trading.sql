/*
  # Update handle_new_user to Initialize Card Ownership

  1. Changes
    - Updates the handle_new_user() trigger function to also initialize card ownership
    - Every new user will automatically own their own card at 20 coins
  
  2. Important Notes
    - This ensures seamless card trading setup for all new users
    - Existing users already have card ownership initialized from previous migration
*/

-- Update function to handle new user signups with card ownership initialization
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger AS $$
BEGIN
  -- Create profile
  INSERT INTO public.profiles (id, username, email, full_name, created_at, updated_at, last_active)
  VALUES (
    new.id,
    COALESCE(new.raw_user_meta_data->>'username', split_part(new.email, '@', 1)),
    new.email,
    COALESCE(new.raw_user_meta_data->>'full_name', ''),
    now(),
    now(),
    now()
  )
  ON CONFLICT (id) DO NOTHING;
  
  -- Initialize card ownership
  INSERT INTO public.card_ownership (card_user_id, owner_id, current_price, base_price)
  VALUES (new.id, new.id, 20.00, 20.00)
  ON CONFLICT (card_user_id) DO NOTHING;
  
  RETURN new;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
