import { randomId } from "./crypto.js";
import { nowIso, runMigrations } from "./db.js";
import { siteUrl } from "./oauth-github.js";
import type { SubscriptionPlan } from "./subscription.js";

/** Stripe recurring Price id for a billing plan. */
export function priceIdForPlan(env: Env, plan: SubscriptionPlan): string {
  const id =
    plan === "annual"
      ? env.STRIPE_PRICE_ANNUAL
      : (env.STRIPE_PRICE_MONTHLY ?? env.STRIPE_PRICE_ID);
  if (!id) {
    throw new Error(
      `Stripe price for the ${plan} plan is not configured (set STRIPE_PRICE_${plan.toUpperCase()}).`,
    );
  }
  return id;
}

/** Whether checkout can be created for a given plan with the current config. */
export function isStripeConfigured(env: Env, plan: SubscriptionPlan): boolean {
  if (!env.STRIPE_SECRET_KEY) return false;
  return plan === "annual"
    ? Boolean(env.STRIPE_PRICE_ANNUAL)
    : Boolean(env.STRIPE_PRICE_MONTHLY ?? env.STRIPE_PRICE_ID);
}

export async function createStripeCheckout(
  env: Env,
  request: Request,
  userId: string,
  product: string,
  plan: SubscriptionPlan,
): Promise<{ checkoutUrl: string; sessionId: string }> {
  if (!env.STRIPE_SECRET_KEY) {
    throw new Error("Stripe is not configured");
  }
  const priceId = priceIdForPlan(env, plan);

  await runMigrations(env.DB);
  const id = randomId("chk_");
  const createdAt = nowIso();

  const successUrl = `${siteUrl(env, request)}/pack?checkout=success`;
  const cancelUrl = `${siteUrl(env, request)}/pack?checkout=canceled`;

  // Subscription mode: the subscription lifecycle (renewal/cancel) is driven by
  // customer.subscription.* webhooks. Metadata is mirrored onto the subscription
  // so those events can resolve the user, product, and plan.
  const body = new URLSearchParams({
    mode: "subscription",
    success_url: successUrl,
    cancel_url: cancelUrl,
    "line_items[0][price]": priceId,
    "line_items[0][quantity]": "1",
    client_reference_id: userId,
    "metadata[product]": product,
    "metadata[user_id]": userId,
    "metadata[plan]": plan,
    "metadata[checkout_id]": id,
    "subscription_data[metadata][product]": product,
    "subscription_data[metadata][user_id]": userId,
    "subscription_data[metadata][plan]": plan,
    "subscription_data[metadata][checkout_id]": id,
  });

  const response = await fetch("https://api.stripe.com/v1/checkout/sessions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${env.STRIPE_SECRET_KEY}`,
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body,
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(`Stripe checkout failed (${response.status}): ${text}`);
  }

  const session = (await response.json()) as { id: string; url: string };

  await env.DB.prepare(
    `INSERT INTO checkout_sessions (id, user_id, product, provider, provider_ref, status, checkout_url, created_at)
     VALUES (?, ?, ?, 'stripe', ?, 'pending', ?, ?)`,
  )
    .bind(id, userId, product, session.id, session.url, createdAt)
    .run();

  return { checkoutUrl: session.url, sessionId: id };
}

export async function verifyStripeSignature(
  payload: string,
  signatureHeader: string | null,
  secret: string,
  toleranceSeconds = 300,
): Promise<boolean> {
  if (!signatureHeader) return false;

  const parts = Object.fromEntries(
    signatureHeader.split(",").map((part) => {
      const [key, value] = part.split("=");
      return [key, value];
    }),
  ) as Record<string, string>;

  const timestamp = parts.t;
  const signature = parts.v1;
  if (!timestamp || !signature) return false;

  // Reject stale/replayed events outside the tolerance window.
  const ts = Number(timestamp);
  if (!Number.isFinite(ts)) return false;
  const nowSeconds = Math.floor(Date.now() / 1000);
  if (Math.abs(nowSeconds - ts) > toleranceSeconds) return false;

  const signedPayload = `${timestamp}.${payload}`;
  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const mac = await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(signedPayload));
  const expected = [...new Uint8Array(mac)].map((b) => b.toString(16).padStart(2, "0")).join("");

  if (expected.length !== signature.length) return false;
  let diff = 0;
  for (let i = 0; i < expected.length; i++) {
    diff |= expected.charCodeAt(i) ^ signature.charCodeAt(i);
  }
  return diff === 0;
}
