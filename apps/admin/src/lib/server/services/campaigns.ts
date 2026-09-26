// Campaigns (DEV-07 §5-4, DEV-09 §2-7b) and the tokens they issue (DEV-07 §5-5, DEV-09 §2-3).
// Same conventions as inquiries.ts: integer ids stay inside, status has one writer per entity,
// the audit entry shares the batch with the change.
import { adminUsers, campaigns, diagnosisResponses, diagnosisTokens } from "@app/schema";
import type { DbClient } from "@app/schema/client";
import { ulid } from "@app/schema/ulid";
import { newSessionToken } from "@app/server-kit/auth";
import { InvalidStateTransitionError, NotFoundError, ValidationError } from "@app/server-kit/http";
import { and, desc, eq, lt, sql } from "drizzle-orm";
import type { Session } from "../auth/session";
import type { CreateCampaignInput, IssueTokensInput, UpdateCampaignInput } from "../validation/campaigns";
import { activityLogInsert } from "./activity-log";

export type CampaignStatus = "draft" | "active" | "closed";

const TRANSITIONS: Record<CampaignStatus, CampaignStatus[]> = {
  draft: ["active"],
  active: ["closed"],
  // Reopening is allowed; going back to draft is not (tokens may already be out).
  closed: ["active"],
};

export function allowedCampaignTransitions(status: CampaignStatus): CampaignStatus[] {
  return TRANSITIONS[status] ?? [];
}

// Outbound tokens live 90 days (DEV-07 §5-5); partner tokens are Phase 4.
export const OUTBOUND_TOKEN_TTL_DAYS = 90;
export const DEFAULT_TOKEN_MAX_USES = 3;
export const MAX_TOKENS_PER_ISSUE = 500;

type CampaignRow = typeof campaigns.$inferSelect;
type TokenRow = typeof diagnosisTokens.$inferSelect;

export function toPublicCampaign(row: CampaignRow, owner: { publicId: string; name: string } | null) {
  return {
    id: row.publicId,
    name: row.name,
    channel: row.channel,
    diagnosisSlug: row.diagnosisSlug,
    introCopy: row.introCopy,
    status: row.status,
    sentAt: row.sentAt,
    notes: row.notes,
    owner: owner ? { id: owner.publicId, name: owner.name } : null,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  };
}

// Deliberately no company or contact name: a token is a send, not a person (DEV-11 §8).
export function toPublicToken(row: TokenRow, stats: { responses: number; leads: number }) {
  return {
    token: row.token,
    entryPath: `/d/${row.token}/`,
    kind: row.kind,
    recipientRef: row.recipientRef,
    diagnosisSlug: row.diagnosisSlug,
    status: row.status,
    expiresAt: row.expiresAt,
    maxUses: row.maxUses,
    useCount: row.useCount,
    firstClickedAt: row.firstClickedAt,
    responses: stats.responses,
    leads: stats.leads,
    createdAt: row.createdAt,
  };
}

const DEFAULT_PER_PAGE = 20;
const MAX_PER_PAGE = 100;
const clampPerPage = (perPage?: number) => Math.min(Math.max(perPage ?? DEFAULT_PER_PAGE, 1), MAX_PER_PAGE);

export async function listCampaigns(db: DbClient, options: { beforeId?: number | null; perPage?: number; status?: CampaignStatus }) {
  const perPage = clampPerPage(options.perPage);
  const rows = await db
    .select({ campaign: campaigns, owner: { publicId: adminUsers.publicId, name: adminUsers.name } })
    .from(campaigns)
    .innerJoin(adminUsers, eq(campaigns.ownerAdminUserId, adminUsers.id))
    .where(and(options.beforeId ? lt(campaigns.id, options.beforeId) : undefined, options.status ? eq(campaigns.status, options.status) : undefined))
    .orderBy(desc(campaigns.id))
    .limit(perPage + 1);

  const hasMore = rows.length > perPage;
  const page = rows.slice(0, perPage);
  return { items: page.map((row) => toPublicCampaign(row.campaign, row.owner)), perPage, nextId: hasMore ? page[page.length - 1]!.campaign.id : null };
}

async function findCampaignRow(db: DbClient, publicId: string) {
  const [row] = await db
    .select({ campaign: campaigns, owner: { publicId: adminUsers.publicId, name: adminUsers.name } })
    .from(campaigns)
    .innerJoin(adminUsers, eq(campaigns.ownerAdminUserId, adminUsers.id))
    .where(eq(campaigns.publicId, publicId))
    .limit(1);
  if (!row) throw new NotFoundError("キャンペーンが見つかりません。");
  return row;
}

export async function getCampaignByPublicId(db: DbClient, publicId: string) {
  const row = await findCampaignRow(db, publicId);
  return toPublicCampaign(row.campaign, row.owner);
}

export async function createCampaign(db: DbClient, input: CreateCampaignInput, session: Session) {
  const now = new Date().toISOString();
  const publicId = ulid();
  const [inserted] = await db.batch([
    db
      .insert(campaigns)
      .values({ publicId, name: input.name, channel: input.channel, diagnosisSlug: input.diagnosisSlug, introCopy: input.introCopy ?? null, sentAt: input.sentAt ?? null, notes: input.notes ?? null, ownerAdminUserId: session.adminUserId, status: "draft", updatedAt: now })
      .returning(),
    activityLogInsert(db, { logName: "campaign", description: `Campaign created (${input.channel})`, subjectType: "Campaign", event: "campaign.created", causerId: session.adminUserId, properties: { publicId, name: input.name } }),
  ]);
  return getCampaignByPublicId(db, inserted[0]!.publicId);
}

// Only drafts change shape; once tokens are out, the copy the recipients saw is fixed.
export async function updateCampaign(db: DbClient, publicId: string, input: UpdateCampaignInput, session: Session) {
  const { campaign } = await findCampaignRow(db, publicId);
  if (campaign.status !== "draft") throw new InvalidStateTransitionError("Campaign", campaign.status, "edited");

  await db.batch([
    db
      .update(campaigns)
      .set({ ...input, updatedAt: new Date().toISOString() })
      .where(eq(campaigns.id, campaign.id)),
    activityLogInsert(db, { logName: "campaign", description: "Campaign updated", subjectType: "Campaign", subjectId: campaign.id, event: "campaign.updated", causerId: session.adminUserId, properties: { publicId, fields: Object.keys(input) } }),
  ]);
  return getCampaignByPublicId(db, publicId);
}

export async function transitionCampaign(db: DbClient, publicId: string, to: CampaignStatus, session: Session) {
  const { campaign } = await findCampaignRow(db, publicId);
  const from = campaign.status;
  if (!allowedCampaignTransitions(from).includes(to)) throw new InvalidStateTransitionError("Campaign", from, to);

  await db.batch([db.update(campaigns).set({ status: to, updatedAt: new Date().toISOString() }).where(eq(campaigns.id, campaign.id)), activityLogInsert(db, { logName: "campaign", description: `Campaign ${from} -> ${to}`, subjectType: "Campaign", subjectId: campaign.id, event: `campaign.${to}`, causerId: session.adminUserId, properties: { from, to } })]);
  return getCampaignByPublicId(db, publicId);
}

// One token per recipient (GOV-02 TBD-20). recipientRefs, when given, pair with the tokens in
// order; they are list-row references, never names or addresses.
export async function issueTokens(db: DbClient, campaignPublicId: string, input: IssueTokensInput, session: Session) {
  const { campaign } = await findCampaignRow(db, campaignPublicId);
  if (campaign.status === "closed") throw new InvalidStateTransitionError("Campaign", campaign.status, "issue tokens");
  if (input.recipientRefs && input.recipientRefs.length !== input.count) {
    throw new ValidationError({ recipientRefs: ["宛先参照の数が発行数と一致しません。"] });
  }

  const now = new Date();
  const expiresAt = new Date(now.getTime() + OUTBOUND_TOKEN_TTL_DAYS * 86_400_000).toISOString();
  const values = Array.from({ length: input.count }, (_, i) => ({
    token: newSessionToken(),
    kind: "outbound" as const,
    campaignId: campaign.id,
    recipientRef: input.recipientRefs?.[i] ?? null,
    diagnosisSlug: campaign.diagnosisSlug,
    expiresAt,
    maxUses: DEFAULT_TOKEN_MAX_USES,
    status: "active" as const,
    updatedAt: now.toISOString(),
  }));

  const [inserted] = await db.batch([db.insert(diagnosisTokens).values(values).returning(), activityLogInsert(db, { logName: "campaign", description: `${input.count} token(s) issued`, subjectType: "Campaign", subjectId: campaign.id, event: "campaign.tokens_issued", causerId: session.adminUserId, properties: { publicId: campaignPublicId, count: input.count } })]);
  return inserted.map((row) => toPublicToken(row, { responses: 0, leads: 0 }));
}

export async function listTokens(db: DbClient, campaignPublicId: string, options: { beforeId?: number | null; perPage?: number }) {
  const { campaign } = await findCampaignRow(db, campaignPublicId);
  const perPage = clampPerPage(options.perPage);
  const responses = sql<number>`(select count(*) from ${diagnosisResponses} where ${diagnosisResponses.tokenId} = ${diagnosisTokens.id})`;
  const leads = sql<number>`(select count(*) from ${diagnosisResponses} where ${diagnosisResponses.tokenId} = ${diagnosisTokens.id} and ${diagnosisResponses.leadId} is not null)`;
  const rows = await db
    .select({ token: diagnosisTokens, responses, leads })
    .from(diagnosisTokens)
    .where(and(eq(diagnosisTokens.campaignId, campaign.id), options.beforeId ? lt(diagnosisTokens.id, options.beforeId) : undefined))
    .orderBy(desc(diagnosisTokens.id))
    .limit(perPage + 1);

  const hasMore = rows.length > perPage;
  const page = rows.slice(0, perPage);
  return { items: page.map((row) => toPublicToken(row.token, { responses: Number(row.responses), leads: Number(row.leads) })), perPage, nextId: hasMore ? page[page.length - 1]!.token.id : null };
}

// The only status writer on the admin side; expiry by date or by use count is the public
// save path / daily job (DEV-09 §2-3).
export async function revokeToken(db: DbClient, campaignPublicId: string, token: string, session: Session) {
  const { campaign } = await findCampaignRow(db, campaignPublicId);
  const [row] = await db
    .select()
    .from(diagnosisTokens)
    .where(and(eq(diagnosisTokens.token, token), eq(diagnosisTokens.campaignId, campaign.id)))
    .limit(1);
  if (!row) throw new NotFoundError("トークンが見つかりません。");
  if (row.status !== "active") throw new InvalidStateTransitionError("DiagnosisToken", row.status, "revoked");

  const [updated] = await db.batch([db.update(diagnosisTokens).set({ status: "revoked", updatedAt: new Date().toISOString() }).where(eq(diagnosisTokens.id, row.id)).returning(), activityLogInsert(db, { logName: "campaign", description: "Token revoked", subjectType: "DiagnosisToken", subjectId: row.id, event: "token.revoked", causerId: session.adminUserId, properties: { campaign: campaignPublicId, recipientRef: row.recipientRef } })]);
  return toPublicToken(updated[0]!, { responses: 0, leads: 0 });
}
