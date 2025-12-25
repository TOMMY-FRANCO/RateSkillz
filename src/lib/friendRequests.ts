import { supabase } from './supabase';

export interface FriendRequest {
  id: string;
  sender_id: string;
  receiver_id: string;
  status: 'pending' | 'accepted' | 'rejected';
  created_at: string;
  updated_at: string;
  sender?: {
    id: string;
    username: string;
    full_name: string;
    avatar_url: string;
  };
  receiver?: {
    id: string;
    username: string;
    full_name: string;
    avatar_url: string;
  };
}

export async function sendFriendRequest(receiverId: string) {
  try {
    const { data: currentUser } = await supabase.auth.getUser();
    if (!currentUser.user) {
      throw new Error('Not authenticated');
    }

    const { data, error } = await supabase
      .from('friend_requests')
      .insert({
        sender_id: currentUser.user.id,
        receiver_id: receiverId,
        status: 'pending'
      })
      .select()
      .single();

    if (error) throw error;
    return { data, error: null };
  } catch (error: any) {
    console.error('Error sending friend request:', error);
    return { data: null, error };
  }
}

export async function acceptFriendRequest(requestId: string) {
  try {
    const { data, error } = await supabase
      .from('friend_requests')
      .update({ status: 'accepted', updated_at: new Date().toISOString() })
      .eq('id', requestId)
      .select()
      .single();

    if (error) throw error;
    return { data, error: null };
  } catch (error: any) {
    console.error('Error accepting friend request:', error);
    return { data: null, error };
  }
}

export async function rejectFriendRequest(requestId: string) {
  try {
    const { data, error } = await supabase
      .from('friend_requests')
      .update({ status: 'rejected', updated_at: new Date().toISOString() })
      .eq('id', requestId)
      .select()
      .single();

    if (error) throw error;
    return { data, error: null };
  } catch (error: any) {
    console.error('Error rejecting friend request:', error);
    return { data: null, error };
  }
}

export async function getFriendRequests(userId: string) {
  try {
    const { data, error } = await supabase
      .from('friend_requests')
      .select(`
        *,
        sender:profiles!friend_requests_sender_id_fkey(id, username, full_name, avatar_url),
        receiver:profiles!friend_requests_receiver_id_fkey(id, username, full_name, avatar_url)
      `)
      .or(`sender_id.eq.${userId},receiver_id.eq.${userId}`)
      .order('created_at', { ascending: false });

    if (error) throw error;
    return { data: data as FriendRequest[], error: null };
  } catch (error: any) {
    console.error('Error fetching friend requests:', error);
    return { data: null, error };
  }
}

export async function getFriendCount(userId: string) {
  try {
    const { count, error } = await supabase
      .from('friend_requests')
      .select('*', { count: 'exact', head: true })
      .eq('status', 'accepted')
      .or(`sender_id.eq.${userId},receiver_id.eq.${userId}`);

    if (error) throw error;
    return { count: count || 0, error: null };
  } catch (error: any) {
    console.error('Error fetching friend count:', error);
    return { count: 0, error };
  }
}

export async function areFriends(userId1: string, userId2: string) {
  try {
    const { data, error } = await supabase
      .from('friend_requests')
      .select('id')
      .eq('status', 'accepted')
      .or(`and(sender_id.eq.${userId1},receiver_id.eq.${userId2}),and(sender_id.eq.${userId2},receiver_id.eq.${userId1})`)
      .maybeSingle();

    if (error) throw error;
    return { areFriends: !!data, error: null };
  } catch (error: any) {
    console.error('Error checking friendship:', error);
    return { areFriends: false, error };
  }
}

export async function removeFriend(friendshipId: string) {
  try {
    const { error } = await supabase
      .from('friend_requests')
      .delete()
      .eq('id', friendshipId);

    if (error) throw error;
    return { error: null };
  } catch (error: any) {
    console.error('Error removing friend:', error);
    return { error };
  }
}
