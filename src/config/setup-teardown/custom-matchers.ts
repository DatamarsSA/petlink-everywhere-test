import { expect } from "vitest";

interface CustomMatchers<R = unknown> {
  toBeWithinHoursOf: (expected: string, hours: number) => R;
}

declare module "vitest" {
  interface Assertion<T = any> extends CustomMatchers<T> {}
  interface AsymmetricMatchersContaining extends CustomMatchers {}
}

expect.extend({
  toBeWithinHoursOf(received: string, expected: string, hours: number) {
    const diff = Math.abs(new Date(received).getTime() - new Date(expected).getTime()) / 3_600_000;
    return {
      pass: diff <= hours,
      message: () => `expected ${received} within ±${hours}h of ${expected}, got ${diff.toFixed(2)}h`,
    };
  },
});
