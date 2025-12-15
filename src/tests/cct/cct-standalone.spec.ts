import { describe, it, expect, beforeAll } from "vitest";
import { testHelper } from "../../clients/client-test-helper.js";
import { petlink } from "../../clients/petlink-infrastructure/client-petlink-infrastructure.js";
import { logger } from "../../config/logger.js";
import { DeviceTypeEnum } from "../../clients/petlink-infrastructure/endpoints/graphql/generated/core_schema.js";
import { fxt } from "../../fixtures/fixtures.js";

describe("CCT Standalone Tests", () => {
  it("should allow CCT Admin to view a User created in Core", async () => {
    // 1. Setup: Create User and Device in Core
    // We use the testHelper which uses petlink.core internally
    const setup = await testHelper.setupBuilder().withUser().withDog().withDogDevice().build();
    const user = setup.user!;
    const device = setup.devices.dogStandard!;

    logger.info("Setup complete", { userId: user.id, deviceId: device.id });
    await new Promise((resolve) => setTimeout(resolve, 15000));

    // 2. Login as CCT Admin
    // This uses the NEW scoped auth method
    logger.info("Logging in as CCT Admin...");
    await petlink.cct.loginWithEmail(fxt.cctAdmin.email, fxt.cctAdmin.password);

    // 3. Verify User existence via CCT
    logger.info("Fetching User via CCT...");
    const cctUserResponse = await petlink.cct.graphqlHttp.authJwt.getUser({
      userId: user.id,
    });

    expect(cctUserResponse.getUser.code).toBe("200");
    expect(cctUserResponse.getUser.user?.email).toBe(user.email);
    logger.info("User verified in CCT", { email: cctUserResponse.getUser.user?.email });

    // 4. Verify Device existence via CCT
    logger.info("Fetching Device via CCT...");
    const cctDeviceResponse = await petlink.cct.graphqlHttp.authJwt.getDevice({
      deviceId: device.serialNumber, // Note: CCT getDevice takes deviceId (e.g. "DOG-123..."), which corresponds to serialNumber in Core
    });

    expect(cctDeviceResponse.getDevice.code).toBe("200");
    expect(cctDeviceResponse.getDevice.device?.serialId).toBe(device.serialNumber);
    logger.info("Device verified in CCT", { serialId: cctDeviceResponse.getDevice.device?.serialId });

    // 5. Perform Admin Action: Reset GPS
    logger.info("Performing Reset GPS via CCT...");
    const resetResponse = await petlink.cct.graphqlHttp.authJwt.resetPetlinkGps({
      id: device.id, // resetPetlinkGps usually takes the internal ID
    });

    expect(resetResponse.resetPetlinkGps.code).toBe("200");
    logger.info("GPS Reset successful");
  });
});
