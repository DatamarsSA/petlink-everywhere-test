import { beforeAll, afterAll } from "vitest";
import { globalState } from "../../helpers/state-global-flow.js";
import { PerformanceTracker } from "../../helpers/performance-tracker.js";

beforeAll(async () => {
  await globalState.cleanupAll();
});

afterAll(async () => {
  PerformanceTracker.appendToJsonl();
  await globalState.cleanupAll();
});
