// diagnosis_definitions snapshots (DEV-07 §5-3). The repository's data.ts stays the source of
// truth; a row exists so a saved response can say which version it answered. Rows are created
// lazily on the first save of a version and never updated.
import { diagnosisDefinitions } from "@app/schema";
import type { DbClient } from "@app/schema/client";
import { AppError } from "@app/server-kit/http";
import { and, eq } from "drizzle-orm";
import aiDx from "../../../diagnoses/ai-dx/data";
import business from "../../../diagnoses/business/data";

export type DiagnosisSlug = "business" | "ai-dx";

export function isDiagnosisSlug(value: string): value is DiagnosisSlug {
  return value === "business" || value === "ai-dx";
}

// Only what decides a result goes into the hash: ids, points, flags, thresholds. Copy edits
// keep the version; a re-weighted option without a version bump is what this must catch.
export function definitionSnapshot(slug: DiagnosisSlug): { version: number; scoring: unknown; full: unknown } {
  if (slug === "business") {
    return {
      version: business.version,
      scoring: {
        slug,
        version: business.version,
        concernQuestionId: business.concernQuestionId,
        tieBreakOrder: business.tieBreakOrder,
        zeroScoreTypeId: business.zeroScoreTypeId,
        questions: business.questions.map((question) => ({ id: question.id, options: question.options.map((option) => ({ scores: option.scores, concerns: option.concerns ?? [], notApplicable: option.notApplicable ?? [] })) })),
        resultTypeIds: business.resultTypes.map((type) => type.id),
      },
      full: { slug, version: business.version, questions: business.questions, resultTypes: business.resultTypes.map((type) => ({ id: type.id, name: type.name })) },
    };
  }
  return {
    version: aiDx.version,
    scoring: {
      slug,
      version: aiDx.version,
      axes: aiDx.axes.map((axis) => axis.id),
      thresholds: aiDx.thresholds,
      questions: aiDx.questions.map((question) => ({ id: question.id, axisId: question.axisId, options: question.options.map((option) => ({ points: option.points, flag: option.flag ?? null })) })),
      strengthThreshold: aiDx.strengthThreshold,
      maxStrengths: aiDx.maxStrengths,
      balanceNote: aiDx.balanceNote,
    },
    full: { slug, version: aiDx.version, questions: aiDx.questions, axes: aiDx.axes, levels: aiDx.levels.map((level) => ({ id: level.id, level: level.level, name: level.name })) },
  };
}

export async function sha256Hex(input: string): Promise<string> {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(input));
  return Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, "0")).join("");
}

export class DefinitionHashMismatchError extends AppError {
  constructor(slug: string, version: number) {
    super(`診断定義 ${slug} v${version} の内容が保存済みのスナップショットと一致しません。version を上げてください。`, 500, "DEFINITION_HASH_MISMATCH");
  }
}

// Get-or-create by (slug, version). A stored hash that differs from the code's means the
// scoring changed without a version bump — refuse rather than mix two rule sets under one id.
export async function ensureDefinition(db: DbClient, slug: DiagnosisSlug): Promise<{ id: number; version: number }> {
  const snapshot = definitionSnapshot(slug);
  const hash = await sha256Hex(JSON.stringify(snapshot.scoring));

  const [existing] = await db
    .select({ id: diagnosisDefinitions.id, hash: diagnosisDefinitions.definitionHash })
    .from(diagnosisDefinitions)
    .where(and(eq(diagnosisDefinitions.slug, slug), eq(diagnosisDefinitions.version, snapshot.version)))
    .limit(1);
  if (existing) {
    if (existing.hash !== hash) throw new DefinitionHashMismatchError(slug, snapshot.version);
    return { id: existing.id, version: snapshot.version };
  }

  const now = new Date().toISOString();
  const [inserted] = await db
    .insert(diagnosisDefinitions)
    .values({ slug, version: snapshot.version, definitionJson: JSON.stringify(snapshot.full), definitionHash: hash, publishedAt: now })
    .returning({ id: diagnosisDefinitions.id });
  return { id: inserted!.id, version: snapshot.version };
}
