/*
  # Create Tier Badges System

  ## Summary
  Creates a tier_badges table to store the new tier badge system based on overall rating.
  This system includes named tiers with specific color schemes and metallic properties.

  ## Changes Made

  1. **New Table: tier_badges**
     - `id` (uuid, primary key)
     - `tier_name` (text) - The display name of the tier (e.g., "EXCEPTIONAL", "LEGENDARY")
     - `overall_rating_min` (integer) - Minimum rating for this tier (inclusive)
     - `overall_rating_max` (integer) - Maximum rating for this tier (inclusive)
     - `color_code` (text) - Hex color code for the metallic color
     - `metallic_property` (text) - Description of metallic appearance
     - `gradient_from` (text) - Tailwind gradient from color
     - `gradient_via` (text) - Tailwind gradient via color
     - `gradient_to` (text) - Tailwind gradient to color
     - `border_color` (text) - Tailwind border color class
     - `glow_color` (text) - Tailwind glow color class
     - `shimmer_gradient` (text) - Tailwind shimmer gradient
     - `created_at` (timestamptz)
     - `updated_at` (timestamptz)

  2. **Initial Data**
     Populates table with 10 tier definitions:
     - Under 60: Default (no special color)
     - 60-69: EXCEPTIONAL - Metallic Blue
     - 70-79: REMARKABLE - Metallic Rich Red
     - 80-89: UNIQUE - Metallic Silver
     - 90-95: TALENTED - Metallic Gold
     - 96: PHENOMENAL - Metallic Dark Orange
     - 97: OUTSTANDING - Metallic Lime Green
     - 98: ABNORMAL - Metallic Hot Pink
     - 99: RARE - Metallic Black
     - 100: LEGENDARY - Metallic Pearl/Light Pink

  3. **Security**
     - Enable RLS on tier_badges table
     - Add policy for public read access
     - Restrict write access to authenticated users only

  4. **Functions**
     - `get_tier_by_rating(rating)` - Returns tier info for a given rating
     - `validate_tier_assignment(user_id)` - Validates user's tier based on overall_rating
*/

-- Create tier_badges table
CREATE TABLE IF NOT EXISTS tier_badges (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tier_name text NOT NULL,
  overall_rating_min integer NOT NULL CHECK (overall_rating_min >= 0 AND overall_rating_min <= 100),
  overall_rating_max integer NOT NULL CHECK (overall_rating_max >= 0 AND overall_rating_max <= 100),
  color_code text NOT NULL,
  metallic_property text NOT NULL,
  gradient_from text NOT NULL,
  gradient_via text NOT NULL,
  gradient_to text NOT NULL,
  border_color text NOT NULL,
  glow_color text NOT NULL,
  shimmer_gradient text NOT NULL,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Enable RLS
ALTER TABLE tier_badges ENABLE ROW LEVEL SECURITY;

-- Allow public read access to tier badges
CREATE POLICY "Anyone can view tier badges"
  ON tier_badges FOR SELECT
  TO public
  USING (true);

-- Only authenticated users can insert/update tier badges (for admin purposes)
CREATE POLICY "Authenticated users can manage tier badges"
  ON tier_badges FOR ALL
  TO authenticated
  USING (true)
  WITH CHECK (true);

-- Insert tier badge data
INSERT INTO tier_badges (
  tier_name,
  overall_rating_min,
  overall_rating_max,
  color_code,
  metallic_property,
  gradient_from,
  gradient_via,
  gradient_to,
  border_color,
  glow_color,
  shimmer_gradient
) VALUES
  -- Default (Under 60)
  (
    'Default',
    0,
    59,
    '#9333EA',
    'Standard Purple',
    'purple-600',
    'purple-700',
    'gray-900',
    'border-purple-400/30',
    'from-pink-400/20',
    'from-transparent via-transparent to-white/5'
  ),
  -- EXCEPTIONAL (60-69) - Metallic Blue
  (
    'EXCEPTIONAL',
    60,
    69,
    '#0EA5E9',
    'Metallic Blue',
    'sky-400',
    'blue-500',
    'blue-800',
    'border-sky-300/60',
    'from-sky-400/30',
    'from-transparent via-sky-300/25 to-transparent'
  ),
  -- REMARKABLE (70-79) - Metallic Rich Red
  (
    'REMARKABLE',
    70,
    79,
    '#DC2626',
    'Metallic Rich Red',
    'red-500',
    'red-600',
    'red-900',
    'border-red-300/70',
    'from-red-400/35',
    'from-transparent via-red-300/25 to-transparent'
  ),
  -- UNIQUE (80-89) - Metallic Silver
  (
    'UNIQUE',
    80,
    89,
    '#94A3B8',
    'Metallic Silver',
    'gray-300',
    'slate-400',
    'gray-600',
    'border-gray-200/70',
    'from-white/30',
    'from-transparent via-white/30 to-transparent'
  ),
  -- TALENTED (90-95) - Metallic Gold
  (
    'TALENTED',
    90,
    95,
    '#FBBF24',
    'Metallic Gold',
    'yellow-400',
    'amber-500',
    'yellow-700',
    'border-yellow-300/80',
    'from-yellow-300/40',
    'from-transparent via-yellow-200/40 to-transparent'
  ),
  -- PHENOMENAL (96) - Metallic Dark Orange
  (
    'PHENOMENAL',
    96,
    96,
    '#EA580C',
    'Metallic Dark Orange',
    'orange-600',
    'orange-700',
    'orange-900',
    'border-orange-400/80',
    'from-orange-400/40',
    'from-transparent via-orange-300/35 to-transparent'
  ),
  -- OUTSTANDING (97) - Metallic Lime Green
  (
    'OUTSTANDING',
    97,
    97,
    '#84CC16',
    'Metallic Lime Green',
    'lime-400',
    'lime-500',
    'lime-700',
    'border-lime-300/80',
    'from-lime-400/40',
    'from-transparent via-lime-300/35 to-transparent'
  ),
  -- ABNORMAL (98) - Metallic Hot Pink
  (
    'ABNORMAL',
    98,
    98,
    '#EC4899',
    'Metallic Hot Pink',
    'pink-500',
    'pink-600',
    'pink-800',
    'border-pink-300/80',
    'from-pink-400/40',
    'from-transparent via-pink-300/35 to-transparent'
  ),
  -- RARE (99) - Metallic Black
  (
    'RARE',
    99,
    99,
    '#000000',
    'Metallic Black',
    'gray-900',
    'black',
    'slate-950',
    'border-white/70',
    'from-purple-500/40',
    'from-transparent via-purple-300/35 to-transparent'
  ),
  -- LEGENDARY (100) - Metallic Pearl/Light Pink
  (
    'LEGENDARY',
    100,
    100,
    '#FDF2F8',
    'Metallic Pearl/Light Pink',
    'pink-100',
    'pink-200',
    'rose-300',
    'border-pink-200/90',
    'from-pink-200/50',
    'from-transparent via-pink-100/40 to-transparent'
  )
ON CONFLICT DO NOTHING;

-- Function to get tier by rating
CREATE OR REPLACE FUNCTION get_tier_by_rating(rating integer)
RETURNS tier_badges
LANGUAGE sql
STABLE
AS $$
  SELECT *
  FROM tier_badges
  WHERE rating >= overall_rating_min
    AND rating <= overall_rating_max
  LIMIT 1;
$$;

-- Function to validate tier assignment for a user
CREATE OR REPLACE FUNCTION validate_tier_assignment(user_id uuid)
RETURNS json
LANGUAGE plpgsql
STABLE
AS $$
DECLARE
  v_overall_rating integer;
  v_tier tier_badges;
BEGIN
  -- Get user's overall rating
  SELECT overall_rating INTO v_overall_rating
  FROM profiles
  WHERE id = user_id;
  
  IF v_overall_rating IS NULL THEN
    RETURN json_build_object(
      'success', false,
      'error', 'User not found or rating not set'
    );
  END IF;
  
  -- Get tier for this rating
  SELECT * INTO v_tier
  FROM tier_badges
  WHERE v_overall_rating >= overall_rating_min
    AND v_overall_rating <= overall_rating_max
  LIMIT 1;
  
  IF v_tier IS NULL THEN
    RETURN json_build_object(
      'success', false,
      'error', 'No tier found for rating',
      'rating', v_overall_rating
    );
  END IF;
  
  RETURN json_build_object(
    'success', true,
    'user_id', user_id,
    'overall_rating', v_overall_rating,
    'tier_name', v_tier.tier_name,
    'tier_id', v_tier.id
  );
  
EXCEPTION WHEN OTHERS THEN
  RETURN json_build_object(
    'success', false,
    'error', SQLERRM
  );
END;
$$;

-- Create index for faster tier lookups
CREATE INDEX IF NOT EXISTS idx_tier_badges_rating_range 
  ON tier_badges (overall_rating_min, overall_rating_max);
