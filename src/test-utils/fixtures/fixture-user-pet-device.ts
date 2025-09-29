// Fixtures per i dati di test
import { env } from "../../config/env-schema-validation.js";
import { LanguageId } from "../../clients/petlink-infrastructure/client-petlink-infrastructure.js";

export const fixtures = {
  // Dati utente predefiniti
  user: {
    default: {
      name: "Test",
      surname: "User",
      city: "Milano",
      countryCode: "IT",
      zipCode: "20100",
      streetAddress: "Via Test 123",
      languageId: "IT" as LanguageId,
      phoneNumber: "+18777804236",
      email: "t90086085@gmail.com",
      password: "Ciaokippy3!",
    },
  },

  // Dati pet predefiniti
  pet: {
    defaultDog: {
      name: "TestDog",
      species: "DOG",
      breed: "MIXED",
      gender: "MALE",
      weight: 10,
      weightUnit: "KG",
    },
    defaultCat: {
      name: "TestCat",
      species: "CAT",
      breed: "MIXED",
      gender: "FEMALE",
      weight: 5,
      weightUnit: "KG",
    },
  },

  // Dati dispositivo predefiniti
  device: {
    default: {
      serialNumber: "TEST12345",
      model: "STANDARD",
    },
  },
};
