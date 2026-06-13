import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { testHelper, TestSetup, EnrichedDevice } from "../../clients/client-test-helper.js";
import { petlink } from "../../clients/petlink-infrastructure/client-petlink-infrastructure.js";
import { logger } from "../../config/logger.js";
import { FilterEnum, LanguageId, OrderEnum } from "../../clients/petlink-infrastructure/endpoints/graphql/generated/cct_schema.js";
import { OperatingStatus } from "../../clients/petlink-infrastructure/packets-sentinel/packets.js";
import {
  RoleEnum,
  DeviceVisibilityEnum,
  VodafoneCountryVisibilityEnum,
} from "../../clients/petlink-infrastructure/endpoints/graphql/generated/cct_schema.js";
import { fxt } from "../../fixtures/fixtures.js";
import { waitFor } from "../../helpers/utils.js";

describe("CCT Tool", () => {
  describe("Customers", () => {
    let user: any;
    let pet: any;
    let device: EnrichedDevice;

    beforeAll(async () => {
      await testHelper.cleanupAll();
      const setup = await testHelper.setupBuilder().withUser().withDog({ withDevice: true }).build();
      user = setup.user!;
      pet = setup.dog!;
      device = setup.dog!.device!;

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
      // TODO. fix -> expect(detailResponse.getCustomer.customer?.language).toBe(user.language);
      expect(detailResponse.getCustomer.customer?.phone).toBe(user.phone);
    });

    it("should allow CCT Admin to view Customer Devices and verify associations", async () => {
      logger.info("Fetching Customer Devices...");
      const devicesResponse = await petlink.cct.graphqlHttp.authJwt.getDevices({
        filter: {
          filterType: FilterEnum.And,
          customerId: user.id,
        },
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

    it("should allow CCT Admin to UPDATE Customer", async () => {
      logger.info("Updating Customer...");

      const updatePayload = {
        email: "updated.customer@example.com",
        confermationEmail: true,
        language: LanguageId.It,
      };

      const updateResponse = await petlink.cct.graphqlHttp.authJwt.updateCustomer({
        customerId: user.id,
        updateCustomer: updatePayload,
      });

      expect(updateResponse.updateCustomer.code, "").toBe("200");
      const getResponse = await petlink.cct.graphqlHttp.authJwt.getCustomer({
        customerId: user.id,
      });
      expect(getResponse.getCustomer.customer).toMatchObject({
        id: user.id,
        email: updatePayload.email,
        language: updatePayload.language,
      });

      logger.info("✓ Customer updated successfully");
    });

    it("should allow CCT Admin to DELETE Customer", async () => {
      logger.info("Deleting Customer...");

      // 1. should not allow to delete customer with pet & gps associted
      const deleteCustomerWithPetResponse = await petlink.cct.graphqlHttp.authJwt.deleteCustomer({
        id: user.id,
      });
      expect(deleteCustomerWithPetResponse.deleteCustomer.code).not.toBe("200");

      // 2. should allow to delete customer without pet & gps associted
      await testHelper.cleanupAll();
      let newSetup = await testHelper.setupBuilder().withUser().build();
      let newUserWithoutPet = newSetup.user!;
      expect(newSetup.user).toBeDefined();
      const deleteCustomerWithoutPetResponse = await petlink.cct.graphqlHttp.authJwt.deleteCustomer({
        id: newUserWithoutPet.id,
      });
      expect(deleteCustomerWithoutPetResponse.deleteCustomer.code).toBe("200");
      // Verify customer no longer exists
      const getResponse = await petlink.cct.graphqlHttp.authJwt.getCustomer({
        customerId: newUserWithoutPet.id,
      });
      expect(getResponse.getCustomer.code).toBe("404");

      logger.info("✓ Customer deleted and verified");
    });
  });

  describe("Devices", () => {
    let user: any;
    let pet: any;
    let device: EnrichedDevice;

    beforeAll(async () => {
      await testHelper.cleanupAll();

      // 1. Setup: Create User + Pet + Device via Core
      const setup = await testHelper.setupBuilder().withUser().withDog({ withDevice: true }).build();
      user = setup.user!;
      pet = setup.dog!;
      device = setup.dog!.device!;

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
      const subResponse = await petlink.cct.graphqlHttp.authJwt.getSubscriptions({
        deviceId: device.id,
      });
      expect(subResponse.getSubscriptions.code).toBe("200");
      expect(subResponse.getSubscriptions.items).toBeDefined();
    });
  });

  describe("Last Connections", () => {
    let setup: TestSetup;

    beforeAll(async () => {
      await testHelper.cleanupAll();
      setup = await testHelper.setupBuilder().withUser().withDog({ withDevice: true }).build();
      await petlink.sentinel.connectAndHandshake(setup.dog!.device!);
    });

    afterAll(async () => {
      petlink.sentinel.disconnect();
    });

    it("should show updated device connection timestamp in CCT list AFTER heartbeat is sent", async () => {
      const device = setup.dog!.device!;
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

      await petlink.sentinel.simulator.heartbeat(device, {
        latitude: testLat,
        longitude: testLng,
        battery: 5800, // 5.8V (che il CCT trasforma in %)
        curr_status: OperatingStatus.DEFAULT,
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

    it("should allow CCT Admin to retrieve Connections History", async () => {
      const device = setup.dog!.device!;
      const response = await petlink.cct.graphqlHttp.authJwt.getConnectionsHistory({
        serialId: device.serialNumber,
        filter: { filterType: FilterEnum.And },
        pagination: { pageNumber: 0, pageSize: 10 },
      });

      expect(response.getConnectionsHistory.code).toBe("200");
      expect(response.getConnectionsHistory.items).toBeDefined();
      // Should have at least one connection from the previous test
      expect(response.getConnectionsHistory.items.length).toBeGreaterThan(0);
    });

    it("should allow CCT Admin to retrieve Last Connections via specific query", async () => {
      const device = setup.dog!.device!;
      const response = await petlink.cct.graphqlHttp.authJwt.getLastConnections({
        filter: {
          filterType: FilterEnum.And,
          serialId: device.serialNumber,
        },
        pagination: { pageNumber: 0, pageSize: 10 },
      });

      expect(response.getLastConnections.code).toBe("200");
      expect(response.getLastConnections.items).toBeDefined();
      expect(response.getLastConnections.items.length).toBeGreaterThan(0);
      expect(response.getLastConnections.items[0].serialId).toBe(device.serialNumber);
    });
  });

  describe("Users (CCT Operators)", () => {
    let createdUser: any;
    let adminUser: any;

    const newUserPayload = {
      name: "Mario".toLowerCase(),
      surname: "Rossi".toLowerCase(),
      email: `mario.rossi.${Date.now()}@example.com`,
      phone: `+19617${Date.now().toString().slice(-6)}`,
      role: [RoleEnum.Superadmin],
      active: true,
      deviceVisibility: [DeviceVisibilityEnum.Kippy, DeviceVisibilityEnum.Petlink, DeviceVisibilityEnum.Vodafone],
      vodafoneCountryVisibility: [VodafoneCountryVisibilityEnum.Eu, VodafoneCountryVisibilityEnum.Gb],
    };

    beforeAll(async () => {
      await testHelper.cleanupAll();
    });

    afterAll(async () => {
      await petlink.cct.graphqlHttp.authJwt.deleteUser({
        id: createdUser.id,
      });
    });

    it("should allow CCT Admin to CREATE a new Operator User", async () => {
      logger.info("Creating new CCT User...", { email: newUserPayload.email });

      const response = await petlink.cct.graphqlHttp.authJwt.createUser({
        user: newUserPayload,
      });

      expect(response.createUser.code).toBe("200");
      expect(response.createUser.user).toBeDefined();
      createdUser = response.createUser.user;
    });

    it("should allow CCT Admin to GET the details of the created User", async () => {
      expect(createdUser).toBeDefined();

      const response = await petlink.cct.graphqlHttp.authJwt.getUser({
        userId: createdUser.id,
      });

      expect(response.getUser.code).toBe("200");
      expect(response.getUser.user, "Created CCT user payload should match input payload").toMatchObject({
        id: createdUser.id,
        name: newUserPayload.name,
        surname: newUserPayload.surname,
        email: newUserPayload.email,
        phone: newUserPayload.phone,
        role: newUserPayload.role,
        active: newUserPayload.active,
        deviceVisibility: newUserPayload.deviceVisibility,
        vodafoneCountryVisibility: newUserPayload.vodafoneCountryVisibility,
      });
    });

    it("should allow CCT Admin to FIND the created User in the list", async () => {
      expect(createdUser).toBeDefined();

      const response = await petlink.cct.graphqlHttp.authJwt.getUsers({
        filter: {
          filterType: FilterEnum.And,
          email: newUserPayload.email,
        },
        pagination: { pageNumber: 0, pageSize: 10 },
      });

      expect(response.getUsers.code).toBe("200");

      const found = response.getUsers.items.find((u) => u.id === createdUser.id);
      expect(found).toBeDefined();
      expect(found?.email).toBe(newUserPayload.email);
    });

    it("should retrieve current Admin info via GetMyInfo", async () => {
      const response = await petlink.cct.graphqlHttp.authJwt.getMyInfo();

      expect(response.getMyInfo.code).toBe("200");
      expect(response.getMyInfo.user).toBeDefined();
      expect(response.getMyInfo.user, "GetMyInfo should return the currently logged-in Admin").toMatchObject({
        email: fxt.cctAdmin.email,
        phone: fxt.cctAdmin.phone,
        role: fxt.cctAdmin.role,
        deviceVisibility: fxt.cctAdmin.deviceVisibility,
        vodafoneCountryVisibility: fxt.cctAdmin.vodafoneCountryVisibility,
      });
      adminUser = response.getMyInfo.user;
    });

    it("should allow CCT Admin to UPDATE the created User", async () => {
      expect(createdUser).toBeDefined();

      const updatePayload = {
        id: createdUser.id,
        name: "SuperMario".toLowerCase(),
        surname: "Bros".toLowerCase(),
        phone: createdUser.phone,
        role: createdUser.role,
        active: createdUser.active,
        deviceVisibility: createdUser.deviceVisibility,
        vodafoneCountryVisibility: createdUser.vodafoneCountryVisibility,
      };

      const response = await petlink.cct.graphqlHttp.authJwt.updateUser({
        userInfo: updatePayload,
      });

      expect(response.updateUser.code).toBe("200");
      expect(response.updateUser.user?.name).toBe("supermario");
      expect(response.updateUser.user?.surname).toBe("bros");
    });

    it("should allow CCT Admin to DELETE the created User", async () => {
      expect(createdUser).toBeDefined();

      const response = await petlink.cct.graphqlHttp.authJwt.deleteUser({
        id: createdUser.id,
      });
      expect(response.deleteUser.code).toBe("200");
      const getResponse = await petlink.cct.graphqlHttp.authJwt.getUser({
        userId: createdUser.id,
      });
      expect(getResponse.getUser.code).toBe("404"); //The resource cannot be found
    });

    it("should allow CCT Admin to retrieve User Log Activity containing CREATE, UPDATE and DELETE actions", async () => {
      expect(createdUser).toBeDefined();
      expect(adminUser).toBeDefined();

      await waitFor(
        async () => {
          const response = await petlink.cct.graphqlHttp.authJwt.getLogActivityUser({
            filter: {
              filterType: FilterEnum.And,
              userId: adminUser.id,
            },
            pagination: { pageNumber: 0, pageSize: 50 },
            order: { field: "creationDate", order: OrderEnum.Desc },
          });

          expect(response.getLogActivityUser.code).toBe("200");
          const logs = response.getLogActivityUser.items || [];

          // Verifica CREATE
          const createLog = logs.find((l) => l.activityType === "CREATE_USER" && l.request.includes(newUserPayload.email));
          expect(createLog, "Missing CREATE_USER log").toBeDefined();

          // Verifica UPDATE
          const updateLog = logs.find(
            (l) => l.activityType === "UPDATE_USER" && l.request.includes(createdUser.id) && l.request.includes("supermario"),
          );
          expect(updateLog, "Missing UPDATE_USER log").toBeDefined();

          // Verifica DELETE
          const deleteLog = logs.find((l) => l.activityType === "DELETE_USER" && l.request.includes(createdUser.id));
          expect(deleteLog, "Missing DELETE_USER log").toBeDefined();

          return true; // Se arriviamo qui, tutti gli expect sono passati
        },
        {
          timeoutError: "Could not find all expected logs (CREATE, UPDATE, DELETE) for the test user",
        },
      );
    });
  });
});
