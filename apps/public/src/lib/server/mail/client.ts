// Resend transport. Every outgoing mail goes through here with a template function building the
// payload (DEV-10 §3-4) — no ad-hoc sends from services.

export interface MailConfig {
  // Workers Secret (`wrangler secret put`), absent from wrangler.jsonc.
  RESEND_API_KEY: string;
  // wrangler.jsonc vars.
  CONTACT_NOTIFY_TO: string;
  CONTACT_FROM: string;
}

export interface MailPayload {
  from: string;
  to: string[];
  reply_to?: string;
  subject: string;
  text: string;
}

export async function sendEmail(config: MailConfig, payload: MailPayload): Promise<boolean> {
  const res = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: { Authorization: `Bearer ${config.RESEND_API_KEY}`, "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  if (!res.ok) console.error("Resend error:", res.status, await res.text());
  return res.ok;
}

export const SITE_SIGNATURE = ["---", "株式会社ナチュラル", "https://naturaling.jp/", "※ このメールは自動送信です。お心当たりのない場合は破棄してください。"];
