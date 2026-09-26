import { describe, expect, it } from "vitest";
import aiDx from "../../src/diagnoses/ai-dx/data";
import { computeResult, decodeAnswers, encodeAnswers, findStrengthAxisIndexes, findWeakestAxisIndex, hasBalanceWarning, MAX_AXIS_SCORE } from "../../src/diagnoses/ai-dx/scoring";

const config = { questions: aiDx.questions, axes: aiDx.axes, thresholds: aiDx.thresholds, strengthThreshold: aiDx.strengthThreshold, maxStrengths: aiDx.maxStrengths, balanceNote: aiDx.balanceNote };

// Answers producing the given axis scores (0–6 each, split across the axis's two questions).
function answersForAxisScores(scores: number[]): Record<string, number> {
  const answers: Record<string, number> = {};
  aiDx.axes.forEach((axis, index) => {
    const questions = aiDx.questions.filter((question) => question.axisId === axis.id);
    const first = Math.min(3, scores[index]);
    answers[questions[0].id] = first;
    answers[questions[1].id] = scores[index] - first;
  });
  return answers;
}

describe("ai-dx v2 definition", () => {
  it("keeps 5 axes × 2 questions × 0–3 points and the v1 thresholds", () => {
    expect(aiDx.axes).toHaveLength(5);
    for (const axis of aiDx.axes) expect(aiDx.questions.filter((question) => question.axisId === axis.id)).toHaveLength(2);
    for (const question of aiDx.questions) expect(question.options.map((option) => option.points)).toEqual([0, 1, 2, 3]);
    expect(aiDx.thresholds.map((t) => [t.min, t.max])).toEqual([
      [0, 6],
      [7, 12],
      [13, 18],
      [19, 24],
      [25, 30],
    ]);
  });

  it("flags the 'unknown AI usage' answer and has a first step for it", () => {
    const q5 = aiDx.questions.find((question) => question.id === "q5")!;
    expect(q5.options[0].flag).toBeDefined();
    expect(aiDx.flagFirstSteps[q5.options[0].flag!]).toBeTruthy();
  });
});

describe("computeResult", () => {
  it.each([
    [0, 1],
    [6, 1],
    [7, 2],
    [12, 2],
    [13, 3],
    [18, 3],
    [19, 4],
    [24, 4],
    [25, 5],
    [30, 5],
  ])("total %i → level %i", (total, level) => {
    const scores = [0, 0, 0, 0, 0];
    let remaining = total;
    for (let i = 0; i < scores.length && remaining > 0; i++) {
      scores[i] = Math.min(MAX_AXIS_SCORE, remaining);
      remaining -= scores[i];
    }
    const result = computeResult(config, answersForAxisScores(scores));
    expect(result.totalScore).toBe(total);
    expect(result.level).toBe(level);
  });

  it("treats a missing answer as 0 points", () => {
    const result = computeResult(config, {});
    expect(result.totalScore).toBe(0);
    expect(result.axisScores).toEqual([0, 0, 0, 0, 0]);
  });

  it("picks the earlier axis when the weakest score ties", () => {
    expect(findWeakestAxisIndex([3, 1, 1, 4, 5])).toBe(1);
    expect(computeResult(config, answersForAxisScores([2, 2, 2, 2, 2])).weakestAxisIndex).toBe(0);
  });

  it("names at most two strengths at 4+ points, highest first, ties in axis order", () => {
    expect(findStrengthAxisIndexes([4, 6, 5, 6, 3], aiDx.strengthThreshold, aiDx.maxStrengths)).toEqual([1, 3]);
    expect(findStrengthAxisIndexes([3, 3, 3, 3, 3], aiDx.strengthThreshold, aiDx.maxStrengths)).toEqual([]);
    expect(computeResult(config, answersForAxisScores([4, 4, 0, 0, 0])).strengthAxisIndexes).toEqual([0, 1]);
  });

  it("raises the balance note only for level 3+ with an axis at 0–1", () => {
    expect(hasBalanceWarning(3, 1, aiDx.balanceNote)).toBe(true);
    expect(hasBalanceWarning(3, 2, aiDx.balanceNote)).toBe(false);
    expect(hasBalanceWarning(2, 0, aiDx.balanceNote)).toBe(false);
    // 6+6+1+0+0 = 13 → level 3 with the AI axis at 1 and people at 0.
    const result = computeResult(config, answersForAxisScores([6, 6, 1, 0, 0]));
    expect(result.level).toBe(3);
    expect(result.balanceWarning).toBe(true);
    expect(result.weakestAxisIndex).toBe(3);
  });

  it("collects flags from the chosen options", () => {
    const answers = answersForAxisScores([3, 3, 0, 3, 3]);
    expect(computeResult(config, answers).flags).toEqual(["unknown-ai-usage"]);
    answers.q5 = 1;
    expect(computeResult(config, answers).flags).toEqual([]);
  });
});

describe("answer parameter", () => {
  it("round-trips through the URL", () => {
    const answers = answersForAxisScores([1, 2, 3, 4, 5]);
    const encoded = encodeAnswers(aiDx.questions, answers);
    expect(decodeAnswers(aiDx.questions, encoded)).toEqual(answers);
  });

  it("rejects malformed values", () => {
    expect(decodeAnswers(aiDx.questions, "1.1")).toBeNull();
    expect(decodeAnswers(aiDx.questions, "5.1.1.1.1.1.1.1.1.1")).toBeNull();
  });
});

describe("cta data", () => {
  it("routes low levels to diagnosis/briefing and higher levels to a service consultation", () => {
    const byLevel = Object.fromEntries(aiDx.levels.map((level) => [level.level, level.primaryCta.kind]));
    expect(byLevel[1]).toBe("cross_diagnosis");
    for (const level of [2, 3, 4, 5]) expect(byLevel[level]).toBe("service_contact");
  });

  it("swaps to the briefing for people/organisation and rules weaknesses", () => {
    expect(aiDx.briefingFirstAxisIds).toEqual(["people-org", "rules"]);
    expect(aiDx.briefingCta.kind).toBe("briefing_15min");
  });
});
