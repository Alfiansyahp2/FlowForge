/**
 * Client-side caching utility with TTL support
 * Implements optimistic updates and cache invalidation
 */

interface CacheEntry<T> {
  data: T;
  timestamp: number;
  ttl: number; // Time to live in milliseconds
}

interface CacheConfig {
  defaultTTL: number; // Default cache duration (5 minutes)
  maxSize: number; // Maximum number of cached items
}

class CacheManager {
  private cache: Map<string, CacheEntry<any>> = new Map();
  private config: CacheConfig = {
    defaultTTL: 5 * 60 * 1000, // 5 minutes
    maxSize: 100,
  };

  /**
   * Get item from cache
   * Returns null if item doesn't exist or has expired
   */
  get<T>(key: string): T | null {
    const entry = this.cache.get(key);

    if (!entry) {
      return null;
    }

    // Check if entry has expired
    const now = Date.now();
    if (now - entry.timestamp > entry.ttl) {
      this.cache.delete(key);
      return null;
    }

    return entry.data as T;
  }

  /**
   * Set item in cache with optional TTL
   */
  set<T>(key: string, data: T, ttl?: number): void {
    // Enforce max cache size
    if (this.cache.size >= this.config.maxSize) {
      // Remove oldest entry
      const firstKey = this.cache.keys().next().value;
      this.cache.delete(firstKey);
    }

    this.cache.set(key, {
      data,
      timestamp: Date.now(),
      ttl: ttl || this.config.defaultTTL,
    });
  }

  /**
   * Delete item from cache
   */
  delete(key: string): void {
    this.cache.delete(key);
  }

  /**
   * Clear all cache entries
   */
  clear(): void {
    this.cache.clear();
  }

  /**
   * Check if key exists and is valid
   */
  has(key: string): boolean {
    return this.get(key) !== null;
  }

  /**
   * Get or set pattern - fetch data if not cached
   */
  async getOrSet<T>(
    key: string,
    fetcher: () => Promise<T>,
    ttl?: number
  ): Promise<T> {
    const cached = this.get<T>(key);
    if (cached !== null) {
      return cached;
    }

    const data = await fetcher();
    this.set(key, data, ttl);
    return data;
  }

  /**
   * Invalidate cache entries matching a pattern
   */
  invalidate(pattern: string): void {
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
      maxSize: this.config.maxSize,
      keys: Array.from(this.cache.keys()),
    };
  }
}

// Global cache instance
export const cache = new CacheManager();

/**
 * Cache key generators for consistent key creation
 */
export const CacheKeys = {
  // Workflow runs
  runsList: (params: Record<string, any> = {}) =>
    `runs:${JSON.stringify(params)}`,
  runDetails: (id: string) => `runs:${id}`,

  // Workflows
  workflowsList: (params: Record<string, any> = {}) =>
    `workflows:${JSON.stringify(params)}`,
  workflowDetails: (id: string) => `workflows:${id}`,

  // Health metrics
  healthMetrics: () => 'health:metrics',

  // Active runs
  activeRuns: () => 'runs:active',
};

/**
 * Optimistic update helper
 * Updates local cache immediately while API call is in progress
 */
export function optimisticUpdate<T>(
  key: string,
  updateFn: (current: T | null) => T,
  apiCall: () => Promise<T>,
  onError?: (error: Error) => void
): Promise<T> {
  // Get current data
  const current = cache.get<T>(key);

  try {
    // Apply optimistic update immediately
    const optimisticData = updateFn(current);
    cache.set(key, optimisticData, 1000); // Short TTL for optimistic updates

    // Make API call
    return apiCall().then((result) => {
      cache.set(key, result); // Update with server response
      return result;
    });
  } catch (error) {
    // Rollback on error
    if (current) {
      cache.set(key, current);
    } else {
      cache.delete(key);
    }
    if (onError) {
      onError(error as Error);
    }
    throw error;
  }
}

/**
 * React hook for using cache
 */
import { useState, useEffect } from 'react';

export function useCachedData<T>(
  key: string,
  fetcher: () => Promise<T>,
  ttl?: number
): { data: T | null; isLoading: boolean; error: Error | null; refresh: () => Promise<void> } {
  const [data, setData] = useState<T | null>(() => cache.get<T>(key));
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<Error | null>(null);

  const refresh = async () => {
    setIsLoading(true);
    setError(null);

    try {
      const result = await fetcher();
      cache.set(key, result, ttl);
      setData(result);
    } catch (err) {
      setError(err as Error);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    // Check cache first
    const cached = cache.get<T>(key);
    if (cached) {
      setData(cached);
    } else {
      refresh();
    }
  }, [key]);

  return { data, isLoading, error, refresh };
}

/**
 * React hook for optimistic updates
 */
export function useOptimisticUpdate<T>(
  key: string
): { update: (updateFn: (current: T | null) => T, apiCall: () => Promise<T>) => Promise<T> } {
  const update = async (
    updateFn: (current: T | null) => T,
    apiCall: () => Promise<T>
  ): Promise<T> => {
    return optimisticUpdate(key, updateFn, apiCall);
  };

  return { update };
}
