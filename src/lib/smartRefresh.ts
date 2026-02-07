/**
 * Smart Refresh Utility
 * Optimizes pull-to-refresh by fetching only changed data since last refresh
 */

import { supabase } from './supabase';

interface RefreshTimestamps {
  [key: string]: string; // ISO timestamp of last refresh per resource
}

class SmartRefresh {
  private timestamps: RefreshTimestamps = {};
  private readonly STORAGE_KEY = 'smartRefresh_timestamps';

  constructor() {
    this.loadTimestamps();
  }

  /**
   * Load timestamps from localStorage
   */
  private loadTimestamps(): void {
    try {
      const stored = localStorage.getItem(this.STORAGE_KEY);
      if (stored) {
        this.timestamps = JSON.parse(stored);
      }
    } catch (error) {
      console.warn('Failed to load refresh timestamps:', error);
    }
  }

  /**
   * Save timestamps to localStorage
   */
  private saveTimestamps(): void {
    try {
      localStorage.setItem(this.STORAGE_KEY, JSON.stringify(this.timestamps));
    } catch (error) {
      console.warn('Failed to save refresh timestamps:', error);
    }
  }

  /**
   * Get last refresh timestamp for a resource
   */
  getLastRefresh(resource: string): string | null {
    return this.timestamps[resource] || null;
  }

  /**
   * Update refresh timestamp for a resource
   */
  setRefreshTimestamp(resource: string, timestamp?: string): void {
    this.timestamps[resource] = timestamp || new Date().toISOString();
    this.saveTimestamps();
  }

  /**
   * Clear all timestamps (force full refresh)
   */
  clearAll(): void {
    this.timestamps = {};
    this.saveTimestamps();
  }

  /**
   * Clear specific resource timestamp
   */
  clear(resource: string): void {
    delete this.timestamps[resource];
    this.saveTimestamps();
  }

  /**
   * Fetch profiles updated since last refresh
   */
  async fetchUpdatedProfiles(userIds?: string[]): Promise<any[]> {
    const resource = 'profiles';
    const lastRefresh = this.getLastRefresh(resource);

    let query = supabase
      .from('profiles')
      .select('*');

    if (lastRefresh) {
      // Only fetch profiles updated since last refresh
      query = query.gt('updated_at', lastRefresh);
    }

    if (userIds && userIds.length > 0) {
      query = query.in('id', userIds);
    }

    const { data, error } = await query;

    if (error) throw error;

    // Update refresh timestamp
    this.setRefreshTimestamp(resource);

    return data || [];
  }

  /**
   * Fetch messages updated since last refresh
   */
  async fetchUpdatedMessages(conversationId: string): Promise<any[]> {
    const resource = `messages:${conversationId}`;
    const lastRefresh = this.getLastRefresh(resource);

    let query = supabase
      .from('messages')
      .select('*')
      .eq('conversation_id', conversationId)
      .order('created_at', { ascending: true });

    if (lastRefresh) {
      // Only fetch messages created since last refresh
      query = query.gt('created_at', lastRefresh);
    }

    const { data, error } = await query;

    if (error) throw error;

    // Update refresh timestamp
    this.setRefreshTimestamp(resource);

    return data || [];
  }

  /**
   * Fetch notifications updated since last refresh
   */
  async fetchUpdatedNotifications(userId: string): Promise<any[]> {
    const resource = `notifications:${userId}`;
    const lastRefresh = this.getLastRefresh(resource);

    let query = supabase
      .from('notifications')
      .select('*')
      .eq('user_id', userId)
      .order('created_at', { ascending: false });

    if (lastRefresh) {
      // Only fetch notifications created since last refresh
      query = query.gt('created_at', lastRefresh);
    }

    const { data, error } = await query;

    if (error) throw error;

    // Update refresh timestamp
    this.setRefreshTimestamp(resource);

    return data || [];
  }

  /**
   * Fetch card ownership changes since last refresh
   */
  async fetchUpdatedCardOwnership(userId?: string): Promise<any[]> {
    const resource = 'card_ownership';
    const lastRefresh = this.getLastRefresh(resource);

    let query = supabase
      .from('card_market_cache')
      .select('*');

    if (lastRefresh) {
      // Only fetch cards updated since last refresh
      query = query.gt('updated_at', lastRefresh);
    }

    if (userId) {
      query = query.eq('owner_id', userId);
    }

    const { data, error } = await query;

    if (error) throw error;

    // Update refresh timestamp
    this.setRefreshTimestamp(resource);

    return data || [];
  }

  /**
   * Fetch leaderboard if stale (updated more than 5 minutes ago)
   */
  async fetchLeaderboardIfStale(): Promise<{ data: any[]; wasStale: boolean }> {
    const resource = 'leaderboard';
    const lastRefresh = this.getLastRefresh(resource);
    const STALE_THRESHOLD = 5 * 60 * 1000; // 5 minutes

    const isStale = !lastRefresh ||
      (Date.now() - new Date(lastRefresh).getTime()) > STALE_THRESHOLD;

    if (!isStale) {
      return { data: [], wasStale: false };
    }

    const { data, error } = await supabase
      .from('leaderboard_cache')
      .select('*')
      .order('rank', { ascending: true })
      .limit(100);

    if (error) throw error;

    // Update refresh timestamp
    this.setRefreshTimestamp(resource);

    return { data: data || [], wasStale: true };
  }

  /**
   * Check if data should be refreshed based on age
   */
  shouldRefresh(resource: string, maxAgeMs: number): boolean {
    const lastRefresh = this.getLastRefresh(resource);
    if (!lastRefresh) return true;

    const age = Date.now() - new Date(lastRefresh).getTime();
    return age > maxAgeMs;
  }

  /**
   * Fetch friend list updates
   */
  async fetchUpdatedFriends(userId: string): Promise<any[]> {
    const resource = `friends:${userId}`;
    const lastRefresh = this.getLastRefresh(resource);

    let query = supabase
      .from('friends')
      .select('*')
      .or(`user_id.eq.${userId},friend_id.eq.${userId}`);

    if (lastRefresh) {
      // Only fetch friendships created or updated since last refresh
      query = query.gt('created_at', lastRefresh);
    }

    const { data, error } = await query;

    if (error) throw error;

    // Update refresh timestamp
    this.setRefreshTimestamp(resource);

    return data || [];
  }

  /**
   * Get refresh status for debugging
   */
  getRefreshStatus(): Record<string, { lastRefresh: string; ageMs: number }> {
    const status: Record<string, { lastRefresh: string; ageMs: number }> = {};
    const now = Date.now();

    for (const [resource, timestamp] of Object.entries(this.timestamps)) {
      status[resource] = {
        lastRefresh: timestamp,
        ageMs: now - new Date(timestamp).getTime(),
      };
    }

    return status;
  }
}

// Singleton instance
export const smartRefresh = new SmartRefresh();

/**
 * Resource identifiers for smart refresh
 */
export const REFRESH_RESOURCES = {
  PROFILES: 'profiles',
  LEADERBOARD: 'leaderboard',
  CARD_OWNERSHIP: 'card_ownership',
  messages: (conversationId: string) => `messages:${conversationId}`,
  notifications: (userId: string) => `notifications:${userId}`,
  friends: (userId: string) => `friends:${userId}`,
  battles: (userId: string) => `battles:${userId}`,
};

/**
 * Maximum age thresholds for different data types
 */
export const MAX_AGE = {
  REALTIME: 10 * 1000, // 10 seconds
  FAST: 30 * 1000, // 30 seconds
  MEDIUM: 2 * 60 * 1000, // 2 minutes
  SLOW: 5 * 60 * 1000, // 5 minutes
  VERY_SLOW: 15 * 60 * 1000, // 15 minutes
};
