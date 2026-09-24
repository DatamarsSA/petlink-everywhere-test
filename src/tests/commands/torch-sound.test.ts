import { describe, it, beforeAll, afterAll, expect } from "vitest";
import { petlink } from "../../clients/petlink-infrastructure/client-petlink-infrastructure.js";
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
    await testHelper.cleanupAll();
    setup = await testHelper
      .setupBuilder()
      .withUser()
      .withDog({ gps: { withSubscription: true } })
      .build();
    await petlink.sentinel.connectAndHandshake(setup.dog!.devices.gps!);
  });

  afterAll(() => {
    petlink.sentinel.disconnect();
    petlink.core.graphqlWS.disconnect();
  });

  describe("TORCH Command", () => {
    it("User ACTIVATE Torch (sendCommand duration=60) -> packet 0x10 should arrive to device AND app receives Torch Status ON", async () => {
      const gps = setup.dog!.devices.gps!;
      let torchDurationSentByApp = 60;
      let torchDurationReceivedByDevice = torchDurationSentByApp / 60;

      // 1. Subscribe from App — the command is sent when the subscription is ready
      const statusUpdatePromise = petlink.core.graphqlWS.authJwt.subscribeUntil(
        OnGpsMessageStatusDocument,
        { id: gps.id },
        "Should receive status update with flashlight=ON",
        (data) => data?.onGpsMessageStatus?.status?.flashlight === StatusState.On,
        async () => {
          const activateResponse = await petlink.core.graphqlHttp.authJwt.sendCommand({
            command: {
              commandType: CommandEnum.Flashlight,
              id: gps.id,
              duration: torchDurationSentByApp,
              modeType: ModeType.Sentinel,
            },
          });
          expect(activateResponse.sendCommand.code).toBe("200");
        },
      );

      // 2. Device waits for the command packet
      const commandPacket = await petlink.sentinel.waitForPacket(
        PacketType.PACKET_0x10,
        (p) => p.torch_duration === torchDurationReceivedByDevice && (p.evo_tasks & 0x01) !== 0,
      );
      expect(commandPacket.torch_duration).toBe(torchDurationReceivedByDevice);
      expect(commandPacket.evo_tasks & 0x01).toBe(0x01);

      // 3. Device sends Packet 0x10 response to confirm state
      await petlink.sentinel.simulator.torch(gps, torchDurationReceivedByDevice);

      // 4. Device sends heartbeat with status update
      await petlink.sentinel.simulator.heartbeat(gps, {
        spare_c4: 80,
      });

      // 5. App received correct new status of device
      const statusEvent = await statusUpdatePromise;
      expect(statusEvent.onGpsMessageStatus.status.flashlight).toBe(StatusState.On);
    });

    it("User DEACTIVATE Torch (sendCommand duration=0) -> packet 0x10 should arrive to device", async () => {
      const gps = setup.dog!.devices.gps!;
      let torchDurationSentByApp = 0;
      let torchDurationReceivedByDevice = torchDurationSentByApp / 60;

      const deactivateResponse = await petlink.core.graphqlHttp.authJwt.sendCommand({
        command: {
          commandType: CommandEnum.Flashlight,
          id: gps.id,
          duration: torchDurationSentByApp,
          modeType: ModeType.Sentinel,
        },
      });
      expect(
        deactivateResponse.sendCommand.code,
        `sendCommand should succeed - Error: ${deactivateResponse.sendCommand.message}${deactivateResponse.sendCommand.translationCode ? ` (${deactivateResponse.sendCommand.translationCode})` : ""}`,
      ).toBe("200");

      const deactivationPacket = await petlink.sentinel.waitForPacket(
        PacketType.PACKET_0x10,
        (p) => p.torch_duration === torchDurationReceivedByDevice && (p.evo_tasks & 0x01) !== 0,
      );

      expect(deactivationPacket.torch_duration).toBe(torchDurationReceivedByDevice);
      expect(deactivationPacket.evo_tasks & 0x01).toBe(0x01);

      // Device sends Packet 0x10 response to confirm deactivation
      await petlink.sentinel.simulator.torch(gps, torchDurationReceivedByDevice);
    });
  });

  describe("SOUND Command", () => {
    it("User ACTIVATE Sound (sendCommand duration=30) -> packet 0x10 should arrive to device AND app receives Sound Status ON", async () => {
      const gps = setup.dog!.devices.gps!;
      let soundDurationSentByApp = 30;
      let soundDurationReceivedByDevice = soundDurationSentByApp;

      // 1. Subscribe from App — the command is sent when the subscription is ready
      const statusUpdatePromise = petlink.core.graphqlWS.authJwt.subscribeUntil(
        OnGpsMessageStatusDocument,
        { id: gps.id },
        "Should receive status update with sound=ON",
        (data) => data?.onGpsMessageStatus?.status?.sound === StatusState.On,
        async () => {
          const activateResponse = await petlink.core.graphqlHttp.authJwt.sendCommand({
            command: {
              commandType: CommandEnum.Sound,
              id: gps.id,
              duration: soundDurationSentByApp,
              modeType: ModeType.Sentinel,
            },
          });
          expect(activateResponse.sendCommand.code).toBe("200");
        },
      );

      // 2. Device waits for the command packet
      const commandPacket = await petlink.sentinel.waitForPacket(
        PacketType.PACKET_0x10,
        (p) => p.sound_duration === soundDurationReceivedByDevice && p.sound_command === 1 && (p.evo_tasks & 0x04) !== 0,
      );
      expect(commandPacket.sound_duration).toBe(soundDurationReceivedByDevice);
      expect(commandPacket.sound_command).toBe(1);
      expect(commandPacket.evo_tasks & 0x04).toBe(0x04);

      // 4. Device sends Packet 0x10 response to confirm state
      await petlink.sentinel.simulator.sound(gps, soundDurationReceivedByDevice);

      // 5. Device sends heartbeat with status update
      await petlink.sentinel.simulator.heartbeat(gps, {
        spare_c4: 75,
      });

      // 6. App received correct new status of device
      const statusEvent = await statusUpdatePromise;
      expect(statusEvent.onGpsMessageStatus.status.sound).toBe(StatusState.On);
    });

    it("User MUTE Sound (sendCommand duration=0) -> packet 0x10 should arrive to device with sound_command=0", async () => {
      const gps = setup.dog!.devices.gps!;
      let soundDurationSentByApp = 0;
      let soundDurationReceivedByDevice = soundDurationSentByApp;

      const muteResponse = await petlink.core.graphqlHttp.authJwt.sendCommand({
        command: {
          commandType: CommandEnum.Sound,
          id: gps.id,
          duration: soundDurationSentByApp,
          modeType: ModeType.Sentinel,
        },
      });
      expect(
        muteResponse.sendCommand.code,
        `sendCommand should succeed - Error: ${muteResponse.sendCommand.message}${muteResponse.sendCommand.translationCode ? ` (${muteResponse.sendCommand.translationCode})` : ""}`,
      ).toBe("200");

      const mutePacket = await petlink.sentinel.waitForPacket(
        PacketType.PACKET_0x10,
        (p) => p.sound_duration === soundDurationReceivedByDevice && p.sound_command === 0 && (p.evo_tasks & 0x04) !== 0,
      );

      expect(mutePacket.sound_duration).toBe(soundDurationReceivedByDevice);
      expect(mutePacket.sound_command).toBe(0);
      expect(mutePacket.evo_tasks & 0x04).toBe(0x04);

      // Device sends Packet 0x10 response to confirm mute
      await petlink.sentinel.simulator.sound(gps, soundDurationReceivedByDevice);
    });
  });
});
