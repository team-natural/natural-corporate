// Worker entry (wrangler.jsonc `main`). Requests go to Astro unchanged; the only addition is
// the Cron Trigger for the daily batch (OPS-02 §4-3). @astrojs/cloudflare ≥ 13 expects this
// shape instead of the old `workerEntryPoint` option.
import { handle } from "@astrojs/cloudflare/handler";
import { createDb } from "@app/schema/client";
import { runDailyJobs } from "./lib/server/jobs/daily";

export default {
  fetch(request, env, ctx) {
    return handle(request, env, ctx);
  },
  scheduled(_event, env, ctx) {
    ctx.waitUntil(runDailyJobs(createDb(env.DB)));
  },
} satisfies ExportedHandler<Env>;
