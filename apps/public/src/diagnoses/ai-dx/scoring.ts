import type { Axis, AxisQuestion, LevelThreshold } from "./types";

export interface ScoringConfig {
  questions: AxisQuestion[];
  axes: Axis[];
  thresholds: LevelThreshold[];
}

export interface AiDxResult {
  totalScore: number;
  level: number;
  axisScores: number[]; // same order as config.axes
}

export function computeResult(config: ScoringConfig, answers: Record<string, number>): AiDxResult {
  const pointsByQuestion: Record<string, number> = {};
  let totalScore = 0;

  for (const question of config.questions) {
    const optionIndex = answers[question.id];
    const option = optionIndex !== undefined ? question.options[optionIndex] : undefined;
    const points = option?.points ?? 0;
    pointsByQuestion[question.id] = points;
    totalScore += points;
  }

  const axisScores = config.axes.map((axis) => config.questions.filter((question) => question.axisId === axis.id).reduce((sum, question) => sum + pointsByQuestion[question.id], 0));

  const threshold = config.thresholds.find((t) => totalScore >= t.min && totalScore <= t.max);
  const level = threshold ? threshold.level : config.thresholds[config.thresholds.length - 1].level;

  return { totalScore, level, axisScores };
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
