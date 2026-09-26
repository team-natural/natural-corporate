// Display helpers shared by admin pages and islands. Dates are stored as ISO 8601 UTC text
// (DEV-07 §1); operators read them in JST.
const dateTime = new Intl.DateTimeFormat("ja-JP", { timeZone: "Asia/Tokyo", year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit" });
const dateOnly = new Intl.DateTimeFormat("ja-JP", { timeZone: "Asia/Tokyo", year: "numeric", month: "2-digit", day: "2-digit" });

export function formatDateTime(iso: string | null | undefined): string {
  if (!iso) return "—";
  const date = new Date(iso);
  return Number.isNaN(date.getTime()) ? iso : dateTime.format(date);
}

export function formatDate(iso: string | null | undefined): string {
  if (!iso) return "—";
  const date = new Date(iso);
  return Number.isNaN(date.getTime()) ? iso : dateOnly.format(date);
}

export const CAMPAIGN_STATUS_LABELS: Record<string, string> = { draft: "下書き", active: "実施中", closed: "終了" };
export const CHANNEL_LABELS: Record<string, string> = { form: "フォーム営業", email: "メール営業", partner: "パートナー", other: "その他" };
export const TOKEN_STATUS_LABELS: Record<string, string> = { active: "有効", expired: "期限切れ", revoked: "失効" };
export const LEAD_STATUS_LABELS: Record<string, string> = { new: "未対応", contacted: "連絡済み", qualified: "商談化", nurturing: "検討中", converted: "成約", lost: "失注" };
export const LEAD_PURPOSE_LABELS: Record<string, string> = { briefing: "15分解説", service: "サービス相談", paid: "有料診断", question: "質問" };
export const BRIEFING_STATUS_LABELS: Record<string, string> = { requested: "申込", scheduled: "予約済み", held: "実施済み", no_show: "不参加", cancelled: "取消" };
export const BRIEFING_OUTCOME_LABELS: Record<string, string> = { service: "サービス相談へ", paid: "有料診断へ", nurture: "検討継続" };
export const DIAGNOSIS_LABELS: Record<string, string> = { business: "業務課題かんたん診断", "ai-dx": "AI・DX浸透診断" };
export const MODE_LABELS: Record<string, string> = { outbound: "営業版", partner: "パートナー版", paid: "有料版" };
