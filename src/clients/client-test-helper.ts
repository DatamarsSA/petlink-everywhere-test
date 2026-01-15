import {
  User,
  UserIn,
  PetIn,
  Pet,
  PetlinkGps,
  PetlinkGpsIn,
  SpeciesEnum,
  UtilityTestTypeEnum,
  DeviceTypeEnum,
} from "./petlink-infrastructure/endpoints/graphql/generated/core_schema.js";
import { Device, FilterEnum } from "./petlink-infrastructure/endpoints/graphql/generated/cct_schema.js";
import { petlink } from "./petlink-infrastructure/client-petlink-infrastructure.js";
import { gmailClient } from "./gmail/client-gmail.js";
import { twilioClient } from "./twilio/client-twillio.js";
import { fxt } from "../fixtures/fixtures.js";
import { logger } from "../config/logger.js";
import { existsSync, mkdirSync } from "fs";
import { unlinkSync } from "node:fs";
import { waitFor } from "../helpers/helpers.js";

type UserOptions = {
  email?: string;
  phone?: string;
  password?: string;
};

export type EnrichedDevice = PetlinkGps & {
  imei: string;
  iccid: string;
  firmware: string;
};

export interface TestSetup {
  user?: User;
  pets: {
    dog?: Pet;
    dogForEvo?: Pet;
    cat?: Pet;
  };
  devices: {
    dogStandard?: EnrichedDevice;
    dogEvo?: EnrichedDevice;
    catStandard?: EnrichedDevice;
  };
}

class TestSetupBuilder {
  private setup: TestSetup = { pets: {}, devices: {} };
  private includeUser = false;
  private userOptions: UserOptions = {};
  private includeDog = false;
  private includeDogForEvo = false;
  private includeCat = false;
  private includeDogDevice = false;
  private includeDogEvoDevice = false;
  private includeCatDevice = false;
  private includeSubscription = false;

  constructor(private helper: TestHelper) {}

  withUser(options: UserOptions = {}): this {
    this.includeUser = true;
    this.userOptions = options;
    return this;
  }

  withDog(): this {
    this.includeDog = true;
    return this;
  }

  withDogForEvo(): this {
    this.includeDogForEvo = true;
    return this;
  }

  withCat(): this {
    this.includeCat = true;
    return this;
  }

  withDogDevice(): this {
    this.includeDogDevice = true;
    return this;
  }

  withDogEvoDevice(): this {
    if (!fxt.isKippyRun) {
      throw new Error("EVO device can only be created when appBrand is KIPPY");
    }
    this.includeDogEvoDevice = true;
    return this;
  }

  withCatDevice(): this {
    this.includeCatDevice = true;
    return this;
  }

  /**
   * Acquista una subscription per il device
   * Prerequisiti: withUser(), withDogDevice() devono essere chiamati prima
   * Internamente: aggiorna billing info + acquista subscription in parallelo
   * Card utilizzata: fxt.current.card.valid
   */
  withSubscription(): this {
    this.includeSubscription = true;
    return this;
  }

  async build(): Promise<TestSetup> {
    //create USER
    if (this.includeUser) {
      this.setup.user = await this.helper.createUser(this.userOptions);
    }

    //create PETS
    const petPromises: Promise<void>[] = [];
    if (this.includeDog) {
      petPromises.push(
        this.helper.createPet(SpeciesEnum.Dog).then((dog) => {
          this.setup.pets.dog = dog;
        }),
      );
    }

    if (this.includeDogForEvo) {
      petPromises.push(
        this.helper.createPet(SpeciesEnum.Dog).then((dogForEvo) => {
          this.setup.pets.dogForEvo = dogForEvo;
        }),
      );
    }

    if (this.includeCat) {
      petPromises.push(
        this.helper.createPet(SpeciesEnum.Cat).then((cat) => {
          this.setup.pets.cat = cat;
        }),
      );
    }

    await Promise.all(petPromises);

    //create DEVICES
    const devicePromises: Promise<void>[] = [];
    let coreDogStandard: PetlinkGps | undefined;
    let coreDogEvo: PetlinkGps | undefined;
    let coreCatStandard: PetlinkGps | undefined;

    if (this.includeDogDevice && this.setup.pets.dog) {
      devicePromises.push(
        this.helper.createDeviceForPet(this.setup.pets.dog, DeviceTypeEnum.Dog).then((device) => {
          coreDogStandard = device;
        }),
      );
    }

    if (this.includeDogEvoDevice && this.setup.pets.dogForEvo) {
      devicePromises.push(
        this.helper.createDeviceForPet(this.setup.pets.dogForEvo, DeviceTypeEnum.Evo).then((device) => {
          coreDogEvo = device;
        }),
      );
    }

    if (this.includeCatDevice && this.setup.pets.cat) {
      devicePromises.push(
        this.helper.createDeviceForPet(this.setup.pets.cat, DeviceTypeEnum.Cat).then((device) => {
          coreCatStandard = device;
        }),
      );
    }

    await Promise.all(devicePromises);

    // --- ENRICHMENT: Fetch full technical data from CCT in a single call ---
    if (this.setup.user && (coreDogStandard || coreDogEvo || coreCatStandard)) {
      logger.debug(`→ Starting strict enrichment for user ${this.setup.user.id}`);

      // Login CCT to access its API
      await petlink.cct.loginWithEmail(fxt.cctAdmin.email, fxt.cctAdmin.password);

      // We wait until Sentinel (async) has populated the firmware version
      const items = await waitFor(
        async () => {
          const res = await petlink.cct.graphqlHttp.authJwt.getDevices({
            filter: {
              filterType: FilterEnum.And,
              customerId: this.setup.user!.id,
            },
          });
          return res.getDevices.items || [];
        },
        {
          timeoutError: "[Setup - getDevices()] CCT enrichment Hardware Data (imei,iccid,firmware) failed: firmware data not ready (Sentinel lag?)",
          isReady: (currentItems) => {
            const devicesToEnrich = [coreDogStandard, coreDogEvo, coreCatStandard].filter((d): d is PetlinkGps => !!d);

            // Check if ALL devices have valid firmware (not "N/A")
            return devicesToEnrich.every((coreDevice) => {
              const cctData = currentItems.find((i) => i?.deviceId === coreDevice.id);
              // Firmware is "N/A" initially until Sentinel updates lastKnownStatus
              return cctData && cctData.imei && cctData.iccid && cctData.firmware && cctData.firmware !== "N/A";
            });
          },
        },
      );

      // Enrich Core devices with hardware data from CCT
      const enrich = (coreDevice: PetlinkGps): EnrichedDevice => {
        const cctData = items.find((i) => i?.deviceId === coreDevice.id);

        if (!cctData || !cctData.imei || !cctData.iccid || !cctData.firmware) {
          throw new Error(`[Setup] CRITICAL: Device ${coreDevice.serialNumber} missing technical data in CCT`);
        }

        return {
          ...coreDevice,
          imei: cctData.imei,
          iccid: cctData.iccid,
          firmware: cctData.firmware,
        };
      };

      if (coreDogStandard) this.setup.devices.dogStandard = enrich(coreDogStandard);
      if (coreDogEvo) this.setup.devices.dogEvo = enrich(coreDogEvo);
      if (coreCatStandard) this.setup.devices.catStandard = enrich(coreCatStandard);
    }

    // Acquista subscription se richiesto
    if (this.includeSubscription && this.setup.user && this.setup.devices.dogStandard) {
      await this.helper.purchaseSubscription(this.setup.user, this.setup.devices.dogStandard);
    }

    return this.setup;
  }
}

class TestHelper {
  constructor() {}

  async cleanupAll(): Promise<void> {
    logger.debug("→ Starting cleanup operations");

    const errors: Array<{ operation: string; error: any }> = [];

    // Raccogli tutti i serial numbers da fixtures
    const testSerialNumbers = [
      ...Object.values(fxt.KIPPY.devices).map((d) => d.serialNumber),
      ...Object.values(fxt.PETLINK.devices).map((d) => d.serialNumber),
    ];

    await Promise.all([
      // 1. Petlink user & related entity cleanup
      petlink.core.graphqlHttp.authIam
        .utilityIntegrationTest({
          input: {
            phone: fxt.current.user.phone,
            // serialNumbers: testSerialNumbers, TODO: add field to remove all sentinel db from backend
            utilityType: UtilityTestTypeEnum.CleanUpUser,
          },
        })
        .then((response) => {
          if (response.utilityIntegrationTest.code !== "200") {
            throw new Error(response.utilityIntegrationTest.message);
          }
        })
        .catch((error) => {
          errors.push({ operation: "Petlink-CLEAN_UP_USER", error });
        }),

      // 2. Gmail cleanup
      gmailClient.deleteAllEmails().catch((error) => {
        errors.push({ operation: "Gmail-deleteAllEmails()", error });
      }),

      // 3. Twilio cleanup
      twilioClient.deleteAllMessagesSentoToNumber(fxt.current.user.phone).catch((error) => {
        errors.push({ operation: "Twilio-deleteAllMessages()", error });
      }),
    ]);
    petlink.logoutUser();

    // Se QUALSIASI operazione è fallita, throw (skippa test)
    if (errors.length > 0) {
      const errorSummary = errors.map((e) => `\n  - ${e.operation}: ${e.error.message}`).join("");
      throw new Error(`Cleanup failed: ${errorSummary}`);
    }

    logger.debug("✓ Cleanup operations completed successfully");
  }

  async cleanUpUser(userPhone?: string): Promise<void> {
    logger.debug("→ Starting user cleanup operation");

    try {
      const response = await petlink.core.graphqlHttp.authIam.utilityIntegrationTest({
        input: {
          phone: userPhone ?? fxt.current.user.phone,
          utilityType: UtilityTestTypeEnum.CleanUpUser,
        },
      });

      if (response.utilityIntegrationTest.code !== "200") {
        throw new Error(response.utilityIntegrationTest.message);
      }

      logger.debug("✓ User cleanup operation completed successfully");
    } catch (error: any) {
      const errorMessage = `Cleanup failed for user: ${error.message}`;
      logger.error(errorMessage);
      throw new Error(errorMessage);
    }
  }

  async createUser(options: UserOptions = {}): Promise<User> {
    logger.debug("→ Creating test user");

    const userPayload: UserIn = {
      email: options.email ?? fxt.current.user.email,
      name: fxt.current.user.name,
      surname: fxt.current.user.surname,
      city: fxt.current.user.city,
      countryCode: fxt.current.user.countryCode,
      zipCode: fxt.current.user.zipCode,
      streetAddress: fxt.current.user.streetAddress,
      phone: options.phone ?? fxt.current.user.phone,
      password: options.password ?? fxt.current.user.password,
      confirmPassword: options.password ?? fxt.current.user.confirmPassword,
      languageId: fxt.current.user.languageId,
    };

    const response = await petlink.core.graphqlHttp.authIam.utilityIntegrationTest({
      input: {
        utilityType: UtilityTestTypeEnum.SignUp,
        userIn: userPayload,
        appBrand: fxt.current.appBrand,
      },
    });

    if (response.utilityIntegrationTest.code !== "200") {
      throw new Error(`Failed to create user: ${response.utilityIntegrationTest.message}`);
    }

    await petlink.core.loginWithPhone(userPayload.phone, userPayload.password);
    const userResponse = await petlink.core.graphqlHttp.authJwt.getUser();

    if (!userResponse.getUser.user) {
      throw new Error("User not found after creation");
    }

    logger.debug("✓ Created User", {
      email: userResponse.getUser.user.email,
      phone: userResponse.getUser.user.phone,
      id: userResponse.getUser.user.id,
    });

    return {
      ...userResponse.getUser.user,
      appBrand: fxt.current.appBrand,
    };
  }

  async createPet(petType: SpeciesEnum): Promise<Pet> {
    logger.debug(`→ Creating test pet (${petType})`);

    let petFixture: PetIn;

    if (petType === SpeciesEnum.Dog) {
      petFixture = fxt.current.pet.defaultDog;
    } else if (petType === SpeciesEnum.Cat) {
      petFixture = fxt.current.pet.defaultCat;
    } else {
      throw new Error(`Invalid pet type: ${petType}.`);
    }

    const petPayload: PetIn = {
      name: petFixture.name,
      species: petFixture.species,
      breedType: petFixture.breedType,
      breeds: petFixture.breeds,
      gender: petFixture.gender,
      weight: petFixture.weight,
      birthDate: petFixture.birthDate,
      livingEnvironment: petFixture.livingEnvironment,
      primaryColor: petFixture.primaryColor,
    };

    const response = await petlink.core.graphqlHttp.authJwt.createPet({
      pet: petPayload,
    });

    if (response.createPet.code !== "200") {
      throw new Error(
        `Failed to create ${petType}: ${response.createPet.message}${(response.createPet.translationCode && ` - ${response.createPet.translationCode}`) ?? ""}`,
      );
    }

    logger.debug("✓ Created Pet", {
      name: response.createPet.pet!.name,
      species: response.createPet.pet!.species,
      id: response.createPet.pet!.id,
    });

    return response.createPet.pet!;
  }

  async createDeviceForPet(pet: Pet, deviceType: DeviceTypeEnum): Promise<PetlinkGps> {
    const deviceFixture = deviceType === DeviceTypeEnum.Evo ? fxt.KIPPY.devices.EVO : (fxt.current.devices as any)[deviceType];

    if (!deviceFixture) {
      throw new Error(`Device fixture not found for brand ${fxt.current.appBrand} and type ${deviceType}`);
    }

    logger.debug(`→ Assigning device ${deviceType} (${deviceFixture.serialNumber}) to pet ${pet.name} (${pet.species}) with id ${pet.id}`);

    // Validate EVO can only be created with KIPPY brand
    if (deviceType === DeviceTypeEnum.Evo && !fxt.isKippyRun) {
      throw new Error("EVO device can only be created when appBrand is KIPPY");
    }

    const devicePayload: PetlinkGpsIn = {
      serialNumber: deviceFixture.serialNumber,
      countryCode: deviceFixture.countryCode,
      timezone: deviceFixture.timezone,
      petId: pet.id,
    };

    const response = await petlink.core.graphqlHttp.authJwt.createPetlinkGps({
      petlinkGps: devicePayload,
      appBrand: fxt.current.appBrand,
    });

    if (response.createPetlinkGps.code !== "200") {
      throw new Error(
        `Failed to create device for ${deviceType}: ${response.createPetlinkGps.message}${(response.createPetlinkGps.translationCode && ` - ${response.createPetlinkGps.translationCode}`) ?? ""}`,
      );
    }

    logger.debug("✓ Assigned Device", {
      serialNumber: response.createPetlinkGps.petlinkGps!.serialNumber,
      deviceType,
      petId: pet.id,
      id: response.createPetlinkGps.petlinkGps!.id,
    });

    return response.createPetlinkGps.petlinkGps!;
  }

  /**
   * Find the first plan pricing that has addon pricings.
   * Returns a pricing object with addon property, or null if none found.
   */
  findPlanWithAddonDeviceprotection(plans: any[]): any {
    for (const plan of plans) {
      for (const pricing of plan.pricings) {
        if (pricing.addonPricings && pricing.addonPricings.length > 0) {
          return {
            ...pricing,
            addon: pricing.addonPricings[0],
          };
        }
      }
    }
    return null;
  }

  /**
   * Acquista una subscription per il device
   * Internamente:
   *   1. Aggiorna billing info dell'utente
   *   2. Ottiene i piani disponibili
   *   3. Acquista il primo piano disponibile
   */
  async purchaseSubscription(user: User, device: PetlinkGps): Promise<void> {
    logger.debug("→ Purchasing subscription for device", { deviceId: device.id });

    // STEP 1 & 2: Aggiorna billing info + ottieni piani
    const [_, plansResponse] = await Promise.all([
      // Aggiorna billing info (non serve il risultato)
      petlink.core.graphqlHttp.authJwt.updateBillingInfo({
        updateBillingInfoInput: {
          billingInfo: {
            address: user.streetAddress!,
            city: user.city!,
            country: user.countryCode!,
            zip: user.zipCode!,
          },
          email: user.email!,
          firstName: user.name!,
          lastName: user.surname!,
          phone: user.phone!,
        },
      }),

      // Ottieni i piani disponibili
      petlink.core.graphqlHttp.authJwt.getSubscriptionPlans({
        productId: device.id,
        countryCode: user.countryCode!,
        serialNumber: device.serialNumber,
      }),
    ]);

    if (plansResponse.getSubscriptionPlans.code !== "200") {
      throw new Error(`Failed to get subscription plans: ${plansResponse.getSubscriptionPlans.message}`);
    }

    // STEP 3: Seleziona il primo piano disponibile
    const selectedPlan = plansResponse.getSubscriptionPlans.plans?.[0];
    if (!selectedPlan || !selectedPlan.pricings[0]) {
      throw new Error("No subscription plans available");
    }

    const chosenPricing = selectedPlan.pricings[0];

    logger.debug("✓ Billing info updated and subscription plan found", {
      planId: chosenPricing.id,
      price: chosenPricing.price,
      period: chosenPricing.period,
    });

    // STEP 4: Acquista la subscription
    const purchaseResponse = await petlink.core.graphqlHttp.authIam.utilityIntegrationTest({
      input: {
        utilityType: UtilityTestTypeEnum.BuyNewSubscription,
        phone: user.phone,
        productId: device.id,
        priceIds: [chosenPricing.id],
        card: fxt.current.card.valid,
      },
    });

    if (purchaseResponse.utilityIntegrationTest.code !== "200") {
      throw new Error(`Failed to purchase subscription: ${purchaseResponse.utilityIntegrationTest.message}`);
    }

    logger.debug("✓ Subscription purchased successfully");
  }

  setupBuilder(): TestSetupBuilder {
    return new TestSetupBuilder(this);
  }
}

export const testHelper = new TestHelper();
