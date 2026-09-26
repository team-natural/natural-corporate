// scheduled → requested (日程変更, DEV-09 §2-5): the slot is dropped and a new one scheduled after.
import type { APIContext } from "astro";
import { env } from "cloudflare:workers";
import { createDb } from "@app/schema/client";
import { jsonItem, toErrorResponse } from "@app/server-kit/http";
import { requireRole, requireSession } from "$lib/server/auth/session";
import { unscheduleBriefing } from "$lib/server/services/briefing-requests";

export async function POST({ params, cookies }: APIContext): Promise<Response> {
  try {
    const db = createDb(env.DB);
    const session = await requireSession(cookies, db);
    requireRole(session, "editor");
    return jsonItem(await unscheduleBriefing(db, params.id!, session));
  } catch (error) {
    return toErrorResponse(error);
  }
}
