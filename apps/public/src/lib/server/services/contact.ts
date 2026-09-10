// Contact form delivery: Turnstile verification, then a notification email to the company and
// an auto-reply to the visitor. Nothing is persisted — D1 has no inquiries row for this yet.
import type { ContactFormValues } from "$lib/contact/schema";

export interface ContactConfig {
  // Workers Secrets (`wrangler secret put`), absent from wrangler.jsonc.
  RESEND_API_KEY: string;
  TURNSTILE_SECRET_KEY: string;
  // wrangler.jsonc vars.
  CONTACT_NOTIFY_TO: string;
  CONTACT_FROM: string;
}

export type ContactResult = { ok: true } | { ok: false; status: number; error: string };

async function verifyTurnstile(config: ContactConfig, token: string, ip: string | null): Promise<boolean> {
  const body = new URLSearchParams({ secret: config.TURNSTILE_SECRET_KEY, response: token });
  if (ip) body.set("remoteip", ip);
  const res = await fetch("https://challenges.cloudflare.com/turnstile/v0/siteverify", { method: "POST", body });
  if (!res.ok) return false;
  const result = (await res.json()) as { success: boolean };
  return result.success === true;
}

async function sendEmail(config: ContactConfig, payload: { from: string; to: string[]; reply_to?: string; subject: string; text: string }): Promise<boolean> {
  const res = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: { Authorization: `Bearer ${config.RESEND_API_KEY}`, "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  if (!res.ok) console.error("Resend error:", res.status, await res.text());
  return res.ok;
}

function notificationText(data: ContactFormValues): string {
  return ["コーポレートサイトのお問い合わせフォームから送信がありました。", "", "■ お問い合わせ項目:", data.inquiryType, "", "■ 会社名:", data.company || "（未記入）", "", "■ お名前:", data.name, "", "■ メールアドレス:", data.email, "", "■ 電話番号:", data.phone || "（未記入）", "", "■ お問い合わせ内容:", data.message, "", "---", "このメールに返信すると、お客様のメールアドレス宛に返信されます。"].join("\n");
}

function autoReplyText(data: ContactFormValues): string {
  return [`${data.name} 様`, "", "お問い合わせいただきありがとうございます。", "以下の内容で受け付けました。担当者より折り返しご連絡いたしますので、今しばらくお待ちください。", "", "■ お問い合わせ項目:", data.inquiryType, "", "■ 会社名:", data.company || "（未記入）", "", "■ お名前:", data.name, "", "■ メールアドレス:", data.email, "", "■ 電話番号:", data.phone || "（未記入）", "", "■ お問い合わせ内容:", data.message, "", "---", "株式会社ナチュラル", "https://naturaling.jp/", "※ このメールは自動送信です。お心当たりのない場合は破棄してください。"].join("\n");
}

export async function submitContact(config: ContactConfig, data: ContactFormValues, ip: string | null): Promise<ContactResult> {
  if (!(await verifyTurnstile(config, data.turnstileToken, ip))) {
    return { ok: false, status: 403, error: "認証に失敗しました。ページを再読み込みしてお試しください。" };
  }

  const notified = await sendEmail(config, {
    from: config.CONTACT_FROM,
    to: [config.CONTACT_NOTIFY_TO],
    reply_to: data.email,
    subject: `【お問い合わせ】${data.inquiryType} - ${data.name}様`,
    text: notificationText(data),
  });
  if (!notified) {
    return { ok: false, status: 502, error: "送信に失敗しました。時間をおいて再度お試しいただくか、LINEよりご連絡ください。" };
  }

  // Auto-reply failure (e.g. invalid recipient) must not fail the whole request —
  // the inquiry itself has already reached the company.
  const autoReplied = await sendEmail(config, {
    from: config.CONTACT_FROM,
    to: [data.email],
    reply_to: config.CONTACT_NOTIFY_TO,
    subject: "お問い合わせを受け付けました｜株式会社ナチュラル",
    text: autoReplyText(data),
  });
  if (!autoReplied) console.error("Auto-reply failed for:", data.email);

  return { ok: true };
}
