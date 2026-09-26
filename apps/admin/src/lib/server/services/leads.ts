// Leads (DEV-07 §5-7, DEV-09 §2-4). Created by apps/public; here they are read, assigned and
// moved through the pipeline. `status` has one writer: transitionLead.
import { adminUsers, briefingRequests, campaigns, diagnosisDefinitions, diagnosisResponses, leads } from "@app/schema";
import type { DbClient } from "@app/schema/client";
import { InvalidStateTransitionError, NotFoundError, ValidationError } from "@app/server-kit/http";
import { and, desc, eq, lt } from "drizzle-orm";
import type { Session } from "../auth/session";
import type { UpdateLeadInput } from "../validation/leads";
import { activityLogInsert } from "./activity-log";

export type LeadStatus = "new" | "contacted" | "qualified" | "nurturing" | "converted" | "lost";

const TRANSITIONS: Record<LeadStatus, LeadStatus[]> = {
  new: ["contacted", "nurturing", "lost"],
  contacted: ["qualified", "nurturing", "converted", "lost"],
  qualified: ["contacted", "nurturing", "converted", "lost"],
  nurturing: ["contacted", "qualified", "converted", "lost"],
  converted: [],
  lost: ["contacted", "nurturing"],
};

export function allowedLeadTransitions(status: LeadStatus): LeadStatus[] {
  return TRANSITIONS[status] ?? [];
}

type LeadRow = typeof leads.$inferSelect;

const selection = {
  lead: leads,
  owner: { publicId: adminUsers.publicId, name: adminUsers.name },
  campaign: { publicId: campaigns.publicId, name: campaigns.name },
};

type Joined = { lead: LeadRow; owner: { publicId: string; name: string } | null; campaign: { publicId: string; name: string } | null };

export function toPublicLead(row: Joined) {
  return {
    id: row.lead.publicId,
    company: row.lead.company,
    name: row.lead.name,
    email: row.lead.email,
    phone: row.lead.phone,
    purpose: row.lead.purpose,
    status: row.lead.status,
    owner: row.owner?.publicId ? { id: row.owner.publicId, name: row.owner.name } : null,
    campaign: row.campaign?.publicId ? { id: row.campaign.publicId, name: row.campaign.name } : null,
    consentPrivacyAt: row.lead.consentPrivacyAt,
    notes: row.lead.notes,
    createdAt: row.lead.createdAt,
    updatedAt: row.lead.updatedAt,
  };
}

const DEFAULT_PER_PAGE = 20;
const MAX_PER_PAGE = 100;

function baseQuery(db: DbClient) {
  return db.select(selection).from(leads).leftJoin(adminUsers, eq(leads.ownerAdminUserId, adminUsers.id)).leftJoin(campaigns, eq(leads.campaignId, campaigns.id));
}

export async function listLeads(db: DbClient, options: { beforeId?: number | null; perPage?: number; status?: LeadStatus }) {
  const perPage = Math.min(Math.max(options.perPage ?? DEFAULT_PER_PAGE, 1), MAX_PER_PAGE);
  const rows = await baseQuery(db)
    .where(and(options.beforeId ? lt(leads.id, options.beforeId) : undefined, options.status ? eq(leads.status, options.status) : undefined))
    .orderBy(desc(leads.id))
    .limit(perPage + 1);
  const hasMore = rows.length > perPage;
  const page = rows.slice(0, perPage);
  return { items: page.map((row) => toPublicLead(row as Joined)), perPage, nextId: hasMore ? page[page.length - 1]!.lead.id : null };
}

async function findLeadJoined(db: DbClient, publicId: string): Promise<Joined> {
  const [row] = await baseQuery(db).where(eq(leads.publicId, publicId)).limit(1);
  if (!row) throw new NotFoundError("リードが見つかりません。");
  return row as Joined;
}

// Detail adds the linked response summary and the briefing history; both are the lead's own.
export async function getLeadByPublicId(db: DbClient, publicId: string) {
  const joined = await findLeadJoined(db, publicId);
  const [response] = joined.lead.sourceResponseId ? await db.select({ publicId: diagnosisResponses.publicId, resultId: diagnosisResponses.resultId, secondaryResultId: diagnosisResponses.secondaryResultId, slug: diagnosisDefinitions.slug, createdAt: diagnosisResponses.createdAt }).from(diagnosisResponses).innerJoin(diagnosisDefinitions, eq(diagnosisResponses.definitionId, diagnosisDefinitions.id)).where(eq(diagnosisResponses.id, joined.lead.sourceResponseId)).limit(1) : [];
  const briefings = await db.select().from(briefingRequests).where(eq(briefingRequests.leadId, joined.lead.id)).orderBy(desc(briefingRequests.id));
  return {
    ...toPublicLead(joined),
    response: response ? { id: response.publicId, diagnosis: response.slug, resultId: response.resultId, secondaryResultId: response.secondaryResultId, createdAt: response.createdAt } : null,
    briefings: briefings.map((row) => ({ id: row.publicId, status: row.status, scheduledAt: row.scheduledAt, heldAt: row.heldAt, outcome: row.outcome, externalRef: row.externalRef, notes: row.notes, createdAt: row.createdAt })),
  };
}

export async function updateLead(db: DbClient, publicId: string, input: UpdateLeadInput, session: Session) {
  const { lead } = await findLeadJoined(db, publicId);
  let ownerAdminUserId: number | null | undefined;
  if (input.ownerId !== undefined) {
    if (input.ownerId === null) ownerAdminUserId = null;
    else {
      const [owner] = await db.select({ id: adminUsers.id }).from(adminUsers).where(eq(adminUsers.publicId, input.ownerId)).limit(1);
      if (!owner) throw new ValidationError({ ownerId: ["担当者が見つかりません。"] });
      ownerAdminUserId = owner.id;
    }
  }

  await db.batch([
    db
      .update(leads)
      .set({ ...(input.notes !== undefined ? { notes: input.notes } : {}), ...(input.phone !== undefined ? { phone: input.phone } : {}), ...(ownerAdminUserId !== undefined ? { ownerAdminUserId } : {}), updatedAt: new Date().toISOString() })
      .where(eq(leads.id, lead.id)),
    activityLogInsert(db, { logName: "lead", description: "Lead updated", subjectType: "Lead", subjectId: lead.id, event: "lead.updated", causerId: session.adminUserId, properties: { publicId, fields: Object.keys(input) } }),
  ]);
  return getLeadByPublicId(db, publicId);
}

export interface TransitionLeadOptions {
  /** system-driven moves (briefing outcome, later payment confirmation) pass null. */
  session: Session | null;
}

export async function transitionLead(db: DbClient, publicId: string, to: LeadStatus, options: TransitionLeadOptions) {
  const { lead } = await findLeadJoined(db, publicId);
  const from = lead.status as LeadStatus;
  if (!allowedLeadTransitions(from).includes(to)) throw new InvalidStateTransitionError("Lead", from, to);

  // First move out of `new` takes ownership when nobody has it yet (DEV-09 §2-4-4).
  const claim = from === "new" && lead.ownerAdminUserId === null && options.session ? { ownerAdminUserId: options.session.adminUserId } : {};

  await db.batch([
    db
      .update(leads)
      .set({ status: to, ...claim, updatedAt: new Date().toISOString() })
      .where(eq(leads.id, lead.id)),
    activityLogInsert(db, { logName: "lead", description: `Lead ${from} -> ${to}`, subjectType: "Lead", subjectId: lead.id, event: `lead.${to}`, causerId: options.session?.adminUserId, properties: { from, to, source: options.session ? "admin" : "system" } }),
  ]);
  return getLeadByPublicId(db, publicId);
}
