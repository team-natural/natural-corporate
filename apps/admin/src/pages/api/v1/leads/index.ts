import type { APIContext } from "astro";
import { env } from "cloudflare:workers";
import { createDb } from "@app/schema/client";
import { decodeCursor, encodeCursor, jsonCursorCollection, toErrorResponse } from "@app/server-kit/http";
import { requireSession } from "$lib/server/auth/session";
import { listLeads, type LeadStatus } from "$lib/server/services/leads";

const STATUSES: LeadStatus[] = ["new", "contacted", "qualified", "nurturing", "converted", "lost"];

export async function GET({ request, cookies }: APIContext): Promise<Response> {
  try {
    const db = createDb(env.DB);
    await requireSession(cookies, db);

    const params = new URL(request.url).searchParams;
    const perPageParam = params.get("per_page");
    const status = params.get("status");
    const { items, perPage, nextId } = await listLeads(db, {
      beforeId: decodeCursor(params.get("cursor")),
      perPage: perPageParam ? Number(perPageParam) : undefined,
      status: STATUSES.includes(status as LeadStatus) ? (status as LeadStatus) : undefined,
    });
    return jsonCursorCollection(items, { perPage, nextCursor: nextId ? encodeCursor(nextId) : null });
  } catch (error) {
    return toErrorResponse(error);
  }
}
