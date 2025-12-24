import { supabase } from './supabase';

export interface ViewTrackingResult {
  success: boolean;
  counted: boolean;
  coins_awarded?: boolean;
  coin_amount?: string;
  new_balance?: string;
  new_count?: number;
  current_count?: number;
  message?: string;
  error?: string;
}

export async function recordUniqueProfileView(
  profileId: string,
  viewerId: string | null
): Promise<ViewTrackingResult> {
  try {
    if (!viewerId) {
      return {
        success: true,
        counted: false,
        coins_awarded: false,
        message: 'Anonymous views are not counted'
      };
    }

    if (viewerId === profileId) {
      return {
        success: true,
        counted: false,
        coins_awarded: false,
        message: 'Self-views are not counted'
      };
    }

    const { data, error } = await supabase.rpc('record_unique_profile_view_with_reward', {
      p_profile_id: profileId,
      p_viewer_id: viewerId
    });

    if (error) {
      console.error('Error recording profile view:', error);
      return {
        success: false,
        counted: false,
        coins_awarded: false,
        error: error.message
      };
    }

    return data as ViewTrackingResult;
  } catch (error) {
    console.error('Exception recording profile view:', error);
    return {
      success: false,
      counted: false,
      coins_awarded: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    };
  }
}

export async function getUniqueViewCount(profileId: string): Promise<number> {
  try {
    const { data, error } = await supabase
      .from('profiles')
      .select('profile_views_count')
      .eq('id', profileId)
      .maybeSingle();

    if (error) {
      console.error('Error fetching view count:', error);
      return 0;
    }

    return data?.profile_views_count || 0;
  } catch (error) {
    console.error('Exception fetching view count:', error);
    return 0;
  }
}

export async function getCommentsCount(profileId: string): Promise<number> {
  try {
    const { data, error } = await supabase
      .from('profiles')
      .select('comments_count')
      .eq('id', profileId)
      .maybeSingle();

    if (error) {
      console.error('Error fetching comments count:', error);
      return 0;
    }

    return data?.comments_count || 0;
  } catch (error) {
    console.error('Exception fetching comments count:', error);
    return 0;
  }
}
