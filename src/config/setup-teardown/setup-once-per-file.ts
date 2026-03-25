import { beforeAll, afterAll } from "vitest";
import { testHelper } from "../../clients/client-test-helper.js";
import { logger } from "../logger.js";

beforeAll(async () => {
  logger.debug("→ Test file setup: Empty actions at the moment");
  logger.debug("← Test file setup: Empty actions at the moment");
});
