import { createClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error('Missing Supabase environment variables');
}

export const supabase = createClient(supabaseUrl, supabaseAnonKey);

export type Profile = {
  id: string;
  username: string;
  full_name: string | null;
  avatar_url: string | null;
  location: string | null;
  school: string | null;
  college: string | null;
  bio: string | null;
  created_at: string;
  updated_at: string;
};

export type Friendship = {
  id: string;
  requester_id: string;
  receiver_id: string;
  status: 'pending' | 'accepted' | 'declined';
  created_at: string;
  updated_at: string;
};

export type Rating = {
  id: string;
  rated_user_id: string;
  rater_user_id: string;
  pac: number;
  sho: number;
  pas: number;
  dri: number;
  def: number;
  phy: number;
  created_at: string;
  updated_at: string;
};

export type Comment = {
  id: string;
  profile_user_id: string;
  commenter_user_id: string;
  content: string;
  created_at: string;
};

export type Like = {
  id: string;
  profile_user_id: string;
  liker_user_id: string;
  is_like: boolean;
  created_at: string;
};
