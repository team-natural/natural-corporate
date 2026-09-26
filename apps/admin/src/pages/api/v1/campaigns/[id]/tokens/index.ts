import type { APIContext } from "astro";
import { env } from "cloudflare:workers";
import { createDb } from "@app/schema/client";
import { decodeCursor, encodeCursor, jsonCursorCollection, jsonItem, toErrorResponse } from "@app/server-kit/http";
import { requireRole, requireSession } from "$lib/server/auth/session";
import { issueTokens, listTokens } from "$lib/server/services/campaigns";
import { issueTokensSchema } from "$lib/server/validation/campaigns";
import { parseBody, readJson } from "$lib/server/validation/parse";

export async function GET({ params, request, cookies }: APIContext): Promise<Response> {
  try {
    const db = createDb(env.DB);
    await requireSession(cookies, db);

    const query = new URL(request.url).searchParams;
    const perPageParam = query.get("per_page");
    const { items, perPage, nextId } = await listTokens(db, params.id!, { beforeId: decodeCursor(query.get("cursor")), perPage: perPageParam ? Number(perPageParam) : undefined });
    return jsonCursorCollection(items, { perPage, nextCursor: nextId ? encodeCursor(nextId) : null });
  } catch (error) {
    return toErrorResponse(error);
  }
}

// Returns the batch just issued (the CSV is built client-side from it — DEV-04 §5-9).
export async function POST({ params, request, cookies }: APIContext): Promise<Response> {
  try {
    const db = createDb(env.DB);
    const session = await requireSession(cookies, db);
    requireRole(session, "editor");

    const input = parseBody(issueTokensSchema, await readJson(request));
    return jsonItem(await issueTokens(db, params.id!, input, session), 201);
  } catch (error) {
    return toErrorResponse(error);
  }
}
