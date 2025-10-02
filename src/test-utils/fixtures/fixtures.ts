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
      breedType: "PUREBREED" as BreedTypeEnum,
      breeds: ["5b0bfddb-532e-41cb-9705-b2ddc21226ef"], //Labrador Retriever
      gender: "MALE" as Gender,
      weight: 15.5,
      birthDate: "2023-12-25T14:30:00.000Z",
      livingEnvironment: "INDOORS_AND_OUTOORS" as PetLivingEnvironment,
      primaryColor: "07f20c17-1fae-45f3-bbce-149a79aad7b4", //Black Bay
    } as PetIn,

    defaultCat: {
      name: "TestCat",
      species: "CAT" as SpeciesEnum,
      breedType: "PUREBREED" as BreedTypeEnum,
      breeds: ["f7bbebdf-26bb-4947-996d-3290bf128f01"], //Siamese
      gender: "FEMALE" as Gender,
      weight: 4.2,
      birthDate: "2023-12-25T14:30:00.000Z",
      livingEnvironment: "ALWAYS_AT_HOME" as PetLivingEnvironment,
      primaryColor: "009f64c1-8fbb-4084-a962-696de40bc5e5", //Tiger Brown
    } as PetIn,
  },
};
