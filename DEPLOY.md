# Deploying NaviTBI

Five minutes to a public URL. Two routes, and the difference between them is not
cosmetic — read the constraint first.

## The constraint

Session state lives in memory, keyed on `globalThis`. That is fine on one
long-running server and wrong on serverless: each instance gets its own store,
so a share link minted by one would 404 on another and a check-in would vanish
between requests.

**So: deploy as a single container, not as serverless functions.** Vercel's
default model is the wrong shape for this build until `src/db/schema.ts` is
wired up — the schema is written and tested against the app's shapes, and
`src/db/store.ts` was built with a narrow accessor boundary for exactly that
swap, but the swap is not done.

## Required environment variable

```
NAVITBI_SESSION_SECRET=<32+ random bytes, hex>
```

Generate one with `openssl rand -hex 32`.

This is not optional in production. Without it, `src/auth/actor.ts` falls back to
a per-process random key, so the cookie issued by one process fails to verify in
another and every mutation is rejected as forged. It must be the same value for
the lifetime of the deployment.

## Route A — Render (recommended, no CLI)

1. Push this repo to GitHub.
2. render.com → **New → Web Service** → connect the repo.
3. Runtime **Docker**. Render finds the `Dockerfile` at the root.
4. Instance type: **Starter** or free. Set **instances = 1** — more than one
   reintroduces the split-store problem above.
5. Environment → add `NAVITBI_SESSION_SECRET`.
6. Deploy. The URL appears when the health check passes.

## Route B — Fly.io (CLI)

```bash
brew install flyctl && fly auth login
fly launch --no-deploy            # accept the detected Dockerfile
fly secrets set NAVITBI_SESSION_SECRET=$(openssl rand -hex 32)
fly scale count 1                 # one instance, for the reason above
fly deploy
```

## Verify a deployment

```bash
curl -sI https://<your-url>/ | grep -iE 'content-security-policy|x-frame|strict-transport'
curl -sI https://<your-url>/s/anything | grep -i x-robots-tag
```

Both should return values: the CSP with a per-request nonce, and `noindex` on
share routes. Then open the site, pick a patient, create a share link and open
it in a private window — that exercises the acting-as cookie, the token, and the
recipient view in one pass.

## What a visitor should be told

This is a demonstration instance seeded with synthetic patients. State resets
when the container restarts, and nothing here is validated in humans. Do not put
real patient data into it.
