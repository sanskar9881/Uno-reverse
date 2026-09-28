/** Classic token bucket: `capacity` burst, refilled at `refillPerSecond`. */
export class TokenBucket {
  private tokens: number;
  private updatedAt: number;

  constructor(
    private readonly capacity: number,
    private readonly refillPerSecond: number,
    private readonly now: () => number = Date.now,
  ) {
    this.tokens = capacity;
    this.updatedAt = now();
  }

  tryTake(cost = 1): boolean {
    this.refill();
    if (this.tokens < cost) return false;
    this.tokens -= cost;
    return true;
  }

  /** True when the bucket is full again (safe to forget). */
  get idle(): boolean {
    this.refill();
    return this.tokens >= this.capacity;
  }

  private refill(): void {
    const t = this.now();
    const elapsed = (t - this.updatedAt) / 1000;
    if (elapsed > 0) {
      this.tokens = Math.min(this.capacity, this.tokens + elapsed * this.refillPerSecond);
      this.updatedAt = t;
    }
  }
}

export interface BucketSpec {
  capacity: number;
  refillPerSecond: number;
}

/** One bucket per key (e.g. per IP). Idle buckets are pruned to bound memory. */
export class KeyedRateLimiter {
  private readonly buckets = new Map<string, TokenBucket>();

  constructor(
    private readonly spec: BucketSpec,
    private readonly maxKeys = 10_000,
  ) {}

  tryTake(key: string): boolean {
    let bucket = this.buckets.get(key);
    if (!bucket) {
      if (this.buckets.size >= this.maxKeys) this.prune();
      bucket = new TokenBucket(this.spec.capacity, this.spec.refillPerSecond);
      this.buckets.set(key, bucket);
    }
    return bucket.tryTake();
  }

  prune(): void {
    for (const [key, bucket] of this.buckets) if (bucket.idle) this.buckets.delete(key);
    // Still too many (sustained abuse): drop oldest entries.
    while (this.buckets.size >= this.maxKeys) {
      const oldest = this.buckets.keys().next().value;
      if (oldest === undefined) break;
      this.buckets.delete(oldest);
    }
  }

  get size(): number {
    return this.buckets.size;
  }
}
