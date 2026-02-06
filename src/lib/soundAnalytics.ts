import { supabase } from './supabase';

type ToggleCategory = 'master' | 'transactions' | 'battles' | 'notifications';

export async function logAudioToggle(
  userId: string,
  category: ToggleCategory,
  enabled: boolean
): Promise<void> {
  try {
    await supabase
      .from('sound_toggle_events')
      .insert({ user_id: userId, category, enabled });
  } catch {}
}

export interface SoundAnalyticsRow {
  category: string;
  total_users: number;
  enabled_users: number;
  enabled_pct: number;
}

export async function getSoundAnalytics(): Promise<SoundAnalyticsRow[]> {
  try {
    const { data, error } = await supabase.rpc('get_sound_analytics');
    if (error) throw error;
    return data || [];
  } catch {
    return [];
  }
}
