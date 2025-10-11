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
