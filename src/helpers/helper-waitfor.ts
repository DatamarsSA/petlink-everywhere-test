/**
 * Poll a function until a condition is met or timeout occurs.
 * Use this when waiting for asynchronous data/events (OTP arrival, email verification, subscription activation, etc.)
 *
 * @param fn - Function that returns the value to check (can return null/undefined if not ready)
 * @param options
 * @param options.isReady - Predicate function to check if the result is valid.
 *                          Receives the result and must return `true` when the condition is satisfied.
 *                          Default: checks for truthy value (!!result)
 * @param options.timeoutMs - Maximum time to wait in milliseconds (default: 30000)
 * @param options.intervalMs - Delay between polling attempts in milliseconds (default: 1000)
 * @param options.timeoutError - Custom error message when timeout occurs
 *
 * @example
 * // Example 1: Simple usage - waits for truthy value (default behavior)
 * const otp = await waitFor(
 *   () => twilioClient.getLatestOtp(phoneNumber),
 *   {
 *     timeoutMs: pollingTimeoutMs,
 *     intervalMs: pollingIntervalMs,
 *     timeoutError: 'OTP not received in time'
 *   }
 * );
 * // Stops when getLatestOtp returns a non-empty string
 *
 * @example
 * // Example 2: Custom condition with isReady
 * const subscription = await waitFor(
 *   () => petlink.getSubscriptionByProductId({ productId: deviceId }),
 *   {
 *     isReady: (result) => {
 *       // Define your custom condition here
 *       // Returns true when subscription is active AND payment succeeded
 *       const subs = result.getSubscriptionByProductId.subscriptions;
 *       return subs?.some(sub =>
 *         sub?.status === "active" &&
 *         sub?.paymentStatus === "SUCCEEDED"
 *       ) ?? false;
 *     },
 *     timeoutMs: pollingTimeoutMs,
 *     intervalMs: pollingIntervalMs,
 *     timeoutError: 'Subscription did not become active in time'
 *   }
 * );
 *
 * @example
 * // Example 3: Wait for specific array length
 * const devices = await waitFor(
 *   () => api.getDevices(userId),
 *   {
 *     isReady: (result) => result.devices.length >= 3,
 *     timeoutMs: pollingTimeoutMs,
 *     intervalMs: pollingIntervalMs
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
  const { isReady = (result) => !!result, timeoutMs = 30000, intervalMs = 1000, timeoutError = `Timeout: Payment succeeded not return within ${timeoutMs}ms` } = options;

  const startTime = Date.now();
  let attempts = 0;
  let lastError: Error | null = null;

  while (Date.now() - startTime < timeoutMs) {
    attempts++;

    try {
      const result = await fn();
      if (isReady(result)) {
        return result;
      }
    } catch (error) {
      // Salva l'errore silenziosamente, senza loggarlo
      lastError = error instanceof Error ? error : new Error(String(error));
      // Continua a fare retry
    }

    if (Date.now() - startTime + intervalMs < timeoutMs) {
      await new Promise((resolve) => setTimeout(resolve, intervalMs));
    }
  }

  // Lancia l'errore finale con i dettagli
  const errorInfo = lastError ? `\nCaused by: ${lastError.message}` : "";
  throw new Error(`${timeoutError} (${attempts} attempts)${errorInfo}`);
}
