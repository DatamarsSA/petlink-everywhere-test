import {
  User,
  UserIn,
  PetIn,
  Pet,
  PetlinkGps,
  PetlinkGpsIn,
  SpeciesEnum,
} from "./petlink-infrastructure/endpoints/graphql/generated/core_schema.js";
import { env } from "../config/env-schema-validation.js";
import { petlink } from "./petlink-infrastructure/client-petlink-infrastructure.js";
import { gmailClient } from "./gmail/client-gmail.js";
import { twilioClient } from "./twilio/client-twillio.js";
import { fixtures } from "../fixtures/fixtures.js";
import {
  PetType,
  DeviceType,
  UtilityTestTypeEnum,
} from "./petlink-infrastructure/types.js";

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
    if (fixtures.appBrand !== "KIPPY") {
      throw new Error(
        "EVO device can only be created when appBrand is KIPPY"
      );
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
        this.helper
          .createDeviceForPet(this.setup.pets.dog.id, DeviceType.DOG)
          .then((device) => {
            this.setup.devices.dogStandard = device;
          }),
      );
    }

    if (this.includeDogEvoDevice && this.setup.pets.dogForEvo) {
      devicePromises.push(
        this.helper
          .createDeviceForPet(this.setup.pets.dogForEvo.id, DeviceType.EVO)
          .then((device) => {
            this.setup.devices.dogEvo = device;
          }),
      );
    }

    if (this.includeCatDevice && this.setup.pets.cat) {
      devicePromises.push(
        this.helper
          .createDeviceForPet(this.setup.pets.cat.id, DeviceType.CAT)
          .then((device) => {
            this.setup.devices.catStandard = device;
          }),
      );
    }

    await Promise.all(devicePromises);

    return this.setup;
  }
}

export class TestHelper {
  async cleanupAll(): Promise<void> {
    // console.log("🧹 Cleaning up test environment...");

    // Clear all cached authentication and clients first
    // petlink.clearAllCache();

    // Login with IAM for cleanup operations
    petlink.loginWithIam(env.AWS_ACCESS_KEY_ID, env.AWS_SECRET_ACCESS_KEY);

    await Promise.all([
      petlink.core.graphql.authIam
        .utilityIntegrationTest({
          input: {
            phone: fixtures.user.phone,
            utilityType: UtilityTestTypeEnum.CLEAN_UP_USER,
          },
        })
        .then(
          () => {},
          // console.log("✅ Deleted User and all related entities")
        ),
      gmailClient.deleteAllEmails().then(
        () => {},
        // console.log("✅ Deleted all emails")
      ),
      twilioClient.deleteAllMessagesSentoToNumber(fixtures.user.phone).then(
        () => {},
        // console.log(`✅ Deleted all SMS for ${fixtures.user.phone}`),
      ),
    ]);

    // Clear cache again after cleanup to ensure fresh state for next test
    // petlink.clearAllCache();
  }

  async clearAuthCache(): Promise<void> {
    petlink.clearAllCache();
  }

  async createUser(): Promise<User> {
    petlink.loginWithIam(env.AWS_ACCESS_KEY_ID, env.AWS_SECRET_ACCESS_KEY);

    const userPayload: UserIn = {
      email: fixtures.user.email,
      name: fixtures.user.name,
      surname: fixtures.user.surname,
      city: fixtures.user.city,
      countryCode: fixtures.user.countryCode,
      zipCode: fixtures.user.zipCode,
      streetAddress: fixtures.user.streetAddress,
      phone: fixtures.user.phone,
      password: fixtures.user.password,
      confirmPassword: fixtures.user.confirmPassword,
      languageId: fixtures.user.languageId,
    };

    const response = await petlink.core.graphql.authIam.utilityIntegrationTest({
      input: {
        utilityType: UtilityTestTypeEnum.SIGN_UP,
        userIn: userPayload,
        appBrand: fixtures.appBrand,
      },
    });

    if (response.utilityIntegrationTest.code !== "200") {
      throw new Error(
        `Failed to create user: ${response.utilityIntegrationTest.message}`,
      );
    }

    await petlink.loginWithPhone(userPayload.phone, userPayload.password);
    const userResponse = await petlink.core.graphql.authJwt.getUser();

    if (!userResponse.getUser.user) {
      throw new Error("User not found after creation");
    }
    // console.log(JSON.stringify(userResponse.getUser.user));
    return userResponse.getUser.user;
  }

  async createPet(petType: SpeciesEnum): Promise<Pet> {
    let petFixture: PetIn;

    if (petType === PetType.DOG) {
      petFixture = fixtures.pet.defaultDog;
    } else if (petType === PetType.CAT) {
      petFixture = fixtures.pet.defaultCat;
    } else {
      throw new Error(`Invalid pet type: ${petType}. Only DOG and CAT are supported.`);
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
      throw new Error(
        `Failed to create ${petType}: ${response.createPet.message}`,
      );
    }

    return response.createPet.pet!;
  }

  async createDeviceForPet(
    petId: string,
    deviceType: DeviceType,
  ): Promise<PetlinkGps> {
    // Validate EVO can only be created with KIPPY brand
    if (deviceType === DeviceType.EVO && fixtures.appBrand !== "KIPPY") {
      throw new Error(
        "EVO device can only be created when appBrand is KIPPY"
      );
    }

    // Use the enum value as string for indexing
    const deviceTypeKey = deviceType as string;
    const brandFixtures = fixtures.devices.petlinkGps[fixtures.appBrand] as Record<string, any>;
    const deviceFixture = brandFixtures[deviceTypeKey];

    if (!deviceFixture) {
      throw new Error(
        `Device fixture not found for brand ${fixtures.appBrand} and type ${deviceType}`
      );
    }

    const devicePayload: PetlinkGpsIn = {
      serialNumber: deviceFixture.serialNumber,
      countryCode: deviceFixture.countryCode,
      timezone: deviceFixture.timezone,
      petId: petId,
    };

    const response = await petlink.core.graphql.authJwt.createPetlinkGps({
      petlinkGps: devicePayload,
      appBrand: fixtures.appBrand,
    });

    if (response.createPetlinkGps.code !== "200") {
      throw new Error(
        `Failed to create device for ${deviceType}: ${response.createPetlinkGps.message}`,
      );
    }

    return response.createPetlinkGps.petlinkGps!;
  }

  setupBuilder(): TestSetupBuilder {
    return new TestSetupBuilder(this);
  }
}

export const testHelper = new TestHelper();
