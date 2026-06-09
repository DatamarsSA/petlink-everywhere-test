import {
  User,
  UserIn,
  PetIn,
  Pet,
  PetlinkGps,
  PetlinkGpsIn,
  SpeciesEnum,
  DeviceTypeEnum,
  UtilityTestTypeEnum as CoreUtilityTestTypeEnum,
  SubscriptionStatusEnum,
  PaymentStatusTypeEnum,
} from "./petlink-infrastructure/endpoints/graphql/generated/core_schema.js";

import { UtilityTestTypeEnum as CctUtilityTestTypeEnum } from "./petlink-infrastructure/endpoints/graphql/generated/cct_schema.js";
import { petlink } from "./petlink-infrastructure/client-petlink-infrastructure.js";
import { gmailClient } from "./gmail/client-gmail.js";
import { twilioClient } from "./twilio/client-twillio.js";
import { fxt } from "../fixtures/fixtures.js";
import { logger } from "../config/logger.js";
import { waitFor } from "../helpers/utils.js";

type UserOptions = Partial<UserIn>;

export type EnrichedDevice = PetlinkGps & {
  imei: string;
  iccid: string;
  firmware: string;
  subscriptionPlan?: string;
};

export type DeviceSetup = EnrichedDevice & {
  subscriptions?: any[];
  availablePlans?: any[];
  availablePetProtectionPlans?: any[];
};

export type PetSetup = Pet & {
  device?: DeviceSetup;
};

export interface TestSetup {
  user?: User;
  dog?: PetSetup;
  cat?: PetSetup;
  dogForEvo?: PetSetup;
}

export interface SubscriptionConfig {
  priceIds?: string[];
}

export interface PetConfig {
  withDevice?: boolean;
  withSubscription?: SubscriptionConfig | true;
}

class TestSetupBuilder {
  private setup: TestSetup = {};
  private includeUser = false;
  private userOptions: UserOptions = {};
  private petConfigs: {
    dog?: PetConfig;
    cat?: PetConfig;
    dogForEvo?: PetConfig;
  } = {};

  constructor(private helper: TestHelper) {}

  withUser(options: UserOptions = {}): this {
    this.includeUser = true;
    this.userOptions = options;
    return this;
  }

  withDog(config: PetConfig = {}): this {
    this.petConfigs.dog = config;
    return this;
  }

  withDogForEvo(config: PetConfig = {}): this {
    if (!fxt.isKippyRun) {
      throw new Error("EVO device can only be created when appBrand is KIPPY");
    }
    this.petConfigs.dogForEvo = config;
    return this;
  }

  withCat(config: PetConfig = {}): this {
    this.petConfigs.cat = config;
    return this;
  }

  async build(options?: { waitForSubscriptions?: boolean }): Promise<TestSetup> {
    // 1. Create user
    if (this.includeUser) {
      this.setup.user = await this.helper.createUser(this.userOptions);
    }

    // 2. Create pets in parallel
    const petPromises: Promise<void>[] = [];

    const createPetEntry = async (species: SpeciesEnum, key: 'dog' | 'cat' | 'dogForEvo') => {
      const pet = await this.helper.createPet(species);
      this.setup[key] = pet as PetSetup;
    };

    if (this.petConfigs.dog) {
      petPromises.push(createPetEntry(SpeciesEnum.Dog, 'dog'));
    }

    if (this.petConfigs.cat) {
      petPromises.push(createPetEntry(SpeciesEnum.Cat, 'cat'));
    }

    if (this.petConfigs.dogForEvo) {
      petPromises.push(createPetEntry(SpeciesEnum.Dog, 'dogForEvo'));
    }

    await Promise.all(petPromises);

    // 3. Create devices in parallel
    const devicePromises: Promise<void>[] = [];

    const createDeviceEntry = async (key: 'dog' | 'cat' | 'dogForEvo', deviceType: DeviceTypeEnum) => {
      const pet = this.setup[key]!;
      const device = await this.helper.createDeviceForPet(pet, deviceType);
      this.setup[key]!.device = device;
    };

    if (this.petConfigs.dog?.withDevice) {
      devicePromises.push(createDeviceEntry('dog', DeviceTypeEnum.Dog));
    }

    if (this.petConfigs.cat?.withDevice) {
      devicePromises.push(createDeviceEntry('cat', DeviceTypeEnum.Cat));
    }

    if (this.petConfigs.dogForEvo?.withDevice) {
      devicePromises.push(createDeviceEntry('dogForEvo', DeviceTypeEnum.Evo));
    }

    await Promise.all(devicePromises);

    // 4. Fetch subscription plans + update billing info in parallel
    const billingPromise = this.setup.user
      ? petlink.core.graphqlHttp.authJwt.updateBillingInfo({
          updateBillingInfoInput: {
            billingInfo: {
              address: this.setup.user.streetAddress!,
              city: this.setup.user.city!,
              country: this.setup.user.countryCode!,
              zip: this.setup.user.zipCode!,
            },
            email: this.setup.user.email!,
            firstName: this.setup.user.name!,
            lastName: this.setup.user.surname!,
            phone: this.setup.user.phone!,
          },
        })
      : Promise.resolve();

    const planPromises: Promise<void>[] = [];

    const fetchPlansForDevice = async (key: 'dog' | 'cat' | 'dogForEvo') => {
      const device = this.setup[key]!.device!;
      const plansResponse = await petlink.core.graphqlHttp.authJwt.getSubscriptionPlans({
        productId: device.id,
        countryCode: device.countryCode,
        serialNumber: device.serialNumber,
      });
      this.setup[key]!.device!.availablePlans = plansResponse.getSubscriptionPlans.plans ?? [];
      this.setup[key]!.device!.availablePetProtectionPlans = plansResponse.getSubscriptionPlans.careProtectionPlans ?? [];
    };

    if (this.setup.dog?.device) {
      planPromises.push(fetchPlansForDevice('dog'));
    }
    if (this.setup.cat?.device) {
      planPromises.push(fetchPlansForDevice('cat'));
    }
    if (this.setup.dogForEvo?.device) {
      planPromises.push(fetchPlansForDevice('dogForEvo'));
    }

    await Promise.all([billingPromise, ...planPromises]);

    // 5. Collect subscription targets
    const subscriptionTargets: Array<{ key: 'dog' | 'cat' | 'dogForEvo'; priceIds: string[] }> = [];

    for (const [key, config] of Object.entries(this.petConfigs) as Array<['dog' | 'cat' | 'dogForEvo', PetConfig]>) {
      if (config.withSubscription && this.setup[key]?.device) {
        let priceIds: string[];
        if (config.withSubscription === true || !config.withSubscription.priceIds || config.withSubscription.priceIds.length === 0) {
          const firstPlan = this.setup[key]!.device!.availablePlans?.[0]?.pricings?.[0];
          if (!firstPlan) {
            throw new Error(`[Setup] No available plans found for ${key}. Cannot auto-purchase subscription.`);
          }
          priceIds = [firstPlan.id];
        } else {
          priceIds = config.withSubscription.priceIds;
        }
        subscriptionTargets.push({ key, priceIds });
      }
    }

    // 6. Purchase subscriptions (and optionally wait for active)
    if (subscriptionTargets.length > 0) {
      if (!this.setup.user) {
        throw new Error("[Setup] User is required for subscription purchase");
      }

      const subs = await Promise.all(
        subscriptionTargets.map(({ key, priceIds }) =>
          this.helper.purchaseSubscription(
            this.setup.user!,
            this.setup[key]!.device!,
            priceIds,
            options?.waitForSubscriptions ? { waitForActive: true } : undefined,
          ),
        ),
      );

      if (options?.waitForSubscriptions) {
        subscriptionTargets.forEach(({ key }, i) => {
          this.setup[key]!.device!.subscriptions = [subs[i]!];
        });
      }
    }

    return this.setup;
  }
}

class TestHelper {
  constructor() {}

  async cleanupAll(): Promise<void> {
    logger.debug("→ Starting cleanup operations");

    const errors: Array<{ operation: string; error: any }> = [];

    await Promise.all([
      // 1. Petlink user & related entity cleanup
      petlink.core.graphqlHttp.authIam
        .utilityIntegrationTest({
          input: {
            phone: fxt.current.user.phone,
            email: fxt.current.user.email,
            utilityType: CoreUtilityTestTypeEnum.CleanUpUser,
          },
        })
        .then((response) => {
          if (response.utilityIntegrationTest.code !== "200") {
            throw new Error(response.utilityIntegrationTest.message);
          }
        })
        .catch((error) => {
          errors.push({ operation: "CLEAN_UP_USER_CORE", error });
        }),

      // 2. Gmail cleanup
      gmailClient.deleteAllEmails().catch((error) => {
        errors.push({ operation: "Gmail-deleteAllEmails()", error });
      }),

      // 3. Twilio cleanup
      twilioClient.deleteAllMessagesSentoToNumber(fxt.current.user.phone).catch((error) => {
        errors.push({ operation: "Twilio-deleteAllMessages()", error });
      }),

      // 4. CCT cleanup
      petlink.cct.graphqlHttp.authIam
        .utilityIntegrationTest({
          input: {
            utilityType: CctUtilityTestTypeEnum.CleanUpUser,
            email: fxt.cctAdmin.email,
          },
        })
        .then((response) => {
          if (response.utilityIntegrationTest.code !== "200") {
            throw new Error(response.utilityIntegrationTest.message);
          }
        })
        .catch((error) => {
          errors.push({ operation: "CLEAN_UP_USER_CCT", error });
        }),

      // 5. Remove coupons from devices on Inventory
      petlink.core.graphqlHttp.authIam
        .utilityIntegrationTest({
          input: {
            utilityType: CoreUtilityTestTypeEnum.CleanUpCoupons,
            serialNumbers: [
              ...Object.values(fxt.KIPPY.devices).map((d: any) => d.serialNumber),
              ...Object.values(fxt.PETLINK.devices).map((d: any) => d.serialNumber),
            ],
          },
        })
        .then((response) => {
          if (response.utilityIntegrationTest.code !== "200") {
            throw new Error(response.utilityIntegrationTest.message);
          }
        })
        .catch((error) => {
          errors.push({ operation: "CLEAN_UP_COUPONS", error });
        }),
    ]);
    petlink.core.logout();
    petlink.cct.logout();

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
          utilityType: CoreUtilityTestTypeEnum.CleanUpUser,
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
    const password = options.password ?? fxt.current.user.password;

    const userPayload: UserIn = {
      ...fxt.current.user,
      ...options,
      password: password,
      confirmPassword: password,
    };

    const response = await petlink.core.graphqlHttp.authIam.utilityIntegrationTest({
      input: {
        utilityType: CoreUtilityTestTypeEnum.SignUp,
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

  async createDeviceForPet(pet: Pet, deviceType: DeviceTypeEnum): Promise<EnrichedDevice> {
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
        `Failed to create device for ${deviceType} (serial: ${devicePayload.serialNumber}): ${response.createPetlinkGps.message}${(response.createPetlinkGps.translationCode && ` - ${response.createPetlinkGps.translationCode}`) ?? ""}`,
      );
    }

    const coreDevice = response.createPetlinkGps.petlinkGps!;

    logger.debug("✓ Assigned Device", {
      serialNumber: coreDevice.serialNumber,
      deviceType,
      petId: pet.id,
      id: coreDevice.id,
    });

    // Enrich with hardware data from fixtures
    const fixture = deviceType === DeviceTypeEnum.Evo ? fxt.KIPPY.devices.EVO : (fxt.current.devices as any)[deviceType];
    if (!fixture || !fixture.imei || !fixture.iccid || !fixture.firmware) {
      throw new Error(`[Setup] CRITICAL: Missing hardware data in fixtures for device type ${deviceType}`);
    }

    return {
      ...coreDevice,
      imei: fixture.imei,
      iccid: fixture.iccid,
      firmware: fixture.firmware,
      subscriptionPlan: (response as any).createPetlinkGps?.subscriptionPlan,
    };
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
   * Acquista una subscription per il device.
   * Billing info deve essere già aggiornata dal caller.
   * Se waitForActive è true, attende che la sub diventi Active e la ritorna.
   */
  async purchaseSubscription(
    user: User,
    device: EnrichedDevice,
    priceIds: string[],
    options?: { waitForActive?: boolean },
  ): Promise<any> {
    logger.debug("→ Purchasing subscription for device", { deviceId: device.id, priceIds });

    const purchaseResponse = await petlink.core.graphqlHttp.authIam.utilityIntegrationTest({
      input: {
        utilityType: CoreUtilityTestTypeEnum.BuyNewSubscription,
        phone: user.phone,
        productId: device.id,
        priceIds,
        card: fxt.current.card.valid,
      },
    });

    if (purchaseResponse.utilityIntegrationTest.code !== "200") {
      throw new Error(`Failed to purchase subscription: ${purchaseResponse.utilityIntegrationTest.message}`);
    }

    logger.debug("✓ Subscription purchased", { deviceId: device.id, priceIds });

    if (options?.waitForActive) {
      const result = await waitFor(
        async () => petlink.core.graphqlHttp.authJwt.getSubscriptions({ productId: device.id }),
        {
          isReady: (result) => {
            const subscription = result.getSubscriptions.subscriptions?.[0];
            return (
              subscription?.status === SubscriptionStatusEnum.Active &&
              subscription?.paymentStatus === PaymentStatusTypeEnum.Succeeded
            );
          },
          timeoutError: `Timeout: Subscription did not become active for device ${device.id}`,
        },
      );
      return result.getSubscriptions.subscriptions![0]!;
    }
  }

  setupBuilder(): TestSetupBuilder {
    return new TestSetupBuilder(this);
  }
}

export const testHelper = new TestHelper();
