/**
 * In-Memory Cache with TTL (Time To Live)
 * Improves performance by caching frequently accessed data
 */

interface CacheEntry<T> {
  data: T;
  timestamp: number;
  ttl: number; // milliseconds
}

class MemoryCache {
  private cache: Map<string, CacheEntry<any>>;
  private cleanupInterval: NodeJS.Timeout | null;

  constructor() {
    this.cache = new Map();
    this.cleanupInterval = null;
    this.startCleanup();
  }

  /**
   * Get cached data if available and not expired
   */
  get<T>(key: string): T | null {
    const entry = this.cache.get(key);
    if (!entry) return null;

    const now = Date.now();
    if (now - entry.timestamp > entry.ttl) {
      this.cache.delete(key);
      return null;
    }

    return entry.data as T;
  }

  /**
   * Set data in cache with TTL
   */
  set<T>(key: string, data: T, ttlMs: number): void {
    this.cache.set(key, {
      data,
      timestamp: Date.now(),
      ttl: ttlMs,
    });
  }

  /**
   * Check if key exists and is not expired
   */
  has(key: string): boolean {
    return this.get(key) !== null;
  }

  /**
   * Delete specific key from cache
   */
  delete(key: string): void {
    this.cache.delete(key);
  }

  /**
   * Clear all cache
   */
  clear(): void {
    this.cache.clear();
  }

  /**
   * Invalidate cache keys matching pattern
   */
  invalidatePattern(pattern: string): void {
    const regex = new RegExp(pattern);
    for (const key of this.cache.keys()) {
      if (regex.test(key)) {
        this.cache.delete(key);
      }
    }
  }

  /**
   * Get cache statistics
   */
  getStats() {
    return {
      size: this.cache.size,
      keys: Array.from(this.cache.keys()),
    };
  }

  /**
   * Start automatic cleanup of expired entries
   */
  private startCleanup(): void {
    this.cleanupInterval = setInterval(() => {
      const now = Date.now();
      for (const [key, entry] of this.cache.entries()) {
        if (now - entry.timestamp > entry.ttl) {
          this.cache.delete(key);
        }
      }
    }, 60000); // Cleanup every minute
  }

  /**
   * Stop cleanup interval
   */
  stopCleanup(): void {
    if (this.cleanupInterval) {
      clearInterval(this.cleanupInterval);
      this.cleanupInterval = null;
    }
  }
}

// Singleton instance
export const cache = new MemoryCache();

/**
 * Cache TTL constants (in milliseconds)
 */
export const CACHE_TTL = {
  VERY_SHORT: 10 * 1000, // 10 seconds - for real-time data
  SHORT: 30 * 1000, // 30 seconds - for frequently changing data
  MEDIUM: 2 * 60 * 1000, // 2 minutes - for moderately stable data
  LONG: 5 * 60 * 1000, // 5 minutes - for stable data
  VERY_LONG: 15 * 60 * 1000, // 15 minutes - for rarely changing data
};

/**
 * Helper function to wrap async operations with caching
 */
export async function withCache<T>(
  key: string,
  ttl: number,
  fetcher: () => Promise<T>
): Promise<T> {
  // Check cache first
  const cached = cache.get<T>(key);
  if (cached !== null) {
    return cached;
  }

  // Fetch fresh data
  const data = await fetcher();

  // Store in cache
  cache.set(key, data, ttl);

  return data;
}

/**
 * Cache key generators for common patterns
 */
export const CacheKeys = {
  profile: (userId: string) => `profile:${userId}`,
  userBalance: (userId: string) => `balance:${userId}`,
  leaderboard: (limit: number = 100) => `leaderboard:${limit}`,
  cardMarket: () => 'card_market',
  cardOwnership: (userId: string) => `cards:${userId}`,
  userPresence: (userId: string) => `presence:${userId}`,
  conversations: (userId: string) => `conversations:${userId}`,
  profileComments: (profileId: string) => `comments:${profileId}`,
  friendsList: (userId: string) => `friends:${userId}`,
  battleHistory: (userId: string) => `battles:${userId}`,
  notifications: (userId: string) => `notifications:${userId}`,
  cardPrice: (cardUserId: string) => `card_price:${cardUserId}`,
};

/**
 * Cache invalidation helpers
 */
export const invalidateCache = {
  profile: (userId: string) => cache.delete(CacheKeys.profile(userId)),
  balance: (userId: string) => cache.delete(CacheKeys.userBalance(userId)),
  leaderboard: () => cache.invalidatePattern('^leaderboard:'),
  cardMarket: () => cache.delete(CacheKeys.cardMarket()),
  userCards: (userId: string) => cache.delete(CacheKeys.cardOwnership(userId)),
  conversations: (userId: string) => cache.delete(CacheKeys.conversations(userId)),
  allProfiles: () => cache.invalidatePattern('^profile:'),
  allBalances: () => cache.invalidatePattern('^balance:'),
};
