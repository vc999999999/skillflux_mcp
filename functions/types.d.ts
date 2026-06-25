interface Env {
  DB: D1Database;
  SKILLFLUX_FIXTURE_MODE?: string;
  // Free public beta: when "1", any logged-in user gets full (deluxe) access
  // without payment. Flip to off + configure Stripe prices to start charging.
  SKILLFLUX_FREE_BETA?: string;
  SKILLFLUX_API_DEV_TOKEN?: string;
  SITE_URL?: string;
  GITHUB_CLIENT_ID?: string;
  GITHUB_CLIENT_SECRET?: string;
  STRIPE_SECRET_KEY?: string;
  STRIPE_WEBHOOK_SECRET?: string;
  STRIPE_PRICE_ID?: string; // legacy single price; prefer the per-plan ids below
  STRIPE_PRICE_MONTHLY?: string;
  STRIPE_PRICE_ANNUAL?: string;
  SKILLFLUX_PRODUCT?: string;
}

type PagesFunction<E = Env> = (context: {
  request: Request;
  env: E;
  params: Record<string, string>;
  waitUntil: (promise: Promise<unknown>) => void;
  next: () => Promise<Response>;
  data: Record<string, unknown>;
}) => Response | Promise<Response>;
