import { PetIn, SpeciesEnum, BreedTypeEnum, Gender, PetLivingEnvironment, UserIn } from "../clients/petlink-infrastructure/endpoints/graphql/generated/core_schema.js";
import { AppBrand, LanguageId } from "../clients/petlink-infrastructure/types.js";

// APP_BRAND is validated in vitest.config.ts and defaults to "KIPPY"
const currentAppBrand = process.env.APP_BRAND as "PETLINK" | "KIPPY";

// ============================================
// COMMON (non-exported, internal use only)
// ============================================

const commonUser = {
  name: "Test",
  surname: "User",
  password: "Ciaokippy3!",
  confirmPassword: "Ciaokippy3!",
  email: "t90086085@gmail.com",
  streetAddress: "Via Test 123",
  phone: "+18777804236",
};

const commonPet = {
  defaultDog: {
    name: "TestDog",
    species: "DOG" as SpeciesEnum,
    breedType: "PUREBREED" as BreedTypeEnum,
    breeds: ["5b0bfddb-532e-41cb-9705-b2ddc21226ef"], // Labrador Retriever
    gender: "MALE" as Gender,
    weight: 15000, // in grammi
    birthDate: "2023-12-25T14:30:00.000Z",
    livingEnvironment: "INDOORS_AND_OUTOORS" as PetLivingEnvironment,
    primaryColor: "07f20c17-1fae-45f3-bbce-149a79aad7b4", // Black Bay
  } as PetIn,

  defaultCat: {
    name: "TestCat",
    species: "CAT" as SpeciesEnum,
    breedType: "PUREBREED" as BreedTypeEnum,
    breeds: ["f7bbebdf-26bb-4947-996d-3290bf128f01"], // Siamese
    gender: "FEMALE" as Gender,
    weight: 4200, // in grammi
    birthDate: "2023-12-25T14:30:00.000Z",
    livingEnvironment: "ALWAYS_AT_HOME" as PetLivingEnvironment,
    primaryColor: "009f64c1-8fbb-4084-a962-696de40bc5e5", // Tiger Brown
  } as PetIn,
};

const commonCard = {
  valid: {
    cardNumber: "4111111111111111",
    expiryMonth: 3,
    expiryYear: 2030,
    cvv: "737",
  },
  insufficientFunds: {
    cardNumber: "4000000000009995",
    expiryMonth: 3,
    expiryYear: 2030,
    cvv: "737",
  },
  expiredCard: {
    cardNumber: "4000000000000069",
    expiryMonth: 3,
    expiryYear: 2030,
    cvv: "737",
  },
};

// ============================================
// EXPORTED FIXTURES
// ============================================

export const fixtures = {
  // Brand-specific configurations
  // KIPPY (EU)
  KIPPY: {
    user: {
      ...commonUser,
      city: "Milano",
      countryCode: "IT",
      zipCode: "20100",
      languageId: "IT" as LanguageId,
    } as UserIn,

    pet: {
      defaultDog: { ...commonPet.defaultDog },
      defaultCat: { ...commonPet.defaultCat },
    },

    devices: {
      CAT: {
        serialNumber: "UTEST01",
        countryCode: "IT",
        timezone: "Europe/Rome",
      },
      DOG: {
        serialNumber: "UTEST02",
        countryCode: "IT",
        timezone: "Europe/Rome",
      },
      EVO: {
        serialNumber: "UTEST03",
        countryCode: "IT",
        timezone: "Europe/Rome",
      },
    },

    card: commonCard,
  },

  // PETLINK (USA..)
  PETLINK: {
    user: {
      ...commonUser,
      city: "New York",
      countryCode: "US",
      zipCode: "10001",
      languageId: "EN" as LanguageId,
    } as UserIn,

    pet: {
      defaultDog: { ...commonPet.defaultDog },
      defaultCat: { ...commonPet.defaultCat },
    },

    devices: {
      CAT: {
        serialNumber: "UTEST04",
        countryCode: "US",
        timezone: "America/New_York",
      },
      DOG: {
        serialNumber: "UTEST05",
        countryCode: "US",
        timezone: "America/New_York",
      },
    },

    card: commonCard,
  },
};

// ============================================
// CONVENIENCE EXPORTS
// ============================================

// Current brand fixtures (automatically selected based on APP_BRAND env var)
export const appBrand = currentAppBrand;
export const isKippyRun = currentAppBrand === AppBrand.KIPPY;
export const isPetlinkRun = currentAppBrand === AppBrand.PETLINK;
export const pollingTimeoutMs = 180000;
export const pollingIntervalMs = 1000;
export const fixtureCurrentBrand = fixtures[currentAppBrand];
