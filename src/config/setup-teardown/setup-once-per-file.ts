import { beforeAll, afterAll } from "vitest";
import { testHelper } from "../../clients/client-test-helper.js";

beforeAll(async () => {
  await testHelper.cleanupAll();
});
