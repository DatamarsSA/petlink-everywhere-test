import { beforeAll, describe, expect, it } from "vitest";
import { BreedTypeEnum, PetIn, User } from "../../clients/petlink-infrastructure/endpoints/graphql/generated/core_schema.js";
import { fxt } from "../../fixtures/fixtures.js";
import { testHelper } from "../../clients/client-test-helper.js";
import { petlink } from "../../clients/petlink-infrastructure/client-petlink-infrastructure.js";

describe("Pet", () => {
  describe("Registration", () => {
    let testUser: User;

    const dogPayload = {
      name: fxt.current.pet.defaultDog.name,
      species: fxt.current.pet.defaultDog.species,
      breedType: fxt.current.pet.defaultDog.breedType,
      breeds: fxt.current.pet.defaultDog.breeds,
      gender: fxt.current.pet.defaultDog.gender,
      weight: fxt.current.pet.defaultDog.weight,
      birthDate: fxt.current.pet.defaultDog.birthDate,
      livingEnvironment: fxt.current.pet.defaultDog.livingEnvironment,
      primaryColor: fxt.current.pet.defaultDog.primaryColor,
    } as PetIn;

    const catPayload = {
      name: fxt.current.pet.defaultCat.name,
      species: fxt.current.pet.defaultCat.species,
      breedType: fxt.current.pet.defaultCat.breedType,
      breeds: fxt.current.pet.defaultCat.breeds,
      gender: fxt.current.pet.defaultCat.gender,
      weight: fxt.current.pet.defaultCat.weight,
      birthDate: fxt.current.pet.defaultCat.birthDate,
      livingEnvironment: fxt.current.pet.defaultCat.livingEnvironment,
      primaryColor: fxt.current.pet.defaultCat.primaryColor,
    } as PetIn;

    beforeAll(async () => {
      await testHelper.cleanupAll();
      testUser = await testHelper.createUser();
    });

    it("Create DOG and CAT for the user", async () => {
      const [dogResponse, catResponse] = await Promise.all([
        petlink.core.graphqlHttp.authJwt.createPet({ pet: dogPayload }),
        petlink.core.graphqlHttp.authJwt.createPet({ pet: catPayload }),
      ]);

      // Assert DOG
      expect(
        dogResponse.createPet.code,
        `createPet should succeed for dog - Error: ${dogResponse.createPet.message}${dogResponse.createPet.translationCode ? ` (${dogResponse.createPet.translationCode})` : ""}`,
      ).toBe("200");
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
      expect(
        catResponse.createPet.code,
        `createPet should succeed for cat - Error: ${catResponse.createPet.message}${catResponse.createPet.translationCode ? ` (${catResponse.createPet.translationCode})` : ""}`,
      ).toBe("200");
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
      const [dogPurebreedWithTwoBreeds, dogMixedbreedWithOneBreed, dogMixedbreedWithTwoEqualsBreed, catWithDogBreed, dogWithCatBreed] =
        await Promise.all([
          // Invalid: PUREBREED with 2 breeds (should have only 1)
          petlink.core.graphqlHttp.authJwt.createPet({
            pet: {
              ...dogPayload,
              breedType: BreedTypeEnum.Purebreed,
              breeds: [
                "5b0bfddb-532e-41cb-9705-b2ddc21226ef", // Labrador Retriever
                "0074b56e-8c84-43b6-aaad-d7c00a9aa37e", // Another dog breed
              ],
            },
          }),
          // Invalid: MIXED_BREED with 1 breed (should have 2)
          petlink.core.graphqlHttp.authJwt.createPet({
            pet: {
              ...dogPayload,
              breedType: BreedTypeEnum.MixedBreed,
              breeds: ["5b0bfddb-532e-41cb-9705-b2ddc21226ef"], // Only 1 breed
            },
          }),
          // Invalid: MIXED_BREED with 2 equals breeds
          petlink.core.graphqlHttp.authJwt.createPet({
            pet: {
              ...dogPayload,
              breedType: BreedTypeEnum.MixedBreed,
              breeds: ["5b0bfddb-532e-41cb-9705-b2ddc21226ef", "5b0bfddb-532e-41cb-9705-b2ddc21226ef"],
            },
          }),
          // Invalid: CAT with DOG breed
          petlink.core.graphqlHttp.authJwt.createPet({
            pet: {
              ...catPayload,
              breedType: BreedTypeEnum.Purebreed,
              breeds: ["5b0bfddb-532e-41cb-9705-b2ddc21226ef"], // Labrador Retriever (DOG)
            },
          }),
          // Invalid: DOG with CAT breed
          petlink.core.graphqlHttp.authJwt.createPet({
            pet: {
              ...dogPayload,
              breedType: BreedTypeEnum.Purebreed,
              breeds: ["f7bbebdf-26bb-4947-996d-3290bf128f01"], // Siamese (CAT)
            },
          }),
        ]);
      // Assert all requests failed with validation error (400)
      expect(
        dogPurebreedWithTwoBreeds.createPet.code,
        `createPet should fail - PUREBREED with 2 breeds - Error: ${dogPurebreedWithTwoBreeds.createPet.message}${dogPurebreedWithTwoBreeds.createPet.translationCode ? ` (${dogPurebreedWithTwoBreeds.createPet.translationCode})` : ""}`,
      ).toBe("400");
      expect(
        dogMixedbreedWithOneBreed.createPet.code,
        `createPet should fail - MIXED_BREED with 1 breed - Error: ${dogMixedbreedWithOneBreed.createPet.message}${dogMixedbreedWithOneBreed.createPet.translationCode ? ` (${dogMixedbreedWithOneBreed.createPet.translationCode})` : ""}`,
      ).toBe("400");
      expect(
        dogMixedbreedWithTwoEqualsBreed.createPet.code,
        `createPet should fail - MIXED_BREED with 2 identical breeds - Error: ${dogMixedbreedWithTwoEqualsBreed.createPet.message}${dogMixedbreedWithTwoEqualsBreed.createPet.translationCode ? ` (${dogMixedbreedWithTwoEqualsBreed.createPet.translationCode})` : ""}`,
      ).toBe("400");
      expect(
        catWithDogBreed.createPet.code,
        `createPet should fail - CAT with DOG breed - Error: ${catWithDogBreed.createPet.message}${catWithDogBreed.createPet.translationCode ? ` (${catWithDogBreed.createPet.translationCode})` : ""}`,
      ).toBe("400");
      expect(
        dogWithCatBreed.createPet.code,
        `createPet should fail - DOG with CAT breed - Error: ${dogWithCatBreed.createPet.message}${dogWithCatBreed.createPet.translationCode ? ` (${dogWithCatBreed.createPet.translationCode})` : ""}`,
      ).toBe("400");
    });

    it("Update PET should work correctly", async () => {
      // Create a temporary PET for UPDATE testing
      const tempPetData = {
        ...dogPayload,
        name: "Temp Pet for UPDATE Test",
      } as PetIn;

      const createResponse = await petlink.core.graphqlHttp.authJwt.createPet({
        pet: tempPetData,
      });

      expect(createResponse.createPet, "Create pet response should be defined").toBeDefined();
      expect(
        createResponse.createPet.code,
        `createPet should succeed - Error: ${createResponse.createPet.message}${createResponse.createPet.translationCode ? ` (${createResponse.createPet.translationCode})` : ""}`,
      ).toBe("200");
      expect(createResponse.createPet.pet, "Created pet should be defined").toBeDefined();
      expect(createResponse.createPet.pet?.name, "Created pet name should match input").toBe(tempPetData.name);

      const petId = createResponse.createPet.pet?.id!;

      // Modify the temporary PET
      const updatedName = "Updated Temp Pet";
      const updatedWeight = 25;

      const updateResponse = await petlink.core.graphqlHttp.authJwt.updatePet({
        pet: {
          id: petId,
          name: updatedName,
          weight: updatedWeight,
        },
      });

      expect(updateResponse.updatePet, "Update pet response should be defined").toBeDefined();
      expect(
        updateResponse.updatePet.code,
        `updatePet should succeed - Error: ${updateResponse.updatePet.message}${updateResponse.updatePet.translationCode ? ` (${updateResponse.updatePet.translationCode})` : ""}`,
      ).toBe("200");
      expect(updateResponse.updatePet.pet, "Updated pet should be defined").toBeDefined();
      expect(updateResponse.updatePet.pet?.id, "Pet ID should remain unchanged after update").toBe(petId);
      expect(updateResponse.updatePet.pet?.name, "Pet name should be updated").toBe(updatedName);
      expect(updateResponse.updatePet.pet?.weight, "Pet weight should be updated").toBe(updatedWeight);

      // Cleanup: Delete the temporary PET
      await petlink.core.graphqlHttp.authJwt.deletePet({ petId });
    });

    it("Delete PET should work correctly", async () => {
      // Create a temporary PET for DELETE testing
      const tempPetData = {
        ...dogPayload,
        name: "Temp Pet for DELETE Test",
      } as PetIn;

      const createResponse = await petlink.core.graphqlHttp.authJwt.createPet({
        pet: tempPetData,
      });
      const petId = createResponse.createPet.pet?.id!;

      // Remove the temporary PET
      const deleteResponse = await petlink.core.graphqlHttp.authJwt.deletePet({
        petId,
      });

      expect(deleteResponse.deletePet, "Delete pet response should be defined").toBeDefined();
      expect(
        deleteResponse.deletePet.code,
        `deletePet should succeed - Error: ${deleteResponse.deletePet.message}${deleteResponse.deletePet.translationCode ? ` (${deleteResponse.deletePet.translationCode})` : ""}`,
      ).toBe("200");

      // Verify the PET no longer exists
      const petsAfterDelete = await petlink.core.graphqlHttp.authJwt.getPets();
      const deletedPet = petsAfterDelete.getPets.pets?.find((p) => p.id === petId);
      expect(deletedPet, "Pet should not exist after deletion").toBeUndefined();
    });

    it("Pet should not be removable if he has device associated", async () => {
      // STEP 1: Create a temporary PET for this test
      const tempPetData = {
        ...dogPayload,
        name: "Pet with Device Test",
      } as PetIn;

      const createPetResponse = await petlink.core.graphqlHttp.authJwt.createPet({
        pet: tempPetData,
      });

      expect(
        createPetResponse.createPet.code,
        `createPet should succeed - Error: ${createPetResponse.createPet.message}${createPetResponse.createPet.translationCode ? ` (${createPetResponse.createPet.translationCode})` : ""}`,
      ).toBe("200");
      expect(createPetResponse.createPet.pet, "Created pet should be defined").toBeDefined();
      const petId = createPetResponse.createPet.pet!.id;

      // STEP 2: Associate a device to the PET (brand-agnostic: works for both PETLINK and KIPPY)
      const devicePayload = {
        serialNumber: fxt.current.gpsFixtures.DOG.serialNumber,
        countryCode: fxt.current.gpsFixtures.DOG.countryCode,
        timezone: fxt.current.gpsFixtures.DOG.timezone,
        petId: petId,
      };

      const createDeviceResponse = await petlink.core.graphqlHttp.authJwt.createPetlinkGps({
        petlinkGps: devicePayload,
        appBrand: fxt.current.appBrand,
      });

      expect(
        createDeviceResponse.createPetlinkGps.code,
        `createPetlinkGps should succeed - Error: ${createDeviceResponse.createPetlinkGps.message}${createDeviceResponse.createPetlinkGps.translationCode ? ` (${createDeviceResponse.createPetlinkGps.translationCode})` : ""}`,
      ).toBe("200");
      expect(createDeviceResponse.createPetlinkGps.petlinkGps).toBeDefined();

      // STEP 3: Try to delete the PET while it has a device associated (should FAIL)
      const deleteWithDeviceResponse = await petlink.core.graphqlHttp.authJwt.deletePet({
        petId,
      });
      expect(
        deleteWithDeviceResponse.deletePet.code,
        `deletePet should fail when device is associated - Error: ${deleteWithDeviceResponse.deletePet.message}${deleteWithDeviceResponse.deletePet.translationCode ? ` (${deleteWithDeviceResponse.deletePet.translationCode})` : ""}`,
      ).not.toBe("200");

      // Verify the PET still exists
      const petsAfterFailedDelete = await petlink.core.graphqlHttp.authJwt.getPets();
      const petStillExists = petsAfterFailedDelete.getPets.pets?.find((p) => p.id === petId);
      expect(petStillExists, "Pet should still exist after failed deletion attempt").toBeDefined();
    });
  });
});
