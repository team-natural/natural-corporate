import type { DiagnosisQuestion } from "./types";

export interface ScoringConfig {
  questions: DiagnosisQuestion[];
  concernQuestionId: string;
  tieBreakOrder: string[];
  zeroScoreTypeId: string;
}

export interface DiagnosisResult {
  primaryId: string;
  secondaryId: string | null;
  concernOptionIndex: number | null;
  totals: Record<string, number>;
}

function resolveTie(candidateIds: string[], concernTypeIds: string[], tieBreakOrder: string[]): string {
  const concernTied = candidateIds.filter((id) => concernTypeIds.includes(id));
  const pool = concernTied.length > 0 ? concernTied : candidateIds;
  return tieBreakOrder.find((id) => pool.includes(id)) ?? pool[0];
}

export function computeResult(config: ScoringConfig, answers: Record<string, number>): DiagnosisResult {
  const totals: Record<string, number> = {};
  for (const id of config.tieBreakOrder) totals[id] = 0;

  for (const question of config.questions) {
    const optionIndex = answers[question.id];
    if (optionIndex === undefined) continue;
    const option = question.options[optionIndex];
    if (!option) continue;
    for (const [typeId, points] of Object.entries(option.scores)) {
      totals[typeId] = (totals[typeId] ?? 0) + points;
    }
  }

  const concernQuestion = config.questions.find((question) => question.id === config.concernQuestionId);
  const concernOptionIndex = answers[config.concernQuestionId];
  const concernOption = concernOptionIndex !== undefined ? concernQuestion?.options[concernOptionIndex] : undefined;
  const concernTypeIds = concernOption ? Object.keys(concernOption.scores) : [];

  const maxScore = Math.max(...Object.values(totals));
  if (maxScore <= 0) {
    return {
      primaryId: config.zeroScoreTypeId,
      secondaryId: null,
      concernOptionIndex: concernOptionIndex ?? null,
      totals,
    };
  }

  const topIds = Object.keys(totals).filter((id) => totals[id] === maxScore);
  const primaryId = topIds.length === 1 ? topIds[0] : resolveTie(topIds, concernTypeIds, config.tieBreakOrder);

  const remaining = Object.entries(totals).filter(([id]) => id !== primaryId);
  const maxRemaining = remaining.length > 0 ? Math.max(...remaining.map(([, value]) => value)) : 0;
  let secondaryId: string | null = null;
  if (maxRemaining > 0) {
    const secondCandidates = remaining.filter(([, value]) => value === maxRemaining).map(([id]) => id);
    // Spec only defines the tie-break order for the primary type; reuse the
    // same rule for the secondary type to keep the outcome deterministic.
    secondaryId = secondCandidates.length === 1 ? secondCandidates[0] : resolveTie(secondCandidates, concernTypeIds, config.tieBreakOrder);
  }

  return { primaryId, secondaryId, concernOptionIndex: concernOptionIndex ?? null, totals };
}
