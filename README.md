# naturaling.jp

Corporate website for 株式会社ナチュラル, on Astro + Cloudflare Workers in a Dev Container.

`apps/public` is the site. `apps/admin` is the template's admin console on a subdomain of the same
service — kept for later, but **nothing on the site reads or writes D1 today**.

Migrated in September 2026 from a standalone Astro 5 fully-static repo
([`team-natural/-natural-corporate`](https://github.com/team-natural/-natural-corporate)). The
published URLs are indexed and must not change; `apps/public/public/_redirects` still carries the
301s from the pre-Astro `.html` URLs.

- **Implementation rules and the constraints that are not visible in the code**: `CLAUDE.md`
- **Specifications**: `docs/` (25 documents; `docs/00_README.md` first)

## What the site is made of

| | |
| --- | --- |
| Pages | 12 corporate pages + 404 / 500, all prerendered |
| News | Markdown in `packages/content/news/`; the filename is the URL |
| Diagnoses | Two self-contained quiz apps under `/diagnosis/` |
| Contact | `/contact/` → `POST /api/contact/` → Turnstile + Resend. No database |

## Getting started

Prerequisites: Docker, and VS Code with the
[Dev Containers extension](https://marketplace.visualstudio.com/items?itemName=ms-vscode-remote.remote-containers)
(or GitHub Codespaces).

**Dev Containers: Reopen in Container**. `.devcontainer/setup.sh` runs on first start —
`pnpm install`, the MCP servers, and Chromium for Playwright. Claude Code's auth lives in a named
volume rather than a host mount, so **each project container needs its own login** (`claude`).

```bash
pnpm dev      # public on 5176, admin on 5177 (set in .devcontainer/.env)
```

The site runs with no further setup. To exercise the contact form locally, copy
`apps/public/.dev.vars.example` to `apps/public/.dev.vars` — the Turnstile keys in it are
Cloudflare's always-pass test keys, so only `RESEND_API_KEY` needs a real value.

## Remaining setup

Everything below is still outstanding. None of it blocks local development.

### 1. Cloudflare resources

```bash
npx wrangler login
npx wrangler d1 create <db-name>
npx wrangler r2 bucket create <bucket-name>
npx wrangler kv namespace create KV
```

Replace every `replace-with-*` placeholder in **both** `wrangler.jsonc` files, including the
`staging` and `production` blocks (`vars`, `d1_databases` and `kv_namespaces` are non-inheritable,
which is why they repeat). `database_id` **must be identical in both apps** — it also keys the
local sqlite file, so a mismatch silently gives each app its own database.

### 2. Custom domains

Neither `wrangler.jsonc` declares `routes`, so a deploy lands on `workers.dev`. The old repository
pointed both apex and www at the Worker; the production block needs the equivalent:

```jsonc
"routes": [
  { "pattern": "naturaling.jp", "custom_domain": true },
  { "pattern": "www.naturaling.jp", "custom_domain": true },
]
```

`custom_domain` means the Worker is the origin, and Cloudflare creates the DNS record and
certificate.

### 3. Contact form credentials

1. **Resend** — add `naturaling.jp` under Domains and register the DKIM records it shows in
   Cloudflare DNS. MX can stay pointed at Google; the two do not conflict. Then issue an API key.
2. **Turnstile** — create a widget for `naturaling.jp` (Managed mode) and note both keys.
3. Register the secrets — Worker-side configuration, so this is a one-off regardless of how you
   deploy:

   ```bash
   cd apps/public
   npx wrangler secret put RESEND_API_KEY
   npx wrangler secret put TURNSTILE_SECRET_KEY
   ```

4. Set `PUBLIC_TURNSTILE_SITE_KEY` as a **Build variable** in the Cloudflare dashboard. It is
   baked into the client at build time, so `wrangler secret put` cannot supply it. **Forget this
   and the form still works** — it falls back to the always-pass test key and only bot filtering
   goes quiet.

Full detail: `docs/3-development/08-deployment.md` §8.

### 4. Schema and migrations

```bash
pnpm db:generate    # → packages/schema/migrations/ — commit this
pnpm db:migrate     # applies to the shared local D1
pnpm --filter admin seed -- --table=admin_users --email=… --password=… --name=…
```

Until this runs, `packages/schema/migrations/` does not exist and every D1-backed unit test fails
by design. **CI runs `pnpm db:generate` itself**, so a green build does not mean the migration is
committed — generate locally and commit the result, or production D1 gets SQL that no one reviewed.

`migrations/` is generated per project, not shipped. If you ever delete it, delete
`.wrangler-state/` too — regenerating picks a new random filename and the next apply fails on
`table already exists`.

### 5. Deployment

`dev` is the default branch and CI runs on it. `main` does not exist yet; DEV-08 §2 expects it to
be the production trigger. CD is Cloudflare Workers Builds (GitHub-connected, configured in the
dashboard, not in this repo) — set Root directory, **Build Watch Paths** so a change to
`apps/public` does not redeploy `apps/admin`, and prefix the admin Deploy command with
`wrangler d1 migrations apply`.

## Day-to-day

| Command | |
| --- | --- |
| `pnpm dev` | Both apps. Stop with `pnpm --filter public exec astro dev stop` — `astro dev` detaches when it detects an AI coding agent |
| `pnpm check` | format + lint + typecheck + unit tests |
| `pnpm test` / `pnpm test:e2e` | Vitest (inside workerd) / Playwright |
| `pnpm build` | Never while that app's dev server is up — it rewrites `node_modules/.vite` and every later request 500s until the dev server restarts |
| `pnpm db:generate` / `pnpm db:migrate` | Drizzle → migration SQL → local D1 |

Two things that bite before anything else, both in `CLAUDE.md`: `trailingSlash: "always"` applies
to API routes and redirects as well as pages, and every content page needs
`export const prerender = true`.
