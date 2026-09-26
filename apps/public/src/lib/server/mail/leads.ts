// Mail templates for a new lead (DEV-10 §3-3): the company is notified, the visitor gets an
// acknowledgement. Both build their payload here; nothing else composes lead mail.
import { LEAD_PURPOSE_LABELS } from "../../diagnosis/lead-schema";
import { briefingBookingHref } from "../../diagnosis/routes";
import type { CreatedLead } from "../services/leads";
import { sendEmail, SITE_SIGNATURE, type MailConfig } from "./client";

const DIAGNOSIS_NAMES: Record<string, string> = { business: "業務課題かんたん診断", "ai-dx": "AI・DX浸透診断" };

function diagnosisLines(lead: CreatedLead, origin: string): string[] {
  if (!lead.diagnosis) return ["■ 診断:", "（診断結果の紐付けなし）"];
  return ["■ 診断:", `${DIAGNOSIS_NAMES[lead.diagnosis.slug] ?? lead.diagnosis.slug} / 結果 ${lead.diagnosis.resultId}`, `${origin}${lead.diagnosis.resultUrl}`];
}

export function leadNotificationText(lead: CreatedLead, origin: string): string {
  return ["診断結果ページから連絡先の入力がありました。", "", "■ ご希望:", LEAD_PURPOSE_LABELS[lead.purpose], "", "■ 会社名:", lead.company, "", "■ お名前:", lead.name, "", "■ メールアドレス:", lead.email, "", "■ 電話番号:", lead.phone || "（未記入）", "", ...diagnosisLines(lead, origin), "", "■ キャンペーン:", lead.campaignName ?? "（一般公開 / 紐付けなし）", "", "■ ご質問・メモ:", lead.message || "（なし）", "", `■ リード ID: ${lead.id}`, "", "---", "このメールに返信すると、お客様のメールアドレス宛に返信されます。"].join("\n");
}

export function leadAutoReplyText(lead: CreatedLead, origin: string): string {
  const next = lead.purpose === "briefing" ? ["15分のオンライン結果解説をご希望いただきました。", "担当者より日程調整のご連絡をいたします。", ...(lead.diagnosis && !briefingBookingHref(null).startsWith("/") ? ["お急ぎの場合は、以下から直接ご予約いただけます。", briefingBookingHref(`${origin}${lead.diagnosis.resultUrl}`)] : [])] : ["担当者より折り返しご連絡いたしますので、今しばらくお待ちください。"];
  return [`${lead.name} 様`, "", "診断結果ページからのご連絡をありがとうございます。", "以下の内容で受け付けました。", "", ...next, "", "■ ご希望:", LEAD_PURPOSE_LABELS[lead.purpose], "", "■ 会社名:", lead.company, "", "■ お名前:", lead.name, "", "■ メールアドレス:", lead.email, "", ...(lead.diagnosis ? ["■ 診断結果:", `${origin}${lead.diagnosis.resultUrl}`, ""] : []), ...SITE_SIGNATURE].join("\n");
}

export async function sendLeadMails(config: MailConfig, lead: CreatedLead, origin: string): Promise<void> {
  const notified = await sendEmail(config, {
    from: config.CONTACT_FROM,
    to: [config.CONTACT_NOTIFY_TO],
    reply_to: lead.email,
    subject: `【診断リード】${LEAD_PURPOSE_LABELS[lead.purpose]} - ${lead.company} ${lead.name}様`,
    text: leadNotificationText(lead, origin),
  });
  if (!notified) console.error("Lead notification failed for:", lead.id);

  // The lead is already in D1, so a failed acknowledgement is logged, not surfaced.
  const acknowledged = await sendEmail(config, {
    from: config.CONTACT_FROM,
    to: [lead.email],
    reply_to: config.CONTACT_NOTIFY_TO,
    subject: "ご連絡を受け付けました｜株式会社ナチュラル",
    text: leadAutoReplyText(lead, origin),
  });
  if (!acknowledged) console.error("Lead auto-reply failed for:", lead.email);
}
