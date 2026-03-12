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
import { FilterEnum } from "./petlink-infrastructure/endpoints/graphql/generated/cct_schema.js";
import { petlink } from "./petlink-infrastructure/client-petlink-infrastructure.js";
import * as subscriptions from "./petlink-infrastructure/endpoints/graphql/operations/core/subscriptions.js";
import { gmailClient } from "./gmail/client-gmail.js";
import { twilioClient } from "./twilio/client-twillio.js";
import { fxt } from "../fixtures/fixtures.js";
import { logger } from "../config/logger.js";
import { waitFor } from "../helpers/utils.js";
import { existsSync, mkdirSync } from "fs";
import { unlinkSync } from "node:fs";

type UserOptions = Partial<UserIn>;

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

export type SubscriptionOptions = {
  priceId?: string;
  waitForActivation?: boolean;
};

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
  private subscriptionOptions: SubscriptionOptions = {};

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
   * Prerequisiti: withUser(), withDogDevice()/withDogEvoDevice() devono essere chiamati prima
   * Internamente: aggiorna billing info + acquista subscription
   */
  withSubscription(options: SubscriptionOptions = {}): this {
    this.includeSubscription = true;
    this.subscriptionOptions = options;
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
    const deviceToSubscribe = this.setup.devices.dogEvo || this.setup.devices.dogStandard || this.setup.devices.catStandard;

    if (this.includeSubscription && this.setup.user && deviceToSubscribe) {
      await this.helper.purchaseSubscription(this.setup.user, deviceToSubscribe, this.subscriptionOptions);
    }

    return this.setup;
  }
}

class TestHelper {
  constructor() {}

  cleanTestReports(): void {
    const reportsDir = "./test-reports";

    // Assicurati che la directory esista
    if (!existsSync(reportsDir)) {
      mkdirSync(reportsDir, { recursive: true });
      logger.debug("📁 Created test-reports/ directory");
      return;
    }

    // Pulisci solo i file di performance (NON junit.xml/results.json)
    const filesToClean = [`${reportsDir}/performance-records.jsonl`, `${reportsDir}/performance-report.txt`];

    filesToClean.forEach((file) => {
      if (existsSync(file)) {
        try {
          unlinkSync(file);
          logger.debug(`🧹 Cleaned ${file}`);
        } catch (error) {
          logger.debug(`⚠️ Could not clean ${file}: ${error}`);
        }
      }
    });
  }

  async cleanupAll(): Promise<void> {
    logger.debug("→ Starting cleanup operations");

    const errors: Array<{ operation: string; error: any }> = [];

    await Promise.all([
      // 1. Petlink user & related entity cleanup
      petlink.core.graphqlHttp.authIam
        .utilityIntegrationTest({
          input: {
            phone: fxt.current.user.phone,
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
      ...fxt.current.user,
      ...options,
      confirmPassword: options.confirmPassword ?? options.password ?? fxt.current.user.confirmPassword,
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

    await Promise.all([
      petlink.core.loginWithPhone(userPayload.phone, userPayload.password),
      await petlink.cct.loginWithEmail(fxt.cctAdmin.email, fxt.cctAdmin.password),
    ]);
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
  async purchaseSubscription(user: User, device: PetlinkGps, options: SubscriptionOptions = {}): Promise<void> {
    const waitForActivation = options.waitForActivation ?? false;
    logger.debug("→ Purchasing subscription for device", { deviceId: device.id, priceId: options.priceId, waitForActivation });

    // STEP 1 & 2: Aggiorna billing info + ottieni piani
    const [_, plansResponse] = await Promise.all([
      // Aggiorna billing info
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

      // Ottieni i piani disponibili (sempre necessario per fallback o log)
      petlink.core.graphqlHttp.authJwt.getSubscriptionPlans({
        productId: device.id,
        countryCode: user.countryCode!,
        serialNumber: device.serialNumber,
      }),
    ]);

    if (plansResponse.getSubscriptionPlans.code !== "200") {
      throw new Error(`Failed to get subscription plans: ${plansResponse.getSubscriptionPlans.message}`);
    }

    // STEP 3: Seleziona il priceId
    let chosenPriceId = options.priceId;

    if (!chosenPriceId) {
      const allPricings = plansResponse.getSubscriptionPlans.plans?.flatMap((p) => p.pricings) || [];
      if (allPricings.length === 0) {
        throw new Error("No subscription plans available and no specific priceId provided");
      }
      chosenPriceId = allPricings[0]!.id;
    }

    logger.debug("✓ Billing info updated and priceId identified", { priceId: chosenPriceId });

    const executePurchase = async () => {
      const purchaseResponse = await petlink.core.graphqlHttp.authIam.utilityIntegrationTest({
        input: {
          utilityType: UtilityTestTypeEnum.BuyNewSubscription,
          phone: user.phone,
          productId: device.id,
          priceIds: [chosenPriceId],
          card: fxt.current.card.valid,
        },
      });

      if (purchaseResponse.utilityIntegrationTest.code !== "200") {
        throw new Error(`Failed to purchase subscription: ${purchaseResponse.utilityIntegrationTest.message}`);
      }
    };

    if (!waitForActivation) {
      // Flusso VELOCE: Compra e non aspettare l'evento
      await executePurchase();
      logger.debug("✓ Subscription purchased (fast mode, no wait)");
      return;
    }

    // Flusso COMPLETO: Apri socket -> aspetta connessione (onReady) -> compra -> aspetta evento
    const subStatusUpdated = await petlink.core.graphqlWS.authJwt.subscribeUntil(
      subscriptions.onSubscriptionStatus,
      { id: user.id },
      "Subscription should become active after purchase",
      (data) => data?.onSubscriptionStatus?.status?.subscriptionIsActive === true,
      executePurchase
    );

    logger.debug("✓ Subscription purchased and activated successfully", {
      subscriptionId: subStatusUpdated?.onSubscriptionStatus?.id,
      productId: subStatusUpdated?.onSubscriptionStatus?.status?.productId,
    });
  }

  setupBuilder(): TestSetupBuilder {
    return new TestSetupBuilder(this);
  }
}

export const testHelper = new TestHelper();
