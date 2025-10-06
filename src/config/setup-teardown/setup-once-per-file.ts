import { beforeAll, afterAll } from "vitest";
import { globalState } from "../../test-utils/global-state/state-global-flow.js";
import { petlink } from "../../clients/petlink-infrastructure/client-petlink-infrastructure.js";
import { PerformanceTracker } from "../../test-utils/helpers/performance-tracker.js";

// QUI le env vars sono disponibili!
beforeAll(async () => {
  await globalState.cleanupAll();
});

afterAll(async () => {
  PerformanceTracker.appendToJsonl();
});
