import { defineConfig } from "vitest/config";
import { loadEnv } from "vite";
import { z } from "zod";

export default defineConfig(({ mode }) => {
  const environment = process.env.TEST_ENV || "develop";

  console.log("Vitest Config initialized", {
    mode,
    NODE_ENV: process.env.NODE_ENV,
    TEST_ENV: process.env.TEST_ENV,
    environment,
  });

  // Carica le variabili d'ambiente dal file .env.{environment}
  const rawEnv = loadEnv(environment, process.cwd(), "");
  Object.assign(process.env, rawEnv);

  // ============================================================================
  // ENVIRONMENT VALIDATION (Zod)
  // ============================================================================
  const envSchema = z.object({
    // CORE API
    CORE_GRAPHQL_API_URL: z.url("CORE_GRAPHQL_API_URL deve essere un URL valido"),
    CORE_GRAPHQL_API_KEY: z.string().min(1, "CORE_GRAPHQL_API_KEY è richiesta"),
    // CCT API
    CCT_GRAPHQL_API_URL: z.url("CCT_GRAPHQL_API_URL deve essere un URL valido"),
    CCT_GRAPHQL_API_KEY: z.string().min(1, "CCT_GRAPHQL_API_KEY è richiesta"),
    // AWS Cognito (for LOGIN)
    COGNITO_REGION: z.string().min(1, "COGNITO_REGION è richiesta"),
    COGNITO_CLIENT_ID: z.string().min(1, "COGNITO_CLIENT_ID è richiesto"),
    // AWS IAM
    AWS_REGION: z.string().min(1, "AWS_REGION è richiesta"),
    AWS_ACCESS_KEY_ID: z.string().min(1, "AWS_ACCESS_KEY_ID è richiesta"),
    AWS_SECRET_ACCESS_KEY: z.string().min(1, "AWS_SECRET_ACCESS_KEY è richiesta"),
    // Twilio
    TWILIO_ACCOUNT_SID: z.string().min(1, "TWILIO_ACCOUNT_SID è richiesto"),
    TWILIO_AUTH_TOKEN: z.string().min(1, "TWILIO_AUTH_TOKEN è richiesto"),
    // Gmail
    GMAIL_CLIENT_ID: z.string().min(1, "GMAIL_CLIENT_ID è richiesto"),
    GMAIL_CLIENT_SECRET: z.string().min(1, "GMAIL_CLIENT_SECRET è richiesto"),
    GMAIL_REFRESH_TOKEN: z.string().min(1, "GMAIL_REFRESH_TOKEN è richiesto"),
    // App Brand
    APP_BRAND: z.enum(["PETLINK", "KIPPY"]).optional().default("KIPPY"),
    // log level console
    LOG_LEVEL: z.enum(["error", "warn", "info", "debug"]).default("error"),
  });

  const result = envSchema.safeParse(process.env);
  if (!result.success) {
    console.error("❌ Envs validation failed");
    result.error.issues.forEach((issue) => {
      console.error(`  ${issue.path.join(".")}: ${issue.message}`);
    });
    process.exit(1);
  }
  Object.assign(process.env, result.data);
  console.log("✅ Envs validated successfully");

  return {
    test: {
      globals: true,
      environment: "node",
      env: rawEnv,
      // timeouts più larghi per integrazione/E2E
      testTimeout: 180000, // singolo test (it) - 3 minutes
      hookTimeout: 180000, // beforeAll/afterAll/beforeEach/afterEach - 3 minutes

      // 1) Eseguito PRIMA di ogni file di test
      setupFiles: ["./src/config/setup-teardown/setup-once-per-file.ts"],
      // 2) Eseguito UNA VOLTA all’inizio; ritorna il teardown UNA VOLTA alla fine
      globalSetup: ["./src/config/setup-teardown/setup-once-per-suite.ts"],

      // --- Reporters per GitHub Actions ---
      reporters: [
        "default", // Console output (per sviluppo locale)
        "junit", // Per GitHub Actions annotations
        "json", // Per skipped tests details in GitHub Actions summary
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
