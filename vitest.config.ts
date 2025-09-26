import { defineConfig } from "vitest/config";
import { loadEnv } from "vite";

export default defineConfig(({ mode }) => {
  const rawEnv = loadEnv(mode ?? "develop", process.cwd(), "");

  return {
    test: {
      globals: true,
      environment: "node",
      env: rawEnv,
      setupFiles: ["./src/config/test-setup.ts"], // Run once before worker
    },
  };
});
