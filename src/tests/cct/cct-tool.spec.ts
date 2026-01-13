import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { testHelper, TestSetup, EnrichedDevice } from "../../clients/client-test-helper.js";
import { petlink } from "../../clients/petlink-infrastructure/client-petlink-infrastructure.js";
import { logger } from "../../config/logger.js";
import { Device, FilterEnum, OrderEnum } from "../../clients/petlink-infrastructure/endpoints/graphql/generated/cct_schema.js";
import { sentinelTcpSocketClient } from "../../clients/sentinel/client-sentinel.js";
import { PetlinkGps } from "../../clients/petlink-infrastructure/endpoints/graphql/generated/core_schema.js";

describe("CCT Tool", () => {
  describe("Customers", () => {
    let user: any;
    let pet: any;
    let device: EnrichedDevice;

    beforeAll(async () => {
      // 1. Setup: Create User + Pet + Device via Core
      const setup = await testHelper.setupBuilder().withUser().withDog().withDogDevice().build();
      user = setup.user!;
      pet = setup.pets.dog!;
      device = setup.devices.dogStandard!;

      logger.info("Setup Customer complete", { userId: user.id, email: user.email, deviceId: device.id });
    });

    it("should allow CCT Admin to find a Customer in the list", async () => {
      // 3. Test List: GetCustomers filter by email
      logger.info("Searching Customer in list...");
      const listResponse = await petlink.cct.graphqlHttp.authJwt.getCustomers({
        filter: {
          filterType: FilterEnum.And,
          email: user.email,
        },
        pagination: { pageNumber: 0, pageSize: 10 },
      });

      expect(listResponse.getCustomers.code).toBe("200");
      expect(listResponse.getCustomers.items?.length).toBeGreaterThan(0);
      const customerInList = listResponse.getCustomers.items?.find((c) => c?.email === user.email);
      expect(customerInList).toBeDefined();
      expect(customerInList?.id).toBe(user.id);
    });

    it("should allow CCT Admin to view Customer details", async () => {
      // 4. Test Detail: GetCustomer
      logger.info("Fetching Customer Detail...");
      const detailResponse = await petlink.cct.graphqlHttp.authJwt.getCustomer({
        customerId: user.id,
      });

      expect(detailResponse.getCustomer.code).toBe("200");
      expect(detailResponse.getCustomer.customer?.id).toBe(user.id);
      expect(detailResponse.getCustomer.customer?.email).toBe(user.email);
      expect(detailResponse.getCustomer.customer?.name).toBe(user.name);
      expect(detailResponse.getCustomer.customer?.surname).toBe(user.surname);
      expect(detailResponse.getCustomer.customer?.appBrand).toBe(user.appBrand);
      expect(detailResponse.getCustomer.customer?.countryCode).toBe(user.countryCode);
      // expect(detailResponse.getCustomer.customer?.language).toBe(user.language);TODO. fix
      expect(detailResponse.getCustomer.customer?.phone).toBe(user.phone);
    });

    it("should allow CCT Admin to view Customer Devices and verify associations", async () => {
      // CustomGetCustomerDevices
      logger.info("Fetching Customer Devices...");
      const devicesResponse = await petlink.cct.graphqlHttp.authJwt.customGetCustomerDevices({
        customerId: user.id,
      });

      expect(devicesResponse.getDevices.code).toBe("200");
      expect(devicesResponse.getDevices.items).toBeDefined();
      expect(devicesResponse.getDevices.items?.length).toBeGreaterThan(0);

      const targetDevice = devicesResponse.getDevices.items?.find((d) => d?.deviceId === device.id);
      expect(targetDevice).toBeDefined();
      expect(targetDevice?.deviceId).toBe(device.id);
      expect(targetDevice?.petId).toBe(pet.id);
      expect(targetDevice?.customerId).toBe(user.id);
      expect(targetDevice?.serialId).toBe(device.serialNumber);
    });
  });

  describe("Devices", () => {
    let user: any;
    let pet: any;
    let device: EnrichedDevice;

    beforeAll(async () => {
      await testHelper.cleanupAll();

      // 1. Setup: Create User + Pet + Device via Core
      const setup = await testHelper.setupBuilder().withUser().withDog().withDogDevice().build();
      user = setup.user!;
      pet = setup.pets.dog!;
      device = setup.devices.dogStandard!;

      logger.info("Setup Device complete", {
        userId: user.id,
        petId: pet.id,
        deviceId: device.id,
        serial: device.serialNumber,
      });

      await new Promise((resolve) => setTimeout(resolve, 2000));
    });

    it("should allow CCT Admin to find a Device in the list", async () => {
      // 3. Test List: GetDevices filter by Serial Number
      logger.info("Searching Device in list...");
      const listResponse = await petlink.cct.graphqlHttp.authJwt.getDevices({
        filter: {
          filterType: FilterEnum.And,
          serialId: device.serialNumber,
        },
        pagination: { pageNumber: 0, pageSize: 10 },
      });

      expect(listResponse.getDevices.code).toBe("200");
      const deviceInList = listResponse.getDevices.items?.find((d) => d?.serialId === device.serialNumber);
      expect(deviceInList).toBeDefined();
      expect(deviceInList?.deviceId).toBe(device.id);
    });

    it("should allow CCT Admin to view Device details", async () => {
      // 4. Test Detail: GetDevice
      logger.info("Fetching Device Detail...");
      const deviceDetailResponse = await petlink.cct.graphqlHttp.authJwt.getDevice({
        serialId: device.serialNumber,
      });
      expect(deviceDetailResponse.getDevice.code).toBe("200");
      expect(deviceDetailResponse.getDevice.device?.deviceId).toBe(device.id);
      expect(deviceDetailResponse.getDevice.device?.serialId).toBe(device.serialNumber);
      expect(deviceDetailResponse.getDevice.device?.customerId).toBe(user.id);
      expect(deviceDetailResponse.getDevice.device?.petId).toBe(pet.id);
    });

    it("should allow CCT Admin to view Device Pet info", async () => {
      // GetPet
      const petResponse = await petlink.cct.graphqlHttp.authJwt.getPet({
        petId: pet.id,
      });
      expect(petResponse.getPet.code).toBe("200");
      expect(petResponse.getPet.pet?.id).toBe(pet.id);
      expect(petResponse.getPet.pet?.userId).toBe(user.id);
    });

    it("should allow CCT Admin to view Device Owner info", async () => {
      // GetCustomer
      const customerResponse = await petlink.cct.graphqlHttp.authJwt.getCustomer({
        customerId: user.id,
      });
      expect(customerResponse.getCustomer.code).toBe("200");
      expect(customerResponse.getCustomer.customer?.id).toBe(user.id);
    });

    it("should allow CCT Admin to view Device Subscriptions", async () => {
      // GetCustomDeviceSubscriptions
      const subResponse = await petlink.cct.graphqlHttp.authJwt.getCustomDeviceSubscriptions({
        deviceId: device.id,
      });
      expect(subResponse.getSubscriptions.code).toBe("200");
      expect(subResponse.getSubscriptions.items).toBeDefined();
    });
  });

  describe("CCT - Last Connections Integration", () => {
    let setup: TestSetup;

    beforeAll(async () => {
      await testHelper.cleanupAll();
      setup = await testHelper.setupBuilder().withUser().withDog().withDogDevice().build();
      await sentinelTcpSocketClient.connect();
    });

    afterAll(async () => {
      sentinelTcpSocketClient.disconnect();
    });

    it("should show updated device connection timestamp in CCT list AFTER heartbeat is sent", async () => {
      const device = setup.devices.dogStandard!;
      const user = setup.user!;

      // --- FASE 1: STATO INIZIALE ---
      // Recuperiamo la data di connessione attuale (se esiste) per confrontarla dopo
      const preResponse = await petlink.cct.graphqlHttp.authJwt.getDevices({
        filter: { filterType: FilterEnum.And, serialId: device.serialNumber },
      });
      const preDevice = preResponse.getDevices.items?.[0];
      const oldLastConnectionDate = preDevice?.lastConnectionDate ? new Date(preDevice.lastConnectionDate).getTime() : 0;

      // --- FASE 2: INVIO HEARTBEAT (EMULAZIONE DEVICE) ---
      const testLat = 45.04862;
      const testLng = 7.641921;

      await sentinelTcpSocketClient.simulator.heartbeat(device, {
        latitude: testLat,
        longitude: testLng,
        battery: 5800, // 5.8V (che il CCT trasforma in %)
      });

      // Attendiamo che il dato attraversi SQS e arrivi al DB (async)
      await new Promise((r) => setTimeout(r, 3000));

      // --- FASE 3: VERIFICA IN CCT TOOL ---
      const postResponse = await petlink.cct.graphqlHttp.authJwt.getDevices({
        pagination: { pageNumber: 0, pageSize: 5 },
        order: { field: "lastConnectionDate", order: OrderEnum.Desc },
        filter: {
          filterType: FilterEnum.And,
          lastConnectionDate: { gte: "2000-01-01T00:00:00.000Z" }, // Filtro standard della vista Last Connections
        },
      });

      const latest = postResponse.getDevices.items?.find((i) => i?.serialId === device.serialNumber);

      expect(latest, "Device should appear on CCT list of devices.").toBeDefined();

      // 1. Assert sul Timestamp: deve essere aumentato e molto recente (ultimi 45s)
      const lastConnDate = new Date(latest?.lastConnectionDate!).getTime();
      expect(lastConnDate, "Last connection date should be updated").toBeGreaterThan(oldLastConnectionDate);
      expect(Date.now() - lastConnDate).toBeLessThan(45000);

      // 2. Assert sui Dati Tecnici
      expect(latest?.imei).toBe(device.imei);
      expect(latest?.iccid).toBe(device.iccid);
      expect(latest?.lat).toBeCloseTo(testLat);
      expect(latest?.lng).toBeCloseTo(testLng);

      expect(latest?.customerEmail).toBe(user.email);
      expect(latest?.customerName).toBe(user.name);

      logger.info("✅ Test Last Connections completed: heartbeat from device to Sentil arrived to CCT!");
    });
  });
});
