import { logger } from "../logger.js";

export default async function setup() {
  // una volta PRIMA di tutta la run
  logger.debug("→ Global Setup: Test suite initialization started");

  // ritorna la funzione di teardown UNA volta a FINE run
  return async () => {
    logger.debug("← Global Teardown: Test suite cleanup completed");
  };
}
