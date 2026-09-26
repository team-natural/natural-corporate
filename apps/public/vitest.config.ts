import { existsSync } from "node:fs";
import path from "node:path";
import { cloudflareTest, readD1Migrations } from "@cloudflare/vitest-plugin";
import { defineConfig } from "vitest/config";

// Bindings are declared inline rather than through `wrangler.configPath`: wrangler.jsonc's
// `main` is the Astro adapter entrypoint, which these tests never build. Keep them in sync.
const migrationsPath = path.join(import.meta.dirname, "../../packages/schema/migrations");

export default defineConfig(async () => ({
  test: {
    projects: [
      {
        plugins: [
          cloudflareTest({
            miniflare: {
              compatibilityDate: "2026-08-01",
              compatibilityFlags: ["nodejs_compat"],
              d1Databases: ["DB"],
              kvNamespaces: ["KV"],
              bindings: {
                TEST_MIGRATIONS: existsSync(migrationsPath) ? await readD1Migrations(migrationsPath) : [],
                SESSION_TTL_DAYS: "30",
                AUTH_LOCKOUT_MAX_ATTEMPTS: "5",
                AUTH_LOCKOUT_MINUTES: "15",
              },
            },
          }),
        ],
        test: {
          name: "workerd",
          include: ["tests/unit/**/*.test.ts"],
          setupFiles: ["./tests/setup.ts"],
        },
      },
      {
        // Pure functions with no D1: kept off workerd so the migrations check in tests/setup.ts
        // cannot take the diagnosis suite down with it.
        test: {
          name: "node",
          include: ["tests/scoring/**/*.test.ts"],
        },
      },
    ],
  },
}));
