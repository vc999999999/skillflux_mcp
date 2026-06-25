import {
  getEntitlementByOrderId,
  grantEntitlement,
  markEntitlementCanceledByOrderId,
  upsertEntitlementByOrderId,
} from "../../../lib/entitlements-db.js";
import { expiresAtForPlan } from "../../../lib/entitlement.js";
import { nowIso, runMigrations } from "../../../lib/db.js";
import { verifyStripeSignature } from "../../../lib/stripe.js";
import {
  isActiveSubStatus,
  periodEndIso,
  resolveSubscriptionPlan,
} from "../../../lib/subscription.js";

interface StripeSubscription {
  id?: string;
  status?: string;
  current_period_end?: number;
  metadata?: Record<string, string>;
  items?: { data?: Array<{ price?: { id?: string }; current_period_end?: number }> };
}

interface StripeSession {
  id?: string;
  subscription?: string;
  client_reference_id?: string;
  metadata?: Record<string, string>;
}

const received = () =>
  new Response(JSON.stringify({ received: true }), {
    headers: { "Content-Type": "application/json" },
  });

export const onRequestPost: PagesFunction<Env> = async (context) => {
  const env = context.env;
  const secret = env.STRIPE_WEBHOOK_SECRET;
  if (!secret) {
    return new Response("Stripe webhook secret not configured.", { status: 501 });
  }

  const payload = await context.request.text();
  const signature = context.request.headers.get("Stripe-Signature");
  if (!(await verifyStripeSignature(payload, signature, secret))) {
    return new Response("Invalid signature.", { status: 400 });
  }

  const event = JSON.parse(payload) as {
    type: string;
    data: { object: Record<string, unknown> };
  };

  await runMigrations(env.DB);

  const productOf = (metadata?: Record<string, string>): string =>
    String(metadata?.product ?? env.SKILLFLUX_PRODUCT ?? "deluxe-pack");
  const prices = {
    monthly: env.STRIPE_PRICE_MONTHLY ?? env.STRIPE_PRICE_ID,
    annual: env.STRIPE_PRICE_ANNUAL,
  };

  switch (event.type) {
    // Subscription lifecycle is authoritative for renewals and cancellation.
    case "customer.subscription.created":
    case "customer.subscription.updated": {
      const sub = event.data.object as StripeSubscription;
      const metadata = sub.metadata ?? {};
      const userId = String(metadata.user_id ?? "");
      const subId = String(sub.id ?? "");
      if (!userId || !subId) return received(); // not one of ours — ignore

      const priceId = sub.items?.data?.[0]?.price?.id;
      const plan = resolveSubscriptionPlan(metadata.plan, priceId, prices);
      const periodEnd = sub.current_period_end ?? sub.items?.data?.[0]?.current_period_end;
      const expiresAt = periodEndIso(periodEnd) ?? expiresAtForPlan(plan);

      await upsertEntitlementByOrderId(env.DB, {
        orderId: subId,
        userId,
        product: productOf(metadata),
        plan,
        status: isActiveSubStatus(sub.status) ? "active" : "canceled",
        source: "stripe",
        expiresAt,
      });
      return received();
    }

    case "customer.subscription.deleted": {
      const sub = event.data.object as StripeSubscription;
      if (sub.id) await markEntitlementCanceledByOrderId(env.DB, String(sub.id));
      return received();
    }

    // Fast-path activation right after checkout. Insert-only so it never clobbers
    // the accurate period end that customer.subscription.* later supplies.
    case "checkout.session.completed": {
      const session = event.data.object as StripeSession;
      const metadata = session.metadata ?? {};
      const userId = String(session.client_reference_id ?? metadata.user_id ?? "");
      const subId = String(session.subscription ?? "");
      if (!userId || !subId) return received(); // ignore non-subscription/no-user sessions

      const plan = resolveSubscriptionPlan(metadata.plan, undefined, prices);
      const existing = await getEntitlementByOrderId(env.DB, subId);
      if (!existing) {
        await grantEntitlement(env.DB, {
          userId,
          product: productOf(metadata),
          plan,
          source: "stripe",
          orderId: subId,
          expiresAt: expiresAtForPlan(plan),
        });
      }

      const checkoutId = String(metadata.checkout_id ?? "");
      if (checkoutId) {
        await env.DB.prepare(
          `UPDATE checkout_sessions SET status = 'completed', completed_at = ?, provider_ref = ? WHERE id = ?`,
        )
          .bind(nowIso(), subId, checkoutId)
          .run();
      }
      return received();
    }

    default:
      return received();
  }
};
