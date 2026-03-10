import { createClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

const missing: string[] = [];
if (!supabaseUrl) missing.push('VITE_SUPABASE_URL');
if (!supabaseAnonKey) missing.push('VITE_SUPABASE_ANON_KEY');
if (missing.length > 0) {
  throw new Error(
    `Missing required environment variables: ${missing.join(', ')}. ` +
    'Add them to your .env file and restart the dev server.'
  );
}

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    persistSession: true,      // Saves session to localStorage — survives app updates
    autoRefreshToken: true,    // Silently renews token before it expires
    detectSessionInUrl: false, // Required for Capacitor — avoids URL hash conflicts
  },
});

export type Profile = {
  id: string;
  username: string;
  email?: string;
  full_name: string;
  avatar_url: string | null;
  avatar_position?: { x: number; y: number; scale: number };
  bio: string | null;
  position?: string;
  number?: string;
  team?: string;
  height?: string;
  weight?: string;
  achievements?: string;
  stats?: string;
  overall_rating?: number;
  last_active?: string;
  created_at: string;
  updated_at: string;
};

export type Friends = {
  id: string;
  user_id: string;
  friend_id: string;
  status: 'pending' | 'accepted' | 'declined' | 'blocked';
  created_at: string;
};

export type Rating = {
  id: string;
  player_id: string;
  rater_id: string;
  pac: number;
  sho: number;
  pas: number;
  dri: number;
  def: number;
  phy: number;
  comment?: string;
  created_at: string;
  updated_at: string;
};

export type UserStats = {
  id: string;
  user_id: string;
  pac: number;
  sho: number;
  pas: number;
  dri: number;
  def: number;
  phy: number;
  overall: number;
  rating_count: number;
  created_at: string;
  updated_at: string;
};

export type Comment = {
  id: string;
  profile_id: string;
  commenter_id: string;
  commenter_name: string;
  text: string;
  likes: number;
  dislikes: number;
  created_at: string;
};

export type SocialLinks = {
  id: string;
  user_id: string;
  instagram_url?: string;
  youtube_url?: string;
  facebook_url?: string;
  twitter_url?: string;
  tiktok_url?: string;
  created_at: string;
  updated_at: string;
};

export type ProfileView = {
  id: string;
  profile_id: string;
  viewer_id: string;
  viewed_at: string;
};