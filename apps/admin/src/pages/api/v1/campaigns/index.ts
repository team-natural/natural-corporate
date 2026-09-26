import type { APIContext } from "astro";
import { env } from "cloudflare:workers";
import { createDb } from "@app/schema/client";
import { decodeCursor, encodeCursor, jsonCursorCollection, jsonItem, toErrorResponse } from "@app/server-kit/http";
import { requireRole, requireSession } from "$lib/server/auth/session";
import { createCampaign, listCampaigns, type CampaignStatus } from "$lib/server/services/campaigns";
import { createCampaignSchema } from "$lib/server/validation/campaigns";
import { parseBody, readJson } from "$lib/server/validation/parse";

const STATUSES: CampaignStatus[] = ["draft", "active", "closed"];

export async function GET({ request, cookies }: APIContext): Promise<Response> {
  try {
    const db = createDb(env.DB);
    await requireSession(cookies, db);

    const params = new URL(request.url).searchParams;
    const perPageParam = params.get("per_page");
    const status = params.get("status");
    const { items, perPage, nextId } = await listCampaigns(db, {
      beforeId: decodeCursor(params.get("cursor")),
      perPage: perPageParam ? Number(perPageParam) : undefined,
      status: STATUSES.includes(status as CampaignStatus) ? (status as CampaignStatus) : undefined,
    });
    return jsonCursorCollection(items, { perPage, nextCursor: nextId ? encodeCursor(nextId) : null });
  } catch (error) {
    return toErrorResponse(error);
  }
}

export async function POST({ request, cookies }: APIContext): Promise<Response> {
  try {
    const db = createDb(env.DB);
    const session = await requireSession(cookies, db);
    requireRole(session, "editor");

    const input = parseBody(createCampaignSchema, await readJson(request));
    return jsonItem(await createCampaign(db, input, session), 201);
  } catch (error) {
    return toErrorResponse(error);
  }
}
