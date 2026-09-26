import type { APIContext } from "astro";
import { env } from "cloudflare:workers";
import { createDb } from "@app/schema/client";
import { jsonItem, toErrorResponse } from "@app/server-kit/http";
import { requireSession } from "$lib/server/auth/session";
import { getResponseByPublicId } from "$lib/server/services/diagnosis-responses";

export async function GET({ params, cookies }: APIContext): Promise<Response> {
  try {
    const db = createDb(env.DB);
    await requireSession(cookies, db);
    return jsonItem(await getResponseByPublicId(db, params.id!));
  } catch (error) {
    return toErrorResponse(error);
  }
}
