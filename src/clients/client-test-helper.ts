import {
  User,
  UserIn,
  PetIn,
} from "./petlink-infrastructure/endpoints/graphql/generated/core_schema.js";
import { env } from "../config/env-schema-validation.js";
import {
  petlink,
  UtilityTestTypeEnum,
} from "./petlink-infrastructure/client-petlink-infrastructure.js";
import { gmailClient } from "./gmail/client-gmail.js";
import { twilioClient } from "./twilio/client-twillio.js";
import { fixtures } from "../fixtures/fixtures.js";

/**
 * Test helper utilities for managing test data and cleanup
 *
 * ⚠️ IMPORTANT: This class requires environment variables to be loaded.
 * Do NOT use in globalSetup - only use in test files or setupFiles.
 */
export class TestHelper {
  /**
   * Clean up all test data (users, emails, SMS)
   * Should be called before each test suite to ensure clean state
   */
  async cleanupAll(): Promise<void> {
    console.log("🧹 Cleaning up test environment...");

    // Clear all cached authentication and clients first
    // petlink.clearAllCache();

    // Login with IAM for cleanup operations
    petlink.loginWithIam(env.AWS_ACCESS_KEY_ID, env.AWS_SECRET_ACCESS_KEY);

    await Promise.all([
      petlink.core.graphql.authIam
        .utilityIntegrationTest({
          input: {
            phone: fixtures.user.phone,
            utilityType: UtilityTestTypeEnum.CLEAN_UP_USER,
          },
        })
        .then(() => console.log("✅ Deleted User and all related entities")),
      gmailClient
        .deleteAllEmails()
        .then(() => console.log("✅ Deleted all emails")),
      twilioClient
        .deleteAllMessagesSentoToNumber(fixtures.user.phone)
        .then(() =>
          console.log(`✅ Deleted all SMS for ${fixtures.user.phone}`),
        ),
    ]);

    // Clear cache again after cleanup to ensure fresh state for next test
    // petlink.clearAllCache();
  }

  /**
   * Clear only authentication cache without deleting data
   * Useful between test files to prevent auth state leakage
   */
  async clearAuthCache(): Promise<void> {
    petlink.clearAllCache();
  }

  /**
   * Create a test user using the utility endpoint (bypasses OTP flow)
   * Automatically logs in the user after creation
   *
   * @returns The created user object
   */
  async createUser(): Promise<User> {
    // Login with IAM to use utility endpoint
    petlink.loginWithIam(env.AWS_ACCESS_KEY_ID, env.AWS_SECRET_ACCESS_KEY);

    const userPayload = {
      email: fixtures.user.email,
      name: fixtures.user.name,
      surname: fixtures.user.surname,
      city: fixtures.user.city,
      countryCode: fixtures.user.countryCode,
      zipCode: fixtures.user.zipCode,
      streetAddress: fixtures.user.streetAddress,
      phone: fixtures.user.phone,
      password: fixtures.user.password,
      confirmPassword: fixtures.user.confirmPassword,
      languageId: fixtures.user.languageId,
    } as UserIn;

    const response = await petlink.core.graphql.authIam.utilityIntegrationTest({
      input: {
        utilityType: UtilityTestTypeEnum.SIGN_UP,
        userIn: userPayload,
        appBrand: fixtures.appBrand,
      },
    });

    if (response.utilityIntegrationTest.code !== "200") {
      throw new Error(
        `Failed to create user: ${response.utilityIntegrationTest.message}`,
      );
    }

    await petlink.loginWithPhone(userPayload.phone, userPayload.password);
    const userResponse = await petlink.core.graphql.authJwt.getUser();

    if (!userResponse.getUser.user) {
      throw new Error("User not found after creation");
    }
    console.log(JSON.stringify(userResponse.getUser.user));
    return userResponse.getUser.user;
  }

  /**
   * Get or create a test user
   * If the user already exists, it will login and return the existing user
   * Otherwise, it will create a new user
   *
   * @returns The user object
   */
  async getOrCreateUser(): Promise<User> {
    try {
      // Try to login with existing credentials
      await petlink.loginWithPhone(fixtures.user.phone, fixtures.user.password);
      const userResponse = await petlink.core.graphql.authJwt.getUser();

      if (userResponse.getUser.user) {
        console.log("✅ Using existing user");
        return userResponse.getUser.user;
      }
    } catch (error) {
      // User doesn't exist, create it
      console.log("👤 Creating new user...");
      return await this.createUser();
    }

    // Fallback: create user
    return await this.createUser();
  }

  /**
   * Create both a dog and a cat for the currently authenticated user
   *
   * @returns Object containing both created pets
   */
  async createPetsForUser(): Promise<{ dog: any; cat: any }> {
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

    const [dogResponse, catResponse] = await Promise.all([
      petlink.core.graphql.authJwt.createPet({ pet: dogPayload }),
      petlink.core.graphql.authJwt.createPet({ pet: catPayload }),
    ]);

    if (dogResponse.createPet.code !== "200") {
      throw new Error(`Failed to create dog: ${dogResponse.createPet.message}`);
    }

    if (catResponse.createPet.code !== "200") {
      throw new Error(`Failed to create cat: ${catResponse.createPet.message}`);
    }

    return {
      dog: dogResponse.createPet.pet,
      cat: catResponse.createPet.pet,
    };
  }
}

// ============================================================================
// SINGLETON EXPORT
// ============================================================================

/**
 * Default singleton instance for test utilities
 * Use this in test files for consistent test data management
 */
export const testHelper = new TestHelper();
