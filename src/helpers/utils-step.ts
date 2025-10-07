// Helper function for step-based execution
export async function step<T>(
  description: string,
  fn: () => Promise<T>,
): Promise<T> {
  const startTime = Date.now();

  try {
    console.log(`\n🔄 ${description}...`);
    const result = await fn();
    const duration = Date.now() - startTime;
    console.log(`✅ ${description} completed (${duration}ms)`);
    return result;
  } catch (error) {
    const duration = Date.now() - startTime;
    console.log(`❌ ${description} failed (${duration}ms)`);
    console.error(`Error details:`, error);
    throw error;
  }
}
