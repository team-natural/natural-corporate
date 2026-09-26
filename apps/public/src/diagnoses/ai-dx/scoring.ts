import type { Axis, AxisQuestion, LevelThreshold } from "./types";

export interface ScoringConfig {
  questions: AxisQuestion[];
  axes: Axis[];
  thresholds: LevelThreshold[];
  strengthThreshold: number;
  maxStrengths: number;
  balanceNote: { minLevel: number; maxAxisScore: number };
}

export interface AiDxResult {
  totalScore: number;
  level: number;
  axisScores: number[]; // same order as config.axes
  weakestAxisIndex: number;
  strengthAxisIndexes: number[];
  flags: string[];
  balanceWarning: boolean;
}

export const MAX_AXIS_SCORE = 6;

export function computeResult(config: ScoringConfig, answers: Record<string, number>): AiDxResult {
  const pointsByQuestion: Record<string, number> = {};
  const flags: string[] = [];
  let totalScore = 0;

  for (const question of config.questions) {
    const optionIndex = answers[question.id];
    const option = optionIndex !== undefined ? question.options[optionIndex] : undefined;
    const points = option?.points ?? 0;
    pointsByQuestion[question.id] = points;
    totalScore += points;
    if (option?.flag && !flags.includes(option.flag)) flags.push(option.flag);
  }

  const axisScores = config.axes.map((axis) => config.questions.filter((question) => question.axisId === axis.id).reduce((sum, question) => sum + pointsByQuestion[question.id], 0));

  const threshold = config.thresholds.find((t) => totalScore >= t.min && totalScore <= t.max);
  const level = threshold ? threshold.level : config.thresholds[config.thresholds.length - 1].level;
  const weakestAxisIndex = findWeakestAxisIndex(axisScores);

  return {
    totalScore,
    level,
    axisScores,
    weakestAxisIndex,
    strengthAxisIndexes: findStrengthAxisIndexes(axisScores, config.strengthThreshold, config.maxStrengths),
    flags,
    balanceWarning: hasBalanceWarning(level, axisScores[weakestAxisIndex], config.balanceNote),
  };
}

// Ties are broken toward the earlier (more foundational) axis, i.e. the
// first index — callers pass axisScores/axes in the same priority order.
export function findWeakestAxisIndex(axisScores: number[]): number {
  let weakestIndex = 0;
  for (let i = 1; i < axisScores.length; i++) {
    if (axisScores[i] < axisScores[weakestIndex]) weakestIndex = i;
  }
  return weakestIndex;
}

// Highest first; ties keep array order (same rule as the weakest axis).
export function findStrengthAxisIndexes(axisScores: number[], threshold: number, max: number): number[] {
  return axisScores
    .map((score, index) => ({ score, index }))
    .filter((entry) => entry.score >= threshold)
    .sort((a, b) => b.score - a.score || a.index - b.index)
    .slice(0, max)
    .map((entry) => entry.index);
}

export function hasBalanceWarning(level: number, weakestScore: number, rule: { minLevel: number; maxAxisScore: number }): boolean {
  return level >= rule.minLevel && weakestScore <= rule.maxAxisScore;
}

// Result URL `a`: 1-based option numbers per question joined with "." (same shape as business,
// deliberately not shared — CLAUDE.md "Diagnoses").
export function encodeAnswers(questions: AxisQuestion[], answers: Record<string, number>): string {
  return questions.map((question) => (answers[question.id] === undefined ? "" : String(answers[question.id] + 1))).join(".");
}

export function decodeAnswers(questions: AxisQuestion[], raw: string | null): Record<string, number> | null {
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
