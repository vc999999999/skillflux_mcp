import { getEntitlementByOrderId, grantEntitlement } from "../../lib/entitlements-db.js";
import { expiresAtForPlan } from "../../lib/entitlement.js";
import { isFixtureEnabled } from "../../lib/fixture.js";

export const onRequestGet: PagesFunction<Env> = async (context) => {
  if (!isFixtureEnabled(context.env, context.request)) {
    return new Response("Not found", { status: 404 });
  }

  const url = new URL(context.request.url);
  const userId = url.searchParams.get("user");
  if (!userId) {
    return new Response("Missing user.", { status: 400 });
  }

  // Optional ?plan=monthly|annual to exercise subscription expiry locally;
  // defaults to a non-expiring lifetime grant for the simple smoke flow.
  const planParam = url.searchParams.get("plan");
  const plan = planParam === "monthly" || planParam === "annual" ? planParam : "lifetime";

  const product = context.env.SKILLFLUX_PRODUCT ?? "deluxe-pack";
  // Stable order id per user+plan so re-opening the fixture page is idempotent.
  const orderId = `fixture-${userId}-${plan}`;
  const existing = await getEntitlementByOrderId(context.env.DB, orderId);
  if (!existing) {
    await grantEntitlement(context.env.DB, {
      userId,
      product,
      plan,
      source: "fixture",
      orderId,
      expiresAt: expiresAtForPlan(plan),
    });
  }

  return new Response(
    `<!doctype html><html><body><h1>SkillFlux fixture checkout complete</h1><p>You can return to your agent and run auth.status again.</p></body></html>`,
    { headers: { "Content-Type": "text/html; charset=utf-8" } },
  );
};
