# Deploying the SkillFlux registry (Cloudflare Pages + D1)

This deploys the registry API (`functions/`) that the `skillflux` npm client
talks to. The marketing site (skillflux.cn) lives in the separate
`Skillflux_Cloudflare` repo.

Two deploy targets:
- **`main`** — paid product (Stripe monthly/annual subscriptions).
- **`free-beta`** — free public beta: login required, but everyone unlocks all
  skills, no payment. See [docs/FREE_BETA.md](docs/FREE_BETA.md).

## 0. Prerequisites

- A Cloudflare account.
- `wrangler` logged in: `npx wrangler login`.
- Node 20+.

## 1. Create the D1 database

```bash
npx wrangler d1 create skillflux
```

Copy the printed `database_id` into [`wrangler.toml`](wrangler.toml) (it ships
with a `00000000-…` placeholder).

## 2. Create the tables

```bash
npm run db:migrate        # remote D1 (production)
# local dev DB instead:  npm run db:migrate:local
```

(The API also auto-creates tables on first request, but running this is cleaner.)

## 3. Configure GitHub OAuth (required — login is always needed)

Create a GitHub OAuth App:
- Homepage URL: your site, e.g. `https://skillflux.cn`
- Authorization callback URL: `https://<your-domain>/api/auth/callback/github`

Then set the secrets on the Pages project:

```bash
npx wrangler pages secret put GITHUB_CLIENT_ID
npx wrangler pages secret put GITHUB_CLIENT_SECRET
```

If you deploy to a domain other than `skillflux.cn`, update `SITE_URL` in
`wrangler.toml` (it drives the OAuth redirect).

## 4. (main / paid only) Configure Stripe

Skip this for the free beta. For the paid `main` branch, create two recurring
Prices (monthly + annual) in Stripe, then:

```bash
npx wrangler pages secret put STRIPE_SECRET_KEY
npx wrangler pages secret put STRIPE_WEBHOOK_SECRET
npx wrangler pages secret put STRIPE_PRICE_MONTHLY
npx wrangler pages secret put STRIPE_PRICE_ANNUAL
```

Point a Stripe webhook at `https://<your-domain>/api/webhooks/payment/stripe`
for `checkout.session.completed` and `customer.subscription.*` events.

## 5. Deploy

```bash
npm run deploy
```

This regenerates `functions/_pack/catalog.json` from `pack.json` (it is a
git-ignored build artifact) and runs `wrangler pages deploy public`.

## 6. Verify

```bash
# Public metadata (free tier only, no auth):
curl -s https://<your-domain>/api/pack | jq .
```

Then connect an agent:

```bash
npx -y skillflux install
# The client now defaults to the live registry (https://skillflux.cn/api).
# If you deployed elsewhere, set SKILLFLUX_API_URL for testers:
#   export SKILLFLUX_API_URL=https://<your-domain>/api
```

In the agent, ask it to install a skill — it will prompt a browser login, then
(on free-beta) unlock everything.

## Switching free beta → paid later

Set `SKILLFLUX_FREE_BETA = "0"` (or remove it), complete step 4, and deploy
`main`. See [docs/FREE_BETA.md](docs/FREE_BETA.md).
