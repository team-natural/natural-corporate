// Migrated from the old site's standalone Worker. The response envelope is `{ ok, error }`
// rather than server-kit's `jsonItem`/`toErrorResponse` shape, because the already-deployed
// form script in src/pages/contact.astro reads those two fields.
import { submitContact, type ContactConfig } from "$lib/server/services/contact";
import { contactSchema } from "$lib/contact/schema";
import type { APIContext } from "astro";
import { env } from "cloudflare:workers";

const json = (status: number, body: Record<string, unknown>) => new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } });

export async function POST({ request }: APIContext): Promise<Response> {
  let payload: unknown;
  try {
    payload = await request.json();
  } catch {
    return json(400, { ok: false, error: "リクエストの形式が不正です。" });
  }

  // Honeypot filled → almost certainly a bot; pretend success without sending.
  const website = (payload as { website?: unknown } | null)?.website;
  if (typeof website === "string" && website.length > 0) {
    return json(200, { ok: true });
  }

  const parsed = contactSchema.safeParse(payload);
  if (!parsed.success) {
    return json(400, { ok: false, error: parsed.error.issues[0]?.message ?? "入力内容を確認してください。" });
  }

  // RESEND_API_KEY and TURNSTILE_SECRET_KEY are Workers Secrets, so they are absent from
  // wrangler.jsonc and `wrangler types` cannot infer them — CI has no .dev.vars to read.
  const config = env as typeof env & ContactConfig;
  const result = await submitContact(config, parsed.data, request.headers.get("CF-Connecting-IP"));

  return result.ok ? json(200, { ok: true }) : json(result.status, { ok: false, error: result.error });
}
