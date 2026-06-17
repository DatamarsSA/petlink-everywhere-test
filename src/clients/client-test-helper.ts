import {
  User,
  UserIn,
  PetIn,
  Pet,
  PetlinkGps,
  PetlinkGpsIn,
  PetlinkMicrochip,
  PetlinkQrTag,
  PetlinkSubscription,
  SpeciesEnum,
  DeviceTypeEnum,
  UtilityTestTypeEnum as CoreUtilityTestTypeEnum,
  SubscriptionStatusEnum,
  PaymentStatusTypeEnum,
} from "./petlink-infrastructure/endpoints/graphql/generated/core_schema.js";

import { UtilityTestTypeEnum as CctUtilityTestTypeEnum } from "./petlink-infrastructure/endpoints/graphql/generated/cct_schema.js";
import { petlink } from "./petlink-infrastructure/client-petlink-infrastructure.js";
import { fxt } from "../fixtures/fixtures.js";
import { logger } from "../config/logger.js";
import { waitFor } from "../helpers/utils.js";


type UserOptions = Partial<UserIn>;

export type DeviceSetupGps = PetlinkGps & {
  imei: string;
  iccid: string;
  firmware: string;
  subscriptionPlan?: string;
  subscription?: PetlinkSubscription;
  availablePlans?: any[];
  availablePetProtectionPlans?: any[];
};

export type DeviceSetupMicrochip = PetlinkMicrochip & {};

export type DeviceSetupQrTag = PetlinkQrTag & {};

export type PetSetup = Pet & {
  devices: {
    gps?: DeviceSetupGps;
    microchip?: DeviceSetupMicrochip;
    qrTag?: DeviceSetupQrTag;
  };
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

export interface GpsConfig {
  model?: DeviceTypeEnum;
  withSubscription?: SubscriptionConfig | true;
}

export interface PetConfig {
  gps?: GpsConfig;
  microchip?: true;
  qrTag?: true;
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

  withCat(config: PetConfig = {}): this {
    this.petConfigs.cat = config;
    return this;
  }

  withDogForEvo(config: PetConfig = {}): this {
    this.petConfigs.dogForEvo = config;
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
      this.setup[key] = { ...pet, devices: {} } as PetSetup;
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

    // 3. Create GPS devices in parallel
    const devicePromises: Promise<void>[] = [];

    const createGpsEntry = async (key: 'dog' | 'cat' | 'dogForEvo', model: DeviceTypeEnum) => {
      const pet = this.setup[key]!;
      const gps = await this.helper.createGpsForPet(pet, model);
      this.setup[key]!.devices.gps = gps;
    };

    if (this.petConfigs.dog?.gps) {
      const model = this.petConfigs.dog.gps.model ?? DeviceTypeEnum.Dog;
      devicePromises.push(createGpsEntry('dog', model));
    }

    if (this.petConfigs.cat?.gps) {
      const model = this.petConfigs.cat.gps.model ?? DeviceTypeEnum.Cat;
      devicePromises.push(createGpsEntry('cat', model));
    }

    if (this.petConfigs.dogForEvo?.gps) {
      const model = this.petConfigs.dogForEvo.gps.model ?? DeviceTypeEnum.Evo;
      devicePromises.push(createGpsEntry('dogForEvo', model));
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

    const fetchPlansForGps = async (key: 'dog' | 'cat' | 'dogForEvo') => {
      const gps = this.setup[key]!.devices.gps!;
      const plansResponse = await petlink.core.graphqlHttp.authJwt.getSubscriptionPlans({
        productId: gps.id,
        countryCode: gps.countryCode,
        serialNumber: gps.serialNumber,
      });
      this.setup[key]!.devices.gps!.availablePlans = plansResponse.getSubscriptionPlans.plans ?? [];
      this.setup[key]!.devices.gps!.availablePetProtectionPlans = plansResponse.getSubscriptionPlans.careProtectionPlans ?? [];
    };

    if (this.setup.dog?.devices.gps) {
      planPromises.push(fetchPlansForGps('dog'));
    }
    if (this.setup.cat?.devices.gps) {
      planPromises.push(fetchPlansForGps('cat'));
    }
    if (this.setup.dogForEvo?.devices.gps) {
      planPromises.push(fetchPlansForGps('dogForEvo'));
    }

    await Promise.all([billingPromise, ...planPromises]);

    // 5. Collect subscription targets
    const subscriptionTargets: Array<{ key: 'dog' | 'cat' | 'dogForEvo'; priceIds: string[] }> = [];

    for (const [key, config] of Object.entries(this.petConfigs) as Array<['dog' | 'cat' | 'dogForEvo', PetConfig]>) {
      if (config.gps?.withSubscription && this.setup[key]?.devices.gps) {
        let priceIds: string[];
        if (config.gps.withSubscription === true || !config.gps.withSubscription.priceIds || config.gps.withSubscription.priceIds.length === 0) {
          const firstPlan = this.setup[key]!.devices.gps!.availablePlans?.[0]?.pricings?.[0];
          if (!firstPlan) {
            throw new Error(`[Setup] No available plans found for ${key}. Cannot auto-purchase subscription.`);
          }
          priceIds = [firstPlan.id];
        } else {
          priceIds = config.gps.withSubscription.priceIds;
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
            this.setup[key]!.devices.gps!,
            priceIds,
            options?.waitForSubscriptions ? { waitForActive: true } : undefined,
          ),
        ),
      );

      if (options?.waitForSubscriptions) {
        subscriptionTargets.forEach(({ key }, i) => {
          this.setup[key]!.devices.gps!.subscription = subs[i]!;
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

      // 2. CCT cleanup
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

      // 3. Remove coupons from devices on Inventory
      petlink.core.graphqlHttp.authIam
        .utilityIntegrationTest({
          input: {
            utilityType: CoreUtilityTestTypeEnum.CleanUpCoupons,
            serialNumbers: [
              ...Object.values(fxt.KIPPY.gpsFixtures).map((d: any) => d.serialNumber),
              ...Object.values(fxt.PETLINK.gpsFixtures).map((d: any) => d.serialNumber),
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

  async createGpsForPet(pet: Pet, model: DeviceTypeEnum): Promise<DeviceSetupGps> {
    const fixture = model === DeviceTypeEnum.Evo ? fxt.KIPPY.gpsFixtures.EVO : (fxt.current.gpsFixtures as any)[model];

    logger.debug(`→ Assigning GPS model ${model} (${fixture.serialNumber}) to pet ${pet.name} (${pet.species}) with id ${pet.id}`);

    // Validate EVO can only be created with KIPPY brand
    if (model === DeviceTypeEnum.Evo && !fxt.isKippyRun) {
      throw new Error("EVO device can only be created when appBrand is KIPPY");
    }

    const devicePayload: PetlinkGpsIn = {
      serialNumber: fixture.serialNumber,
      countryCode: fixture.countryCode,
      timezone: fixture.timezone,
      petId: pet.id,
    };

    const response = await petlink.core.graphqlHttp.authJwt.createPetlinkGps({
      petlinkGps: devicePayload,
      appBrand: fxt.current.appBrand,
    });

    if (response.createPetlinkGps.code !== "200") {
      throw new Error(
        `Failed to create GPS for ${model} (serial: ${devicePayload.serialNumber}): ${response.createPetlinkGps.message}${(response.createPetlinkGps.translationCode && ` - ${response.createPetlinkGps.translationCode}`) ?? ""}`,
      );
    }

    const coreDevice = response.createPetlinkGps.petlinkGps!;

    logger.debug("✓ Assigned GPS", {
      serialNumber: coreDevice.serialNumber,
      model,
      petId: pet.id,
      id: coreDevice.id,
    });

    // Enrich with hardware data from fixtures
    const hwFixture = model === DeviceTypeEnum.Evo ? fxt.KIPPY.gpsFixtures.EVO : (fxt.current.gpsFixtures as any)[model];
    if (!hwFixture || !hwFixture.imei || !hwFixture.iccid || !hwFixture.firmware) {
      throw new Error(`[Setup] CRITICAL: Missing hardware data in fixtures for GPS model ${model}`);
    }

    return {
      ...coreDevice,
      imei: hwFixture.imei,
      iccid: hwFixture.iccid,
      firmware: hwFixture.firmware,
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
    gps: DeviceSetupGps,
    priceIds: string[],
    options?: { waitForActive?: boolean },
  ): Promise<any> {
    logger.debug("→ Purchasing subscription for GPS", { deviceId: gps.id, priceIds });

    const purchaseResponse = await petlink.core.graphqlHttp.authIam.utilityIntegrationTest({
      input: {
        utilityType: CoreUtilityTestTypeEnum.BuyNewSubscription,
        phone: user.phone,
        productId: gps.id,
        priceIds,
        card: fxt.current.card.valid,
      },
    });

    if (purchaseResponse.utilityIntegrationTest.code !== "200") {
      throw new Error(`Failed to purchase subscription: ${purchaseResponse.utilityIntegrationTest.message}`);
    }

    logger.debug("✓ Subscription purchased", { deviceId: gps.id, priceIds });

    if (options?.waitForActive) {
      const result = await waitFor(
        async () => petlink.core.graphqlHttp.authJwt.getSubscriptions({ productId: gps.id }),
        {
          isReady: (result) => {
            const subscription = result.getSubscriptions.subscriptions?.[0];
            return (
              subscription?.status === SubscriptionStatusEnum.Active &&
              subscription?.paymentStatus === PaymentStatusTypeEnum.Succeeded
            );
          },
          timeoutError: `Timeout: Subscription did not become active for GPS ${gps.id}`,
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
