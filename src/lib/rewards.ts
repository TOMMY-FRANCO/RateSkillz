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

export async function getRewardStatus(userId: string): Promise<RewardStatus | null> {
  try {
    const { data: profile, error: profileError } = await supabase
      .from('profiles')
      .select('is_verified, has_shared_x, has_shared_facebook, shared_reward_claimed, social_badge_reward_claimed, friend_count')
      .eq('id', userId)
      .single();

    if (profileError) throw profileError;

    const { data: whatsappReward, error: rewardError } = await supabase
      .from('reward_logs')
      .select('id')
      .eq('user_id', userId)
      .eq('reward_type', 'whatsapp_verify')
      .eq('status', 'claimed')
      .maybeSingle();

    if (rewardError) throw rewardError;

    return {
      whatsapp_verified: profile.is_verified || false,
      whatsapp_reward_claimed: whatsappReward !== null,
      has_shared_x: profile.has_shared_x || false,
      has_shared_facebook: profile.has_shared_facebook || false,
      social_reward_claimed: profile.shared_reward_claimed || false,
      friend_count: profile.friend_count || 0,
      friend_milestone_reward_claimed: profile.social_badge_reward_claimed || false
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
      .select('*')
      .eq('user_id', userId)
      .order('claimed_date', { ascending: false });

    if (error) throw error;

    return data;
  } catch (error) {
    console.error('Error getting reward logs:', error);
    return [];
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
