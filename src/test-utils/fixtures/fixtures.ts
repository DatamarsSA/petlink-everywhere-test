import type {
  PetIn,
  SpeciesEnum,
  BreedTypeEnum,
  Gender,
  PetLivingEnvironment,
  UserIn,
} from "../../clients/petlink-infrastructure/endpoints/graphql/generated/core_schema.js";
import { LanguageId } from "../../clients/petlink-infrastructure/client-petlink-infrastructure.js";

export const fixtures = {
  user: {
    name: "Test",
    surname: "User",
    city: "Milano",
    countryCode: "IT",
    zipCode: "20100",
    streetAddress: "Via Test 123",
    languageId: "IT" as LanguageId,
    phone: "+18777804236",
    email: "t90086085@gmail.com",
    password: "Ciaokippy3!",
    confirmPassword: "Ciaokippy3!",
  } as UserIn,

  pet: {
    defaultDog: {
      name: "TestDog",
      species: "DOG" as SpeciesEnum,
      breedType: "MIXED_BREED" as BreedTypeEnum,
      breeds: ["MIXED"],
      gender: "MALE" as Gender,
      weight: 15.5,
      birthDate: "2020-01-15",
      livingEnvironment: "INDOORS_AND_OUTOORS" as PetLivingEnvironment,
      primaryColor: "Brown",
    } as PetIn,

    defaultCat: {
      name: "TestCat",
      species: "CAT" as SpeciesEnum,
      breedType: "PUREBREED" as BreedTypeEnum,
      breeds: ["PERSIAN"],
      gender: "FEMALE" as Gender,
      weight: 4.2,
      birthDate: "2021-06-20",
      livingEnvironment: "ALWAYS_AT_HOME" as PetLivingEnvironment,
      primaryColor: "White",
    } as PetIn,
  },
};
