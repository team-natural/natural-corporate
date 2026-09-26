import type { DiagnosisQuestion } from "./types";

export interface ScoringConfig {
  questions: DiagnosisQuestion[];
  concernQuestionId: string;
  tieBreakOrder: string[];
  zeroScoreTypeId: string;
}

export interface JudgementReason {
  questionId: string;
  optionIndex: number;
  points: number;
}

export interface DiagnosisResult {
  primaryId: string;
  secondaryId: string | null;
  concernOptionIndex: number | null;
  /** Raw points per type (v1 `s` format, A–I order of tieBreakOrder keys). */
  totals: Record<string, number>;
  /** Raw points ÷ reachable maximum, 0–1. Not-applicable types are absent. */
  ratios: Record<string, number>;
  notApplicableIds: string[];
  /** Types at 0% (excluding not-applicable), up to 3 in display order. */
  strengthIds: string[];
  /** Answers that scored the primary type, highest points first, up to 3. */
  reasons: JudgementReason[];
}

const MAX_STRENGTHS = 3;
const MAX_REASONS = 3;
const EPSILON = 1e-9;

// The maximum a type can reach across all questions, derived from the data so a
// re-weighted option can never leave a stale hand-maintained constant behind.
export function maxPointsByType(questions: DiagnosisQuestion[]): Record<string, number> {
  const max: Record<string, number> = {};
  for (const question of questions) {
    const best: Record<string, number> = {};
    for (const option of question.options) {
      for (const [typeId, points] of Object.entries(option.scores)) {
        best[typeId] = Math.max(best[typeId] ?? 0, points);
      }
    }
    for (const [typeId, points] of Object.entries(best)) max[typeId] = (max[typeId] ?? 0) + points;
  }
  return max;
}

function resolveTie(candidateIds: string[], concernTypeIds: string[], tieBreakOrder: string[]): string {
  const concernTied = candidateIds.filter((id) => concernTypeIds.includes(id));
  const pool = concernTied.length > 0 ? concernTied : candidateIds;
  return tieBreakOrder.find((id) => pool.includes(id)) ?? pool[0];
}

function topByRatio(ratios: Record<string, number>, exclude: string | null): { ids: string[]; value: number } {
  let value = 0;
  let ids: string[] = [];
  for (const [id, ratio] of Object.entries(ratios)) {
    if (id === exclude) continue;
    if (ratio > value + EPSILON) {
      value = ratio;
      ids = [id];
    } else if (Math.abs(ratio - value) <= EPSILON && value > 0) {
      ids.push(id);
    }
  }
  return { ids, value };
}

export function computeResult(config: ScoringConfig, answers: Record<string, number>): DiagnosisResult {
  const totals: Record<string, number> = {};
  for (const id of config.tieBreakOrder) totals[id] = 0;
  const notApplicable = new Set<string>();

  for (const question of config.questions) {
    if (question.id === config.concernQuestionId) continue;
    const optionIndex = answers[question.id];
    if (optionIndex === undefined) continue;
    const option = question.options[optionIndex];
    if (!option) continue;
    for (const [typeId, points] of Object.entries(option.scores)) {
      totals[typeId] = (totals[typeId] ?? 0) + points;
    }
    for (const typeId of option.notApplicable ?? []) notApplicable.add(typeId);
  }

  const concernQuestion = config.questions.find((question) => question.id === config.concernQuestionId);
  const concernOptionIndex = answers[config.concernQuestionId];
  const concernOption = concernOptionIndex !== undefined ? concernQuestion?.options[concernOptionIndex] : undefined;
  const concernTypeIds = concernOption?.concerns ?? [];

  const maxPoints = maxPointsByType(config.questions);
  const ratios: Record<string, number> = {};
  for (const id of config.tieBreakOrder) {
    if (notApplicable.has(id)) continue;
    const max = maxPoints[id] ?? 0;
    ratios[id] = max > 0 ? totals[id] / max : 0;
  }

  const notApplicableIds = config.tieBreakOrder.filter((id) => notApplicable.has(id));
  const strengthIds = config.tieBreakOrder.filter((id) => !notApplicable.has(id) && totals[id] === 0).slice(0, MAX_STRENGTHS);

  const top = topByRatio(ratios, null);
  if (top.value <= 0) {
    return { primaryId: config.zeroScoreTypeId, secondaryId: null, concernOptionIndex: concernOptionIndex ?? null, totals, ratios, notApplicableIds, strengthIds: [], reasons: [] };
  }

  const primaryId = top.ids.length === 1 ? top.ids[0] : resolveTie(top.ids, concernTypeIds, config.tieBreakOrder);

  const second = topByRatio(ratios, primaryId);
  let secondaryId: string | null = null;
  if (second.value > 0) {
    // Spec only defines the tie-break order for the primary type; reuse the
    // same rule for the secondary type to keep the outcome deterministic.
    secondaryId = second.ids.length === 1 ? second.ids[0] : resolveTie(second.ids, concernTypeIds, config.tieBreakOrder);
  }

  return { primaryId, secondaryId, concernOptionIndex: concernOptionIndex ?? null, totals, ratios, notApplicableIds, strengthIds, reasons: judgementReasons(config.questions, answers, primaryId) };
}

// Answers that scored `typeId`, highest points first; the stable sort keeps question order
// among equal points ("同点は質問順"). Exposed so a result page can quote its own type even
// when the answers in a shared URL would judge differently.
export function judgementReasons(questions: DiagnosisQuestion[], answers: Record<string, number>, typeId: string): JudgementReason[] {
  const reasons: JudgementReason[] = [];
  for (const question of questions) {
    const optionIndex = answers[question.id];
    const points = optionIndex === undefined ? undefined : question.options[optionIndex]?.scores[typeId];
    if (points !== undefined && optionIndex !== undefined) reasons.push({ questionId: question.id, optionIndex, points });
  }
  return reasons.sort((a, b) => b.points - a.points).slice(0, MAX_REASONS);
}

// Result URL parameters (PRD-07 §1-3). Scores and answers are 1-based option numbers joined
// with "." so a v1 reader ignores what it does not know and a v2 reader can replay the answers.
export function encodeAnswers(questions: DiagnosisQuestion[], answers: Record<string, number>): string {
  return questions.map((question) => (answers[question.id] === undefined ? "" : String(answers[question.id] + 1))).join(".");
}

export function decodeAnswers(questions: DiagnosisQuestion[], raw: string | null): Record<string, number> | null {
  if (!raw) return null;
  const parts = raw.split(".");
  if (parts.length !== questions.length) return null;
  const answers: Record<string, number> = {};
  for (let i = 0; i < questions.length; i++) {
    if (parts[i] === "") continue;
    const optionIndex = Number(parts[i]) - 1;
    if (!Number.isInteger(optionIndex) || optionIndex < 0 || optionIndex >= questions[i].options.length) return null;
    answers[questions[i].id] = optionIndex;
  }
  return answers;
}
