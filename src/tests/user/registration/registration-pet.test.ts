import { beforeAll, describe, expect, it } from "vitest";
import type { PetIn, User } from "../../../clients/petlink-infrastructure/endpoints/graphql/generated/core_schema.js";
import { fixtureCurrentBrand, appBrand } from "../../../fixtures/fixtures.js";
import { testHelper } from "../../../clients/client-test-helper.js";
import { petlink } from "../../../clients/petlink-infrastructure/client-petlink-infrastructure.js";

describe("Pet Registration", () => {
  let testUser: User;

  const dogPayload = {
    name: fixtureCurrentBrand.pet.defaultDog.name,
    species: fixtureCurrentBrand.pet.defaultDog.species,
    breedType: fixtureCurrentBrand.pet.defaultDog.breedType,
    breeds: fixtureCurrentBrand.pet.defaultDog.breeds,
    gender: fixtureCurrentBrand.pet.defaultDog.gender,
    weight: fixtureCurrentBrand.pet.defaultDog.weight,
    birthDate: fixtureCurrentBrand.pet.defaultDog.birthDate,
    livingEnvironment: fixtureCurrentBrand.pet.defaultDog.livingEnvironment,
    primaryColor: fixtureCurrentBrand.pet.defaultDog.primaryColor,
  } as PetIn;

  const catPayload = {
    name: fixtureCurrentBrand.pet.defaultCat.name,
    species: fixtureCurrentBrand.pet.defaultCat.species,
    breedType: fixtureCurrentBrand.pet.defaultCat.breedType,
    breeds: fixtureCurrentBrand.pet.defaultCat.breeds,
    gender: fixtureCurrentBrand.pet.defaultCat.gender,
    weight: fixtureCurrentBrand.pet.defaultCat.weight,
    birthDate: fixtureCurrentBrand.pet.defaultCat.birthDate,
    livingEnvironment: fixtureCurrentBrand.pet.defaultCat.livingEnvironment,
    primaryColor: fixtureCurrentBrand.pet.defaultCat.primaryColor,
  } as PetIn;

  beforeAll(async () => {
    testUser = await testHelper.createUser();
  });

  it("Create DOG and CAT for the user", async () => {
    const [dogResponse, catResponse] = await Promise.all([petlink.core.graphql.authJwt.createPet({ pet: dogPayload }), petlink.core.graphql.authJwt.createPet({ pet: catPayload })]);

    // Assert DOG
    expect(dogResponse.createPet.code).toBe("200");
    expect(dogResponse.createPet.pet, "Created dog should match input payload").toMatchObject({
      name: dogPayload.name,
      species: dogPayload.species,
      breedType: dogPayload.breedType,
      breeds: dogPayload.breeds,
      gender: dogPayload.gender,
      weight: dogPayload.weight,
      birthDate: dogPayload.birthDate,
      livingEnvironment: dogPayload.livingEnvironment,
      primaryColor: dogPayload.primaryColor,
    });
    expect(dogResponse.createPet.pet?.id, "Dog ID auto-generated should be present").toBeDefined();

    // Assert CAT
    expect(catResponse.createPet.code).toBe("200");
    expect(catResponse.createPet.pet, "Created cat should match input payload").toMatchObject({
      name: catPayload.name,
      species: catPayload.species,
      breedType: catPayload.breedType,
      breeds: catPayload.breeds,
      gender: catPayload.gender,
      weight: catPayload.weight,
      birthDate: catPayload.birthDate,
      livingEnvironment: catPayload.livingEnvironment,
      primaryColor: catPayload.primaryColor,
    });
    expect(catResponse.createPet.pet?.id, "Cat ID auto-generated should be present").toBeDefined();
  });

  it("Try to create PETs with wrong combinations data", async () => {
    // Test validation rules:
    // 1. PUREBREED must have exactly 1 breed
    // 2. MIXED_BREED must have exactly 2 breeds (and both should be different breeds)
    // 3. DOG species cannot use CAT breeds
    // 4. CAT species cannot use DOG breeds

    // Execute all invalid pet creation requests in parallel
    const [dogPurebreedWithTwoBreeds, dogMixedbreedWithOneBreed, dogMixedbreedWithTwoEqualsBreed, catWithDogBreed, dogWithCatBreed] = await Promise.all([
      // Invalid: PUREBREED with 2 breeds (should have only 1)
      petlink.core.graphql.authJwt.createPet({
        pet: {
          ...dogPayload,
          breedType: "PUREBREED",
          breeds: [
            "5b0bfddb-532e-41cb-9705-b2ddc21226ef", // Labrador Retriever
            "0074b56e-8c84-43b6-aaad-d7c00a9aa37e", // Another dog breed
          ],
        },
      }),
      // Invalid: MIXED_BREED with 1 breed (should have 2)
      petlink.core.graphql.authJwt.createPet({
        pet: {
          ...dogPayload,
          breedType: "MIXED_BREED",
          breeds: ["5b0bfddb-532e-41cb-9705-b2ddc21226ef"], // Only 1 breed
        },
      }),
      // Invalid: MIXED_BREED with 2 equals breeds
      petlink.core.graphql.authJwt.createPet({
        pet: {
          ...dogPayload,
          breedType: "MIXED_BREED",
          breeds: ["5b0bfddb-532e-41cb-9705-b2ddc21226ef", "5b0bfddb-532e-41cb-9705-b2ddc21226ef"],
        },
      }),
      // Invalid: CAT with DOG breed
      petlink.core.graphql.authJwt.createPet({
        pet: {
          ...catPayload,
          breedType: "PUREBREED",
          breeds: ["5b0bfddb-532e-41cb-9705-b2ddc21226ef"], // Labrador Retriever (DOG)
        },
      }),
      // Invalid: DOG with CAT breed
      petlink.core.graphql.authJwt.createPet({
        pet: {
          ...dogPayload,
          breedType: "PUREBREED",
          breeds: ["f7bbebdf-26bb-4947-996d-3290bf128f01"], // Siamese (CAT)
        },
      }),
    ]);
    // Assert all requests failed with validation error (400)
    expect(dogPurebreedWithTwoBreeds.createPet.code, "PUREBREED with 2 breeds should fail validation").toBe("400");
    expect(dogMixedbreedWithOneBreed.createPet.code, "MIXED_BREED with 1 breed should fail validation").toBe("400");
    expect(dogMixedbreedWithTwoEqualsBreed.createPet.code, "MIXED_BREED with 2 identical breeds should fail validation").toBe("400");
    expect(catWithDogBreed.createPet.code, "CAT with DOG breed should fail validation").toBe("400");
    expect(dogWithCatBreed.createPet.code, "DOG with CAT breed should fail validation").toBe("400");
  });

  it("Update and Delete PET should work correctly", async () => {
    // Create a temporary PET for CRUD testing (isolated from main DOG and CAT)
    const tempPetData = {
      ...dogPayload,
      name: "Temp Pet for CRUD Test",
    } as PetIn;

    const createResponse = await petlink.core.graphql.authJwt.createPet({
      pet: tempPetData,
    });

    expect(createResponse.createPet, "Create pet response should be defined").toBeDefined();
    expect(createResponse.createPet.code).toBe("200");
    expect(createResponse.createPet.pet, "Created pet should be defined").toBeDefined();
    expect(createResponse.createPet.pet?.name, "Created pet name should match input").toBe(tempPetData.name);

    const petId = createResponse.createPet.pet?.id!;

    // TEST UPDATE: Modify the temporary PET
    const updatedName = "Updated Temp Pet";
    const updatedWeight = 25;

    const updateResponse = await petlink.core.graphql.authJwt.updatePet({
      pet: {
        id: petId,
        name: updatedName,
        weight: updatedWeight,
      },
    });

    expect(updateResponse.updatePet, "Update pet response should be defined").toBeDefined();
    expect(updateResponse.updatePet.code).toBe("200");
    expect(updateResponse.updatePet.pet, "Updated pet should be defined").toBeDefined();
    expect(updateResponse.updatePet.pet?.id, "Pet ID should remain unchanged after update").toBe(petId);
    expect(updateResponse.updatePet.pet?.name, "Pet name should be updated").toBe(updatedName);
    expect(updateResponse.updatePet.pet?.weight, "Pet weight should be updated").toBe(updatedWeight);

    // TEST DELETE: Remove the temporary PET
    const deleteResponse = await petlink.core.graphql.authJwt.deletePet({
      petId,
    });

    expect(deleteResponse.deletePet, "Delete pet response should be defined").toBeDefined();
    expect(deleteResponse.deletePet.code).toBe("200");

    // Verify the PET no longer exists
    const petsAfterDelete = await petlink.core.graphql.authJwt.getPets();
    const deletedPet = petsAfterDelete.getPets.pets?.find((p) => p.id === petId);
    expect(deletedPet, "Pet should not exist after deletion").toBeUndefined();
  });

  it("Pet should not be removable if he has device associated", async () => {
    // STEP 1: Create a temporary PET for this test
    const tempPetData = {
      ...dogPayload,
      name: "Pet with Device Test",
    } as PetIn;

    const createPetResponse = await petlink.core.graphql.authJwt.createPet({
      pet: tempPetData,
    });

    expect(createPetResponse.createPet.code).toBe("200");
    expect(createPetResponse.createPet.pet, "Created pet should be defined").toBeDefined();
    const petId = createPetResponse.createPet.pet!.id;

    // STEP 2: Associate a device to the PET (brand-agnostic: works for both PETLINK and KIPPY)
    const devicePayload = {
      serialNumber: fixtureCurrentBrand.devices.DOG.serialNumber,
      countryCode: fixtureCurrentBrand.devices.DOG.countryCode,
      timezone: fixtureCurrentBrand.devices.DOG.timezone,
      petId: petId,
    };

    const createDeviceResponse = await petlink.core.graphql.authJwt.createPetlinkGps({
      petlinkGps: devicePayload,
      appBrand: appBrand,
    });

    expect(createDeviceResponse.createPetlinkGps.code).toBe("200");
    expect(createDeviceResponse.createPetlinkGps.petlinkGps).toBeDefined();

    // STEP 3: Try to delete the PET while it has a device associated (should FAIL)
    const deleteWithDeviceResponse = await petlink.core.graphql.authJwt.deletePet({
      petId,
    });
    expect(deleteWithDeviceResponse.deletePet.code, "Pet deletion should fail when device is associated").not.toBe("200");

    // Verify the PET still exists
    const petsAfterFailedDelete = await petlink.core.graphql.authJwt.getPets();
    const petStillExists = petsAfterFailedDelete.getPets.pets?.find((p) => p.id === petId);
    expect(petStillExists, "Pet should still exist after failed deletion attempt").toBeDefined();
  });
});
