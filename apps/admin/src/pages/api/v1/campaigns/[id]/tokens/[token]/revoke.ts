import type { APIContext } from "astro";
import { env } from "cloudflare:workers";
import { createDb } from "@app/schema/client";
import { jsonItem, toErrorResponse } from "@app/server-kit/http";
import { requireRole, requireSession } from "$lib/server/auth/session";
import { revokeToken } from "$lib/server/services/campaigns";

export async function POST({ params, cookies }: APIContext): Promise<Response> {
  try {
    const db = createDb(env.DB);
    const session = await requireSession(cookies, db);
    requireRole(session, "editor");
    return jsonItem(await revokeToken(db, params.id!, params.token!, session));
  } catch (error) {
    return toErrorResponse(error);
  }
}
