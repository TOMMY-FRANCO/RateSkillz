import { supabase } from './supabase';

export interface Message {
  id: string;
  conversation_id: string;
  sender_id: string;
  recipient_id: string;
  content: string;
  is_read: boolean;
  read_at: string | null;
  created_at: string;
}

export interface Conversation {
  id: string;
  user_one_id: string;
  user_two_id: string;
  last_message_at: string;
  last_message_preview: string;
  created_at: string;
  other_user?: {
    id: string;
    username: string;
    full_name: string | null;
    avatar_url: string | null;
  };
  unread_count?: number;
}

export interface UserStatus {
  user_id: string;
  is_online: boolean;
  last_seen: string;
  updated_at: string;
}

export interface TypingStatus {
  user_id: string;
  conversation_id: string;
  is_typing: boolean;
  updated_at: string;
}

export interface SendResult {
  message: Message | null;
  error: string | null;
}

export async function getOrCreateConversation(userId: string, otherUserId: string): Promise<string | null> {
  try {
    const { data, error } = await supabase.rpc('get_or_create_conversation', {
      p_user_one_id: userId,
      p_user_two_id: otherUserId,
    });

    if (error) throw error;
    return data;
  } catch (error) {
    console.error('Error getting/creating conversation:', error);
    return null;
  }
}

export async function getUserConversations(userId: string): Promise<Conversation[]> {
  try {
    const { data: conversations, error } = await supabase
      .from('conversations')
      .select('id, user_one_id, user_two_id, last_message_at, last_message_preview, created_at')
      .or(`user_one_id.eq.${userId},user_two_id.eq.${userId}`)
      .order('last_message_at', { ascending: false, nullsFirst: false });

    if (error) throw error;
    if (!conversations || conversations.length === 0) return [];

    // PERFORMANCE FIX: Fetch all profiles in a single query to prevent N+1
    const otherUserIds = conversations.map(conv =>
      conv.user_one_id === userId ? conv.user_two_id : conv.user_one_id
    );

    const { data: profiles, error: profilesError } = await supabase
      .from('profiles')
      .select('id, username, full_name, avatar_url')
      .in('id', otherUserIds);

    if (profilesError) throw profilesError;

    // Create profile lookup map for O(1) access
    const profileMap = new Map(profiles?.map(p => [p.id, p]) || []);

    // PERFORMANCE FIX: Fetch all unread counts in a single aggregated query
    const { data: unreadCounts, error: unreadError } = await supabase
      .from('messages')
      .select('conversation_id')
      .eq('recipient_id', userId)
      .eq('is_read', false)
      .in('conversation_id', conversations.map(c => c.id));

    if (unreadError) throw unreadError;

    // Count unread messages per conversation
    const unreadMap = new Map<string, number>();
    unreadCounts?.forEach(msg => {
      unreadMap.set(msg.conversation_id, (unreadMap.get(msg.conversation_id) || 0) + 1);
    });

    // Combine all data
    const conversationsWithUsers = conversations.map(conv => {
      const otherUserId = conv.user_one_id === userId ? conv.user_two_id : conv.user_one_id;
      return {
        ...conv,
        other_user: profileMap.get(otherUserId) || undefined,
        unread_count: unreadMap.get(conv.id) || 0,
      };
    });

    return conversationsWithUsers;
  } catch (error) {
    console.error('Error getting conversations:', error);
    return [];
  }
}

export async function getConversationMessages(conversationId: string): Promise<Message[]> {
  try {
    const { data, error } = await supabase
      .from('messages')
      .select('id, conversation_id, sender_id, recipient_id, content, is_read, read_at, created_at')
      .eq('conversation_id', conversationId)
      .order('created_at', { ascending: true });

    if (error) throw error;
    return data || [];
  } catch (error) {
    console.error('Error getting messages:', error);
    return [];
  }
}

export async function sendMessage(
  conversationId: string,
  senderId: string,
  recipientId: string,
  content: string
): Promise<SendResult> {
  try {
    const { data, error } = await supabase
      .from('messages')
      .insert({
        conversation_id: conversationId,
        sender_id: senderId,
        recipient_id: recipientId,
        content,
      })
      .select()
      .single();

    if (error) throw error;

    return { message: data, error: null };
  } catch (error: any) {
    console.error('Error sending message:', error);
    return { message: null, error: error?.message || 'Failed to send message' };
  }
}

export async function markMessagesAsRead(conversationId: string, userId: string): Promise<void> {
  try {
    await supabase.rpc('mark_messages_as_read', {
      p_conversation_id: conversationId,
      p_user_id: userId,
    });
  } catch (error) {
    console.error('Error marking messages as read:', error);
  }
}

export async function getUnreadCount(userId: string): Promise<number> {
  try {
    const { data, error } = await supabase.rpc('get_unread_count', {
      p_user_id: userId,
    });

    if (error) throw error;
    return data || 0;
  } catch (error) {
    console.error('Error getting unread count:', error);
    return 0;
  }
}

export async function updateUserStatus(userId: string): Promise<void> {
  try {
    const now = new Date().toISOString();
    const { error } = await supabase
      .from('user_presence')
      .upsert({
        user_id: userId,
        last_seen: now,
        updated_at: now,
      }, {
        onConflict: 'user_id'
      });

    if (error) throw error;
  } catch (error) {
    console.error('Error updating user status:', error);
  }
}

export async function getUserStatus(userId: string): Promise<UserStatus | null> {
  try {
    const { data, error } = await supabase
      .from('user_presence')
      .select('user_id, last_seen, updated_at')
      .eq('user_id', userId)
      .maybeSingle();

    if (error) throw error;

    if (!data) return null;

    const now = Date.now();
    const lastSeen = new Date(data.last_seen).getTime();
    const isOnline = (now - lastSeen) < 5 * 60 * 1000;

    return {
      user_id: data.user_id,
      is_online: isOnline,
      last_seen: data.last_seen,
      updated_at: data.updated_at,
    };
  } catch (error) {
    console.error('Error getting user status:', error);
    return null;
  }
}

export async function setTypingStatus(
  userId: string,
  conversationId: string,
  isTyping: boolean
): Promise<void> {
  try {
    if (isTyping) {
      await supabase.from('typing_status').upsert({
        user_id: userId,
        conversation_id: conversationId,
        is_typing: true
      });
    } else {
      await supabase
        .from('typing_status')
        .delete()
        .eq('user_id', userId)
        .eq('conversation_id', conversationId);
    }
  } catch (error) {
    console.error('Error setting typing status:', error);
  }
}

export async function checkAreFriends(userId: string, otherUserId: string): Promise<boolean> {
  try {
    const { data, error } = await supabase
      .from('friends')
      .select('status')
      .or(`and(user_id.eq.${userId},friend_id.eq.${otherUserId}),and(user_id.eq.${otherUserId},friend_id.eq.${userId})`)
      .eq('status', 'accepted')
      .maybeSingle();

    if (error) throw error;
    return !!data;
  } catch (error) {
    console.error('Error checking friendship:', error);
    return false;
  }
}

export function formatTimestamp(timestamp: string): string {
  if (!timestamp) return '';
  const date = new Date(timestamp);
  const now = new Date();
  const diffInMs = now.getTime() - date.getTime();
  const diffInMinutes = Math.floor(diffInMs / 60000);
  const diffInHours = Math.floor(diffInMs / 3600000);
  const diffInDays = Math.floor(diffInMs / 86400000);

  if (diffInMinutes < 1) {
    return 'Just now';
  } else if (diffInMinutes < 60) {
    return `${diffInMinutes} ${diffInMinutes === 1 ? 'minute' : 'minutes'} ago`;
  } else if (diffInHours < 24) {
    return `${diffInHours} ${diffInHours === 1 ? 'hour' : 'hours'} ago`;
  } else if (diffInDays === 1) {
    return 'Yesterday';
  } else if (diffInDays < 7) {
    return `${diffInDays} days ago`;
  } else {
    return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  }
}
