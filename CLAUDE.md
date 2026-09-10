# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## About this project

Corporate website for 株式会社ナチュラル (naturaling.jp), built on the team's Astro SSR + Cloudflare
Workers template. `apps/public` is the site; `apps/admin` is the template's admin console, kept but
not yet used — **nothing on the site reads or writes D1 today**.

Migrated in September 2026 from a standalone Astro 5 fully-static repo. Two consequences explain
most of what looks unusual here:

- **Published URLs are frozen.** The site is indexed, and `public/_redirects` still carries 301s
  from the pre-Astro `.html` URLs. Changing a URL is an SEO regression, not a refactor.
- **Almost every page is `prerender = true`.** The template is SSR-first; this site is not.

## Commands

| Command | Notes |
| --- | --- |
| `pnpm dev` | Both apps. This project runs public on 5176 and admin on 5177 (`.devcontainer/.env`); 5173/5174 are only the fallback in `astro.config.mjs` |
| `pnpm check` | format + lint + typecheck + unit tests |
| `pnpm test` | Vitest, all packages |
| `pnpm test:e2e` | Playwright. Requires `pnpm db:generate` first |
| `pnpm build` | |
| `pnpm db:generate` | Drizzle → `packages/schema/migrations/` |
| `pnpm db:migrate` | Applies to the shared local D1 |
| `pnpm --filter admin seed -- --table=admin_users --email=… --password=… --name=…` | `--table=members` for the public side. Values need `=`, not a space |

`pnpm db:generate` **has not been run for this project yet**, so `packages/schema/migrations/` does
not exist and every D1-backed unit test fails by design. Decide first whether the public-side
member login stays (`members` / `member_sessions`, `/login/`, `/mypage/` — none of it is reachable
from the site's navigation): after the first generate, dropping a table is a migration, not a
deletion.

## URLs and rendering

`site` and `trailingSlash: "always"` are set in `apps/public/astro.config.mjs`. Both are
load-bearing:

- Subpage URLs are directory-style with a trailing slash (`/about/`). Canonical and `og:url` come
  from `new URL(path, Astro.site)` in the layout, and `public/sitemap.xml` uses the same form. Dev
  404s on `/about` — deliberate strictness that catches bad internal links before production
  silently redirects them.
- **It applies to API routes and redirects too**, not just page links. Every internal target needs
  the slash: `fetch("/api/contact/")`, `Astro.redirect("/login/")`, `location.replace("/mypage/")`.
  A slash-less one is a 404, and nothing catches it until someone clicks. Sweep for new ones with
  `grep -rnoE '(fetch|redirect|replace|assign)\("(/[a-z0-9v/_-]*[a-z0-9])"' apps/public/src`.

`output: "server"` server-renders every page by default and **silently ignores
`getStaticPaths()`**. Every content page therefore carries `export const prerender = true` —
without it `news/[slug]` and the diagnosis result routes render with no props at all.
`apps/public/tests/e2e/` guards this.

`public/sitemap.xml` is hand-maintained. Adding a page or a news post means editing it.

## Pages and chrome

- `src/layouts/BaseLayout.astro` owns the whole HTML skeleton: `<head>` (title, description,
  canonical, OGP — all from props), favicon, Google Fonts, global CSS, GA4, and the shared chrome
  (Header → `<slot />` → ContactBanner → Footer → `main.js`). Pages pass `title`, `description`
  and `path`; `ogImage` overrides the default image, `noindex` swaps canonical for a robots meta.
- Shared chrome lives in `src/components/` — not `src/lib/components/`, which holds the template's
  Svelte islands. Anchor links use the `/#section` form so they work from subpages, and the
  pre-footer CTA comes from the layout: never re-inline `<ContactBanner />` into a page.
- `{` and `}` in Japanese copy are Astro expression syntax — escape as `&#123;` or wrap in `is:raw`.
- A `<script src="...">` in a component is bundled by Vite. That is how `main.js` loads — do not
  add `is:inline` to it.

## Styling

Tailwind v4, CSS-first. There is no `tailwind.config.js` — the `@theme` block in
`src/styles/global.css` holds the `natural-*` palette, fonts and keyframes.

- `#site-header.scrolled` sits deliberately **outside** any `@layer`: unlayered CSS must beat the
  `bg-transparent` utility. Don't move it into a layer.
- Every `<section id="...">` reachable by an anchor needs `scroll-mt-24`, or its heading lands
  under the fixed header.
- `src/styles/` holds every stylesheet — `global.css` site-wide, plus one file per feature area
  imported only by that feature's layout (`diagnosis.css` ← `DiagnosisLayout.astro`). Don't grow
  `global.css` with section-specific rules.

## Page behaviour

`src/js/main.js` is the only client entry point: AOS init, `.scrolled` past 80px, and the mobile
drawer. AOS and Font Awesome are npm dependencies imported there, not CDN tags; only Google Fonts
loads from a CDN.

The drawer's checkbox, overlay and nav must stay **siblings of `<header>`**, never descendants:
`.scrolled`'s `backdrop-filter` turns the header into a containing block, which would trap the
fixed drawer inside it.

GA4's snippet uses `arguments`, so `prefer-rest-params` is disabled on that one line in both
layouts. Rest parameters push a real array, which gtag.js does not read the same way — the rule's
autofix silently stops hits being recorded.

## Content

News posts are developer-maintained Markdown in `packages/content/news/`, loaded by
`apps/public/src/content.config.ts` with `newsSchema` from `@app/content`. **The filename is the
URL** — `/news/<filename>/` is indexed, so renaming a published post breaks it.

Astro 7 defaults to the Sätteri Markdown processor, which does not run rehype plugins.
`astro.config.mjs` pins `processor: unified()` so `rehype-external-links` keeps rendering the
already-published posts exactly as they are.

Client-maintained content belongs in D1 with an admin screen; developer-maintained content belongs
in `packages/content`. Prefer Content Collections when the choice is open — it costs no D1 reads.

## Diagnoses (`/diagnosis/`)

Lead-gen quiz mini-apps at `/diagnosis/<slug>/`, `/questions/` and `/result/<type>/`.

**Each diagnosis is a self-contained module, deliberately NOT built on a shared engine.** `business`
judges by max-type with a tie-break; `ai-dx` by sum-vs-threshold with a per-axis breakdown — zero
shared scoring code, no `mode` flag anywhere. A third diagnosis means copying the pattern, not
parameterising an existing one. Generalise only once a real case proves the same shape.

- **Shared** (presentation and URL plumbing only): `layouts/DiagnosisLayout.astro`,
  `components/diagnosis/*`, `styles/diagnosis.css`, and `lib/diagnosis/routes.ts` (path builders,
  `DIAGNOSIS_CTA_HREF`, `diagnosisContactHref`).
- **Not shared** (all inside `src/diagnoses/<slug>/`): question data, types, scoring, the result
  UI component, and the two client scripts.
- `diagnosis.css` stays one file — its classes are visual primitives. A diagnosis needing one-off
  visuals puts them in its own component, not here.
- Material Symbols load from a CDN in `DiagnosisLayout.astro`. Size them through
  `.diagnosis-icon-lg` / `.diagnosis-icon-sm`, never bare Tailwind text-size utilities — Google's
  unlayered stylesheet beats `@layer utilities` regardless of `<link>` order.
- `pages/diagnosis/index.astro` is the portal and uses `BaseLayout`, not `DiagnosisLayout`: it is
  meant to be browsed with the global nav. It lists `data/diagnoses-catalog.ts`, a
  presentation-only list kept decoupled from each diagnosis's internal data.

## Contact form

`/contact/` → `POST /api/contact/` → `lib/server/services/contact.ts`: Turnstile verify, then a
notification mail and an auto-reply via Resend. **Nothing is persisted** — the `inquiries` table
exists in the schema but this site does not use it.

- The route answers `{ ok, error }` rather than server-kit's `jsonItem` / `toErrorResponse`
  envelope, because the already-deployed form script reads those two fields.
- An auto-reply failure must not fail the request — the inquiry has already reached the company.
- A filled honeypot returns 200 without sending.
- The Zod schema in `lib/contact/schema.ts` is shared by the client script and the route so
  validation cannot drift between them.
- Needs `RESEND_API_KEY` and `TURNSTILE_SECRET_KEY` as Workers Secrets, `CONTACT_NOTIFY_TO` /
  `CONTACT_FROM` as vars, and `PUBLIC_TURNSTILE_SITE_KEY` as a **build** variable (it is embedded
  client-side, so `wrangler secret put` cannot supply it). Locally, copy `.dev.vars.example` to
  `.dev.vars`; the fallback site key is Cloudflare's always-pass test key.

## Container

`docker-compose.yml` mounts only this repository at `/workspace`; sibling projects on the host are
deliberately invisible. The container just `sleep infinity`s and devcontainer tooling execs in.
Node 24 and the `claude` CLI come from Dev Container Features, so nothing is installed on the host.

Claude Code's auth lives in a named volume (`claude-config` at `/home/vscode/.claude`), not a host
bind mount, so **each project container needs its own `claude` login**. The volume is root-owned on
creation, which is why `setup.sh` chowns it on every `postCreateCommand`.

`setup.sh` also runs `corepack enable` + `pnpm install`, and installs `context-mode`,
`@playwright/mcp` and Chromium. `Dockerfile` adds `uv`, which the Semble MCP server needs.

Ports are published by docker compose only (`devcontainer.json` has no `forwardPorts`), bound to
`127.0.0.1`.

## Local database

Both apps open the same store: `persistState: { path: "../../.wrangler-state" }` in each
`astro.config.mjs`, and every wrangler CLI call passes `--persist-to ../../.wrangler-state`. Drop
that flag and you silently get a second, empty database. `database_id` must be identical in both
apps' `wrangler.jsonc` — it also keys the local sqlite file, so a mismatch gives each app its own
database with no error.

`packages/schema/migrations/` is generated, not shipped — this project generates its own and
commits them. Two consequences:

- Deleting `migrations/` means deleting `.wrangler-state/` too. Regenerating produces a new random
  filename, which no longer matches what `d1_migrations` recorded, and the next apply fails with
  `table already exists`.
- Deleting only the `.sql` file leaves `meta/`, and drizzle-kit then reports "no changes" and
  generates nothing.

## Dev servers

`astro dev` **detaches into the background** when it detects an AI coding agent, so it survives the
shell that started it. Stop it with `pnpm --filter public exec astro dev stop`, not by killing the
foreground process. Playwright sets `ASTRO_DEV_BACKGROUND=0` for the same reason.

Never run `astro build` in an app while its dev server is up: the build rewrites
`node_modules/.vite`, and every subsequent request 500s with a stale dep-optimizer error until the
dev server is restarted. Stop it first, or pass a free `APP_INSPECTOR_PORT_PUBLIC`.

Each app pins its own `inspectorPort` (env-overridable), because an explicit port loses wrangler's
automatic fallback and both apps would otherwise fight over 9229.

Dev/inspector ports come from `.devcontainer/.env` (`APP_PORT_DEV_*`), which docker compose both
publishes and puts in the container environment. **Turborepo runs in strict env mode**, so a
variable reaching a task also has to be listed in `turbo.json`'s `globalPassThroughEnv` — otherwise
`pnpm dev` silently falls back to the `?? 5173` default in `astro.config.mjs` while
`pnpm --filter public exec astro dev` honours it. Add any new env var there too.
`devcontainer.json`'s `portsAttributes` keys are literal numbers and must match the `.env`.

`apps/admin` delays dev startup by 2.5s. Both apps recovering the shared WAL at once kills one of
them; letting `apps/public` go first avoids it.

Builds need `NODE_OPTIONS=--dns-result-order=ipv4first` — Node resolves `localhost` to `::1` while
the prerender fetch listens on `127.0.0.1`. It is set both in `devcontainer.json` and in each
app's `build` script, so CI works too.

## Deploying

`wrangler deploy` does not read `wrangler.jsonc`. The Cloudflare adapter resolves it at build time
and writes `dist/server/wrangler.json`, which is what actually ships — so **the environment has to
be chosen when building, not when deploying**:

```bash
CLOUDFLARE_ENV=production pnpm --filter public build && npx wrangler deploy --env production
```

Drop `CLOUDFLARE_ENV` and the `env.production` block is silently ignored: the build falls back to
the top-level bindings and emits no `routes`, so the deploy succeeds and the custom domains never
attach. `--env` alone does not fix it.

## Architecture

```
apps/public   naturaling.jp — the corporate site
apps/admin    admin console (shadcn-svelte lives here only). Not used by this site yet
packages/schema      Drizzle tables, ULID, D1 client
packages/server-kit  password hashing, lockout, session rules, HTTP envelope
packages/content     developer-maintained Markdown (news posts)
```

```
apps/public/src/
  pages/            one .astro per URL; api/contact.ts is the only endpoint
  layouts/          BaseLayout (site) / DiagnosisLayout (diagnosis flows)
  components/       Astro chrome — Header, Footer, ContactBanner, diagnosis/*
  diagnoses/        one self-contained module per diagnosis
  data/             presentation-only lists (case studies, diagnosis catalog)
  lib/              contact + diagnosis helpers, formatDate
  lib/server/       services — the layer API routes call
  lib/components/   the template's Svelte islands (unused by the site)
  styles/           global.css + one file per feature area
  js/main.js        the only client entry point
```

Layering inside an app is `pages/ → services/ → schema`. API routes parse input with Zod, call a
service, and convert thrown `AppError`s with `toErrorResponse` — `/api/contact/` is the one
documented exception to the response envelope. Pages guard themselves: there is no auth
middleware, and unlike an API route a page redirects instead of answering 401.

## Authentication

Dormant on this site — no page links to it, and `middleware.ts` marks `/login`, `/mypage` and
`/api/v1/auth` `X-Robots-Tag: noindex` so they stay out of the index. The header, not a `<meta>`
tag: `/mypage` answers 302 and never renders HTML. The code still ships and the routes still work.

AdminUser and Member sessions never share a table or cookie: an admin token must not authenticate
on the public site. What they do share is `packages/server-kit/src/auth/session.ts` — token
generation, TTL validation and the expiry/status check. Change those in one place.

Two rules that look like implementation details but are not:

- Miss paths (`unknown email`, `deactivated`) still run `burnPasswordVerification`. Returning early
  makes them answer far faster than a real account, which is a usable enumeration oracle.
- A missing `SESSION_TTL_DAYS` or `AUTH_LOCKOUT_*` var must throw. `Number(undefined)` is `NaN`,
  every comparison against it is false, and the lockout would silently never engage.

`apps/public` sets `Cache-Control: private, no-store` on member routes **in middleware**, not in
page frontmatter: `Astro.response.headers` does not reach a `Response` returned from a page, so
redirects would go out cacheable. The admin subdomain needs no equivalent.

Lockout counts per IP as well as per account, and locally every request arrives from `127.0.0.1` —
so five failed attempts lock every account for 15 minutes, and the symptom is a 429 on a password
that is correct. Clear it from `apps/admin`, where both the binary and the relative path resolve:

```bash
npx wrangler kv key list --binding KV --local --persist-to ../../.wrangler-state
npx wrangler kv key delete "auth-lock:ip:127.0.0.1" --binding KV --local --persist-to ../../.wrangler-state
```

## Testing

Unit tests run inside workerd via `@cloudflare/vitest-plugin`, not Node — `hashPassword` needs Web
Crypto and lockout needs a real KV. It peers on `vitest ^4.1.0`; vitest 5 makes miniflare fail to
boot with a bare `SyntaxError`.

E2E seeds its own account in `globalSetup`, so no env vars are needed. `pnpm test:e2e` runs with
`--concurrency=1`: both suites drive a real dev server against the one local D1, and running them
in parallel corrupts it.

Cover what E2E cannot reach — fail-closed config, expiry, timing parity — in Vitest. Cover
hydration and prerendering in E2E: a missing `client:*` directive still renders server-side, and a
missing `prerender = true` still renders the listing page, so only an interaction or a per-post
route catches either.

## MCP servers

Configured in `.mcp.json`, enabled in `.claude/settings.json`.

- `context7` — library/framework docs
- `astro-docs`, `svelte`, `cloudflare-docs` — the official docs servers for this stack. Prefer
  them over `context7` for those three
- `context-mode` — context compression
- `semble` — code search (needs `uv`)
- `playwright` — browser automation. `--browser chromium` is required: the default is branded
  Chrome, which is not installed. `--output-dir` only applies when no filename is given, so asking
  for a named screenshot writes it to the repo root.

## Skills

`.claude/skills/shadcn-svelte/` is vendored verbatim from `huntabyte/shadcn-svelte`
(`skills/shadcn-svelte/`). Never hand-edit it — refresh by replacing the directory. The rest are
this team's own.

`shadcn-svelte` components are added with `npx shadcn-svelte add <component>` from inside
`apps/admin`. The CLI writes tab-indented files, so run `pnpm format` afterwards.

## Editing files

Always create/modify files with the `Edit` / `Write` tools, never `Bash` (`sed`, `echo >`,
heredocs). The PostToolUse hook (`.claude/hooks/format-and-check.sh`) only fires on `Edit`/`Write`
— bypassing it silently skips Prettier, ESLint, and the typecheck that runs after them.

## Comments

Write the code first with no comments, then add back only the ones that survive this test:

**Name the specific mistake the comment prevents. If you cannot name one, delete it.**

"A reader might wonder why" is not a mistake. "Someone will reorder these two calls and orphan a
row" is. Apply it per comment, not per file.

Then:

- **One line.** A second line only to name the consequence. Never a paragraph.
- **State the constraint, not the reasoning that produced it.** `// Bucket first: a row must never
  point at missing bytes.` — not the paragraph about which failure mode is recoverable. The
  reasoning belongs in the commit message, or in `docs/` if it outlives the commit.
- **Say it once per file.** The second and third place cross-reference the first.
- **"Not X" only when someone would plausibly write X.** Ruling out an option nobody would reach
  for is noise.

If comment lines exceed roughly a tenth of a file, that is not a violation but it is a signal —
read them again with the test above.
