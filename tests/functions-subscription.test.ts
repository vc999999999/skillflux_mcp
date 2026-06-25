import { describe, expect, it } from "vitest";
import {
  isActiveSubStatus,
  periodEndIso,
  resolveSubscriptionPlan,
} from "../functions/lib/subscription";

describe("subscription helpers", () => {
  it("treats active and trialing as granting access", () => {
    expect(isActiveSubStatus("active")).toBe(true);
    expect(isActiveSubStatus("trialing")).toBe(true);
    expect(isActiveSubStatus("past_due")).toBe(false);
    expect(isActiveSubStatus("canceled")).toBe(false);
    expect(isActiveSubStatus(undefined)).toBe(false);
  });

  it("converts a Stripe period end into ISO, null when absent", () => {
    // 2026-07-25T00:00:00Z
    expect(periodEndIso(1784937600)).toBe("2026-07-25T00:00:00.000Z");
    expect(periodEndIso(null)).toBeNull();
    expect(periodEndIso(undefined)).toBeNull();
    expect(periodEndIso(Number.NaN)).toBeNull();
  });

  it("resolves the plan from metadata first, then price id, then monthly", () => {
    const prices = { monthly: "price_m", annual: "price_a" };
    expect(resolveSubscriptionPlan("annual", undefined, prices)).toBe("annual");
    expect(resolveSubscriptionPlan("monthly", "price_a", prices)).toBe("monthly");
    expect(resolveSubscriptionPlan(undefined, "price_a", prices)).toBe("annual");
    expect(resolveSubscriptionPlan(undefined, "price_m", prices)).toBe("monthly");
    expect(resolveSubscriptionPlan(undefined, "unknown", prices)).toBe("monthly");
  });
});
