import { defineConfig } from "vitest/config";
import { loadEnv } from "vite";

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode ?? "develop", process.cwd(), "");

  return {
    test: {
      globals: true,
      environment: "node",
      env,
      setupFiles: ["./src/test-setup.ts"], // Run once before worker
    },
  };
});
