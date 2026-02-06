import { supabase } from './supabase';

export type TransferErrorCode =
  | 'friend_required'
  | 'daily_limit_exceeded'
  | 'insufficient_balance'
  | 'invalid_amount'
  | 'not_verified'
  | 'recipient_not_verified'
  | 'self_transfer'
  | 'unknown';

export interface CoinTransfer {
  id: string;
  sender_id: string;
  recipient_id: string;
  amount: number;
  status: 'completed' | 'failed';
  conversation_id: string | null;
  created_at: string;
  completed_at: string | null;
  error_message: string | null;
}

export interface TransferLimits {
  remainingSendLimit: number;
  remainingReceiveLimit: number;
}

export interface TransferResult {
  success: boolean;
  error?: string;
  errorCode?: TransferErrorCode;
  transfer_id?: string;
  amount?: number;
  remaining_send_limit?: number;
  remaining_receive_limit?: number;
}

export interface FriendOption {
  id: string;
  username: string;
  full_name: string | null;
  avatar_url: string | null;
  is_verified: boolean;
}

function parseErrorCode(message: string): TransferErrorCode {
  const lower = message.toLowerCase();
  if (lower.includes('friend')) return 'friend_required';
  if (lower.includes('daily') || lower.includes('limit')) return 'daily_limit_exceeded';
  if (lower.includes('insufficient') || lower.includes('balance')) return 'insufficient_balance';
  if (lower.includes('increment') || lower.includes('invalid') || lower.includes('amount')) return 'invalid_amount';
  if (lower.includes('you must be verified')) return 'not_verified';
  if (lower.includes('recipient must be verified')) return 'recipient_not_verified';
  if (lower.includes('yourself')) return 'self_transfer';
  return 'unknown';
}

export async function processCoinTransfer(
  senderId: string,
  recipientId: string,
  amount: number,
  conversationId?: string
): Promise<TransferResult> {
  try {
    const { data, error } = await supabase.rpc('process_coin_transfer', {
      p_sender_id: senderId,
      p_recipient_id: recipientId,
      p_amount: amount,
      p_conversation_id: conversationId || null,
    });

    if (error) {
      return {
        success: false,
        error: error.message,
        errorCode: parseErrorCode(error.message),
      };
    }

    if (data && !data.success) {
      return {
        success: false,
        error: data.error,
        errorCode: parseErrorCode(data.error || ''),
      };
    }

    return data as TransferResult;
  } catch (err) {
    return {
      success: false,
      error: err instanceof Error ? err.message : 'Unknown error occurred',
      errorCode: 'unknown',
    };
  }
}

export async function getRemainingSendLimit(userId: string): Promise<number> {
  try {
    const { data, error } = await supabase.rpc('get_remaining_send_limit', {
      p_user_id: userId,
    });
    if (error) throw error;
    return Number(data) || 0;
  } catch {
    return 0;
  }
}

export async function getRemainingReceiveLimit(userId: string): Promise<number> {
  try {
    const { data, error } = await supabase.rpc('get_remaining_receive_limit', {
      p_user_id: userId,
    });
    if (error) throw error;
    return Number(data) || 0;
  } catch {
    return 0;
  }
}

export async function getUserTransferLimits(
  senderId: string,
  recipientId: string
): Promise<TransferLimits> {
  const [remainingSendLimit, remainingReceiveLimit] = await Promise.all([
    getRemainingSendLimit(senderId),
    getRemainingReceiveLimit(recipientId),
  ]);
  return { remainingSendLimit, remainingReceiveLimit };
}

export async function getAcceptedFriends(userId: string): Promise<FriendOption[]> {
  try {
    const { data, error } = await supabase
      .from('friends')
      .select('user_id, friend_id')
      .or(`user_id.eq.${userId},friend_id.eq.${userId}`)
      .eq('status', 'accepted');

    if (error || !data || data.length === 0) return [];

    const friendIds = data.map((f) =>
      f.user_id === userId ? f.friend_id : f.user_id
    );

    const { data: profiles, error: profileError } = await supabase
      .from('profiles')
      .select('id, username, full_name, avatar_url, is_verified')
      .in('id', friendIds);

    if (profileError || !profiles) return [];

    return profiles.map((p) => ({
      id: p.id,
      username: p.username,
      full_name: p.full_name,
      avatar_url: p.avatar_url,
      is_verified: p.is_verified ?? false,
    }));
  } catch {
    return [];
  }
}

export async function checkCanSendCoins(
  senderId: string,
  recipientId: string
): Promise<{ canSend: boolean; reason?: string; errorCode?: TransferErrorCode }> {
  try {
    const { data: senderProfile } = await supabase
      .from('profiles')
      .select('is_verified')
      .eq('id', senderId)
      .maybeSingle();

    if (!senderProfile?.is_verified) {
      return {
        canSend: false,
        reason: 'You must be verified to send coins. Verify via WhatsApp to unlock.',
        errorCode: 'not_verified',
      };
    }

    const { data: recipientProfile } = await supabase
      .from('profiles')
      .select('is_verified')
      .eq('id', recipientId)
      .maybeSingle();

    if (!recipientProfile?.is_verified) {
      return {
        canSend: false,
        reason: 'Recipient must be verified to receive coins.',
        errorCode: 'recipient_not_verified',
      };
    }

    const { data: friendship } = await supabase
      .from('friends')
      .select('status')
      .or(
        `and(user_id.eq.${senderId},friend_id.eq.${recipientId}),and(user_id.eq.${recipientId},friend_id.eq.${senderId})`
      )
      .eq('status', 'accepted')
      .maybeSingle();

    if (!friendship) {
      return {
        canSend: false,
        reason: 'You can only send coins to friends',
        errorCode: 'friend_required',
      };
    }

    return { canSend: true };
  } catch {
    return {
      canSend: false,
      reason: 'Unable to verify transfer eligibility',
      errorCode: 'unknown',
    };
  }
}
