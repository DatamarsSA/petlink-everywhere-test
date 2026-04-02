import { defineConfig } from "vitest/config";
import { getEnvironment } from "./src/config/environment.js";

export default defineConfig(() => {
  const env = getEnvironment();

  console.log("APP_BRAND: ", env.APP_BRAND);
  console.log("LOG_LEVEL: ", env.LOG_LEVEL);
  console.log("ENABLE_PERFORMANCE_TRACKER: ", env.ENABLE_PERFORMANCE_TRACKER);

  return {
    // look at https://vitest.dev/guide/lifecycle for vitest config
    test: {
      globals: true,
      environment: "node",
      env: env,
      // timeouts più larghi per integrazione/E2E
      testTimeout: 180000, // singolo test (it) - in milliseconds
      hookTimeout: 180000, // beforeAll/afterAll/beforeEach/afterEach - in milliseconds

      // 1) Eseguito PRIMA di ogni file di test
      setupFiles: ["./src/config/setup-teardown/setup-once-per-file.ts"],
      // 2) Eseguito UNA VOLTA all’inizio; ritorna il teardown UNA VOLTA alla fine
      globalSetup: ["./src/config/setup-teardown/setup-once-per-suite.ts"],

      // --- Reporters per GitHub Actions e locale ---
      reporters: [
        "default", // Console output (per sviluppo locale)
        "junit", // Per GitHub Actions annotations
        "html", // Per UI web statica e visualizzazione locale
      ],

      outputFile: {
        junit: "./test-reports/junit.xml", // GitHub Actions legge questo
        html: "./test-reports/index.html", // Report HTML interattivo
      },
      // 1. Disabilita parallelismo TRA file
      fileParallelism: false,
      // 2. Disabilita parallelismo tra test DENTRO lo stesso file
      sequence: {
        concurrent: false,
      },

      exclude: ["node_modules/**", "all-repo/*"],
    },
  };
});
