import { User, UserIn, PetIn, Pet, PetlinkGps, PetlinkGpsIn, SpeciesEnum } from "./petlink-infrastructure/endpoints/graphql/generated/core_schema.js";
import { petlink } from "./petlink-infrastructure/client-petlink-infrastructure.js";
import { gmailClient } from "./gmail/client-gmail.js";
import { twilioClient } from "./twilio/client-twillio.js";
import { fixtures, fixtureCurrentBrand, appBrand, isKippyRun } from "../fixtures/fixtures.js";
import { PetType, DeviceType, UtilityTestTypeEnum } from "./petlink-infrastructure/types.js";
import { logger } from "../config/logger.js";
import { existsSync, mkdirSync } from "fs";
import { unlinkSync } from "node:fs";

export interface TestSetup {
  user?: User;
  pets: {
    dog?: Pet;
    dogForEvo?: Pet;
    cat?: Pet;
  };
  devices: {
    dogStandard?: PetlinkGps;
    dogEvo?: PetlinkGps;
    catStandard?: PetlinkGps;
  };
}

class TestSetupBuilder {
  private setup: TestSetup = { pets: {}, devices: {} };
  private includeUser = false;
  private includeDog = false;
  private includeDogForEvo = false;
  private includeCat = false;
  private includeDogDevice = false;
  private includeDogEvoDevice = false;
  private includeCatDevice = false;

  constructor(private helper: TestHelper) {}

  withUser(): this {
    this.includeUser = true;
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
    if (!isKippyRun) {
      throw new Error("EVO device can only be created when appBrand is KIPPY");
    }
    this.includeDogEvoDevice = true;
    return this;
  }

  withCatDevice(): this {
    this.includeCatDevice = true;
    return this;
  }

  async build(): Promise<TestSetup> {
    if (this.includeUser) {
      this.setup.user = await this.helper.createUser();
    }

    const petPromises: Promise<void>[] = [];

    if (this.includeDog) {
      petPromises.push(
        this.helper.createPet(PetType.DOG).then((dog) => {
          this.setup.pets.dog = dog;
        }),
      );
    }

    if (this.includeDogForEvo) {
      petPromises.push(
        this.helper.createPet(PetType.DOG).then((dogForEvo) => {
          this.setup.pets.dogForEvo = dogForEvo;
        }),
      );
    }

    if (this.includeCat) {
      petPromises.push(
        this.helper.createPet(PetType.CAT).then((cat) => {
          this.setup.pets.cat = cat;
        }),
      );
    }

    await Promise.all(petPromises);

    const devicePromises: Promise<void>[] = [];

    if (this.includeDogDevice && this.setup.pets.dog) {
      devicePromises.push(
        this.helper.createDeviceForPet(this.setup.pets.dog.id, DeviceType.DOG).then((device) => {
          this.setup.devices.dogStandard = device;
        }),
      );
    }

    if (this.includeDogEvoDevice && this.setup.pets.dogForEvo) {
      devicePromises.push(
        this.helper.createDeviceForPet(this.setup.pets.dogForEvo.id, DeviceType.EVO).then((device) => {
          this.setup.devices.dogEvo = device;
        }),
      );
    }

    if (this.includeCatDevice && this.setup.pets.cat) {
      devicePromises.push(
        this.helper.createDeviceForPet(this.setup.pets.cat.id, DeviceType.CAT).then((device) => {
          this.setup.devices.catStandard = device;
        }),
      );
    }

    await Promise.all(devicePromises);

    return this.setup;
  }
}

export class TestHelper {
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
      petlink.core.graphql.authIam
        .utilityIntegrationTest({
          input: {
            phone: fixtureCurrentBrand.user.phone,
            utilityType: UtilityTestTypeEnum.CLEAN_UP_USER,
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
      twilioClient.deleteAllMessagesSentoToNumber(fixtureCurrentBrand.user.phone).catch((error) => {
        errors.push({ operation: "Twilio-deleteAllMessages()", error });
      }),
    ]);

    // Se QUALSIASI operazione è fallita, throw (skippa test)
    if (errors.length > 0) {
      const errorSummary = errors.map((e) => `\n  - ${e.operation}: ${e.error.message}`).join("");
      throw new Error(`Cleanup failed: ${errorSummary}`);
    }

    logger.debug("✓ Cleanup operations completed successfully");
  }

  async clearAuthCache(): Promise<void> {
    petlink.clearAllCache();
  }

  async createUser(): Promise<User> {
    logger.debug("→ Creating test user");

    const userPayload: UserIn = {
      email: fixtureCurrentBrand.user.email,
      name: fixtureCurrentBrand.user.name,
      surname: fixtureCurrentBrand.user.surname,
      city: fixtureCurrentBrand.user.city,
      countryCode: fixtureCurrentBrand.user.countryCode,
      zipCode: fixtureCurrentBrand.user.zipCode,
      streetAddress: fixtureCurrentBrand.user.streetAddress,
      phone: fixtureCurrentBrand.user.phone,
      password: fixtureCurrentBrand.user.password,
      confirmPassword: fixtureCurrentBrand.user.confirmPassword,
      languageId: fixtureCurrentBrand.user.languageId,
    };

    const response = await petlink.core.graphql.authIam.utilityIntegrationTest({
      input: {
        utilityType: UtilityTestTypeEnum.SIGN_UP,
        userIn: userPayload,
        appBrand: appBrand,
      },
    });

    if (response.utilityIntegrationTest.code !== "200") {
      throw new Error(`Failed to create user: ${response.utilityIntegrationTest.message}`);
    }

    await petlink.loginWithPhone(userPayload.phone, userPayload.password);
    const userResponse = await petlink.core.graphql.authJwt.getUser();

    if (!userResponse.getUser.user) {
      throw new Error("User not found after creation");
    }

    logger.debug("✓ Created User", {
      email: userResponse.getUser.user.email,
      phone: userResponse.getUser.user.phone,
      id: userResponse.getUser.user.id,
    });

    return userResponse.getUser.user;
  }

  async createPet(petType: SpeciesEnum): Promise<Pet> {
    logger.debug(`→ Creating test pet (${petType})`);

    let petFixture: PetIn;

    if (petType === PetType.DOG) {
      petFixture = fixtureCurrentBrand.pet.defaultDog;
    } else if (petType === PetType.CAT) {
      petFixture = fixtureCurrentBrand.pet.defaultCat;
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

    const response = await petlink.core.graphql.authJwt.createPet({
      pet: petPayload,
    });

    if (response.createPet.code !== "200") {
      throw new Error(`Failed to create ${petType}: ${response.createPet.message}${(response.createPet.translationCode && ` - ${response.createPet.translationCode}`) ?? ""}`);
    }

    logger.debug("✓ Created Pet", {
      name: response.createPet.pet!.name,
      species: response.createPet.pet!.species,
      id: response.createPet.pet!.id,
    });

    return response.createPet.pet!;
  }

  async createDeviceForPet(petId: string, deviceType: DeviceType): Promise<PetlinkGps> {
    logger.debug(`→ Creating device (${deviceType}) for pet ${petId}`);

    // Validate EVO can only be created with KIPPY brand
    if (deviceType === DeviceType.EVO && !isKippyRun) {
      throw new Error("EVO device can only be created when appBrand is KIPPY");
    }

    const deviceFixture = deviceType === DeviceType.EVO ? fixtures.KIPPY.devices.EVO : fixtureCurrentBrand.devices[deviceType];

    if (!deviceFixture) {
      throw new Error(`Device fixture not found for brand ${appBrand} and type ${deviceType}`);
    }

    const devicePayload: PetlinkGpsIn = {
      serialNumber: deviceFixture.serialNumber,
      countryCode: deviceFixture.countryCode,
      timezone: deviceFixture.timezone,
      petId: petId,
    };

    const response = await petlink.core.graphql.authJwt.createPetlinkGps({
      petlinkGps: devicePayload,
      appBrand: appBrand,
    });

    if (response.createPetlinkGps.code !== "200") {
      throw new Error(
        `Failed to create device for ${deviceType}: ${response.createPetlinkGps.message}${(response.createPetlinkGps.translationCode && ` - ${response.createPetlinkGps.translationCode}`) ?? ""}`,
      );
    }

    logger.debug("✓ Created Device", {
      serialNumber: response.createPetlinkGps.petlinkGps!.serialNumber,
      deviceType,
      petId,
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

  setupBuilder(): TestSetupBuilder {
    return new TestSetupBuilder(this);
  }
}

export const testHelper = new TestHelper();
