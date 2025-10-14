import { defineConfig } from "vitest/config";
import { loadEnv } from "vite";

export default defineConfig(({ mode }) => {
  const environment = process.env.TEST_ENV || "develop";

  console.log(
    `🔧 Vitest Config - Mode: ${mode}, NODE_ENV: ${process.env.NODE_ENV}, TEST_ENV: ${process.env.TEST_ENV}, Using: ${environment}`,
  );

  // Carica le variabili d'ambiente dal file .env.{environment}
  const rawEnv = loadEnv(environment, process.cwd(), "");

  return {
    test: {
      globals: true,
      environment: "node",
      env: rawEnv,
      // timeouts più larghi per integrazione/E2E
      testTimeout: 150000, // singolo test (it)
      hookTimeout: 150000, // beforeAll/afterAll/beforeEach/afterEach

      // 1) Eseguito PRIMA di ogni file di test
      setupFiles: ["./src/config/setup-teardown/setup-once-per-file.ts"],
      // 2) Eseguito UNA VOLTA all’inizio; ritorna il teardown UNA VOLTA alla fine
      globalSetup: ["./src/config/setup-teardown/setup-once-per-suite.ts"],

      // --- Reporters per GitHub Actions ---
      reporters: [
        "default", // Console output (per sviluppo locale)
        "junit", // Per GitHub Actions annotations
      ],

      outputFile: {
        junit: "./test-reports/junit.xml", // GitHub Actions legge questo
        json: "./test-reports/results.json", // Per post-processing
      },
      // 1. Disabilita parallelismo TRA file
      fileParallelism: false,
      // 2. Disabilita parallelismo tra test DENTRO lo stesso file
      sequence: {
        concurrent: false,
      },
    },
  };
});
