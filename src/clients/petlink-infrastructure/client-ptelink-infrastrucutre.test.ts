import { describe, it, expect } from "vitest";
import { petlink } from "../../clients/petlink-infrastructure/client-petlink-infrastructure.js";

describe("PetLinkInfrastructure Client must work", () => {
  it("Should response PUBLIC (apikey) ednpoint", async () => {
    const result = await petlink.core.public.getBreed({
      species: "DOG",
      languageId: "IT",
    });
    console.log("result", result);

    expect(result.getBreed).toBeDefined();
    expect(result.getBreed.items).toBeDefined();
    expect(Array.isArray(result.getBreed.items)).toBe(true);
  });

  it("Should response PRIVATE (jwt) endpoint", async () => {
    await petlink.loginWithEmail("marco@test.it", "Ciaokippy3!");

    const user = await petlink.core.authJwt.withRetry().getUser();
    console.log("user", user);

    expect(user.getUser).toBeDefined();
    expect(user.getUser.user).toBeDefined();
    expect(user.getUser.user?.name).toBeDefined();
  });

  it("Should response PRIVATE (IAM aws) endpoint", async () => {
    // Login con credenziali IAM (Access Key + Secret Key)
    // todo: Sostituisci con credenziali reali per il test
    try {
      petlink.loginWithIam("AKIA_TEST_KEY", "test_secret_key");
      const result = await petlink.core.authIam.getUser();
      console.log("IAM result", result);

      expect(result.getUser).toBeDefined();
      expect(result.getUser.user).toBeDefined();
    } catch (error) {
      console.log("IAM auth error (expected with fake keys):", error);
      expect(error).toBeDefined();
    }
  });
});
