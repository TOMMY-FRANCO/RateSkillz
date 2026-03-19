import { supabase } from './supabase';
 
export interface UserPresence {
  user_id: string;
  last_seen: string;
  updated_at: string;
}
 
// Call this on app load and every 5 minutes to keep presence fresh
export async function updatePresence(userId: string): Promise<void> {
  if (!userId) return;
  try {
    const now = new Date().toISOString();
    await supabase
      .from('user_presence')
      .upsert(
        { user_id: userId, last_seen: now, updated_at: now },
        { onConflict: 'user_id' }
      );
  } catch (error) {
    // Silently fail — presence is non-critical
  }
}
 
export function formatTimeAgo(timestamp: string | undefined): string {
  if (!timestamp) return 'Offline';
  const now = Date.now();
  const lastSeen = new Date(timestamp).getTime();
  const diffMs = now - lastSeen;
  const diffMinutes = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMinutes / 60);
  const diffDays = Math.floor(diffHours / 24);
 
  if (diffMinutes < 60) {
    return 'Online';
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
  return now - lastSeen < 60 * 60 * 1000; // 1 hour
}
 
export async function getUserPresence(userId: string): Promise<UserPresence | null> {
  try {
    const { data, error } = await supabase
      .from('user_presence')
      .select('user_id, last_seen, updated_at')
      .eq('user_id', userId)
      .maybeSingle();
    if (error) return null;
    return data;
  } catch {
    return null;
  }
}
 
export async function getMultipleUserPresence(userIds: string[]): Promise<Map<string, UserPresence>> {
  const presenceMap = new Map<string, UserPresence>();
  if (userIds.length === 0) return presenceMap;
  try {
    const { data, error } = await supabase
      .from('user_presence')
      .select('user_id, last_seen, updated_at')
      .in('user_id', userIds);
    if (error) return presenceMap;
    if (data) {
      data.forEach((presence: UserPresence) => {
        presenceMap.set(presence.user_id, presence);
      });
    }
    return presenceMap;
  } catch {
    return presenceMap;
  }
}