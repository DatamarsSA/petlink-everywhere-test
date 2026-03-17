import { beforeAll, afterAll } from "vitest";
import { testHelper } from "../../clients/client-test-helper.js";
import { logger } from "../logger.js";

beforeAll(async () => {
  logger.debug("→ Test file setup: Running cleanup before tests");
  await testHelper.cleanupAll(); // Temporaneamente disabilitato per test
  logger.debug("← Test file setup: Cleanup completed");
});
