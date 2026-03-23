import { supabase } from './supabase';

export interface UserPresence {
  user_id: string;
  last_seen: string;
  updated_at: string;
}

// ─── constants ───────────────────────────────────────────────────────────────
// Heartbeat fires every 10 minutes — enough to stay "online" within the
// 15-minute window while keeping egress low (~144 writes/user/day max).
export const PRESENCE_HEARTBEAT_MS = 10 * 60 * 1000;

// A user is considered online if last seen within 15 minutes.
export const ONLINE_THRESHOLD_MS = 15 * 60 * 1000;

// ─── core update ─────────────────────────────────────────────────────────────
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
  } catch {
    // Silently fail — presence is non-critical
  }
}

// ─── visibility-aware presence manager ───────────────────────────────────────
// Call this once from App.tsx instead of the manual setInterval.
// Returns a cleanup function to call on unmount / sign-out.
export function startPresenceManager(userId: string): () => void {
  if (!userId) return () => {};

  // Fire immediately so the user is online the moment they open the app
  updatePresence(userId);

  // Regular heartbeat
  const interval = setInterval(() => updatePresence(userId), PRESENCE_HEARTBEAT_MS);

  // Re-fire when the tab/app becomes visible again after backgrounding.
  // This is the key fix for PWA — mobile browsers suspend timers when backgrounded.
  const handleVisibilityChange = () => {
    if (document.visibilityState === 'visible') {
      updatePresence(userId);
    }
  };

  // Also fire on window focus (desktop browsers / switching tabs)
  const handleFocus = () => updatePresence(userId);

  document.addEventListener('visibilitychange', handleVisibilityChange);
  window.addEventListener('focus', handleFocus);

  // Cleanup
  return () => {
    clearInterval(interval);
    document.removeEventListener('visibilitychange', handleVisibilityChange);
    window.removeEventListener('focus', handleFocus);
  };
}

// ─── helpers ─────────────────────────────────────────────────────────────────
export function formatTimeAgo(timestamp: string | undefined): string {
  if (!timestamp) return 'Offline';
  const diffMs      = Date.now() - new Date(timestamp).getTime();
  const diffMinutes = Math.floor(diffMs / 60000);
  const diffHours   = Math.floor(diffMinutes / 60);
  const diffDays    = Math.floor(diffHours / 24);

  if (diffMinutes < 15)  return 'Online';
  if (diffHours   < 24)  return `${diffHours}h ago`;
  if (diffDays    < 7)   return `${diffDays}d ago`;
  return 'Offline';
}

export function isOnline(timestamp: string | undefined): boolean {
  if (!timestamp) return false;
  return Date.now() - new Date(timestamp).getTime() < ONLINE_THRESHOLD_MS;
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
    (data || []).forEach((p: UserPresence) => presenceMap.set(p.user_id, p));
    return presenceMap;
  } catch {
    return presenceMap;
  }
}