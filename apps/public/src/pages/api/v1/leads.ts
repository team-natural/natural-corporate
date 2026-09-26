// Contact-details entry from a result page (DEV-04 §5-6). Unauthenticated write guarded the
// same way as /api/contact/: honeypot, Turnstile, then the service.
import type { APIContext } from "astro";
import { env } from "cloudflare:workers";
import { ulid } from "@app/schema/ulid";
import { createDb } from "@app/schema/client";
import { AppError, jsonItem, toErrorResponse, ValidationError } from "@app/server-kit/http";
import { leadSchema } from "$lib/diagnosis/lead-schema";
import { sendLeadMails } from "$lib/server/mail/leads";
import type { MailConfig } from "$lib/server/mail/client";
import { createLead } from "$lib/server/services/leads";
import { verifyTurnstile, type TurnstileConfig } from "$lib/server/turnstile";
import { z } from "zod";

export async function POST({ request, locals }: APIContext): Promise<Response> {
  try {
    const payload: unknown = await request.json().catch(() => null);

    // Honeypot filled → almost certainly a bot; answer like a success without writing.
    const website = (payload as { website?: unknown } | null)?.website;
    if (typeof website === "string" && website.length > 0) {
      return jsonItem({ id: ulid(), briefingRequestId: null }, 201);
    }

    const parsed = leadSchema.safeParse(payload);
    if (!parsed.success) throw new ValidationError(z.flattenError(parsed.error).fieldErrors);

    // RESEND_API_KEY and TURNSTILE_SECRET_KEY are Workers Secrets, absent from wrangler.jsonc.
    const config = env as typeof env & MailConfig & TurnstileConfig;
    if (!(await verifyTurnstile(config, parsed.data.turnstileToken, request.headers.get("CF-Connecting-IP")))) {
      throw new AppError("認証に失敗しました。ページを再読み込みしてお試しください。", 403, "TURNSTILE_FAILED");
    }

    const db = createDb(env.DB);
    const lead = await createLead(db, parsed.data);

    // Mail after the response (DEV-05 §4); the lead row is already committed either way.
    const origin = new URL(request.url).origin;
    const mails = sendLeadMails(config, lead, origin);
    const waitUntil = (locals as { runtime?: { ctx?: { waitUntil?: (promise: Promise<unknown>) => void } } }).runtime?.ctx?.waitUntil;
    if (waitUntil) waitUntil(mails);
    else await mails;

    return jsonItem({ id: lead.id, purpose: lead.purpose, briefingRequestId: lead.briefingRequestId }, 201);
  } catch (error) {
    return toErrorResponse(error);
  }
}
