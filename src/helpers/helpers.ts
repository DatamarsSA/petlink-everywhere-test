import { expect } from "vitest";
import type { Pricing, AddonPricing, PetProtection } from "../clients/petlink-infrastructure/endpoints/graphql/generated/core_schema.js";

/**
 * Poll a function until a condition is met or timeout occurs.
 * Use this when waiting for asynchronous data/events (OTP arrival, email verification, subscription activation, etc.)
 *
 * @param fn - Function that returns the value to check (can return null/undefined if not ready)
 * @param options
 * @param options.isReady - Predicate function to check if the result is valid.
 *                          Receives the result and must return `true` when the condition is satisfied.
 *                          Default: checks for truthy value (!!result)
 * @param options.timeoutMs - Maximum time to wait in milliseconds (default: 30000)
 * @param options.intervalMs - Delay between polling attempts in milliseconds (default: 1000)
 * @param options.timeoutError - Custom error message when timeout occurs
 *
 * @example
 * // Example 1: Simple usage - waits for truthy value (default behavior)
 * const otp = await waitFor(
 *   () => twilioClient.getLatestOtp(phoneNumber),
 *   {
 *     timeoutMs: fixtures.polling.timeoutMs,
 *     intervalMs: fixtures.polling.intervalMs,
 *     timeoutError: 'OTP not received in time'
 *   }
 * );
 * // Stops when getLatestOtp returns a non-empty string
 *
 * @example
 * // Example 2: Custom condition with isReady
 * const subscription = await waitFor(
 *   () => petlink.getSubscriptionByProductId({ productId: deviceId }),
 *   {
 *     isReady: (result) => {
 *       // Define your custom condition here
 *       // Returns true when subscription is active AND payment succeeded
 *       const subs = result.getSubscriptionByProductId.subscriptions;
 *       return subs?.some(sub =>
 *         sub?.status === "active" &&
 *         sub?.paymentStatus === "SUCCEEDED"
 *       ) ?? false;
 *     },
 *     timeoutMs: fixtures.polling.timeoutMs,
 *     intervalMs: fixtures.polling.intervalMs,
 *     timeoutError: 'Subscription did not become active in time'
 *   }
 * );
 *
 * @example
 * // Example 3: Wait for specific array length
 * const devices = await waitFor(
 *   () => api.getDevices(userId),
 *   {
 *     isReady: (result) => result.devices.length >= 3,
 *     timeoutMs: fixtures.polling.timeoutMs,
 *     timeoutMs: fixtures.polling.intervalMs
 *   }
 * );
 */
export async function waitFor<T>(
  fn: () => Promise<T>,
  options: {
    isReady?: (result: T) => boolean;
    timeoutMs?: number;
    intervalMs?: number;
    timeoutError?: string;
  } = {},
): Promise<T> {
  const {
    isReady = (result) => !!result,
    timeoutMs = 30000,
    intervalMs = 1000,
    timeoutError = `Timeout: Payment succeeded not return within ${timeoutMs}ms`,
  } = options;

  const startTime = Date.now();
  let attempts = 0;
  let lastError: Error | null = null;

  while (Date.now() - startTime < timeoutMs) {
    attempts++;

    try {
      const result = await fn();
      if (isReady(result)) {
        return result;
      }
    } catch (error) {
      // Salva l'errore silenziosamente, senza loggarlo
      lastError = error instanceof Error ? error : new Error(String(error));
      // Continua a fare retry
    }

    if (Date.now() - startTime + intervalMs < timeoutMs) {
      await new Promise((resolve) => setTimeout(resolve, intervalMs));
    }
  }

  // Lancia l'errore finale con i dettagli
  const errorInfo = lastError ? `\nCaused by: ${lastError.message}` : "";
  throw new Error(`${timeoutError} (${attempts} attempts)${errorInfo}`);
}

/**
 * Assert that two ISO date strings are within a specified tolerance in hours
 *
 * @param date1 - ISO date string to check
 * @param date2 - ISO date string expected
 * @param toleranceHours - Maximum allowed difference in hours
 * @param message - Custom error message
 *
 * @example
 * assertDatesWithinTolerance(
 *   futureSub.currentTermStart,
 *   currentSub.currentTermEnd,
 *   24, // ±24 hours (1 day)
 *   "Future should start when current ends"
 * );
 */
export function assertDatesWithinTolerance(date1: string, date2: string, toleranceHours: number, message: string): void {
  const actual = new Date(date1.replace(/\.\d{3}Z$/, "Z")).getTime();
  const expected = new Date(date2.replace(/\.\d{3}Z$/, "Z")).getTime();

  const diffMs = Math.abs(actual - expected);
  const diffHours = diffMs / (1000 * 60 * 60);

  expect(
    diffHours,
    `${message}. Date1: ${date1}, Date2: ${date2}, ` + `Actual diff: ${diffHours.toFixed(2)} hours (Expected tolerance: ±${toleranceHours}h)`,
  ).toBeLessThanOrEqual(toleranceHours);
}

/**
 * Assert that a purchased subscription matches the expected plan pricing.
 * Validates subscription-level fields (currencyCode, billingPeriod, status, etc.)
 * and subscription items (plan + optional addon).
 *
 * This helper uses toMatchObject for flexible validation of known fields only,
 * ignoring runtime-generated fields like id, creationDate, etc.
 *
 * Accepts both SubscriptionShortInfo and PetlinkSubscription types.
 *
 * @param subPurchased - The actual subscription returned from the API
 * @param subToBuy - The expected plan pricing that was purchased
 * @param options - Validation options
 * @param options.expectedStatus - Expected subscription status (e.g., "active", "future")
 * @param options.expectedPaymentStatus - Expected payment status (e.g., "SUCCEEDED")
 * @param options.addonToBuy - Optional addon pricing if addon was purchased with the plan
 * @param options.message - Optional custom error message for context
 *
 * @example
 * // Simple subscription without addon
 * assertSubscriptionMatchesPlan(subscription, choosenPlan, {
 *   expectedStatus: 'active',
 *   expectedPaymentStatus: 'SUCCEEDED'
 * });
 *
 * @example
 * // Subscription with device protection addon
 * assertSubscriptionMatchesPlan(subscription, choosenPlan, {
 *   expectedStatus: 'active',
 *   expectedPaymentStatus: 'SUCCEEDED',
 *   addonToBuy: choosenPlan.addon
 * });
 */
export function expectSubBoughtMatchSubToBuy(
  subPurchased: any,
  subToBuy: Pricing,
  options: {
    expectedStatus: string;
    expectedPaymentStatus: string;
    addonToBuy?: AddonPricing;
    message?: string;
  },
): void {
  const { expectedStatus, expectedPaymentStatus, addonToBuy, message } = options;
  const contextMsg = message ? ` (${message})` : "";

  // Validate subscription-level fields
  expect(subPurchased, `Subscription should match plan pricing${contextMsg}`).toMatchObject({
    currencyCode: subToBuy.currencyCode,
    billingPeriod: subToBuy.period,
    billingPeriodUnit: subToBuy.periodUnit,
    status: expectedStatus,
    paymentStatus: expectedPaymentStatus,
  });

  // Validate subscription items count
  const expectedItemsCount = addonToBuy ? 2 : 1;
  expect(subPurchased.subscriptionItems.length, `Should have ${expectedItemsCount} subscription item(s)${contextMsg}`).toBe(expectedItemsCount);

  // Find and validate plan item
  const planItem = subPurchased.subscriptionItems.find((item: any) => item.itemType === "plan");
  expect(planItem, `Plan item should exist in subscription items${contextMsg}`).toBeDefined();
  expect(planItem!, `Plan item should match expected plan pricing${contextMsg}`).toMatchObject({
    itemPriceId: subToBuy.id,
    itemId: subToBuy.itemId,
    amount: subToBuy.price,
    itemType: "plan",
    quantity: 1,
  });

  // If addon provided, find and validate addon item
  if (addonToBuy) {
    const addonItem = subPurchased.subscriptionItems.find((item: any) => item.itemType === "addon");
    expect(addonItem, `Addon item should exist in subscription items${contextMsg}`).toBeDefined();
    expect(addonItem!, `Addon item should match expected addon pricing${contextMsg}`).toMatchObject({
      itemPriceId: addonToBuy.id,
      itemId: addonToBuy.itemId,
      amount: addonToBuy.price,
      itemType: "addon",
      quantity: 1,
    });
  }
}

/**
 * Assert that a purchased pet protection subscription matches the expected plan pricing.
 * Validates core fields (name, price, period, etc.) and identifiers (petId, userId).
 *
 * This helper uses toMatchObject for flexible validation of known fields only.
 *
 * @param petProtectionPurchased - The actual pet protection returned from the API
 * @param petProtectionToBuy - The expected pet protection plan pricing that was purchased
 * @param options - Validation options
 * @param options.expectedPetId - Expected pet ID this protection is linked to
 * @param options.expectedUserId - Expected user ID this protection is linked to
 * @param options.expectedStatus - Expected pet protection status (e.g., "OPEN", "ACTIVE")
 * @param options.message - Optional custom error message for context
 *
 * @example
 * assertPetProtectionMatchesPlan(petProtection, chosenPetProtectionPlan, {
 *   expectedPetId: pet.id,
 *   expectedUserId: user.id,
 *   expectedStatus: 'OPEN'
 * });
 */
export function expectPetProtBoughtMatchesPetProtToBuy(
  petProtectionPurchased: PetProtection,
  petProtectionToBuy: Pricing,
  options: {
    expectedPetId: string;
    expectedUserId: string;
    expectedStatus: string;
    message?: string;
  },
): void {
  const { expectedPetId, expectedUserId, expectedStatus, message } = options;
  const contextMsg = message ? ` (${message})` : "";

  expect(petProtectionPurchased, `Pet protection should match plan pricing${contextMsg}`).toMatchObject({
    name: petProtectionToBuy.externalName,
    price: petProtectionToBuy.price,
    currencyCode: petProtectionToBuy.currencyCode,
    period: petProtectionToBuy.period,
    periodUnit: petProtectionToBuy.periodUnit,
    petId: expectedPetId,
    userId: expectedUserId,
    status: expectedStatus,
  });
}

export function extractParamsFromUrl(url: string) {
  const urlObj = new URL(url);
  const uuid = urlObj.searchParams.get("uuid");
  const otp = urlObj.searchParams.get("otp");
  const verificationId = urlObj.searchParams.get("verificationId");
  return { uuid, otp, verificationId };
}
