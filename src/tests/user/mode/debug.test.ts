//@ts-nocheck
import { describe, it } from "vitest";
import { onGpsMessagePosition } from "../../../clients/petlink-infrastructure/endpoints/graphql/operations/core/subscriptions.js";
import { petlink } from "../../../clients/petlink-infrastructure/client-petlink-infrastructure.js";
import * as subscriptions from "../../../clients/petlink-infrastructure/endpoints/graphql/operations/core/subscriptions.js";
import { logger } from "../../../config/logger.js";
import { fxt } from "../../../fixtures/fixtures.js";

describe.skip("User mode", () => {
  it("LIVE TRACKING", async () => {
    // App action
    await app.sendCommand({
      commandType: "LIVE_TRACKING",
      id: deviceId,
      duration: 900,
    });

    // Aspetta
    await sleep(5000);

    // Verifica: device dovrebbe mandare posizioni ogni 5 sec
    expect(positionsReceived).toBeGreaterThan(1); // Almeno 2 posizioni
  });

  it("GEOFANCE", async () => {
    // Setup: device è FUORI dal poligono
    // App action
    await app.sendSetting({
      operationType: "ACTIVATE",
      settingType: "GEOFENCE",
      deviceId: deviceId,
      geofence: [
        //6 coordinates
        { lat: 44.5, lng: 11.3 },
        { lat: 44.5, lng: 11.35 },
        { lat: 44.55, lng: 11.35 },
        { lat: 44.55, lng: 11.3 },
        { lat: 44.505, lng: 11.32 },
        { lat: 44.495, lng: 11.32 },
      ],
    });

    // Aspetta
    await sleep(2000);

    // Verifica: dovrebbe arrivare push AND auto LIVE_TRACKING attivato
    expect(pushNotifications).toContain({ action: "GEOFENCE_OUT" });
    expect(device.frequencyUpdated).toBe(5); // Changed to 5 sec (auto LT)
  });

  it("ENERGY SAVING ZONE", async () => {
    // Setup: device è dentro la zona (col_detached=1, WiFi match)
    // App action
    await app.sendSetting({
      operationType: "ACTIVATE",
      settingType: "ENERGY_SAVING_ZONE",
      deviceId: deviceId,
    });

    // Aspetta
    await sleep(2000);

    // Verifica: app dovrebbe ricevere push "Pet in ESZ"
    expect(pushNotifications).toContain({ action: "ENERGY_SAVING_ZONE_IN" });
  });
});
