import type { APIContext } from "astro";
import { env } from "cloudflare:workers";
import { createDb } from "@app/schema/client";
import { decodeCursor, encodeCursor, jsonCursorCollection, toErrorResponse } from "@app/server-kit/http";
import { requireSession } from "$lib/server/auth/session";
import { listResponses, type ResponseMode } from "$lib/server/services/diagnosis-responses";

const MODES: ResponseMode[] = ["outbound", "partner", "paid"];

export async function GET({ request, cookies }: APIContext): Promise<Response> {
  try {
    const db = createDb(env.DB);
    await requireSession(cookies, db);

    const params = new URL(request.url).searchParams;
    const perPageParam = params.get("per_page");
    const mode = params.get("mode");
    const { items, perPage, nextId } = await listResponses(db, {
      beforeId: decodeCursor(params.get("cursor")),
      perPage: perPageParam ? Number(perPageParam) : undefined,
      mode: MODES.includes(mode as ResponseMode) ? (mode as ResponseMode) : undefined,
      campaignId: params.get("campaign") ?? undefined,
      resultId: params.get("result") ?? undefined,
      from: params.get("from") ?? undefined,
      to: params.get("to") ?? undefined,
    });
    return jsonCursorCollection(items, { perPage, nextCursor: nextId ? encodeCursor(nextId) : null });
  } catch (error) {
    return toErrorResponse(error);
  }
}
