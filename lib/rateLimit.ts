/**
 * Lightweight in-memory rate limiter. One bucket per key, sliding window
 * implemented as "list of timestamps within window".
 *
 * Important caveats — read before assuming this protects production:
 *
 * 1. **Per-instance state.** Each serverless instance keeps its own Map.
 *    On Vercel with multiple warm instances, the effective limit becomes
 *    `instances × maxAttempts`. Acceptable for low-traffic apps where the
 *    goal is stopping naive scripts, not determined attackers.
 *
 * 2. **Memory cleanup.** We prune expired timestamps lazily (on every
 *    `check`). For very high-cardinality keys (e.g., per-IP across the
 *    whole internet), a long-running process could grow the Map. Mitigated
 *    here by the serverless model — instances are recycled.
 *
 * 3. **Bypassable by IP rotation.** This is keyed by whatever you pass.
 *    A botnet defeats it. For that, use Upstash/Redis-backed limiting
 *    with proper IP analysis, not this.
 *
 * Used in: lib/auth.ts (login attempts).
 */

interface Bucket {
  /** Unix epoch ms timestamps of attempts still inside the window. */
  attempts: number[]
}

const buckets = new Map<string, Bucket>()

export interface RateLimitOptions {
  /** Max attempts allowed per window. */
  maxAttempts: number
  /** Window size, in milliseconds. */
  windowMs: number
}

export interface RateLimitResult {
  allowed: boolean
  /** How many attempts remain in the current window. */
  remaining: number
  /** Ms until the oldest attempt expires (i.e., next slot opens). 0 if allowed. */
  retryAfterMs: number
}

/**
 * Checks whether `key` may perform another attempt right now. If yes, the
 * attempt is recorded.
 */
export function checkRateLimit(
  key: string,
  { maxAttempts, windowMs }: RateLimitOptions
): RateLimitResult {
  const now = Date.now()
  const cutoff = now - windowMs

  const bucket = buckets.get(key) ?? { attempts: [] }

  // Drop attempts outside the window.
  bucket.attempts = bucket.attempts.filter((t) => t > cutoff)

  if (bucket.attempts.length >= maxAttempts) {
    const oldest = bucket.attempts[0]
    const retryAfterMs = oldest + windowMs - now
    buckets.set(key, bucket)
    return { allowed: false, remaining: 0, retryAfterMs }
  }

  bucket.attempts.push(now)
  buckets.set(key, bucket)

  return {
    allowed: true,
    remaining: maxAttempts - bucket.attempts.length,
    retryAfterMs: 0,
  }
}

/** Test/ops helper — clears all buckets. */
export function resetRateLimit(): void {
  buckets.clear()
}