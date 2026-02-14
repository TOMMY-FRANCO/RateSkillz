import { supabase } from './supabase';

export interface PlayerRating {
  id?: string;
  rater_id: string;
  player_id: string;
  pac: number;
  sho: number;
  pas: number;
  dri: number;
  def: number;
  phy: number;
  comment?: string;
  created_at?: string;
  updated_at?: string;
}

export interface UserStats {
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
}

export interface RatingResult {
  success: boolean;
  error?: string;
  data?: PlayerRating;
}

export async function checkIfFriends(userId: string, friendId: string): Promise<boolean> {
  try {
    const { data, error } = await supabase
      .from('friends')
      .select('status')
      .or(`and(user_id.eq.${userId},friend_id.eq.${friendId}),and(user_id.eq.${friendId},friend_id.eq.${userId})`)
      .eq('status', 'accepted')
      .maybeSingle();

    if (error) {
      console.error('[CheckFriends] Error:', error);
      return false;
    }

    return !!data;
  } catch (error) {
    console.error('[CheckFriends] Exception:', error);
    return false;
  }
}

export async function getMyRatingForUser(raterId: string, playerId: string): Promise<PlayerRating | null> {
  try {
    console.log(`[GetMyRating] Fetching rating from ${raterId} for player ${playerId}`);

    const { data, error } = await supabase
      .from('ratings')
      .select('id, rater_id, player_id, pac, sho, pas, dri, def, phy, comment, created_at, updated_at')
      .eq('rater_id', raterId)
      .eq('player_id', playerId)
      .maybeSingle();

    if (error) {
      console.error('[GetMyRating] Error:', error);
      return null;
    }

    if (data) {
      console.log('[GetMyRating] Found existing rating:', data);
    } else {
      console.log('[GetMyRating] No existing rating found');
    }

    return data;
  } catch (error) {
    console.error('[GetMyRating] Exception:', error);
    return null;
  }
}

export async function getUserStats(userId: string): Promise<UserStats | null> {
  try {
    console.log(`[GetUserStats] Fetching stats for user ${userId}`);

    const { data, error } = await supabase
      .from('user_stats')
      .select('id, user_id, pac, sho, pas, dri, def, phy, overall, rating_count, created_at, updated_at')
      .eq('user_id', userId)
      .maybeSingle();

    if (error) {
      console.error('[GetUserStats] Error:', error);
      return null;
    }

    if (data) {
      console.log('[GetUserStats] Found stats:', {
        overall: data.overall,
        rating_count: data.rating_count,
      });
    } else {
      console.log('[GetUserStats] No stats found, user may have no ratings yet');
    }

    return data;
  } catch (error) {
    console.error('[GetUserStats] Exception:', error);
    return null;
  }
}

export async function saveRating(rating: PlayerRating): Promise<RatingResult> {
  try {
    console.log('========================================');
    console.log('[SaveRating] SAVING RATING');
    console.log(`  Rater: ${rating.rater_id}`);
    console.log(`  Player: ${rating.player_id}`);
    console.log(`  Stats: PAC=${rating.pac}, SHO=${rating.sho}, PAS=${rating.pas}, DRI=${rating.dri}, DEF=${rating.def}, PHY=${rating.phy}`);
    console.log('========================================');

    if (rating.rater_id === rating.player_id) {
      console.error('[SaveRating] ✗ Cannot rate yourself');
      return {
        success: false,
        error: 'You cannot rate yourself',
      };
    }

    if (
      rating.pac < 1 || rating.pac > 100 ||
      rating.sho < 1 || rating.sho > 100 ||
      rating.pas < 1 || rating.pas > 100 ||
      rating.dri < 1 || rating.dri > 100 ||
      rating.def < 1 || rating.def > 100 ||
      rating.phy < 1 || rating.phy > 100
    ) {
      console.error('[SaveRating] ✗ Invalid rating values (must be 1-100)');
      return {
        success: false,
        error: 'All ratings must be between 1 and 100',
      };
    }

    const isFriend = await checkIfFriends(rating.rater_id, rating.player_id);
    if (!isFriend) {
      console.error('[SaveRating] ✗ Not friends');
      return {
        success: false,
        error: 'You can only rate accepted friends',
      };
    }

    console.log('[SaveRating] ✓ Friendship verified');

    const existingRating = await getMyRatingForUser(rating.rater_id, rating.player_id);

    if (existingRating) {
      console.log('[SaveRating] Updating existing rating...');

      const { data, error } = await supabase
        .from('ratings')
        .update({
          pac: rating.pac,
          sho: rating.sho,
          pas: rating.pas,
          dri: rating.dri,
          def: rating.def,
          phy: rating.phy,
          comment: rating.comment,
          updated_at: new Date().toISOString(),
        })
        .eq('rater_id', rating.rater_id)
        .eq('player_id', rating.player_id)
        .select()
        .single();

      if (error) {
        console.error('[SaveRating] ✗ Update error:', error);
        return {
          success: false,
          error: `Failed to update rating: ${error.message}`,
        };
      }

      console.log('[SaveRating] ✓ Rating updated successfully');
      console.log('[SaveRating] Trigger will auto-calculate averages');
      console.log('========================================');

      return {
        success: true,
        data,
      };
    } else {
      console.log('[SaveRating] Creating new rating...');

      const { data, error } = await supabase
        .from('ratings')
        .insert({
          rater_id: rating.rater_id,
          player_id: rating.player_id,
          pac: rating.pac,
          sho: rating.sho,
          pas: rating.pas,
          dri: rating.dri,
          def: rating.def,
          phy: rating.phy,
          comment: rating.comment,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        })
        .select()
        .single();

      if (error) {
        console.error('[SaveRating] ✗ Insert error:', error);
        return {
          success: false,
          error: `Failed to save rating: ${error.message}`,
        };
      }

      console.log('[SaveRating] ✓ Rating saved successfully');
      console.log('[SaveRating] Trigger will auto-calculate averages');
      console.log('========================================');

      return {
        success: true,
        data,
      };
    }
  } catch (error: any) {
    console.error('========================================');
    console.error('[SaveRating] ✗ FATAL ERROR');
    console.error('  Error:', error.message);
    console.error('========================================');
    return {
      success: false,
      error: error.message || 'An unexpected error occurred',
    };
  }
}

export async function deleteRating(raterId: string, playerId: string): Promise<RatingResult> {
  try {
    console.log(`[DeleteRating] Deleting rating from ${raterId} for player ${playerId}`);

    const { error } = await supabase
      .from('ratings')
      .delete()
      .eq('rater_id', raterId)
      .eq('player_id', playerId);

    if (error) {
      console.error('[DeleteRating] Error:', error);
      return {
        success: false,
        error: `Failed to delete rating: ${error.message}`,
      };
    }

    console.log('[DeleteRating] ✓ Rating deleted successfully');
    console.log('[DeleteRating] Trigger will auto-recalculate averages');

    return {
      success: true,
    };
  } catch (error: any) {
    console.error('[DeleteRating] Exception:', error);
    return {
      success: false,
      error: error.message || 'An unexpected error occurred',
    };
  }
}

export async function getAllRatingsForUser(playerId: string): Promise<PlayerRating[]> {
  try {
    console.log(`[GetAllRatings] Fetching all ratings for player ${playerId}`);

    const { data, error } = await supabase
      .from('ratings')
      .select('id, rater_id, player_id, pac, sho, pas, dri, def, phy, comment, created_at, updated_at')
      .eq('player_id', playerId);

    if (error) {
      console.error('[GetAllRatings] Error:', error);
      return [];
    }

    console.log(`[GetAllRatings] Found ${data?.length || 0} ratings`);
    return data || [];
  } catch (error) {
    console.error('[GetAllRatings] Exception:', error);
    return [];
  }
}
