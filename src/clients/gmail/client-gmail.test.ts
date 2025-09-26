import { describe, expect, it } from "vitest";
import { gmailClient } from "./client-gmail.js";
import { step } from "../../shared/utils.js";
import { petlink } from "../petlink-infrastructure/client-petlink-infrastructure.js";

describe("Gmail Client", () => {
  // beforeAll(async () => {
  //   const deletedCount = await gmailClient.deleteAllEmails();
  //   console.log(`🧹 Cleanup: ${deletedCount} emails deleted`);
  // });

  it("should verify Gmail connection", async () => {
    const emailAddress = await gmailClient.verifyConnection();
    console.log("✅ Connesso all'account Gmail:", emailAddress);
    expect(emailAddress).toBeDefined();
    expect(emailAddress.includes("@")).toBe(true);
  }, 10000);

  // afterAll(async () => {
  //   // Clean up after tests
  //   await gmailClient.deleteAllEmails();
  // });
});
