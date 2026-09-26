import { spawnSync } from "node:child_process";
import { existsSync } from "node:fs";
import path from "node:path";

// Seeded below rather than read from env vars, so `pnpm test:e2e` works unconfigured.
export const E2E_MEMBER = {
  email: "e2e-member@example.test",
  password: "e2e-only-password",
  name: "E2E Member",
};

// Outbound-mode fixtures for diagnosis-outbound.spec.ts. Token strings are fixed so the spec
// can build URLs; they never leave the local D1.
export const E2E_TOKEN = "e2e-live-token-0123456789abcdefghijklmnopqrstuv";
export const E2E_REVOKED_TOKEN = "e2e-revoked-token-0123456789abcdefghijklmnopqrs";
const E2E_CAMPAIGN_OWNER_EMAIL = "e2e-campaign-owner@example.test";

// Resolved from this file, not the cwd: `playwright test --config apps/public/...` run from the
// repo root would otherwise point wrangler at paths that do not exist.
const appDir = path.join(import.meta.dirname, "../..");
const adminDir = path.join(appDir, "../admin");
const migrationsDir = path.join(appDir, "../../packages/schema/migrations");
// The store the dev server opens (astro.config.mjs `persistState`).
const persist = ["--persist-to", path.join(appDir, "../../.wrangler-state")];

// Run from apps/admin: its wrangler.jsonc owns the shared database (migrations_dir), and the
// seeder lives alongside it.
function runInAdmin(command: string, args: string[]) {
  const result = spawnSync(command, args, { stdio: "inherit", cwd: adminDir });
  if (result.status !== 0) throw new Error(`E2E setup failed: ${command} ${args.join(" ")}`);
}

export default function globalSetup() {
  if (!existsSync(migrationsDir)) {
    throw new Error("No D1 migrations found. Run `pnpm db:generate` from the repo root first.");
  }

  runInAdmin("npx", ["wrangler", "d1", "migrations", "apply", "DB", "--local", ...persist]);

  // Drop only this account, so a developer's own data survives a test run. Sessions go first:
  // member_sessions.member_id has no ON DELETE CASCADE.
  const email = E2E_MEMBER.email.replaceAll("'", "''");
  runInAdmin("npx", ["wrangler", "d1", "execute", "DB", "--local", ...persist, "--command", `DELETE FROM member_sessions WHERE member_id IN (SELECT id FROM members WHERE email = '${email}'); DELETE FROM members WHERE email = '${email}';`]);

  runInAdmin("pnpm", ["seed", "--", "--table=members", `--email=${E2E_MEMBER.email}`, `--password=${E2E_MEMBER.password}`, `--name=${E2E_MEMBER.name}`]);

  // Campaign + tokens, rebuilt on every run so a previous run's saves and expiry never leak in.
  // Order respects the FKs: responses → tokens → campaign → owner.
  const now = new Date().toISOString();
  const expires = new Date(Date.now() + 30 * 86_400_000).toISOString();
  const sql = [`DELETE FROM diagnosis_responses WHERE token_id IN (SELECT id FROM diagnosis_tokens WHERE token IN ('${E2E_TOKEN}', '${E2E_REVOKED_TOKEN}'));`, `DELETE FROM diagnosis_tokens WHERE token IN ('${E2E_TOKEN}', '${E2E_REVOKED_TOKEN}');`, `DELETE FROM leads WHERE campaign_id IN (SELECT id FROM campaigns WHERE public_id = 'E2ECAMPAIGN00000000000000');`, `DELETE FROM campaigns WHERE public_id = 'E2ECAMPAIGN00000000000000';`, `INSERT OR IGNORE INTO admin_users (public_id, name, email, password_hash, role, status, updated_at) VALUES ('E2EOWNER00000000000000000', 'E2E Owner', '${E2E_CAMPAIGN_OWNER_EMAIL}', 'x.y', 'editor', 'active', '${now}');`, `INSERT INTO campaigns (public_id, name, channel, diagnosis_slug, intro_copy, owner_admin_user_id, status, updated_at) VALUES ('E2ECAMPAIGN00000000000000', 'E2E campaign', 'form', 'business', 'E2E キャンペーン向けの入口文言', (SELECT id FROM admin_users WHERE email = '${E2E_CAMPAIGN_OWNER_EMAIL}'), 'active', '${now}');`, `INSERT INTO diagnosis_tokens (token, kind, campaign_id, recipient_ref, diagnosis_slug, expires_at, max_uses, use_count, status, updated_at) VALUES ('${E2E_TOKEN}', 'outbound', (SELECT id FROM campaigns WHERE public_id = 'E2ECAMPAIGN00000000000000'), 'e2e-row-1', 'business', '${expires}', 50, 0, 'active', '${now}');`, `INSERT INTO diagnosis_tokens (token, kind, campaign_id, recipient_ref, diagnosis_slug, expires_at, max_uses, use_count, status, updated_at) VALUES ('${E2E_REVOKED_TOKEN}', 'outbound', (SELECT id FROM campaigns WHERE public_id = 'E2ECAMPAIGN00000000000000'), 'e2e-row-2', 'business', '${expires}', 3, 0, 'revoked', '${now}');`].join(" ");
  runInAdmin("npx", ["wrangler", "d1", "execute", "DB", "--local", ...persist, "--command", sql]);
}
