import { beforeAll, afterAll } from "vitest";
import { globalState } from "../../helpers/state-global-flow.js";

beforeAll(async () => {
  await globalState.cleanupAll();
});

afterAll(async () => {
  await globalState.cleanupAll();
});
