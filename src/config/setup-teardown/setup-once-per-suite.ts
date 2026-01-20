import { logger } from "../logger.js";
import { testHelper } from "../../clients/client-test-helper.js";

export default async function setup() {
  logger.debug("→ Global Setup: Test suite initialization started");
  testHelper.cleanTestReports();
  return async () => {
    logger.debug("← Global Teardown: Test suite cleanup completed");
  };
}
