// Token check for the outbound entry (DEV-04 §5-6). Unauthenticated by design: the token is
// the credential, and every failure mode answers the same 404.
import type { APIContext } from "astro";
import { env } from "cloudflare:workers";
import { createDb } from "@app/schema/client";
import { jsonItem, toErrorResponse } from "@app/server-kit/http";
import { resolveActiveToken } from "$lib/server/services/diagnosis-tokens";

export async function GET({ params }: APIContext): Promise<Response> {
  try {
    const db = createDb(env.DB);
    return jsonItem(await resolveActiveToken(db, params.token!));
  } catch (error) {
    return toErrorResponse(error);
  }
}
