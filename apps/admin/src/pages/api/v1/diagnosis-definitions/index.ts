import type { APIContext } from "astro";
import { env } from "cloudflare:workers";
import { createDb } from "@app/schema/client";
import { jsonItem, toErrorResponse } from "@app/server-kit/http";
import { requireSession } from "$lib/server/auth/session";
import { listDefinitions } from "$lib/server/services/diagnosis-definitions";

export async function GET({ cookies }: APIContext): Promise<Response> {
  try {
    const db = createDb(env.DB);
    await requireSession(cookies, db);
    return jsonItem(await listDefinitions(db));
  } catch (error) {
    return toErrorResponse(error);
  }
}
