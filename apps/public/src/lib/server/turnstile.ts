// Cloudflare Turnstile verification, shared by every unauthenticated write that carries
// personal data (/api/contact/, /api/v1/leads/).

export interface TurnstileConfig {
  // Workers Secret (`wrangler secret put`), absent from wrangler.jsonc.
  TURNSTILE_SECRET_KEY: string;
}

export async function verifyTurnstile(config: TurnstileConfig, token: string, ip: string | null): Promise<boolean> {
  const body = new URLSearchParams({ secret: config.TURNSTILE_SECRET_KEY, response: token });
  if (ip) body.set("remoteip", ip);
  const res = await fetch("https://challenges.cloudflare.com/turnstile/v0/siteverify", { method: "POST", body });
  if (!res.ok) return false;
  const result = (await res.json()) as { success: boolean };
  return result.success === true;
}
