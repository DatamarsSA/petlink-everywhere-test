import { describe, it, expect } from "vitest";
import { Infrastructure } from "../../infrastructure/clients/client.js";

describe("Infrastructure microservices must be available", () => {
  it("CORE - should response PUBLIC (apikey) ednpoint", async () => {
    const result = await Infrastructure.core.authApiKey.sdk.getBreed({
      species: "DOG",
      languageId: "IT",
    });

    expect(result.getBreed).toBeDefined();
    expect(result.getBreed.items).toBeDefined();
    expect(Array.isArray(result.getBreed.items)).toBe(true);
  });

  it("CORE - should response PRIVATE (login) endpoint", async () => {
    const result = await Infrastructure.core.authLogin.sdk.getUser();

    expect(result.getUser).toBeDefined();
    expect(result.getUser.user).toBeDefined();
    expect(result.getUser.user?.name).toBeDefined();
  });
});
