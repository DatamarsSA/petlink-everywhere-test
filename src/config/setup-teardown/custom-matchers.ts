import { expect } from "vitest";

interface CustomMatchers<R = unknown> {
  toBeWithinHoursOf: (expected: string, hours: number) => R;
  toBeWithinDaysOf: (expected: string, days: number) => R;
  toHaveDaysDurationOf: (expectedDays: number, toleranceHours?: number) => R;
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
  toBeWithinDaysOf(received: string, expected: string, days: number) {
    const diff = Math.abs(new Date(received).getTime() - new Date(expected).getTime()) / 86_400_000;
    return {
      pass: diff <= days,
      message: () => `expected ${received} within ±${days}d of ${expected}, got ${diff.toFixed(2)}d`,
    };
  },
  toHaveDaysDurationOf(
    received: { start: string; end: string },
    expectedDays: number,
    toleranceHours: number = 1,
  ) {
    const actualMs = new Date(received.end).getTime() - new Date(received.start).getTime();
    const actualDays = actualMs / 86_400_000;
    const toleranceDays = toleranceHours / 24;
    const pass = Math.abs(actualDays - expectedDays) <= toleranceDays;
    return {
      pass,
      message: () =>
        `expected duration between ${received.start} and ${received.end} to be ${expectedDays}d (±${toleranceHours}h), got ${actualDays.toFixed(3)}d`,
    };
  },
});
