// `[id]` is the lead's public_id (a ULID), never the internal integer primary key.
import type { APIContext } from "astro";
import { env } from "cloudflare:workers";
import { createDb } from "@app/schema/client";
import { jsonItem, toErrorResponse } from "@app/server-kit/http";
import { requireRole, requireSession } from "$lib/server/auth/session";
import { getLeadByPublicId, updateLead } from "$lib/server/services/leads";
import { updateLeadSchema } from "$lib/server/validation/leads";
import { parseBody, readJson } from "$lib/server/validation/parse";

export async function GET({ params, cookies }: APIContext): Promise<Response> {
  try {
    const db = createDb(env.DB);
    await requireSession(cookies, db);
    return jsonItem(await getLeadByPublicId(db, params.id!));
  } catch (error) {
    return toErrorResponse(error);
  }
}

export async function PATCH({ params, request, cookies }: APIContext): Promise<Response> {
  try {
    const db = createDb(env.DB);
    const session = await requireSession(cookies, db);
    requireRole(session, "editor");

    const input = parseBody(updateLeadSchema, await readJson(request));
    return jsonItem(await updateLead(db, params.id!, input, session));
  } catch (error) {
    return toErrorResponse(error);
  }
}
