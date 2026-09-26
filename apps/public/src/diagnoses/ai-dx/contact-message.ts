// Prefill for /contact/ (PRD-07 §3): diagnosis, version, level, axis scores, result URL.
// Shared by ResultPage.astro (build-time default) and result.js (with the live scores).

export interface ContactMessageInput {
  title: string;
  version: number;
  levelName: string;
  totalScore?: number | null;
  maxTotal?: number;
  axisScores?: { name: string; score: number }[];
  resultUrl?: string | null;
}

export function buildContactMessage({ title, version, levelName, totalScore, maxTotal, axisScores, resultUrl }: ContactMessageInput): string {
  const lines = [`【${title} v${version}】`, `判定結果: ${levelName}${totalScore !== null && totalScore !== undefined ? `（合計 ${totalScore} / ${maxTotal}点）` : ""}`];
  if (axisScores && axisScores.length > 0) lines.push(`軸別: ${axisScores.map((axis) => `${axis.name} ${axis.score}`).join(" / ")}`);
  if (resultUrl) lines.push(`結果URL: ${resultUrl}`);
  lines.push("", "相談したいこと:", "");
  return lines.join("\n");
}
