import {
  PetIn,
  SpeciesEnum,
  BreedTypeEnum,
  Gender,
  PetLivingEnvironment,
  LanguageId,
  AppBrand,
  UserIn,
} from "../clients/petlink-infrastructure/endpoints/graphql/generated/core_schema.js";

// Determine the current brand from environment variables
const currentAppBrand = process.env.APP_BRAND as "PETLINK" | "KIPPY";

// ============================================
// COMMON DATA (Internal use only)
// ============================================

const commonUser = {
  name: "Test",
  surname: "User",
  password: "Ciaokippy3!",
  confirmPassword: "Ciaokippy3!",
  email: "t90086085@gmail.com",
  phone: "+18777804236",
};

const commonPet = {
  defaultDog: {
    name: "TestDog",
    species: SpeciesEnum.Dog,
    breedType: BreedTypeEnum.Purebreed,
    breeds: ["5b0bfddb-532e-41cb-9705-b2ddc21226ef"], // Labrador Retriever
    gender: "MALE" as Gender,
    weight: 15000, // in grammi
    birthDate: "2023-12-25T14:30:00.000Z",
    livingEnvironment: "INDOORS_AND_OUTOORS" as PetLivingEnvironment,
    primaryColor: "07f20c17-1fae-45f3-bbce-149a79aad7b4", // Black Bay
  } as PetIn,

  defaultCat: {
    name: "TestCat",
    species: SpeciesEnum.Cat,
    breedType: BreedTypeEnum.Purebreed,
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
// BASE FIXTURES (Internal use only)
// ============================================

const baseFixtures = {
  KIPPY: {
    appBrand: AppBrand.Kippy,
    user: { ...commonUser, city: "Milano", countryCode: "IT", zipCode: "20100", languageId: LanguageId.It, streetAddress: "Via Torino 10" } as UserIn,
    pet: { ...commonPet },
    devices: {
      CAT: { serialNumber: "UTEST01", countryCode: "IT", timezone: "Europe/Rome" },
      DOG: { serialNumber: "UTEST02", countryCode: "IT", timezone: "Europe/Rome" },
      EVO: { serialNumber: "UTEST03", countryCode: "IT", timezone: "Europe/Rome" },
    },
    card: commonCard,
  },
  PETLINK: {
    appBrand: AppBrand.Petlink,
    user: {
      ...commonUser,
      city: "New York",
      countryCode: "US",
      zipCode: "10001",
      languageId: LanguageId.En,
      streetAddress: "Fifth Avenue 350",
    } as UserIn,
    pet: { ...commonPet },
    devices: {
      CAT: { serialNumber: "UTEST04", countryCode: "US", timezone: "America/New_York" },
      DOG: { serialNumber: "UTEST05", countryCode: "US", timezone: "America/New_York" },
    },
    card: commonCard,
  },
};

// ============================================
// SINGLE EXPORTED FIXTURE OBJECT
// ============================================

export const fxt = {
  ...baseFixtures,
  isKippyRun: currentAppBrand === AppBrand.Kippy,
  isPetlinkRun: currentAppBrand === AppBrand.Petlink,
  current: baseFixtures[currentAppBrand],
  polling: {
    timeoutMs: 30000,
    intervalMs: 1500,
  },
  socket: {
    timeoutMs: 30000,
  },
};
