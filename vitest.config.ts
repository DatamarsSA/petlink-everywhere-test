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
      // 1) Eseguito PRIMA di ogni file di test
      setupFiles: ["./src/config/setup-teardown/setup-once-per-file.ts"],
      // 2) Eseguito UNA VOLTA all’inizio; ritorna il teardown UNA VOLTA alla fine
      globalSetup: ["./src/config/setup-teardown/setup-once-per-suite.ts"],
    },
  };
});
