/**
 * Retry a function on errors/exceptions.
 * Use this when operations can fail temporarily (network errors, rate limits, etc.)
 *
 * @example
 * const user = await withRetry(() => petlink.core.authJwt.getUser(), {
 *   retries: 3,
 *   delayMs: 500
 * });
 */
export async function withRetry<T>(
  fn: () => Promise<T>,
  options: { retries?: number; delayMs?: number } = {},
): Promise<T> {
  const { retries = 3, delayMs = 500 } = options;
  let lastError: unknown;

  for (let attempt = 0; attempt <= retries; attempt++) {
    try {
      return await fn();
    } catch (err) {
      lastError = err;
      if (attempt < retries) {
        // simple fixed delay backoff
        await new Promise((res) => setTimeout(res, delayMs));
      }
    }
  }

  throw lastError;
}

/**
 * Poll a function until a condition is met or timeout occurs.
 * Use this when waiting for asynchronous data/events (OTP arrival, email verification, etc.)
 *
 * @param fn - Function that returns the value to check (can return null/undefined if not ready)
 * @param options
 * @param options.isReady - Predicate to check if the result is valid (default: checks for truthy value)
 * @param options.timeoutMs - Maximum time to wait in milliseconds (default: 30000)
 * @param options.intervalMs - Delay between polling attempts in milliseconds (default: 1000)
 * @param options.timeoutError - Custom error message when timeout occurs
 *
 * @example
 * const otp = await waitFor(
 *   () => twilioClient.getLatestOtp(phoneNumber),
 *   {
 *     timeoutMs: 60000,
 *     intervalMs: 3000,
 *     timeoutError: 'OTP not received in time'
 *   }
 * );
 */
export async function waitFor<T>(
  fn: () => Promise<T>,
  options: {
    isReady?: (result: T) => boolean;
    timeoutMs?: number;
    intervalMs?: number;
    timeoutError?: string;
  } = {},
): Promise<T> {
  const {
    isReady = (result) => !!result,
    timeoutMs = 30000,
    intervalMs = 1000,
    timeoutError = `Timeout: condition not met within ${timeoutMs}ms`,
  } = options;

  const startTime = Date.now();
  let attempts = 0;

  while (Date.now() - startTime < timeoutMs) {
    attempts++;

    try {
      const result = await fn();
      if (isReady(result)) {
        return result;
      }
    } catch (error) {
      // Continue polling even if fn throws (e.g., network errors during polling)
      // If you want to fail fast on errors, remove this try-catch
    }

    // Don't wait after the last attempt if we're about to timeout
    if (Date.now() - startTime + intervalMs < timeoutMs) {
      await new Promise((resolve) => setTimeout(resolve, intervalMs));
    }
  }

  throw new Error(`${timeoutError} (${attempts} attempts)`);
}
