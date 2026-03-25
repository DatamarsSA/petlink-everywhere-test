import { describe, it, beforeAll, afterAll, expect } from "vitest";
import { petlink } from "../../clients/petlink-infrastructure/client-petlink-infrastructure.js";
import { logger } from "../../config/logger.js";
import { PacketType } from "../../clients/petlink-infrastructure/packets-sentinel/packets.js";
import { testHelper, TestSetup } from "../../clients/client-test-helper.js";
import {
  CommandEnum,
  ModeType,
  OnGpsMessageStatusDocument,
  StatusState,
} from "../../clients/petlink-infrastructure/endpoints/graphql/generated/core_schema.js";

describe("Torch & Sound Commands", () => {
  let setup: TestSetup = {} as TestSetup;

  beforeAll(async () => {
    setup = await testHelper.setupBuilder().withUser().withDog().withDogDevice().withSubscription().build();
    await petlink.sentinel.connectAndHandshake(setup.devices.dogStandard!);
  });

  afterAll(() => {
    petlink.sentinel.disconnect();
    petlink.core.graphqlWS.disconnect();
  });

  describe("TORCH Command", () => {
    it("User ACTIVATE Torch (sendCommand duration=60) -> packet 0x10 should arrive to device AND app receives Torch Status ON", async () => {
      logger.info("🔦 User activates Torch");

      const device = setup.devices.dogStandard!;
      let torchDurationSentByApp = 60;
      let torchDurationReceivedByDevice = torchDurationSentByApp / 60;

      // 1. Setup listener for device packet BEFORE sending command
      logger.info("⏳ Device waiting for 0x10 (TORCH)...");
      const commandPacketPromise = petlink.sentinel.waitForPacket(
        PacketType.PACKET_0x10,
        (p) => p.torch_duration === torchDurationReceivedByDevice && (p.evo_tasks & 0x01) !== 0,
      );

      // 2. Start listening from App
      const statusUpdatePromise = petlink.core.graphqlWS.authJwt.subscribeUntil(
        OnGpsMessageStatusDocument,
        { id: device.id },
        "Should receive status update with flashlight=ON",
        (data) => data?.onGpsMessageStatus?.status?.flashlight === StatusState.On,
        async () => {
          // Send command when subscription is ready
          logger.info("⚡ Subscription ready -> Sending torch command...");
          const activateResponse = await petlink.core.graphqlHttp.authJwt.sendCommand({
            command: {
              commandType: CommandEnum.Flashlight,
              id: device.id,
              duration: torchDurationSentByApp,
              modeType: ModeType.Sentinel,
            },
          });
          expect(activateResponse.sendCommand.code).toBe("200");
        },
      );

      // 3. Device wait for packet
      const commandPacket = await commandPacketPromise;
      expect(commandPacket.torch_duration).toBe(torchDurationReceivedByDevice);
      expect(commandPacket.evo_tasks & 0x01).toBe(0x01);
      logger.info("✓ Device received torch command");

      // 4. Device sends Packet 0x10 response to confirm state
      await petlink.sentinel.simulator.torch(device, torchDurationReceivedByDevice);

      // 5. Device sends heartbeat with status update
      await petlink.sentinel.simulator.heartbeat(device, {
        spare_c4: 80,
      });

      // 6. App received correct new status of device
      const statusEvent = await statusUpdatePromise;
      logger.info("statusEvent:", statusEvent);
      expect(statusEvent.onGpsMessageStatus.status.flashlight).toBe(StatusState.On);
      logger.info("✓ App received torch status update");
    });

    it("User DEACTIVATE Torch (sendCommand duration=0) -> packet 0x10 should arrive to device", async () => {
      logger.info("🔦 User deactivates Torch");

      const device = setup.devices.dogStandard!;
      let torchDurationSentByApp = 0;
      let torchDurationReceivedByDevice = torchDurationSentByApp / 60;

      const deactivationPacketPromise = petlink.sentinel.waitForPacket(
        PacketType.PACKET_0x10,
        (p) => p.torch_duration === torchDurationReceivedByDevice && (p.evo_tasks & 0x01) !== 0,
      );

      const deactivateResponse = await petlink.core.graphqlHttp.authJwt.sendCommand({
        command: {
          commandType: CommandEnum.Flashlight,
          id: device.id,
          duration: torchDurationSentByApp,
          modeType: ModeType.Sentinel,
        },
      });
      expect(
        deactivateResponse.sendCommand.code,
        `sendCommand should succeed - Error: ${deactivateResponse.sendCommand.message}${deactivateResponse.sendCommand.translationCode ? ` (${deactivateResponse.sendCommand.translationCode})` : ""}`,
      ).toBe("200");

      logger.info("⏳ Waiting for 0x10 (TORCH OFF)...");
      const deactivationPacket = await deactivationPacketPromise;

      expect(deactivationPacket.torch_duration).toBe(torchDurationReceivedByDevice);
      expect(deactivationPacket.evo_tasks & 0x01).toBe(0x01);
      logger.info("✓ Torch deactivated");

      // Device sends Packet 0x10 response to confirm deactivation
      await petlink.sentinel.simulator.torch(device, torchDurationReceivedByDevice);
    });
  });

  describe("SOUND Command", () => {
    it("User ACTIVATE Sound (sendCommand duration=30) -> packet 0x10 should arrive to device AND app receives Sound Status ON", async () => {
      logger.info("🔊 User activates Sound");

      const device = setup.devices.dogStandard!;
      let soundDurationSentByApp = 30;
      let soundDurationReceivedByDevice = soundDurationSentByApp;

      // 1. Setup listener for device packet BEFORE sending command
      logger.info("⏳ Device waiting for 0x10 (SOUND)...");
      const commandPacketPromise = petlink.sentinel.waitForPacket(
        PacketType.PACKET_0x10,
        (p) => p.sound_duration === soundDurationReceivedByDevice && p.sound_command === 1 && (p.evo_tasks & 0x04) !== 0,
      );

      // 2. Start listening from App WITH onReady callback
      const statusUpdatePromise = petlink.core.graphqlWS.authJwt.subscribeUntil(
        OnGpsMessageStatusDocument,
        { id: device.id },
        "Should receive status update with sound=ON",
        (data) => data?.onGpsMessageStatus?.status?.sound === StatusState.On,
        async () => {
          // ✅ FIX: Send command when subscription is ready
          logger.info("⚡ Subscription ready -> Sending sound command...");
          const activateResponse = await petlink.core.graphqlHttp.authJwt.sendCommand({
            command: {
              commandType: CommandEnum.Sound,
              id: device.id,
              duration: soundDurationSentByApp,
              modeType: ModeType.Sentinel,
            },
          });
          expect(activateResponse.sendCommand.code).toBe("200");
        },
      );

      // 3. Device wait for packet
      const commandPacket = await commandPacketPromise;
      expect(commandPacket.sound_duration).toBe(soundDurationReceivedByDevice);
      expect(commandPacket.sound_command).toBe(1);
      expect(commandPacket.evo_tasks & 0x04).toBe(0x04);
      logger.info("✓ Device received sound command");

      // 4. Device sends Packet 0x10 response to confirm state
      await petlink.sentinel.simulator.sound(device, soundDurationReceivedByDevice);

      // 5. Device sends heartbeat with status update
      await petlink.sentinel.simulator.heartbeat(device, {
        spare_c4: 75,
      });

      // 6. App received correct new status of device
      const statusEvent = await statusUpdatePromise;
      logger.info("statusEvent:", statusEvent);
      expect(statusEvent.onGpsMessageStatus.status.sound).toBe(StatusState.On);
      logger.info("✓ App received sound status update");
    });

    it("User MUTE Sound (sendCommand duration=0) -> packet 0x10 should arrive to device with sound_command=0", async () => {
      logger.info("🔊 User mutes Sound");

      const device = setup.devices.dogStandard!;
      let soundDurationSentByApp = 0;
      let soundDurationReceivedByDevice = soundDurationSentByApp;

      const mutePacketPromise = petlink.sentinel.waitForPacket(
        PacketType.PACKET_0x10,
        (p) => p.sound_duration === soundDurationReceivedByDevice && p.sound_command === 0 && (p.evo_tasks & 0x04) !== 0,
      );

      const muteResponse = await petlink.core.graphqlHttp.authJwt.sendCommand({
        command: {
          commandType: CommandEnum.Sound,
          id: device.id,
          duration: soundDurationSentByApp,
          modeType: ModeType.Sentinel,
        },
      });
      expect(
        muteResponse.sendCommand.code,
        `sendCommand should succeed - Error: ${muteResponse.sendCommand.message}${muteResponse.sendCommand.translationCode ? ` (${muteResponse.sendCommand.translationCode})` : ""}`,
      ).toBe("200");

      logger.info("⏳ Waiting for 0x10 (SOUND MUTE)...");
      const mutePacket = await mutePacketPromise;

      expect(mutePacket.sound_duration).toBe(soundDurationReceivedByDevice);
      expect(mutePacket.sound_command).toBe(0);
      expect(mutePacket.evo_tasks & 0x04).toBe(0x04);
      logger.info("✓ Sound muted");

      // Device sends Packet 0x10 response to confirm mute
      await petlink.sentinel.simulator.sound(device, soundDurationReceivedByDevice);
    });
  });
});
