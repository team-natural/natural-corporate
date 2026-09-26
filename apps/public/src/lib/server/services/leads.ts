// Contact-details entry from a diagnosis result (DEV-07 §5-7 / §5-8, DEV-04 §5-6). This is the
// one moment an anonymous response gets tied to a company: lead row, response link, briefing
// request and the consent audit entry all land in one batch.
import { briefingRequests, campaigns, diagnosisResponses, diagnosisTokens, leads } from "@app/schema";
import type { DbClient } from "@app/schema/client";
import { ulid } from "@app/schema/ulid";
import { ValidationError } from "@app/server-kit/http";
import { and, eq, isNull, sql } from "drizzle-orm";
import type { LeadFormValues } from "../../diagnosis/lead-schema";
import { diagnosisResultPath } from "../../diagnosis/routes";
import { activityLogInsert } from "../activity-log";

export interface CreatedLead {
  id: string;
  purpose: LeadFormValues["purpose"];
  company: string;
  name: string;
  email: string;
  phone: string | null;
  message: string | null;
  briefingRequestId: string | null;
  /** Context for the notification mail; null when the lead came without a saved response. */
  diagnosis: { slug: string; resultId: string; resultUrl: string } | null;
  campaignName: string | null;
}

export async function createLead(db: DbClient, input: LeadFormValues, options: { now?: Date } = {}): Promise<CreatedLead> {
  const now = (options.now ?? new Date()).toISOString();

  const response = input.responseId ? await findResponse(db, input.responseId) : null;
  // The response's own token wins over one passed in the body — the body is visitor-controlled.
  const tokenId = response?.tokenId ?? (input.token ? await findTokenId(db, input.token) : null);
  const campaign = tokenId ? await findCampaignForToken(db, tokenId) : null;

  const leadPublicId = ulid();
  const leadIdSubquery = sql`(select id from ${leads} where ${leads.publicId} = ${leadPublicId})`;
  const briefingPublicId = input.purpose === "briefing" ? ulid() : null;

  await db.batch([
    db.insert(leads).values({
      publicId: leadPublicId,
      company: input.company,
      name: input.name,
      email: input.email,
      phone: input.phone || null,
      purpose: input.purpose,
      sourceResponseId: response?.id ?? null,
      campaignId: campaign?.id ?? null,
      ownerAdminUserId: campaign?.ownerAdminUserId ?? null,
      status: "new",
      consentPrivacyAt: now,
      notes: input.message || null,
      updatedAt: now,
    }),
    // Only an unlinked response takes the link: the first consent wins, a later re-entry does
    // not re-point somebody else's row.
    ...(response && !response.leadId
      ? [
          db
            .update(diagnosisResponses)
            .set({ leadId: leadIdSubquery })
            .where(and(eq(diagnosisResponses.id, response.id), isNull(diagnosisResponses.leadId))),
        ]
      : []),
    ...(briefingPublicId ? [db.insert(briefingRequests).values({ publicId: briefingPublicId, leadId: leadIdSubquery, responseId: response?.id ?? null, status: "requested", updatedAt: now })] : []),
    activityLogInsert(db, {
      logName: "lead",
      description: `Lead created (${input.purpose}) with privacy consent`,
      subjectType: "Lead",
      event: "lead.created",
      properties: { publicId: leadPublicId, purpose: input.purpose, responseId: response?.publicId ?? null, consentPrivacyAt: now },
    }),
  ]);

  return {
    id: leadPublicId,
    purpose: input.purpose,
    company: input.company,
    name: input.name,
    email: input.email,
    phone: input.phone || null,
    message: input.message || null,
    briefingRequestId: briefingPublicId,
    diagnosis: response ? { slug: response.slug, resultId: response.resultId, resultUrl: `${diagnosisResultPath(response.slug, response.resultId)}?r=${response.publicId}` } : null,
    campaignName: campaign?.name ?? null,
  };
}

async function findResponse(db: DbClient, publicId: string) {
  const [row] = await db.select({ id: diagnosisResponses.id, publicId: diagnosisResponses.publicId, tokenId: diagnosisResponses.tokenId, leadId: diagnosisResponses.leadId, resultId: diagnosisResponses.resultId, definitionId: diagnosisResponses.definitionId }).from(diagnosisResponses).where(eq(diagnosisResponses.publicId, publicId)).limit(1);
  if (!row) throw new ValidationError({ responseId: ["診断結果が見つかりません。"] });
  const slug = await findResponseSlug(db, row.definitionId);
  return { ...row, slug };
}

async function findResponseSlug(db: DbClient, definitionId: number): Promise<string> {
  const [row] = await db
    .select({ slug: sql<string>`(select slug from diagnosis_definitions where id = ${definitionId})` })
    .from(diagnosisResponses)
    .limit(1);
  return row?.slug ?? "business";
}

async function findTokenId(db: DbClient, token: string): Promise<number | null> {
  // Any status: a lead after the token expired still belongs to its campaign.
  const [row] = await db.select({ id: diagnosisTokens.id }).from(diagnosisTokens).where(eq(diagnosisTokens.token, token)).limit(1);
  return row?.id ?? null;
}

async function findCampaignForToken(db: DbClient, tokenId: number) {
  const [row] = await db.select({ id: campaigns.id, name: campaigns.name, ownerAdminUserId: campaigns.ownerAdminUserId }).from(diagnosisTokens).innerJoin(campaigns, eq(diagnosisTokens.campaignId, campaigns.id)).where(eq(diagnosisTokens.id, tokenId)).limit(1);
  return row ?? null;
}
