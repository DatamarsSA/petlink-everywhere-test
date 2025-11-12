// src/tests/device/sentinel-tcp.test.ts

import { describe, it, beforeAll, afterAll } from "vitest";
import { testHelper } from "../../clients/client-test-helper.js";
import { logger } from "../../config/logger.js";
import { sentinelTcpClient } from "../../clients/sentinel/client-sentinel.js";

describe.skip("Sentinel TCP Communication", async () => {
  let setup: any;
  // Connette al server Sentinel
  await sentinelTcpClient.connect()

  beforeAll(async () => {
    setup = await testHelper.setupBuilder()
      .withUser()
      .withDog()
      .withDogDevice()
      .build();

  });

  afterAll(() => {
    sentinelTcpClient.disconnect();
  });

  it("should send WELCOME packet and receive response", async () => {
    logger.info("Testing device WELCOME handshake");

    const serialNumber = setup.devices.dogStandard!.serialNumber;

    // Invia il welcome
    await sentinelTcpClient.sendWelcome(serialNumber);

    // Verifica che abbiamo ricevuto qualcosa
    const receivedData = sentinelTcpClient.getReceivedData();
    logger.debug(`Received ${receivedData.length} bytes from Sentinel`);

    // Qui puoi fare assertion sulla risposta
    // expect(receivedData.length).toBeGreaterThan(0);
  });

  it("should send HEARTBEAT after connection", async () => {
    logger.info("Testing device HEARTBEAT");

    const serialNumber = setup.devices.dogStandard!.serialNumber;

    await sentinelTcpClient.sendHeartbeat(serialNumber);

    // Verifica ricezione
    const receivedData = sentinelTcpClient.getReceivedData();
    logger.debug(`Total received: ${receivedData.length} bytes`);
  });

});



describe.skip("", () => {

  it("", async () => {
    await testHelper.cleanUpUser();
    await testHelper.cleanupAll()
  })

})