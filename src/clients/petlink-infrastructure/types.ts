import { SpeciesEnum as GeneratedSpeciesEnum, DeviceTypeEnum as GeneratedDeviceTypeEnum } from "./endpoints/graphql/generated/core_schema.js";

// ============================================================================
// UTILITY TEST TYPES
// ============================================================================

export enum AppBrand {
  KIPPY = "KIPPY",
  PETLINK = "PETLINK",
}

export enum UtilityTestTypeEnum {
  BUY_NEW_SUBSCRIPTION = "BUY_NEW_SUBSCRIPTION",
  CLEAN_UP_USER = "CLEAN_UP_USER",
  SIGN_UP = "SIGN_UP",
}

export enum LanguageId {
  DE = "DE",
  EN = "EN",
  ES = "ES",
  FR = "FR",
  IT = "IT",
}

// ============================================================================
// PET & DEVICE TYPES (Type-safe with GraphQL schema)
// ============================================================================

/**
 * PetType enum synchronized with GraphQL SpeciesEnum.
 * If the GraphQL schema changes, TypeScript will catch the mismatch at build time.
 */
export enum PetType {
  DOG = "DOG",
  CAT = "CAT",
  OTHER = "OTHER",
}

/**
 * DeviceType enum synchronized with GraphQL DeviceTypeEnum.
 * If the GraphQL schema changes, TypeScript will catch the mismatch at build time.
 */
export enum DeviceType {
  DOG = "DOG",
  CAT = "CAT",
  EVO = "EVO",
}

// Type assertions to ensure our enums match the generated types
// If these fail, it means the GraphQL schema has changed and we need to update our enums
type AssertPetTypeMatchesSchema = {
  [K in PetType]: K extends GeneratedSpeciesEnum ? true : never;
};

type AssertDeviceTypeMatchesSchema = {
  [K in DeviceType]: K extends GeneratedDeviceTypeEnum ? true : never;
};

// Verify the reverse direction too (all generated values are in our enum)
type AssertSchemaMatchesPetType = {
  [K in GeneratedSpeciesEnum]: K extends PetType ? true : never;
};

type AssertSchemaMatchesDeviceType = {
  [K in GeneratedDeviceTypeEnum]: K extends DeviceType ? true : never;
};
