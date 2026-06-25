// Pure helpers for mapping Stripe subscription state onto our entitlement model.
// Kept side-effect free so the webhook logic stays unit-testable.

export type SubscriptionPlan = "monthly" | "annual";

/** A Stripe subscription counts as granting access while active or trialing. */
export function isActiveSubStatus(status: string | undefined): boolean {
  return status === "active" || status === "trialing";
}

/** Convert a Stripe Unix-seconds period end into an ISO-8601 UTC string. */
export function periodEndIso(currentPeriodEnd: number | null | undefined): string | null {
  if (typeof currentPeriodEnd !== "number" || !Number.isFinite(currentPeriodEnd)) {
    return null;
  }
  return new Date(currentPeriodEnd * 1000).toISOString();
}

/**
 * Resolve the billing plan. Subscription/session metadata is authoritative
 * (we set it at checkout); fall back to matching the price id, then monthly.
 */
export function resolveSubscriptionPlan(
  metadataPlan: string | undefined,
  priceId: string | undefined,
  prices: { monthly?: string; annual?: string },
): SubscriptionPlan {
  if (metadataPlan === "monthly" || metadataPlan === "annual") return metadataPlan;
  if (priceId && prices.annual && priceId === prices.annual) return "annual";
  if (priceId && prices.monthly && priceId === prices.monthly) return "monthly";
  return "monthly";
}
