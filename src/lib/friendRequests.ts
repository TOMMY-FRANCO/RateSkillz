import { supabase } from './supabase';

export interface FriendRequest {
  id: string;
  user_id: string;
  friend_id: string;
  status: 'pending' | 'accepted' | 'rejected';
  created_at: string;
  profile?: {
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

    const senderId = currentUser.user.id;

    const { data: existing } = await supabase
      .from('friends')
      .select('id, status')
      .or(
        `and(user_id.eq.${senderId},friend_id.eq.${receiverId}),and(user_id.eq.${receiverId},friend_id.eq.${senderId})`
      )
      .maybeSingle();

    if (existing) {
      if (existing.status === 'accepted') {
        throw new Error('Already friends');
      }
      if (existing.status === 'pending') {
        throw new Error('Friend request already pending');
      }
    }

    const { data, error } = await supabase
      .from('friends')
      .insert({
        user_id: senderId,
        friend_id: receiverId,
        status: 'pending',
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
      .from('friends')
      .update({ status: 'accepted' })
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
    const { error } = await supabase
      .from('friends')
      .delete()
      .eq('id', requestId);

    if (error) throw error;
    return { error: null };
  } catch (error: any) {
    console.error('Error rejecting friend request:', error);
    return { error };
  }
}

export async function getFriendRequests(userId: string) {
  try {
    const { data, error } = await supabase
      .from('friends')
      .select('*')
      .or(`user_id.eq.${userId},friend_id.eq.${userId}`)
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
      .from('friends')
      .select('*', { count: 'exact', head: true })
      .eq('status', 'accepted')
      .or(`user_id.eq.${userId},friend_id.eq.${userId}`);

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
      .from('friends')
      .select('id')
      .eq('status', 'accepted')
      .or(
        `and(user_id.eq.${userId1},friend_id.eq.${userId2}),and(user_id.eq.${userId2},friend_id.eq.${userId1})`
      )
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
      .from('friends')
      .delete()
      .eq('id', friendshipId);

    if (error) throw error;
    return { error: null };
  } catch (error: any) {
    console.error('Error removing friend:', error);
    return { error };
  }
}
