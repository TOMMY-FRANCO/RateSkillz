/*
  # Update handle_new_user to Generate Username from Email

  1. Changes
    - Updates handle_new_user() to generate username from email
    - Uses generate_username_from_email() function
    - Ensures unique username for each user
    - Initializes username_customized as false (user hasn't customized yet)
  
  2. Important Notes
    - Username is stored in LOWERCASE
    - If email username is taken, appends numbers
    - First username change is always immediate
*/

-- Update function to handle new user signups with username generation
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger AS $$
DECLARE
  v_generated_username text;
BEGIN
  -- Generate unique username from email
  v_generated_username := generate_username_from_email(new.email);
  
  -- Create profile with generated username
  INSERT INTO public.profiles (
    id, 
    username, 
    email, 
    full_name, 
    username_customized,
    username_change_count,
    created_at, 
    updated_at, 
    last_active
  )
  VALUES (
    new.id,
    v_generated_username,
    new.email,
    COALESCE(new.raw_user_meta_data->>'full_name', ''),
    false,
    0,
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
