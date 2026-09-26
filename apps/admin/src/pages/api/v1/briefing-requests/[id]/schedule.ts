import type { APIContext } from "astro";
import { env } from "cloudflare:workers";
import { createDb } from "@app/schema/client";
import { jsonItem, toErrorResponse } from "@app/server-kit/http";
import { requireRole, requireSession } from "$lib/server/auth/session";
import { scheduleBriefing } from "$lib/server/services/briefing-requests";
import { scheduleBriefingSchema } from "$lib/server/validation/briefing-requests";
import { parseBody, readJson } from "$lib/server/validation/parse";

export async function POST({ params, request, cookies }: APIContext): Promise<Response> {
  try {
    const db = createDb(env.DB);
    const session = await requireSession(cookies, db);
    requireRole(session, "editor");
    const input = parseBody(scheduleBriefingSchema, await readJson(request));
    return jsonItem(await scheduleBriefing(db, params.id!, input, session));
  } catch (error) {
    return toErrorResponse(error);
  }
}
