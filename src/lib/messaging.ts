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
      .select('*')
      .or(`user_one_id.eq.${userId},user_two_id.eq.${userId}`)
      .order('last_message_at', { ascending: false });

    if (error) throw error;

    if (!conversations) return [];

    const conversationsWithUsers = await Promise.all(
      conversations.map(async (conv) => {
        const otherUserId = conv.user_one_id === userId ? conv.user_two_id : conv.user_one_id;

        const { data: profile } = await supabase
          .from('profiles')
          .select('id, username, full_name, avatar_url')
          .eq('id', otherUserId)
          .single();

        const { count } = await supabase
          .from('messages')
          .select('*', { count: 'exact', head: true })
          .eq('conversation_id', conv.id)
          .eq('recipient_id', userId)
          .eq('is_read', false);

        return {
          ...conv,
          other_user: profile || undefined,
          unread_count: count || 0,
        };
      })
    );

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
      .select('*')
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
): Promise<Message | null> {
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
    return data;
  } catch (error) {
    console.error('Error sending message:', error);
    return null;
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

export async function updateUserStatus(userId: string, isOnline: boolean): Promise<void> {
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
      .select('*')
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
        is_typing: true,
        updated_at: new Date().toISOString(),
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

export function subscribeToMessages(
  conversationId: string,
  callback: (message: Message) => void
) {
  const channel = supabase
    .channel(`messages:${conversationId}`)
    .on(
      'postgres_changes',
      {
        event: 'INSERT',
        schema: 'public',
        table: 'messages',
        filter: `conversation_id=eq.${conversationId}`,
      },
      (payload) => {
        callback(payload.new as Message);
      }
    )
    .subscribe();

  return () => {
    supabase.removeChannel(channel);
  };
}

export function subscribeToUserStatus(userId: string, callback: (status: UserStatus) => void) {
  const channel = supabase
    .channel(`user_status:${userId}`)
    .on(
      'postgres_changes',
      {
        event: 'UPDATE',
        schema: 'public',
        table: 'user_status',
        filter: `user_id=eq.${userId}`,
      },
      (payload) => {
        callback(payload.new as UserStatus);
      }
    )
    .subscribe();

  return () => {
    supabase.removeChannel(channel);
  };
}

export function subscribeToTypingStatus(
  conversationId: string,
  callback: (status: TypingStatus | null) => void
) {
  const channel = supabase
    .channel(`typing:${conversationId}`)
    .on(
      'postgres_changes',
      {
        event: '*',
        schema: 'public',
        table: 'typing_status',
        filter: `conversation_id=eq.${conversationId}`,
      },
      (payload) => {
        if (payload.eventType === 'DELETE') {
          callback(null);
        } else {
          callback(payload.new as TypingStatus);
        }
      }
    )
    .subscribe();

  return () => {
    supabase.removeChannel(channel);
  };
}

export function subscribeToConversationUpdates(
  userId: string,
  callback: (conversation: Conversation) => void
) {
  const channel = supabase
    .channel(`conversations:${userId}`)
    .on(
      'postgres_changes',
      {
        event: '*',
        schema: 'public',
        table: 'conversations',
      },
      (payload) => {
        const conv = payload.new as Conversation;
        if (conv.user_one_id === userId || conv.user_two_id === userId) {
          callback(conv);
        }
      }
    )
    .subscribe();

  return () => {
    supabase.removeChannel(channel);
  };
}

export function formatTimestamp(timestamp: string): string {
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
