import { authenticate, json, parseBearerToken } from "../lib/auth.js";
import { isFixtureEnabled } from "../lib/fixture.js";
import { createStripeCheckout, isStripeConfigured } from "../lib/stripe.js";
import type { SubscriptionPlan } from "../lib/subscription.js";

export const onRequestPost: PagesFunction<Env> = async (context) => {
  const token = parseBearerToken(context.request);
  if (!token) {
    return json({ ok: false, code: "UNAUTHORIZED", message: "Bearer token required." }, 401);
  }

  const auth = await authenticate(context.request, context.env);
  if (auth instanceof Response) return auth;

  let body: { product?: string; plan?: string } = {};
  try {
    body = (await context.request.json()) as typeof body;
  } catch {
    body = {};
  }

  const product = body.product ?? context.env.SKILLFLUX_PRODUCT ?? "deluxe-pack";
  const plan: SubscriptionPlan = body.plan === "annual" ? "annual" : "monthly";
  if (body.plan && body.plan !== "monthly" && body.plan !== "annual") {
    return json(
      { ok: false, code: "INVALID_INPUT", message: "plan must be 'monthly' or 'annual'." },
      400,
    );
  }

  try {
    if (isStripeConfigured(context.env, plan)) {
      const checkout = await createStripeCheckout(context.env, context.request, auth.userId, product, plan);
      return json({
        ok: true,
        message: `Stripe ${plan} subscription checkout session created.`,
        data: { checkoutUrl: checkout.checkoutUrl, plan },
      });
    }
  } catch (error) {
    return json(
      {
        ok: false,
        code: "CHECKOUT_FAILED",
        message: error instanceof Error ? error.message : String(error),
      },
      502,
    );
  }

  if (isFixtureEnabled(context.env, context.request)) {
    const origin = new URL(context.request.url).origin;
    return json({
      ok: true,
      message: "Fixture checkout URL (complete in browser to grant entitlement).",
      data: {
        checkoutUrl: `${origin}/api/checkout/fixture-complete?user=${encodeURIComponent(auth.userId)}`,
      },
    });
  }

  return json(
    {
      ok: false,
      code: "NOT_CONFIGURED",
      message: "No hosted checkout provider configured.",
    },
    501,
  );
};

export const onRequestOptions: PagesFunction = async () =>
  new Response(null, {
    status: 204,
    headers: {
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Methods": "POST, OPTIONS",
      "Access-Control-Allow-Headers": "Authorization, Content-Type",
    },
  });
