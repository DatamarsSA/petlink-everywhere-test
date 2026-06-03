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
import {
  DeviceVisibilityEnum,
  RoleEnum,
  VodafoneCountryVisibilityEnum,
} from "../clients/petlink-infrastructure/endpoints/graphql/generated/cct_schema.js";

// Determine the current brand from environment variables
const currentAppBrand = process.env.APP_BRAND as "PETLINK" | "KIPPY";

// ============================================
// COMMON DATA (Internal use only)
// ============================================

const commonUser = {
  name: process.env.USER_APP_NAME,
  surname: process.env.USER_APP_SURNAME,
  password: process.env.USER_APP_PASSWORD,
  email: process.env.GMAIL_USER_EMAIL,
  phone: process.env.TWILIO_USER_PHONE_NUMBER,
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

const commonCoupon = {
  test20Percent: {
    id: "TEST",
  },
};

const cctAdmin = {
  email: process.env.OPERATOR_CCT_EMAIL,
  password: process.env.OPERATOR_CCT_PASSWORD,
  phone: process.env.OPERATOR_CCT_PHONE,
  role: [RoleEnum.Superadmin],
  deviceVisibility: [DeviceVisibilityEnum.Kippy, DeviceVisibilityEnum.Petlink, DeviceVisibilityEnum.Vodafone],
  vodafoneCountryVisibility: [VodafoneCountryVisibilityEnum.Eu, VodafoneCountryVisibilityEnum.Gb],
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
      CAT: { serialNumber: "UTEST01", countryCode: "IT", timezone: "Europe/Rome", imei: "000000000000001", iccid: "89880000000000000001", firmware: "11.1.50" },
      DOG: { serialNumber: "UTEST02", countryCode: "IT", timezone: "Europe/Rome", imei: "000000000000002", iccid: "89880000000000000002", firmware: "10.4.88" },
      EVO: { serialNumber: "UTEST03", countryCode: "IT", timezone: "Europe/Rome", imei: "000000000000003", iccid: "89880000000000000002", firmware: "9.1.50" },
      //OLD devices
      VITA: { serialNumber: "VITA001", countryCode: "IT", timezone: "Europe/Rome", imei: "000000000000006", iccid: "89880000000000000003", firmware: "10.4.88" },
      FINDER: { serialNumber: "FINDER0", countryCode: "IT", timezone: "Europe/Rome", imei: "FINDER01", iccid: "FINDER01", firmware: "3.1.66" },
      EVO6: { serialNumber: "EVO0006", countryCode: "IT", timezone: "Europe/Rome", imei: "8988EVO6", iccid: "8988EVO6", firmware: "7.1.15" },
    },
    card: commonCard,
    coupon: commonCoupon,
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
      CAT: { serialNumber: "UTEST04", countryCode: "US", timezone: "America/New_York", imei: "000000000000004", iccid: "89010000000000000001", firmware: "11.1.50" },
      DOG: { serialNumber: "UTEST05", countryCode: "US", timezone: "America/New_York", imei: "000000000000005", iccid: "89010000000000000002", firmware: "10.4.88" },
    },
    card: commonCard,
    coupon: commonCoupon,
  },
};

// ============================================
// SINGLE EXPORTED FIXTURE OBJECT
// ============================================

export const fxt = {
  ...baseFixtures,
  cctAdmin,
  isKippyRun: currentAppBrand === AppBrand.Kippy,
  isPetlinkRun: currentAppBrand === AppBrand.Petlink,
  current: baseFixtures[currentAppBrand],
  polling: {
    timeoutMs: 240000,
    intervalMs: 1500,
  },
  socket: {
    timeoutMs: 180000,
  },
};
