import { describe, expect, it } from "vitest";
import business from "../../src/diagnoses/business/data";
import { computeResult, decodeAnswers, encodeAnswers, maxPointsByType } from "../../src/diagnoses/business/scoring";

const config = { questions: business.questions, concernQuestionId: business.concernQuestionId, tieBreakOrder: business.tieBreakOrder, zeroScoreTypeId: business.zeroScoreTypeId };
const scoredQuestions = business.questions.filter((question) => question.id !== business.concernQuestionId);
const NO_CONCERN = business.questions[0].options.length - 1;

// Every "no issue" option per question, so a single answer can be flipped in isolation.
function cleanAnswers(): Record<string, number> {
  const answers: Record<string, number> = { q0: NO_CONCERN };
  for (const question of scoredQuestions) {
    answers[question.id] = question.options.findIndex((option) => Object.keys(option.scores).length === 0 && !option.notApplicable);
  }
  return answers;
}

function optionIndexScoring(questionId: string, typeId: string): number {
  const question = business.questions.find((q) => q.id === questionId)!;
  return question.options.findIndex((option) => option.scores[typeId] !== undefined);
}

describe("business v2 definition", () => {
  it("reachable maxima follow from the table (PRD-07 §1-2 lists A as 4; q1 + q2 + q3 actually give 5)", () => {
    expect(maxPointsByType(business.questions)).toEqual({ A: 5, B: 3, C: 5, D: 3, E: 5, F: 3, G: 3, H: 5, I: 2 });
  });

  it("the concern question adds no points", () => {
    const concern = business.questions.find((q) => q.id === business.concernQuestionId)!;
    for (const option of concern.options) expect(option.scores).toEqual({});
  });

  it("every not-applicable option scores nothing", () => {
    for (const question of business.questions) {
      for (const option of question.options) {
        if (option.notApplicable) expect(option.scores).toEqual({});
      }
    }
  });
});

describe("computeResult", () => {
  it("returns the all-clear type when nothing scores, with no strengths or reasons", () => {
    const result = computeResult(config, cleanAnswers());
    expect(result.primaryId).toBe("Z");
    expect(result.secondaryId).toBeNull();
    expect(result.strengthIds).toEqual([]);
    expect(result.reasons).toEqual([]);
  });

  it("compares by ratio, not raw points", () => {
    // I reaches 2/2 = 100% from one answer; C gets 3/5 = 60% from two answers.
    const answers = cleanAnswers();
    answers.q4 = 0; // I+2
    answers.q6 = 1; // C+2
    answers.q7 = 1; // E+1, C+1
    const result = computeResult(config, answers);
    expect(result.totals.C).toBe(3);
    expect(result.totals.I).toBe(2);
    expect(result.primaryId).toBe("I");
    expect(result.secondaryId).toBe("C");
    expect(result.ratios.I).toBeCloseTo(1);
    expect(result.ratios.C).toBeCloseTo(0.6);
  });

  it("excludes not-applicable types from ratios, strengths and the judgement", () => {
    const answers = cleanAnswers();
    answers.q2 = 3; // Web not needed → A out
    answers.q1 = 0; // A+2, H+1 — A would otherwise win
    const result = computeResult(config, answers);
    expect(result.notApplicableIds).toEqual(["A"]);
    expect(result.ratios.A).toBeUndefined();
    expect(result.primaryId).toBe("H");
    expect(result.strengthIds).not.toContain("A");
  });

  it("breaks ratio ties by concern, then by the fixed order", () => {
    const answers = cleanAnswers();
    answers.q5 = 0; // D+2 → 2/3
    answers.q9 = 0; // F+2 → 2/3
    expect(computeResult(config, { ...answers, q0: 5 }).primaryId).toBe("F"); // concern 6 → F
    expect(computeResult(config, { ...answers, q0: 3 }).primaryId).toBe("D"); // concern 4 → D, E, G
    expect(computeResult(config, { ...answers, q0: NO_CONCERN }).primaryId).toBe("D"); // fixed order: D before F
  });

  it("lists strengths as 0% types in display order, capped at three", () => {
    const answers = cleanAnswers();
    answers.q4 = 0; // I only
    const result = computeResult(config, answers);
    expect(result.strengthIds).toHaveLength(3);
    expect(result.strengthIds).toEqual(business.tieBreakOrder.filter((id) => id !== "I").slice(0, 3));
  });

  it("quotes the answers that scored the primary type, highest points first, capped at three", () => {
    const answers = cleanAnswers();
    answers.q6 = 0; // C+2, E+1
    answers.q7 = 0; // E+2, B+1
    answers.q8 = 1; // G+2, E+1
    answers.q3 = 0; // B+2, E+1 → E reaches 5/5 but so does B (3/3); the fixed order picks B
    expect(computeResult(config, answers).primaryId).toBe("B");
    answers.q3 = 3; // no score → E 4/5 wins outright
    const result = computeResult(config, answers);
    expect(result.primaryId).toBe("E");
    expect(result.reasons).toHaveLength(3);
    expect(result.reasons[0]).toEqual({ questionId: "q7", optionIndex: 0, points: 2 });
    expect(result.reasons.slice(1).map((reason) => reason.questionId)).toEqual(["q6", "q8"]);
  });

  it("ignores answers to unknown questions and out-of-range options", () => {
    const answers = cleanAnswers();
    answers.q99 = 0;
    answers.q1 = 42;
    expect(computeResult(config, answers).primaryId).toBe("Z");
  });
});

describe("answer parameter", () => {
  it("round-trips through the URL as 1-based option numbers", () => {
    const answers = cleanAnswers();
    answers.q1 = 2;
    const encoded = encodeAnswers(business.questions, answers);
    expect(encoded.split(".")).toHaveLength(business.questions.length);
    expect(encoded.split(".")[1]).toBe("3");
    expect(decodeAnswers(business.questions, encoded)).toEqual(answers);
  });

  it("rejects malformed values instead of guessing", () => {
    expect(decodeAnswers(business.questions, null)).toBeNull();
    expect(decodeAnswers(business.questions, "1.2")).toBeNull();
    expect(decodeAnswers(business.questions, "9.1.1.1.1.1.1.1.1.1")).toBeNull();
    expect(decodeAnswers(business.questions, "x.1.1.1.1.1.1.1.1.1")).toBeNull();
  });
});

describe("full-combination simulation (GOV-02 TBD-21 input)", () => {
  it("covers every type, keeps ties rare and prints the distribution", () => {
    const counts: Record<string, number> = {};
    const rawCounts: Record<string, number> = {};
    let total = 0;
    let ties = 0;
    let zero = 0;
    const answers: Record<string, number> = { q0: NO_CONCERN };

    const walk = (depth: number) => {
      if (depth === scoredQuestions.length) {
        total += 1;
        const result = computeResult(config, answers);
        counts[result.primaryId] = (counts[result.primaryId] ?? 0) + 1;
        if (result.primaryId === business.zeroScoreTypeId) zero += 1;
        const top = Math.max(0, ...Object.values(result.ratios));
        if (top > 0 && Object.values(result.ratios).filter((ratio) => Math.abs(ratio - top) < 1e-9).length > 1) ties += 1;
        // Reference only: the v1 rule (highest raw points, same fixed order) on the same answers.
        const rawTop = Math.max(0, ...Object.values(result.totals));
        const rawPrimary = rawTop === 0 ? business.zeroScoreTypeId : business.tieBreakOrder.find((id) => result.totals[id] === rawTop)!;
        rawCounts[rawPrimary] = (rawCounts[rawPrimary] ?? 0) + 1;
        return;
      }
      const question = scoredQuestions[depth];
      for (let i = 0; i < question.options.length; i++) {
        answers[question.id] = i;
        walk(depth + 1);
      }
    };
    walk(0);

    const pct = (n: number) => `${((100 * n) / total).toFixed(2).padStart(6)}%`;
    const rows = business.resultTypes.map((type) => `${type.id} ${type.name.padEnd(10, "　")} ratio ${pct(counts[type.id] ?? 0)}   raw ${pct(rawCounts[type.id] ?? 0)}`);
    console.log([`business v2 simulation: ${total} combinations (concern = none)`, ...rows, `ties resolved by fixed order: ${pct(ties)}`, `Z (all clear): ${pct(zero)}`].join("\n"));

    for (const type of business.resultTypes) expect(counts[type.id] ?? 0).toBeGreaterThan(0);
    expect(zero).toBeGreaterThan(0);
  });

  it("uses the concern to resolve ties whenever one applies", () => {
    let concernTies = 0;
    let concernResolved = 0;
    const answers: Record<string, number> = {};
    const concern = business.questions[0];

    const walk = (depth: number) => {
      if (depth === scoredQuestions.length) {
        const base = computeResult(config, { ...answers, q0: NO_CONCERN });
        const top = Math.max(0, ...Object.values(base.ratios));
        const tied = Object.keys(base.ratios).filter((id) => Math.abs(base.ratios[id] - top) < 1e-9);
        if (top === 0 || tied.length < 2) return;
        concern.options.forEach((option, index) => {
          const hit = tied.filter((id) => option.concerns?.includes(id));
          if (hit.length === 0) return;
          concernTies += 1;
          if (hit.includes(computeResult(config, { ...answers, q0: index }).primaryId)) concernResolved += 1;
        });
        return;
      }
      const question = scoredQuestions[depth];
      for (let i = 0; i < question.options.length; i++) {
        answers[question.id] = i;
        walk(depth + 1);
      }
    };
    walk(0);

    expect(concernTies).toBeGreaterThan(0);
    expect(concernResolved).toBe(concernTies);
  });
});

describe("cta data", () => {
  it("gives every type a service consultation or the cross diagnosis as its primary route", () => {
    for (const type of business.resultTypes) {
      expect(["service_contact", "cross_diagnosis"]).toContain(type.primaryCta.kind);
      if (type.primaryCta.kind === "service_contact") expect(type.primaryCta.inquiryType).toBeTruthy();
    }
  });

  it("resolves the option indexes used by the tests above", () => {
    expect(optionIndexScoring("q4", "I")).toBe(0);
    expect(optionIndexScoring("q6", "C")).toBe(0);
  });
});
