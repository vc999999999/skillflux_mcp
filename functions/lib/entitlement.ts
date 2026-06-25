import type { AuthContext } from "./catalog";

export function tiersForPlan(plan: AuthContext["plan"]): string[] {
  switch (plan) {
    case "fixture":
    case "lifetime":
    case "annual":
    case "monthly":
      return ["free", "deluxe"];
    case "free":
      return ["free"];
    default:
      return ["free"];
  }
}

export function canAccessSkill(auth: AuthContext, tier: string): boolean {
  return tiersForPlan(auth.plan).includes(tier);
}

export function publicTiers(): string[] {
  return ["free"];
}

/**
 * Expiry timestamp for a purchased plan, or null for non-expiring plans.
 * Subscriptions (monthly/annual) expire; lifetime/fixture never do.
 */
export function expiresAtForPlan(plan: string, from: Date = new Date()): string | null {
  const date = new Date(from);
  switch (plan) {
    case "monthly":
      date.setUTCMonth(date.getUTCMonth() + 1);
      return date.toISOString();
    case "annual":
      date.setUTCFullYear(date.getUTCFullYear() + 1);
      return date.toISOString();
    default:
      return null;
  }
}
