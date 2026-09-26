// Saving a free-diagnosis run for the outbound mode (DEV-07 §5-6, DEV-04 §5-6 / §6-1b). The
// server re-runs the diagnosis's own scoring — the client result is recorded, never trusted.
import { diagnosisResponses, diagnosisTokens } from "@app/schema";
import type { DbClient } from "@app/schema/client";
import { ulid } from "@app/schema/ulid";
import { ValidationError } from "@app/server-kit/http";
import { eq } from "drizzle-orm";
import aiDx from "../../../diagnoses/ai-dx/data";
import { computeResult as computeAiDx } from "../../../diagnoses/ai-dx/scoring";
import business from "../../../diagnoses/business/data";
import { computeResult as computeBusiness } from "../../../diagnoses/business/scoring";
import { diagnosisResultPath, PARAM_SCORES, PARAM_VERSION } from "../../diagnosis/routes";
import { ensureDefinition, isDiagnosisSlug, type DiagnosisSlug } from "./diagnosis-definitions";
import { findUsableToken } from "./diagnosis-tokens";
import { sha256Hex } from "./diagnosis-definitions";

export interface SaveResponseInput {
  token: string;
  diagnosis: string;
  definitionVersion: number;
  /** question id → 0-based option index, the same object questions.js scores from. */
  answers: Record<string, number>;
  clientResult?: { resultId: string; secondaryResultId?: string | null } | null;
}

export interface SavedResponse {
  id: string;
  resultId: string;
  secondaryResultId: string | null;
  /** Server-built, without the answers (`a`): this is the URL a sales owner may see. */
  resultUrl: string;
}

interface Scored {
  resultId: string;
  secondaryResultId: string | null;
  scores: Record<string, unknown>;
  flags: string[];
  resultParams: URLSearchParams;
}

// Each diagnosis keeps its own scoring (CLAUDE.md "Diagnoses"); this only dispatches to it.
const DIAGNOSES: Record<DiagnosisSlug, { version: number; questionIds: string[]; optionCount(questionId: string): number; score(answers: Record<string, number>): Scored }> = {
  business: {
    version: business.version,
    questionIds: business.questions.map((question) => question.id),
    optionCount: (questionId) => business.questions.find((question) => question.id === questionId)?.options.length ?? 0,
    score(answers) {
      const result = computeBusiness({ questions: business.questions, concernQuestionId: business.concernQuestionId, tieBreakOrder: business.tieBreakOrder, zeroScoreTypeId: business.zeroScoreTypeId }, answers);
      const scoreTypeIds = business.resultTypes.filter((type) => type.id !== business.zeroScoreTypeId).map((type) => type.id);
      const params = new URLSearchParams();
      params.set(PARAM_VERSION, String(business.version));
      if (result.secondaryId) params.set("second", result.secondaryId.toLowerCase());
      if (result.concernOptionIndex !== null) params.set("concern", String(result.concernOptionIndex + 1));
      params.set(PARAM_SCORES, scoreTypeIds.map((id) => result.totals[id] ?? 0).join("."));
      if (result.notApplicableIds.length > 0) params.set("na", result.notApplicableIds.map((id) => id.toLowerCase()).join("."));
      return {
        resultId: result.primaryId.toLowerCase(),
        secondaryResultId: result.secondaryId?.toLowerCase() ?? null,
        scores: { totals: result.totals, ratios: result.ratios, na: result.notApplicableIds.map((id) => id.toLowerCase()) },
        flags: [],
        resultParams: params,
      };
    },
  },
  "ai-dx": {
    version: aiDx.version,
    questionIds: aiDx.questions.map((question) => question.id),
    optionCount: (questionId) => aiDx.questions.find((question) => question.id === questionId)?.options.length ?? 0,
    score(answers) {
      const result = computeAiDx({ questions: aiDx.questions, axes: aiDx.axes, thresholds: aiDx.thresholds, strengthThreshold: aiDx.strengthThreshold, maxStrengths: aiDx.maxStrengths, balanceNote: aiDx.balanceNote }, answers);
      const params = new URLSearchParams();
      params.set(PARAM_VERSION, String(aiDx.version));
      params.set(PARAM_SCORES, result.axisScores.join("."));
      if (result.flags.length > 0) params.set("f", result.flags.join("."));
      return {
        resultId: `level-${result.level}`,
        secondaryResultId: null,
        scores: { axes: result.axisScores, total: result.totalScore },
        flags: result.flags,
        resultParams: params,
      };
    },
  },
};

function validateAnswers(slug: DiagnosisSlug, answers: Record<string, number>): void {
  const errors: Record<string, string[]> = {};
  const module = DIAGNOSES[slug];
  for (const questionId of module.questionIds) {
    const value = answers[questionId];
    if (value === undefined) errors[questionId] = ["未回答です。"];
    else if (!Number.isInteger(value) || value < 0 || value >= module.optionCount(questionId)) errors[questionId] = ["選択肢の範囲外です。"];
  }
  for (const questionId of Object.keys(answers)) {
    if (!module.questionIds.includes(questionId)) errors[questionId] = ["この診断にない質問です。"];
  }
  if (Object.keys(errors).length > 0) throw new ValidationError(errors);
}

export async function saveDiagnosisResponse(db: DbClient, input: SaveResponseInput, meta: { userAgent: string | null; now?: Date }): Promise<SavedResponse> {
  const now = meta.now ?? new Date();
  const { row: token } = await findUsableToken(db, input.token, now);

  if (!isDiagnosisSlug(input.diagnosis)) throw new ValidationError({ diagnosis: ["対応していない診断です。"] });
  const slug = input.diagnosis;
  const module = DIAGNOSES[slug];
  if (input.definitionVersion !== module.version) throw new ValidationError({ definitionVersion: [`この診断の現在の版は ${module.version} です。ページを再読み込みしてください。`] });
  validateAnswers(slug, input.answers);

  const definition = await ensureDefinition(db, slug);
  const scored = module.score(input.answers);
  const flags = [...scored.flags];
  if (input.clientResult && (input.clientResult.resultId !== scored.resultId || (input.clientResult.secondaryResultId ?? null) !== scored.secondaryResultId)) {
    flags.push("client_mismatch");
  }

  const publicId = ulid();
  scored.resultParams.set("r", publicId);
  const resultUrl = `${diagnosisResultPath(slug, scored.resultId)}?${scored.resultParams}`;
  const useCount = token.useCount + 1;

  await db.batch([
    db.insert(diagnosisResponses).values({
      publicId,
      definitionId: definition.id,
      mode: token.kind === "partner" ? "partner" : "outbound",
      tokenId: token.id,
      answersJson: JSON.stringify(input.answers),
      scoresJson: JSON.stringify(scored.scores),
      resultId: scored.resultId,
      secondaryResultId: scored.secondaryResultId,
      flagsJson: flags.length > 0 ? JSON.stringify(flags) : null,
      userAgentHash: meta.userAgent ? (await sha256Hex(meta.userAgent)).slice(0, 16) : null,
    }),
    // Reaching max_uses expires the token in the same transaction as the save that used it up.
    db
      .update(diagnosisTokens)
      .set({ useCount, status: useCount >= token.maxUses ? "expired" : token.status, updatedAt: now.toISOString() })
      .where(eq(diagnosisTokens.id, token.id)),
  ]);

  return { id: publicId, resultId: scored.resultId, secondaryResultId: scored.secondaryResultId, resultUrl };
}
