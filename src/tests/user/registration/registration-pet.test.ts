import { beforeAll, describe, expect, it } from "vitest";
import type { PetIn, User } from "../../../clients/petlink-infrastructure/endpoints/graphql/generated/core_schema.js";
import { fixtures } from "../../../fixtures/fixtures.js";
import { testHelper } from "../../../clients/client-test-helper.js";
import { petlink } from "../../../clients/petlink-infrastructure/client-petlink-infrastructure.js";

describe("Pet Registration", () => {
  let testUser: User;

  const dogPayload = {
    name: fixtures.pet.defaultDog.name,
    species: fixtures.pet.defaultDog.species,
    breedType: fixtures.pet.defaultDog.breedType,
    breeds: fixtures.pet.defaultDog.breeds,
    gender: fixtures.pet.defaultDog.gender,
    weight: fixtures.pet.defaultDog.weight,
    birthDate: fixtures.pet.defaultDog.birthDate,
    livingEnvironment: fixtures.pet.defaultDog.livingEnvironment,
    primaryColor: fixtures.pet.defaultDog.primaryColor,
  } as PetIn;

  const catPayload = {
    name: fixtures.pet.defaultCat.name,
    species: fixtures.pet.defaultCat.species,
    breedType: fixtures.pet.defaultCat.breedType,
    breeds: fixtures.pet.defaultCat.breeds,
    gender: fixtures.pet.defaultCat.gender,
    weight: fixtures.pet.defaultCat.weight,
    birthDate: fixtures.pet.defaultCat.birthDate,
    livingEnvironment: fixtures.pet.defaultCat.livingEnvironment,
    primaryColor: fixtures.pet.defaultCat.primaryColor,
  } as PetIn;

  beforeAll(async () => {
    testUser = await testHelper.createUser();
  });

  it("Create DOG and CAT for the user", async () => {
    const [dogResponse, catResponse] = await Promise.all([petlink.core.graphql.authJwt.createPet({ pet: dogPayload }), petlink.core.graphql.authJwt.createPet({ pet: catPayload })]);

    // Assert DOG
    expect(dogResponse.createPet.code).toBe("200");
    expect(dogResponse.createPet.pet).toMatchObject({
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
    expect(dogResponse.createPet.pet?.id).toBeDefined();

    // Assert CAT
    expect(catResponse.createPet.code).toBe("200");
    expect(catResponse.createPet.pet).toMatchObject({
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
    expect(catResponse.createPet.pet?.id).toBeDefined();
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
    expect(dogPurebreedWithTwoBreeds.createPet.code).toBe("400");
    expect(dogMixedbreedWithOneBreed.createPet.code).toBe("400");
    expect(dogMixedbreedWithTwoEqualsBreed.createPet.code).toBe("400");
    expect(catWithDogBreed.createPet.code).toBe("400");
    expect(dogWithCatBreed.createPet.code).toBe("400");
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

    expect(createResponse.createPet).toBeDefined();
    expect(createResponse.createPet.code).toBe("200");
    expect(createResponse.createPet.pet).toBeDefined();
    expect(createResponse.createPet.pet?.name).toBe(tempPetData.name);

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

    expect(updateResponse.updatePet).toBeDefined();
    expect(updateResponse.updatePet.code).toBe("200");
    expect(updateResponse.updatePet.pet).toBeDefined();
    expect(updateResponse.updatePet.pet?.id).toBe(petId);
    expect(updateResponse.updatePet.pet?.name).toBe(updatedName);
    expect(updateResponse.updatePet.pet?.weight).toBe(updatedWeight);

    // TEST DELETE: Remove the temporary PET
    const deleteResponse = await petlink.core.graphql.authJwt.deletePet({
      petId,
    });

    expect(deleteResponse.deletePet).toBeDefined();
    expect(deleteResponse.deletePet.code).toBe("200");

    // Verify the PET no longer exists
    const petsAfterDelete = await petlink.core.graphql.authJwt.getPets();
    const deletedPet = petsAfterDelete.getPets.pets?.find((p) => p.id === petId);
    expect(deletedPet).toBeUndefined();
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
    expect(createPetResponse.createPet.pet).toBeDefined();
    const petId = createPetResponse.createPet.pet!.id;

    // STEP 2: Associate a device to the PET (brand-agnostic: works for both PETLINK and KIPPY)
    const devicePayload = {
      serialNumber: fixtures.devices.petlinkGps[fixtures.appBrand].DOG.serialNumber,
      countryCode: fixtures.devices.petlinkGps[fixtures.appBrand].DOG.countryCode,
      timezone: fixtures.devices.petlinkGps[fixtures.appBrand].DOG.timezone,
      petId: petId,
    };

    const createDeviceResponse = await petlink.core.graphql.authJwt.createPetlinkGps({
      petlinkGps: devicePayload,
      appBrand: fixtures.appBrand,
    });

    expect(createDeviceResponse.createPetlinkGps.code).toBe("200");
    expect(createDeviceResponse.createPetlinkGps.petlinkGps).toBeDefined();

    // STEP 3: Try to delete the PET while it has a device associated (should FAIL)
    const deleteWithDeviceResponse = await petlink.core.graphql.authJwt.deletePet({
      petId,
    });
    expect(deleteWithDeviceResponse.deletePet.code).not.toBe("200");

    // Verify the PET still exists
    const petsAfterFailedDelete = await petlink.core.graphql.authJwt.getPets();
    const petStillExists = petsAfterFailedDelete.getPets.pets?.find((p) => p.id === petId);
    expect(petStillExists).toBeDefined();
  });
});
