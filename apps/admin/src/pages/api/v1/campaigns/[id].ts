// `[id]` is the campaign's public_id (a ULID), never the internal integer primary key.
import type { APIContext } from "astro";
import { env } from "cloudflare:workers";
import { createDb } from "@app/schema/client";
import { jsonItem, toErrorResponse } from "@app/server-kit/http";
import { requireRole, requireSession } from "$lib/server/auth/session";
import { getCampaignByPublicId, updateCampaign } from "$lib/server/services/campaigns";
import { updateCampaignSchema } from "$lib/server/validation/campaigns";
import { parseBody, readJson } from "$lib/server/validation/parse";

export async function GET({ params, cookies }: APIContext): Promise<Response> {
  try {
    const db = createDb(env.DB);
    await requireSession(cookies, db);
    return jsonItem(await getCampaignByPublicId(db, params.id!));
  } catch (error) {
    return toErrorResponse(error);
  }
}

export async function PATCH({ params, request, cookies }: APIContext): Promise<Response> {
  try {
    const db = createDb(env.DB);
    const session = await requireSession(cookies, db);
    requireRole(session, "editor");

    const input = parseBody(updateCampaignSchema, await readJson(request));
    return jsonItem(await updateCampaign(db, params.id!, input, session));
  } catch (error) {
    return toErrorResponse(error);
  }
}
