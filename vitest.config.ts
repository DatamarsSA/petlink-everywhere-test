import { defineConfig } from "vitest/config";
import { loadEnv } from "vite";

export default defineConfig(({ mode }) => {
  // 1. Usa il mode passato da riga di comando (--mode)
  // 2. ..Altrimenti usa NODE_ENV
  // 3. ..Se nessuno dei due è definito, usa "develop"
  const environment = mode || process.env.NODE_ENV || "develop";

  console.log(`Running tests in '${environment}' environment`);
  // Carica le variabili d'ambiente dal file .env.{environment}
  const rawEnv = loadEnv(environment, process.cwd(), "");

  return {
    test: {
      globals: true,
      environment: "node",
      env: rawEnv,
      // timeouts più larghi per integrazione/E2E
      testTimeout: 25000, // singolo test (it)
      hookTimeout: 25000, // beforeAll/afterAll/beforeEach/afterEach

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
      // 1. Disabilita parallelismo tra FILE
      fileParallelism: false,
      // 2. Assicura che i test dentro ogni file siano sequenziali
      sequence: {
        concurrent: false,
      },
      // 3. Usa un solo worker (un solo processo alla volta)
      pool: "forks", // o 'threads'
      poolOptions: {
        forks: {
          singleFork: true, // Forza un singolo fork process
        },
        threads: {
          singleThread: true, // Oppure singolo thread
        },
      },
    },
  };
});
