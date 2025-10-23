import { logger } from "../logger.js";
import { testHelper, TestHelper } from "../../clients/client-test-helper.js";

export default async function setup() {
  // Clean test-reports/ directory once before all tests
  logger.debug("→ Global Setup: Test suite initialization started");
  testHelper.cleanTestReports();

  // ritorna la funzione di teardown UNA volta a FINE run
  return async () => {
    logger.debug("← Global Teardown: Test suite cleanup completed");
  };
}
