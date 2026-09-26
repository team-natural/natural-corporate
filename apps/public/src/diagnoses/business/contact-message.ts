// Prefill for /contact/ (PRD-07 §3): diagnosis, version, result, top issues, result URL.
// Shared by ResultPage.astro (build-time default) and result.js (with the live scores).

export interface ContactMessageInput {
  title: string;
  version: number;
  resultName: string;
  secondaryName?: string | null;
  topIssues?: { label: string; percent: number }[];
  resultUrl?: string | null;
}

export function buildContactMessage({ title, version, resultName, secondaryName, topIssues, resultUrl }: ContactMessageInput): string {
  const lines = [`【${title} v${version}】`, `判定結果: ${resultName}${secondaryName ? `（あわせて検討: ${secondaryName}）` : ""}`];
  if (topIssues && topIssues.length > 0) lines.push(`課題度（上位）: ${topIssues.map((issue) => `${issue.label} ${issue.percent}%`).join(" / ")}`);
  if (resultUrl) lines.push(`結果URL: ${resultUrl}`);
  lines.push("", "相談したいこと:", "");
  return lines.join("\n");
}
