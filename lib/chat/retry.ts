/**
 * Retrying a transient chat failure instead of surfacing it.
 *
 * A chat connection drops for ordinary reasons — a tunnel, a laptop lid, a
 * flaky café network — and web treated every one of them as terminal: the
 * conversation showed an error with no way back except a full reload.
 */

/** Exponential, starting at one second: `[1000, 2000, 4000]` for three attempts. */
export function backoffDelays(attempts: number, base = 1000): number[] {
  return Array.from({ length: Math.max(0, attempts) }, (_, i) => base * 2 ** i);
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

/**
 * Runs `fn`, retrying on failure with {@link backoffDelays}.
 *
 * `attempts` counts *total* tries, not retries — `withRetry(fn, 3)` calls `fn`
 * at most three times. Rethrows the last error so the caller can still show its
 * own failure state once the retries are exhausted.
 */
export async function withRetry<T>(
  fn: () => Promise<T>,
  attempts = 3,
  base = 1000,
): Promise<T> {
  const delays = backoffDelays(attempts, base);
  let lastError: unknown;

  for (let i = 0; i < Math.max(1, attempts); i += 1) {
    try {
      return await fn();
    } catch (err) {
      lastError = err;
      // No sleep after the final attempt — nothing follows it.
      if (i < attempts - 1) await sleep(delays[i]!);
    }
  }

  throw lastError;
}
