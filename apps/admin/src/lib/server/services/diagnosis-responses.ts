// Saved runs, read-only on this side (apps/public writes them). A row without lead_id is shown
// anonymous: no recipient reference is joined to a company here (DEV-11 §8).
import { campaigns, diagnosisDefinitions, diagnosisResponses, diagnosisTokens, leads } from "@app/schema";
import type { DbClient } from "@app/schema/client";
import { NotFoundError } from "@app/server-kit/http";
import { and, desc, eq, gte, lt, lte } from "drizzle-orm";

export type ResponseMode = "outbound" | "partner" | "paid";

const selection = {
  response: diagnosisResponses,
  definition: { slug: diagnosisDefinitions.slug, version: diagnosisDefinitions.version },
  campaignPublicId: campaigns.publicId,
  campaignName: campaigns.name,
  recipientRef: diagnosisTokens.recipientRef,
  lead: { publicId: leads.publicId, company: leads.company, name: leads.name, status: leads.status },
};

type Joined = { response: typeof diagnosisResponses.$inferSelect; definition: { slug: string; version: number }; campaignPublicId: string | null; campaignName: string | null; recipientRef: string | null; lead: { publicId: string; company: string; name: string; status: string } | null };

function parseJson<T>(value: string | null, fallback: T): T {
  if (!value) return fallback;
  try {
    return JSON.parse(value) as T;
  } catch {
    return fallback;
  }
}

export function toPublicResponse(row: Joined) {
  const linked = row.lead && row.lead.publicId;
  return {
    id: row.response.publicId,
    diagnosis: row.definition.slug,
    definitionVersion: row.definition.version,
    mode: row.response.mode,
    resultId: row.response.resultId,
    secondaryResultId: row.response.secondaryResultId,
    flags: parseJson<string[]>(row.response.flagsJson, []),
    campaign: row.campaignPublicId ? { id: row.campaignPublicId, name: row.campaignName } : null,
    // The list row reference is a candidate only; it never appears next to a company name.
    recipientRef: linked ? null : row.recipientRef,
    lead: linked ? { id: row.lead!.publicId, company: row.lead!.company, name: row.lead!.name, status: row.lead!.status } : null,
    createdAt: row.response.createdAt,
  };
}

export function toPublicResponseDetail(row: Joined) {
  return {
    ...toPublicResponse(row),
    answers: parseJson<Record<string, number>>(row.response.answersJson, {}),
    scores: parseJson<Record<string, unknown>>(row.response.scoresJson, {}),
  };
}

const DEFAULT_PER_PAGE = 20;
const MAX_PER_PAGE = 100;

export interface ListResponsesOptions {
  beforeId?: number | null;
  perPage?: number;
  mode?: ResponseMode;
  campaignId?: string;
  resultId?: string;
  from?: string;
  to?: string;
}

function baseQuery(db: DbClient) {
  return db.select(selection).from(diagnosisResponses).innerJoin(diagnosisDefinitions, eq(diagnosisResponses.definitionId, diagnosisDefinitions.id)).leftJoin(diagnosisTokens, eq(diagnosisResponses.tokenId, diagnosisTokens.id)).leftJoin(campaigns, eq(diagnosisTokens.campaignId, campaigns.id)).leftJoin(leads, eq(diagnosisResponses.leadId, leads.id));
}

export async function listResponses(db: DbClient, options: ListResponsesOptions) {
  const perPage = Math.min(Math.max(options.perPage ?? DEFAULT_PER_PAGE, 1), MAX_PER_PAGE);
  const rows = await baseQuery(db)
    .where(and(options.beforeId ? lt(diagnosisResponses.id, options.beforeId) : undefined, options.mode ? eq(diagnosisResponses.mode, options.mode) : undefined, options.campaignId ? eq(campaigns.publicId, options.campaignId) : undefined, options.resultId ? eq(diagnosisResponses.resultId, options.resultId) : undefined, options.from ? gte(diagnosisResponses.createdAt, options.from) : undefined, options.to ? lte(diagnosisResponses.createdAt, options.to) : undefined))
    .orderBy(desc(diagnosisResponses.id))
    .limit(perPage + 1);

  const hasMore = rows.length > perPage;
  const page = rows.slice(0, perPage);
  return { items: page.map((row) => toPublicResponse(row as Joined)), perPage, nextId: hasMore ? page[page.length - 1]!.response.id : null };
}

export async function getResponseByPublicId(db: DbClient, publicId: string) {
  const [row] = await baseQuery(db).where(eq(diagnosisResponses.publicId, publicId)).limit(1);
  if (!row) throw new NotFoundError("回答が見つかりません。");
  return toPublicResponseDetail(row as Joined);
}
