import { supabase } from './supabase';

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
  transfer_id?: string;
  amount?: number;
  remaining_send_limit?: number;
  remaining_receive_limit?: number;
}

export async function processCoinTransfer(
  senderId: string,
  recipientId: string,
  amount: number,
  conversationId: string
): Promise<TransferResult> {
  try {
    const { data, error } = await supabase.rpc('process_coin_transfer', {
      p_sender_id: senderId,
      p_recipient_id: recipientId,
      p_amount: amount,
      p_conversation_id: conversationId,
    });

    if (error) {
      return {
        success: false,
        error: error.message,
      };
    }

    return data as TransferResult;
  } catch (err) {
    console.error('Error processing coin transfer:', err);
    return {
      success: false,
      error: err instanceof Error ? err.message : 'Unknown error occurred',
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
  } catch (err) {
    console.error('Error getting remaining send limit:', err);
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
  } catch (err) {
    console.error('Error getting remaining receive limit:', err);
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

  return {
    remainingSendLimit,
    remainingReceiveLimit,
  };
}

export async function getUserTransfers(userId: string): Promise<CoinTransfer[]> {
  try {
    const { data, error } = await supabase
      .from('coin_transfers')
      .select('*')
      .or(`sender_id.eq.${userId},recipient_id.eq.${userId}`)
      .order('created_at', { ascending: false });

    if (error) throw error;
    return data || [];
  } catch (err) {
    console.error('Error getting user transfers:', err);
    return [];
  }
}

export async function checkCanSendCoins(
  senderId: string,
  recipientId: string
): Promise<{ canSend: boolean; reason?: string }> {
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
        reason: 'Only verified friends can send coins. Verify via WhatsApp to unlock.',
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
      };
    }

    return { canSend: true };
  } catch (err) {
    console.error('Error checking if can send coins:', err);
    return {
      canSend: false,
      reason: 'Unable to verify transfer eligibility',
    };
  }
}

