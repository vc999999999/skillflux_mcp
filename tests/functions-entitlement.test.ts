import { describe, expect, it } from "vitest";
import { canAccessSkill, expiresAtForPlan, tiersForPlan } from "../functions/lib/entitlement";
import { pickActiveEntitlement, type EntitlementRow } from "../functions/lib/entitlements-db";

describe("registry entitlement", () => {
  it("lifetime plan includes deluxe tier", () => {
    expect(tiersForPlan("lifetime")).toContain("deluxe");
    expect(
      canAccessSkill({ userId: "u1", plan: "lifetime", tiers: ["free", "deluxe"] }, "deluxe"),
    ).toBe(true);
  });

  it("free plan excludes deluxe tier", () => {
    expect(
      canAccessSkill({ userId: "u1", plan: "free", tiers: ["free"] }, "deluxe"),
    ).toBe(false);
  });
});

function row(overrides: Partial<EntitlementRow>): EntitlementRow {
  return {
    id: "ent",
    user_id: "u1",
    product: "deluxe-pack",
    plan: "lifetime",
    status: "active",
    source: "stripe",
    order_id: "ord",
    created_at: "2026-01-01T00:00:00.000Z",
    expires_at: null,
    ...overrides,
  };
}

describe("entitlement expiry", () => {
  const now = "2026-06-25T00:00:00.000Z";

  it("keeps lifetime entitlement active (expires_at null)", () => {
    const picked = pickActiveEntitlement([row({ plan: "lifetime", expires_at: null })], now);
    expect(picked?.plan).toBe("lifetime");
  });

  it("keeps a subscription active before expiry", () => {
    const picked = pickActiveEntitlement(
      [row({ plan: "monthly", expires_at: "2026-07-01T00:00:00.000Z" })],
      now,
    );
    expect(picked?.plan).toBe("monthly");
  });

  it("drops an expired subscription (downgrades to free)", () => {
    const picked = pickActiveEntitlement(
      [row({ plan: "monthly", expires_at: "2026-05-01T00:00:00.000Z" })],
      now,
    );
    expect(picked).toBeNull();
  });

  it("prefers lifetime over an active subscription", () => {
    const picked = pickActiveEntitlement(
      [
        row({ id: "sub", plan: "annual", expires_at: "2026-12-01T00:00:00.000Z", created_at: "2026-06-01T00:00:00.000Z" }),
        row({ id: "life", plan: "lifetime", expires_at: null, created_at: "2026-01-01T00:00:00.000Z" }),
      ],
      now,
    );
    expect(picked?.id).toBe("life");
  });

  it("computes subscription expiry, null for lifetime", () => {
    const from = new Date("2026-06-25T00:00:00.000Z");
    expect(expiresAtForPlan("monthly", from)).toBe("2026-07-25T00:00:00.000Z");
    expect(expiresAtForPlan("annual", from)).toBe("2027-06-25T00:00:00.000Z");
    expect(expiresAtForPlan("lifetime", from)).toBeNull();
  });
});
