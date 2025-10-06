import { beforeAll, afterAll } from "vitest";
import { globalState } from "../../test-utils/global-state/state-global-flow.js";
import { writeFileSync } from "fs";

// Questo viene eseguito PRIMA di ogni file di test
beforeAll(async () => {
  console.log("----- INIZIO FILE DI TEST (setupFiles beforeAll) -----");
  // writeFileSync(
  //   "./src/config/setup-teardown/BEFORE_FILE_EXECUTED.txt",
  //   new Date().toISOString(),
  // );
  await globalState.cleanupAll();
});

// Questo viene eseguito DOPO ogni file di test
afterAll(async () => {
  console.log("----- FINE FILE DI TEST (setupFiles afterAll) -----");
  // writeFileSync(
  //   "./src/config/setup-teardown/AFTER_FILE_EXECUTED.txt",
  //   new Date().toISOString(),
  // );
});
