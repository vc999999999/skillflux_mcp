# Free Public Beta (free-beta branch)

This branch runs SkillFlux as a **free beta**: users still log in (GitHub OAuth),
but every logged-in user unlocks **all** skills — including deluxe — with **no
payment**. It exists so you can launch an internal/free beta before the billing
paperwork is done, then switch to paid by flipping one flag.

## How it works

A single switch drives it: `SKILLFLUX_FREE_BETA = "1"` (set in `wrangler.toml`).

When on, the registry treats any authenticated device as a `beta` plan with
`["free", "deluxe"]` tiers:
- `functions/lib/entitlement.ts` — `isFreeBeta(env)` and `freeBetaAuthContext`,
  plus the `beta` plan in `tiersForPlan`.
- `functions/lib/auth.ts` — `authenticate()` and `resolveDeviceStatus()` return
  the beta context once a valid login exists, skipping the entitlement/payment
  check entirely.

Everything else is unchanged from `main`:
- Login is still required, so beta users are real accounts (you can rate-limit,
  count, and later migrate them to paid).
- Paid skill payloads are still kept out of the public npm package.
- The full subscription billing code is still present — just dormant while the
  flag is on.

## Requirements to deploy the beta

- GitHub OAuth configured: `GITHUB_CLIENT_ID`, `GITHUB_CLIENT_SECRET`.
- A D1 database bound as `DB`.
- `SKILLFLUX_FREE_BETA = "1"` (already set on this branch).
- Stripe is **not** required while in free beta.

## Switching to paid (when billing is ready)

1. Create the monthly + annual recurring Prices in Stripe; set
   `STRIPE_PRICE_MONTHLY`, `STRIPE_PRICE_ANNUAL`, `STRIPE_SECRET_KEY`,
   `STRIPE_WEBHOOK_SECRET` as secrets.
2. Set `SKILLFLUX_FREE_BETA = "0"` (or remove it).
3. Deploy `main` (or merge `main` into this branch and deploy).

With the flag off, `authenticate()`/`resolveDeviceStatus()` fall back to the
entitlement + subscription logic on `main`: logged-in users without an active
subscription get `needs_payment`, and the manager skill prompts for the
monthly/annual checkout.

Existing beta users are unaffected by the switch — they simply need to subscribe
to keep deluxe access, since no entitlement rows were created during the beta.
