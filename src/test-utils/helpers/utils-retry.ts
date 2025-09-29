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

//da cosi
// const user = await petlink.core.authJwt.getUser();

//a cosi
// const user = await withRetry(() => petlink.core.authJwt.getUser(), {
//   retries: 3,
// });
