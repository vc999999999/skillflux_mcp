// Fixture mode is a development-only bypass that grants entitlement without a
// real SSO/payment provider. It must be impossible to enable on the production
// host even if the env flag is misconfigured, so callers require BOTH:
//   1. SKILLFLUX_FIXTURE_MODE === "1", and
//   2. the request host is not the production site host.
//
// Production deploys must NOT set SKILLFLUX_FIXTURE_MODE (see wrangler.toml).

const PROD_HOSTS = new Set(["skillflux.cn", "www.skillflux.cn"]);

export function isFixtureEnabled(env: Env, request?: Request): boolean {
  if (env.SKILLFLUX_FIXTURE_MODE !== "1") return false;

  // No request context (e.g. internal call): flag alone gates it. Production
  // never sets the flag, so this stays off in production.
  if (!request) return true;

  let host: string;
  try {
    host = new URL(request.url).hostname.toLowerCase();
  } catch {
    return false;
  }

  if (PROD_HOSTS.has(host)) return false;

  if (env.SITE_URL) {
    try {
      const siteHost = new URL(env.SITE_URL).hostname.toLowerCase();
      if (host === siteHost) return false;
    } catch {
      // Malformed SITE_URL — ignore and fall through to the flag decision.
    }
  }

  return true;
}
