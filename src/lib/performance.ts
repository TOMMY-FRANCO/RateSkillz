/**
 * Performance Monitoring Utility
 * Tracks page load times, query performance, and user interactions
 */

interface PerformanceMetric {
  name: string;
  duration: number;
  timestamp: number;
  metadata?: Record<string, any>;
}

class PerformanceMonitor {
  private metrics: PerformanceMetric[] = [];
  private marks: Map<string, number> = new Map();
  private maxMetrics = 100; // Keep last 100 metrics

  /**
   * Start timing an operation
   */
  mark(name: string): void {
    this.marks.set(name, performance.now());
  }

  /**
   * End timing and record metric
   */
  measure(name: string, metadata?: Record<string, any>): number | null {
    const startTime = this.marks.get(name);
    if (!startTime) {
      console.warn(`No mark found for: ${name}`);
      return null;
    }

    const duration = performance.now() - startTime;
    this.recordMetric(name, duration, metadata);
    this.marks.delete(name);

    return duration;
  }

  /**
   * Record a metric directly without marking
   */
  recordMetric(name: string, duration: number, metadata?: Record<string, any>): void {
    this.metrics.push({
      name,
      duration,
      timestamp: Date.now(),
      metadata,
    });

    // Keep only recent metrics
    if (this.metrics.length > this.maxMetrics) {
      this.metrics.shift();
    }

    // Log slow operations in development
    if (import.meta.env.DEV && duration > 1000) {
      console.warn(`Slow operation detected: ${name} took ${duration.toFixed(2)}ms`, metadata);
    }
  }

  /**
   * Get metrics by name
   */
  getMetrics(name?: string): PerformanceMetric[] {
    if (name) {
      return this.metrics.filter((m) => m.name === name);
    }
    return [...this.metrics];
  }

  /**
   * Get average duration for a metric
   */
  getAverage(name: string): number | null {
    const metrics = this.getMetrics(name);
    if (metrics.length === 0) return null;

    const total = metrics.reduce((sum, m) => sum + m.duration, 0);
    return total / metrics.length;
  }

  /**
   * Get percentile duration (e.g., p95, p99)
   */
  getPercentile(name: string, percentile: number): number | null {
    const metrics = this.getMetrics(name);
    if (metrics.length === 0) return null;

    const sorted = metrics.map((m) => m.duration).sort((a, b) => a - b);
    const index = Math.ceil((percentile / 100) * sorted.length) - 1;
    return sorted[index];
  }

  /**
   * Get performance summary
   */
  getSummary(): Record<string, any> {
    const metricsByName = new Map<string, number[]>();

    this.metrics.forEach((metric) => {
      if (!metricsByName.has(metric.name)) {
        metricsByName.set(metric.name, []);
      }
      metricsByName.get(metric.name)!.push(metric.duration);
    });

    const summary: Record<string, any> = {};

    metricsByName.forEach((durations, name) => {
      const sorted = [...durations].sort((a, b) => a - b);
      const avg = durations.reduce((sum, d) => sum + d, 0) / durations.length;
      const p50 = sorted[Math.floor(sorted.length * 0.5)];
      const p95 = sorted[Math.floor(sorted.length * 0.95)];
      const p99 = sorted[Math.floor(sorted.length * 0.99)];

      summary[name] = {
        count: durations.length,
        avg: avg.toFixed(2),
        p50: p50?.toFixed(2) || 0,
        p95: p95?.toFixed(2) || 0,
        p99: p99?.toFixed(2) || 0,
        min: Math.min(...durations).toFixed(2),
        max: Math.max(...durations).toFixed(2),
      };
    });

    return summary;
  }

  /**
   * Clear all metrics
   */
  clear(): void {
    this.metrics = [];
    this.marks.clear();
  }

  /**
   * Export metrics for analysis
   */
  export(): string {
    return JSON.stringify({
      metrics: this.metrics,
      summary: this.getSummary(),
      exportedAt: new Date().toISOString(),
    }, null, 2);
  }
}

// Singleton instance
export const perfMonitor = new PerformanceMonitor();

/**
 * Hook for measuring React component render time
 */
export function usePerformanceMark(componentName: string) {
  const markName = `render:${componentName}`;

  // Mark start of render
  perfMonitor.mark(markName);

  // Measure on mount/update
  return () => {
    perfMonitor.measure(markName);
  };
}

/**
 * Higher-order function to measure async operation performance
 */
export async function measureAsync<T>(
  name: string,
  operation: () => Promise<T>,
  metadata?: Record<string, any>
): Promise<T> {
  perfMonitor.mark(name);
  try {
    const result = await operation();
    perfMonitor.measure(name, metadata);
    return result;
  } catch (error) {
    perfMonitor.measure(name, { ...metadata, error: true });
    throw error;
  }
}

/**
 * Measure database query performance
 */
export async function measureQuery<T>(
  queryName: string,
  query: () => Promise<T>
): Promise<T> {
  return measureAsync(`query:${queryName}`, query);
}

/**
 * Performance metric names
 */
export const PERF_METRICS = {
  PAGE_LOAD: 'page_load',
  QUERY_PROFILES: 'query:profiles',
  QUERY_LEADERBOARD: 'query:leaderboard',
  QUERY_CARDS: 'query:cards',
  QUERY_MESSAGES: 'query:messages',
  QUERY_BATTLES: 'query:battles',
  RENDER_DASHBOARD: 'render:Dashboard',
  RENDER_PROFILE: 'render:ProfileView',
  RENDER_LEADERBOARD: 'render:Leaderboard',
  RENDER_INBOX: 'render:Inbox',
  IMAGE_LOAD: 'image_load',
  API_CALL: 'api_call',
};

/**
 * Log performance summary to console (dev only)
 */
export function logPerformanceSummary(): void {
  if (!import.meta.env.DEV) return;

  console.group('📊 Performance Summary');
  console.table(perfMonitor.getSummary());
  console.groupEnd();
}

/**
 * Measure Web Vitals (Core Web Vitals)
 */
export function measureWebVitals(): void {
  if (!('PerformanceObserver' in window)) return;

  try {
    // First Contentful Paint (FCP)
    const fcpObserver = new PerformanceObserver((list) => {
      const entries = list.getEntries();
      entries.forEach((entry: any) => {
        perfMonitor.recordMetric('web_vital:fcp', entry.startTime);
        console.log(`⚡ First Contentful Paint: ${entry.startTime.toFixed(2)}ms`);
      });
    });
    fcpObserver.observe({ entryTypes: ['paint'] });

    // Largest Contentful Paint (LCP)
    const lcpObserver = new PerformanceObserver((list) => {
      const entries = list.getEntries();
      const lastEntry = entries[entries.length - 1];
      perfMonitor.recordMetric('web_vital:lcp', lastEntry.startTime);
      console.log(`⚡ Largest Contentful Paint: ${lastEntry.startTime.toFixed(2)}ms`);
    });
    lcpObserver.observe({ entryTypes: ['largest-contentful-paint'] });

    // First Input Delay (FID)
    const fidObserver = new PerformanceObserver((list) => {
      const entries = list.getEntries();
      entries.forEach((entry: any) => {
        const delay = entry.processingStart - entry.startTime;
        perfMonitor.recordMetric('web_vital:fid', delay);
        console.log(`⚡ First Input Delay: ${delay.toFixed(2)}ms`);
      });
    });
    fidObserver.observe({ entryTypes: ['first-input'] });

    // Cumulative Layout Shift (CLS)
    let clsScore = 0;
    const clsObserver = new PerformanceObserver((list) => {
      const entries = list.getEntries();
      entries.forEach((entry: any) => {
        if (!entry.hadRecentInput) {
          clsScore += entry.value;
        }
      });
      perfMonitor.recordMetric('web_vital:cls', clsScore);
    });
    clsObserver.observe({ entryTypes: ['layout-shift'] });

    // Log initial page load time
    if (window.performance && window.performance.timing) {
      window.addEventListener('load', () => {
        const loadTime = window.performance.timing.loadEventEnd - window.performance.timing.navigationStart;
        perfMonitor.recordMetric('page_load_total', loadTime);
        console.log(`⚡ Page Load Total: ${loadTime.toFixed(2)}ms`);
      });
    }
  } catch (error) {
    console.warn('Failed to measure web vitals:', error);
  }
}

/**
 * Measure network connection quality
 */
export function getConnectionQuality(): string {
  if ('connection' in navigator) {
    const conn = (navigator as any).connection;
    const effectiveType = conn.effectiveType;

    if (effectiveType === '4g') return 'excellent';
    if (effectiveType === '3g') return 'good';
    if (effectiveType === '2g') return 'poor';
    return 'slow';
  }
  return 'unknown';
}

/**
 * Get device performance tier
 */
export function getDeviceTier(): 'high' | 'medium' | 'low' {
  const memory = (navigator as any).deviceMemory;
  const cores = navigator.hardwareConcurrency || 2;

  if (memory >= 8 && cores >= 8) return 'high';
  if (memory >= 4 && cores >= 4) return 'medium';
  return 'low';
}
