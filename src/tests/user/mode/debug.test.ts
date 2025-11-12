import { describe, it, beforeAll } from "vitest";
import { logger } from "../../../config/logger.js";
import { sentinelTcpClient } from "../../../clients/sentinel/client-sentinel.js";

// describe.skip("User mode", () => {
//   it("LIVE TRACKING", async () => {
//     // App action
//     await app.sendCommand({
//       commandType: "LIVE_TRACKING",
//       id: deviceId,
//       duration: 900,
//     });
//
//     // Aspetta
//     await sleep(5000);
//
//     // Verifica: device dovrebbe mandare posizioni ogni 5 sec
//     expect(positionsReceived).toBeGreaterThan(1); // Almeno 2 posizioni
//   });
//
//   it("GEOFANCE", async () => {
//     // Setup: device è FUORI dal poligono
//     // App action
//     await app.sendSetting({
//       operationType: "ACTIVATE",
//       settingType: "GEOFENCE",
//       deviceId: deviceId,
//       geofence: [
//         //6 coordinates
//         { lat: 44.5, lng: 11.3 },
//         { lat: 44.5, lng: 11.35 },
//         { lat: 44.55, lng: 11.35 },
//         { lat: 44.55, lng: 11.3 },
//         { lat: 44.505, lng: 11.32 },
//         { lat: 44.495, lng: 11.32 },
//       ],
//     });
//
//     // Aspetta
//     await sleep(2000);
//
//     // Verifica: dovrebbe arrivare push AND auto LIVE_TRACKING attivato
//     expect(pushNotifications).toContain({ action: "GEOFENCE_OUT" });
//     expect(device.frequencyUpdated).toBe(5); // Changed to 5 sec (auto LT)
//   });
//
//   it("ENERGY SAVING ZONE", async () => {
//     // Setup: device è dentro la zona (col_detached=1, WiFi match)
//     // App action
//     await app.sendSetting({
//       operationType: "ACTIVATE",
//       settingType: "ENERGY_SAVING_ZONE",
//       deviceId: deviceId,
//     });
//
//     // Aspetta
//     await sleep(2000);
//
//     // Verifica: app dovrebbe ricevere push "Pet in ESZ"
//     expect(pushNotifications).toContain({ action: "ENERGY_SAVING_ZONE_IN" });
//   });
// });

describe("Socket TCP sentinel", () => {
  beforeAll(async () => {
    logger.info("🔌 Connecting to Sentinel TCP server...");
    await sentinelTcpClient.connect();
    logger.info("✓ Connected to Sentinel");
  });

  // it("socket - send welcome vs send heartbeat", async () => {
  //   logger.info("→ Sending device packet with GPS enabled");
  //
  //   // Scenario 1: Device con GPS acceso (normale)
  //   // sendWelcome: Packet 0x01 con dati completi
  //   await sentinelTcpClient.sendWelcome("PETL123456", {
  //     latitude: 44.5024,
  //     longitude: 11.3463,
  //     wifi_cells: [...]
  //   });
  //
  //   // sendHeartbeat: Packet 0x06 semplice (niente opzioni)
  //   await sentinelTcpClient.sendHeartbeat("PETL123456");
  //
  //   // sendRaw: Non usare (è privato!)
  //
  //   logger.info("✓ Packet sent, waiting for Sentinel to process...");
  //   await new Promise((resolve) => setTimeout(resolve, 2000));
  // });

  it("socket - send welcome packet with GPS", async () => {
    logger.info("→ Sending device packet with GPS enabled");

    // Scenario 1: Device con GPS acceso (normale)
    await sentinelTcpClient.sendWelcome("PETL123456", {
      latitude: 44.5024,
      longitude: 11.3463,
      battery: 4200,
      collar_detached: false,
    });

    logger.info("✓ Packet sent, waiting for Sentinel to process...");
    await new Promise((resolve) => setTimeout(resolve, 2000));
  });

  it("socket - send welcome packet in ESZ mode", async () => {
    logger.info("→ Sending device packet in ESZ mode (GPS disabled)");

    // Scenario 2: Device in ESZ (GPS spento, a casa)
    await sentinelTcpClient.sendWelcome("PETL123456", {
      latitude: 0,
      longitude: 0,
      battery: 3500,
      collar_detached: true,
    });

    logger.info("✓ Packet sent, waiting for Sentinel to process...");
    await new Promise((resolve) => setTimeout(resolve, 2000));
  });

  it("wifi & gsm geolocation", async () => {
    logger.info("→ Sending geolocation");

    // WiFi Geolocation
    await sentinelTcpClient.sendWelcome("PETL123456", {
      latitude: 0,
      longitude: 0,
      wifi_cells: [
        { bssid: "AA:BB:CC:DD:EE:FF", rssi: -50, channel: 6 },
        { bssid: "11:22:33:44:55:66", rssi: -70, channel: 11 },
      ],
    });

    // GSM Geolocation
    await sentinelTcpClient.sendWelcome("PETL123456", {
      latitude: 0,
      longitude: 0,
      gsm_cells: [{ cid: 12345, lac: 67890, mcc: 222, mnc: 10, rxl: 20 }],
    });

    logger.info("✓ Packet sent, waiting for Sentinel to process...");
    await new Promise((resolve) => setTimeout(resolve, 2000));
  });
});
