import { describe, it, expect, beforeAll } from "vitest";
import { testHelper } from "../../clients/client-test-helper.js";
import { petlink } from "../../clients/petlink-infrastructure/client-petlink-infrastructure.js";
import { logger } from "../../config/logger.js";
import { fxt } from "../../fixtures/fixtures.js";
import { FilterEnum } from "../../clients/petlink-infrastructure/endpoints/graphql/generated/cct_schema.js";
import { before } from "node:test";

describe("CCT Tool Tests", () => {
  describe("Customers", () => {
    let user: any;

    beforeAll(async () => {
      // 1. Setup: Create User via Core
      const setup = await testHelper.setupBuilder().withUser().build();
      user = setup.user!;
      logger.info("Setup Customer complete", { userId: user.id, email: user.email });

      // 2. Login as CCT Admin
      logger.info("Logging in as CCT Admin...");
      await petlink.cct.loginWithEmail(fxt.cctAdmin.email, fxt.cctAdmin.password);
    });

    it("should allow CCT Admin to find a Customer in the list", async () => {
      // 3. Test List: GetCustomers filter by email
      logger.info("Searching Customer in list...");
      const listResponse = await petlink.cct.graphqlHttp.authJwt.GetCustomers({
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
    });

    it("should allow CCT Admin to view Customer Devices", async () => {
      // CustomGetCustomerDevices
      logger.info("Fetching Customer Devices...");
      const devicesResponse = await petlink.cct.graphqlHttp.authJwt.CustomGetCustomerDevices({
        customerId: user.id,
      });

      expect(devicesResponse.getDevices.code).toBe("200");
      expect(devicesResponse.getDevices.items).toBeDefined();
    });
  });

  describe("Devices", () => {
    let user: any;
    let pet: any;
    let device: any;

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

      // 2. Login as CCT Admin
      await petlink.cct.loginWithEmail(fxt.cctAdmin.email, fxt.cctAdmin.password);
    });

    it("should allow CCT Admin to find a Device in the list", async () => {
      // 3. Test List: GetDevices filter by Serial Number
      logger.info("Searching Device in list...");
      const listResponse = await petlink.cct.graphqlHttp.authJwt.GetDevices({
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
      const deviceDetailResponse = await petlink.cct.graphqlHttp.authJwt.GetDevice({
        deviceId: device.id,
      });
      expect(deviceDetailResponse.getDevice.code).toBe("200");
      expect(deviceDetailResponse.getDevice.device?.serialId).toBe(device.serialNumber);
      expect(deviceDetailResponse.getDevice.device?.customerId).toBe(user.id);
      expect(deviceDetailResponse.getDevice.device?.petId).toBe(pet.id);
    });

    it("should allow CCT Admin to view Device Pet info", async () => {
      // GetPet
      const petResponse = await petlink.cct.graphqlHttp.authJwt.GetPet({
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
      const subResponse = await petlink.cct.graphqlHttp.authJwt.GetCustomDeviceSubscriptions({
        deviceId: device.id,
      });
      expect(subResponse.getSubscriptions.code).toBe("200");
      expect(subResponse.getSubscriptions.items).toBeDefined();
    });
  });
});
