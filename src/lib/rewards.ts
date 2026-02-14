import { supabase } from './supabase';

export interface RewardResult {
  success: boolean;
  amount?: number;
  error?: string;
  transaction_id?: string;
}

export interface RewardStatus {
  whatsapp_verified: boolean;
  whatsapp_reward_claimed: boolean;
  has_shared_x: boolean;
  has_shared_facebook: boolean;
  social_reward_claimed: boolean;
  friend_count: number;
  friend_milestone_reward_claimed: boolean;
  friend_milestone_claimed_count: number;
}

export interface FriendMilestoneStatus {
  friend_count: number;
  claimed_milestones: number[];
  total_coins_earned: number;
}

export async function claimWhatsAppVerificationReward(userId: string): Promise<RewardResult> {
  try {
    const { data, error } = await supabase.rpc('claim_whatsapp_verification_reward', {
      p_user_id: userId
    });

    if (error) throw error;

    return data as RewardResult;
  } catch (error) {
    console.error('Error claiming WhatsApp reward:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to claim reward'
    };
  }
}

export async function markSocialPlatformShared(userId: string, platform: 'x' | 'facebook'): Promise<boolean> {
  try {
    const column = platform === 'x' ? 'has_shared_x' : 'has_shared_facebook';

    const { error } = await supabase
      .from('profiles')
      .update({ [column]: true })
      .eq('id', userId);

    if (error) throw error;

    return true;
  } catch (error) {
    console.error(`Error marking ${platform} as shared:`, error);
    return false;
  }
}

export async function claimSocialSharingReward(userId: string): Promise<RewardResult> {
  try {
    const { data, error } = await supabase.rpc('claim_social_sharing_reward', {
      p_user_id: userId
    });

    if (error) throw error;

    return data as RewardResult;
  } catch (error) {
    console.error('Error claiming social sharing reward:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to claim reward'
    };
  }
}

export async function claimFriendMilestoneReward(userId: string): Promise<RewardResult> {
  try {
    const { data, error } = await supabase.rpc('claim_friend_milestone_reward', {
      p_user_id: userId
    });

    if (error) throw error;

    return data as RewardResult;
  } catch (error) {
    console.error('Error claiming friend milestone reward:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to claim reward'
    };
  }
}

export async function claimPerFriendMilestoneReward(
  userId: string,
  friendId: string
): Promise<RewardResult & { claimed_count?: number; milestone_complete?: boolean }> {
  try {
    const { data, error } = await supabase.rpc('claim_per_friend_milestone_reward', {
      p_user_id: userId,
      p_friend_id: friendId,
    });

    if (error) throw error;

    return data as RewardResult & { claimed_count?: number; milestone_complete?: boolean };
  } catch (error) {
    console.error('Error claiming per-friend milestone reward:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to claim reward',
    };
  }
}

export async function getFriendMilestoneClaimedCount(userId: string): Promise<number> {
  try {
    const { count, error } = await supabase
      .from('reward_logs')
      .select('id', { count: 'exact', head: true })
      .eq('user_id', userId)
      .eq('reward_type', 'friend_milestone_per_friend')
      .eq('status', 'claimed');

    if (error) throw error;
    return count || 0;
  } catch {
    return 0;
  }
}

export async function getRewardStatus(userId: string): Promise<RewardStatus | null> {
  try {
    const { data: profile, error: profileError } = await supabase
      .from('profiles')
      .select('is_verified, has_shared_x, has_shared_facebook, shared_reward_claimed, social_badge_reward_claimed, friend_count')
      .eq('id', userId)
      .single();

    if (profileError) throw profileError;

    const [whatsappResult, milestoneCountResult] = await Promise.all([
      supabase
        .from('reward_logs')
        .select('id')
        .eq('user_id', userId)
        .eq('reward_type', 'whatsapp_verify')
        .eq('status', 'claimed')
        .maybeSingle(),
      supabase
        .from('reward_logs')
        .select('id', { count: 'exact', head: true })
        .eq('user_id', userId)
        .eq('reward_type', 'friend_milestone_per_friend')
        .eq('status', 'claimed'),
    ]);

    if (whatsappResult.error) throw whatsappResult.error;

    const claimedCount = milestoneCountResult.count || 0;

    return {
      whatsapp_verified: profile.is_verified || false,
      whatsapp_reward_claimed: whatsappResult.data !== null,
      has_shared_x: profile.has_shared_x || false,
      has_shared_facebook: profile.has_shared_facebook || false,
      social_reward_claimed: profile.shared_reward_claimed || false,
      friend_count: profile.friend_count || 0,
      friend_milestone_reward_claimed: claimedCount >= 5,
      friend_milestone_claimed_count: claimedCount,
    };
  } catch (error) {
    console.error('Error getting reward status:', error);
    return null;
  }
}

export async function getRewardLogs(userId: string) {
  try {
    const { data, error } = await supabase
      .from('reward_logs')
      .select('id, user_id, reward_type, amount, status, claimed_date, milestone_level, metadata')
      .eq('user_id', userId)
      .order('claimed_date', { ascending: false });

    if (error) throw error;

    return data;
  } catch (error) {
    console.error('Error getting reward logs:', error);
    return [];
  }
}

export async function getFriendMilestoneStatus(userId: string): Promise<FriendMilestoneStatus | null> {
  try {
    const [profileResult, rewardLogsResult] = await Promise.all([
      supabase
        .from('profiles')
        .select('friend_count')
        .eq('id', userId)
        .maybeSingle(),
      supabase
        .from('reward_logs')
        .select('milestone_level, amount')
        .eq('user_id', userId)
        .in('reward_type', ['friend_milestone_5', 'friend_milestone_10', 'friend_milestone_25', 'friend_milestone_50'])
        .eq('status', 'claimed')
    ]);

    if (profileResult.error) throw profileResult.error;
    if (rewardLogsResult.error) throw rewardLogsResult.error;

    const friendCount = profileResult.data?.friend_count || 0;
    const claimedMilestones = (rewardLogsResult.data || [])
      .map(log => log.milestone_level)
      .filter((level): level is number => level !== null)
      .sort((a, b) => a - b);

    const totalCoinsEarned = (rewardLogsResult.data || [])
      .reduce((sum, log) => sum + (log.amount || 0), 0);

    return {
      friend_count: friendCount,
      claimed_milestones: claimedMilestones,
      total_coins_earned: totalCoinsEarned
    };
  } catch (error) {
    console.error('Error getting friend milestone status:', error);
    return null;
  }
}

export async function checkAndAutoClaimRewards(userId: string): Promise<void> {
  try {
    const status = await getRewardStatus(userId);
    if (!status) return;

    if (status.friend_count >= 5 && !status.friend_milestone_reward_claimed) {
      await claimFriendMilestoneReward(userId);
    }

    if (status.has_shared_x && status.has_shared_facebook && !status.social_reward_claimed) {
      await claimSocialSharingReward(userId);
    }
  } catch (error) {
    console.error('Error auto-claiming rewards:', error);
  }
}
