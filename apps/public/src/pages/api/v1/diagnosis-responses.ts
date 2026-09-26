// Saves an outbound-mode run (DEV-04 §5-6 / §6-1b). Unauthenticated: the token gates it, and
// the body carries no personal data. Rate limiting is Cloudflare's job (GOV-02 TBD-31).
import type { APIContext } from "astro";
import { env } from "cloudflare:workers";
import { createDb } from "@app/schema/client";
import { jsonItem, toErrorResponse, ValidationError } from "@app/server-kit/http";
import { saveDiagnosisResponse } from "$lib/server/services/diagnosis-responses";
import { saveResponseSchema } from "$lib/server/validation/diagnosis-responses";
import { z } from "zod";

export async function POST({ request }: APIContext): Promise<Response> {
  try {
    const parsed = saveResponseSchema.safeParse(await request.json().catch(() => null));
    if (!parsed.success) throw new ValidationError(z.flattenError(parsed.error).fieldErrors);

    const db = createDb(env.DB);
    const saved = await saveDiagnosisResponse(db, parsed.data, { userAgent: request.headers.get("User-Agent") });
    return jsonItem(saved, 201);
  } catch (error) {
    return toErrorResponse(error);
  }
}
