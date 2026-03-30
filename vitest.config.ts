import { defineConfig } from "vitest/config";
import { loadEnv } from "vite";
import { z } from "zod";

export default defineConfig(() => {
  const environment = process.env.NODE_ENV || "develop";

  console.log("Vitest Config initialized", {
    NODE_ENV: process.env.NODE_ENV,
    environment,
  });

  // Carica le variabili d'ambiente dal file .env.{environment}
  const rawEnv = loadEnv(environment, process.cwd(), "");
  Object.assign(process.env, rawEnv);

  // ============================================================================
  // ENVIRONMENT VALIDATION (Zod)
  // ============================================================================
  const envSchema = z.object({
    // AWS Cognito (endpoints)
    COGNITO_REGION: z.string().min(1, "COGNITO_REGION è richiesta"),
    COGNITO_CLIENT_ID_APP_USER: z.string().min(1, "COGNITO_CLIENT_ID_APP_USER è richiesto"),
    COGNITO_CLIENT_ID_FE_CCT: z.string().min(1, "COGNITO_CLIENT_ID_FE_CCT è richiesto"),
    // USER (app) credentials login
    USER_APP_NAME: z.string().min(1, "USER_APP_NAME è richiesta"),
    USER_APP_SURNAME: z.string().min(1, "USER_APP_SURNAME è richiesta"),
    USER_APP_PASSWORD: z.string().min(1, "USER_APP_PASSWORD è richiesta"),
    // OPERATOR (cct) credentials login
    OPERATOR_CCT_EMAIL: z.string().min(1, "OPERATOR_CCT_EMAIL è richiesta"),
    OPERATOR_CCT_PASSWORD: z.string().min(1, "OPERATOR_CCT_PASSWORD è richiesta"),
    OPERATOR_CCT_PHONE: z.string().min(1, "OPERATOR_CCT_PHONE è richiesta"),
    // CORE API
    CORE_GRAPHQL_API_URL: z.url("CORE_GRAPHQL_API_URL deve essere un URL valido"),
    CORE_GRAPHQL_API_KEY: z.string().min(1, "CORE_GRAPHQL_API_KEY è richiesta"),
    // CCT API
    CCT_GRAPHQL_API_URL: z.url("CCT_GRAPHQL_API_URL deve essere un URL valido"),
    CCT_GRAPHQL_API_KEY: z.string().min(1, "CCT_GRAPHQL_API_KEY è richiesta"),
    // AWS IAM
    AWS_REGION: z.string().min(1, "AWS_REGION è richiesta"),
    AWS_CORE_ACCESS_KEY_ID: z.string().min(1, "AWS_CORE_ACCESS_KEY_ID è richiesta"),
    AWS_CORE_SECRET_ACCESS_KEY: z.string().min(1, "AWS_CORE_SECRET_ACCESS_KEY è richiesta"),
    AWS_CCT_ACCESS_KEY_ID: z.string().min(1, "AWS_CCT_ACCESS_KEY_ID è richiesta"),
    AWS_CCT_SECRET_ACCESS_KEY: z.string().min(1, "AWS_CCT_SECRET_ACCESS_KEY è richiesta"),
    // Twilio
    TWILIO_ACCOUNT_SID: z.string().min(1, "TWILIO_ACCOUNT_SID è richiesto"),
    TWILIO_AUTH_TOKEN: z.string().min(1, "TWILIO_AUTH_TOKEN è richiesto"),
    TWILIO_USER_PHONE_NUMBER: z.string().min(1, "TWILIO_USER_PHONE_NUMBER è richiesto"),
    // Gmail
    GMAIL_CLIENT_ID: z.string().min(1, "GMAIL_CLIENT_ID è richiesto"),
    GMAIL_CLIENT_SECRET: z.string().min(1, "GMAIL_CLIENT_SECRET è richiesto"),
    GMAIL_REFRESH_TOKEN: z.string().min(1, "GMAIL_REFRESH_TOKEN è richiesto"),
    GMAIL_USER_EMAIL: z.string().min(1, "GMAIL_USER_EMAIL è richiesto"),
    // App Brand
    APP_BRAND: z.enum(["PETLINK", "KIPPY"]).optional().default("KIPPY"),
    // log level console
    LOG_LEVEL: z.enum(["error", "warn", "info", "debug"]).default("debug"),
    ENABLE_PERFORMANCE_TRACKER: z.enum(["true", "false"]).default("false"),
    // Sentinel socket tcp
    SENTINEL_HOST: z.ipv4().min(1, "SENTINEL_HOST è richiesto"),
    SENTINEL_PORT: z.string().min(4, "SENTINEL_PORT è richiesta"),
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
  console.log("APP_BRAND: ", result.data?.APP_BRAND);
  console.log("LOG_LEVEL: ", result.data?.LOG_LEVEL);
  console.log("ENABLE_PERFORMANCE_TRACKER: ", process.env.ENABLE_PERFORMANCE_TRACKER);

  return {
    test: {
      globals: true,
      environment: "node",
      env: result.data,
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
