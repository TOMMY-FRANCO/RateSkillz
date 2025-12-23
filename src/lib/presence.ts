import { supabase } from './supabase';

export interface UserPresence {
  user_id: string;
  last_seen: string;
  updated_at: string;
}

export function formatTimeAgo(timestamp: string | undefined): string {
  if (!timestamp) return 'Offline';

  const now = Date.now();
  const lastSeen = new Date(timestamp).getTime();
  const diffMs = now - lastSeen;
  const diffMinutes = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMinutes / 60);
  const diffDays = Math.floor(diffHours / 24);

  if (diffMinutes < 5) {
    return 'Online';
  } else if (diffMinutes < 60) {
    return `${diffMinutes}m ago`;
  } else if (diffHours < 24) {
    return `${diffHours}h ago`;
  } else if (diffDays < 7) {
    return `${diffDays}d ago`;
  } else {
    return 'Offline';
  }
}

export function isOnline(timestamp: string | undefined): boolean {
  if (!timestamp) return false;
  const now = Date.now();
  const lastSeen = new Date(timestamp).getTime();
  const diffMs = now - lastSeen;
  return diffMs < 5 * 60 * 1000;
}

export async function getUserPresence(userId: string): Promise<UserPresence | null> {
  try {
    const { data, error } = await supabase
      .from('user_presence')
      .select('*')
      .eq('user_id', userId)
      .maybeSingle();

    if (error) {
      console.error('Error fetching user presence:', error);
      return null;
    }

    return data;
  } catch (error) {
    console.error('Error fetching user presence:', error);
    return null;
  }
}

export async function getMultipleUserPresence(userIds: string[]): Promise<Map<string, UserPresence>> {
  const presenceMap = new Map<string, UserPresence>();

  if (userIds.length === 0) return presenceMap;

  try {
    const { data, error } = await supabase
      .from('user_presence')
      .select('*')
      .in('user_id', userIds);

    if (error) {
      console.error('Error fetching multiple user presence:', error);
      return presenceMap;
    }

    if (data) {
      data.forEach((presence: UserPresence) => {
        presenceMap.set(presence.user_id, presence);
      });
    }

    return presenceMap;
  } catch (error) {
    console.error('Error fetching multiple user presence:', error);
    return presenceMap;
  }
}
