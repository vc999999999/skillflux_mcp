import { nowIso, runMigrations } from "./db.js";
import { randomId } from "./crypto.js";
import type { AuthContext } from "./catalog.js";
import { tiersForPlan } from "./entitlement.js";

export interface EntitlementRow {
  id: string;
  user_id: string;
  product: string;
  plan: string;
  status: string;
  source: string;
  order_id: string | null;
  created_at: string;
  expires_at: string | null;
}

export async function ensureDb(db: D1Database): Promise<void> {
  await runMigrations(db);
}

/**
 * Pure selection of the effective entitlement from a candidate set.
 * An entitlement counts only if it is active AND not expired (lifetime grants
 * store expires_at = NULL; subscriptions store a future timestamp). Prefers a
 * lifetime grant, then the newest non-expired entitlement. ISO-8601 UTC strings
 * compare lexicographically, so string `>` is a valid time comparison.
 */
export function pickActiveEntitlement(
  rows: EntitlementRow[],
  now: string = nowIso(),
): EntitlementRow | null {
  const live = rows.filter(
    (row) => row.status === "active" && (row.expires_at === null || row.expires_at > now),
  );
  if (live.length === 0) return null;
  live.sort((a, b) => {
    const aLifetime = a.expires_at === null ? 1 : 0;
    const bLifetime = b.expires_at === null ? 1 : 0;
    if (aLifetime !== bLifetime) return bLifetime - aLifetime;
    if (a.created_at === b.created_at) return 0;
    return a.created_at > b.created_at ? -1 : 1;
  });
  return live[0];
}

export async function getActiveEntitlement(
  db: D1Database,
  userId: string,
  product: string,
): Promise<EntitlementRow | null> {
  // Fetch all active rows for this user+product (a tiny set) and apply expiry
  // selection in JS so the logic stays unit-testable and single-sourced.
  const result = await db
    .prepare(`SELECT * FROM entitlements WHERE user_id = ? AND product = ? AND status = 'active'`)
    .bind(userId, product)
    .all<EntitlementRow>();
  return pickActiveEntitlement(result.results ?? [], nowIso());
}

export async function getEntitlementByOrderId(
  db: D1Database,
  orderId: string,
): Promise<EntitlementRow | null> {
  return db
    .prepare(`SELECT * FROM entitlements WHERE order_id = ? LIMIT 1`)
    .bind(orderId)
    .first<EntitlementRow>();
}

export async function grantEntitlement(
  db: D1Database,
  input: {
    userId: string;
    product: string;
    plan: string;
    source: string;
    orderId?: string;
    expiresAt?: string | null;
  },
): Promise<EntitlementRow> {
  const id = randomId("ent_");
  const createdAt = nowIso();
  await db
    .prepare(
      `INSERT INTO entitlements (id, user_id, product, plan, status, source, order_id, created_at, expires_at)
       VALUES (?, ?, ?, ?, 'active', ?, ?, ?, ?)`,
    )
    .bind(
      id,
      input.userId,
      input.product,
      input.plan,
      input.source,
      input.orderId ?? null,
      createdAt,
      input.expiresAt ?? null,
    )
    .run();

  return {
    id,
    user_id: input.userId,
    product: input.product,
    plan: input.plan,
    status: "active",
    source: input.source,
    order_id: input.orderId ?? null,
    created_at: createdAt,
    expires_at: input.expiresAt ?? null,
  };
}

/**
 * Insert or update the entitlement identified by a provider order id
 * (the Stripe subscription id). Used to keep a single row in sync across the
 * subscription lifecycle: created → renewed (new expires_at) → canceled.
 */
export async function upsertEntitlementByOrderId(
  db: D1Database,
  input: {
    orderId: string;
    userId: string;
    product: string;
    plan: string;
    status: string;
    source: string;
    expiresAt: string | null;
  },
): Promise<void> {
  const existing = await getEntitlementByOrderId(db, input.orderId);
  if (existing) {
    await db
      .prepare(
        `UPDATE entitlements SET plan = ?, status = ?, expires_at = ? WHERE order_id = ?`,
      )
      .bind(input.plan, input.status, input.expiresAt, input.orderId)
      .run();
    return;
  }
  await grantEntitlement(db, {
    userId: input.userId,
    product: input.product,
    plan: input.plan,
    source: input.source,
    orderId: input.orderId,
    expiresAt: input.expiresAt,
  });
  if (input.status !== "active") {
    await db
      .prepare(`UPDATE entitlements SET status = ? WHERE order_id = ?`)
      .bind(input.status, input.orderId)
      .run();
  }
}

export async function markEntitlementCanceledByOrderId(
  db: D1Database,
  orderId: string,
): Promise<void> {
  await db
    .prepare(`UPDATE entitlements SET status = 'canceled' WHERE order_id = ?`)
    .bind(orderId)
    .run();
}

export function authContextFromEntitlement(
  userId: string,
  entitlement: EntitlementRow | null,
): AuthContext {
  if (!entitlement) {
    return { userId, plan: "free", tiers: tiersForPlan("free") };
  }
  const plan = entitlement.plan as AuthContext["plan"];
  return { userId, plan, tiers: tiersForPlan(plan) };
}

export function hasDeluxeAccess(auth: AuthContext): boolean {
  return auth.tiers.includes("deluxe");
}
