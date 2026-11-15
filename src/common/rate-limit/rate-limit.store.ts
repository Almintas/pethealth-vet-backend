import { Injectable, OnModuleDestroy } from '@nestjs/common';

type Bucket = { count: number; resetAt: number };

const CLEANUP_INTERVAL_MS = 60_000;

/**
 * In-memory fixed-window counters. Good enough for a single API instance;
 * with several replicas each keeps its own counts (limits get looser, never
 * stricter), which is acceptable for brute-force protection.
 */
@Injectable()
export class RateLimitStore implements OnModuleDestroy {
  private readonly buckets = new Map<string, Bucket>();
  private readonly cleanupTimer: NodeJS.Timeout;

  constructor() {
    this.cleanupTimer = setInterval(() => this.cleanup(), CLEANUP_INTERVAL_MS);
    this.cleanupTimer.unref();
  }

  /** Counts one hit. Returns seconds to wait when over the limit, else 0. */
  hit(key: string, limit: number, windowMs: number, now = Date.now()): number {
    const bucket = this.buckets.get(key);
    if (!bucket || bucket.resetAt <= now) {
      this.buckets.set(key, { count: 1, resetAt: now + windowMs });
      return 0;
    }
    bucket.count += 1;
    if (bucket.count > limit) {
      return Math.max(1, Math.ceil((bucket.resetAt - now) / 1000));
    }
    return 0;
  }

  reset(): void {
    this.buckets.clear();
  }

  onModuleDestroy(): void {
    clearInterval(this.cleanupTimer);
  }

  private cleanup(now = Date.now()): void {
    for (const [key, bucket] of this.buckets) {
      if (bucket.resetAt <= now) {
        this.buckets.delete(key);
      }
    }
  }
}
