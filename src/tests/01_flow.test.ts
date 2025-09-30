import { describe, expect, it } from "vitest";

describe("tet string", () => {
  it("name should be the same", async () => {
    let a = "Emanuel";
    expect(a).toBe("Roberto");
  });

  it("sourname should be the same", async () => {
    let a = "Epifani";
    expect(a).toBe("Rossi");
  });
});
