// 15-minute briefing requests (DEV-07 §5-8, DEV-09 §2-5). `hold` records the outcome and then
// moves the lead through its own transition function — a separate transaction on purpose.
import { briefingRequests, diagnosisResponses, leads } from "@app/schema";
import type { DbClient } from "@app/schema/client";
import { InvalidStateTransitionError, NotFoundError } from "@app/server-kit/http";
import { and, desc, eq, lt } from "drizzle-orm";
import type { Session } from "../auth/session";
import type { HoldBriefingInput, ScheduleBriefingInput } from "../validation/briefing-requests";
import { activityLogInsert } from "./activity-log";
import { allowedLeadTransitions, transitionLead, type LeadStatus } from "./leads";

export type BriefingStatus = "requested" | "scheduled" | "held" | "no_show" | "cancelled";
export type BriefingOutcome = "service" | "paid" | "nurture";

const TRANSITIONS: Record<BriefingStatus, BriefingStatus[]> = {
  requested: ["scheduled", "cancelled"],
  scheduled: ["requested", "held", "no_show", "cancelled"],
  held: [],
  no_show: ["scheduled", "cancelled"],
  cancelled: [],
};

export function allowedBriefingTransitions(status: BriefingStatus): BriefingStatus[] {
  return TRANSITIONS[status] ?? [];
}

// Where the lead goes after the call (BIZ-04 §9): a clear next step is a qualified lead.
const OUTCOME_LEAD_STATUS: Record<BriefingOutcome, LeadStatus> = { service: "qualified", paid: "qualified", nurture: "nurturing" };

type BriefingRow = typeof briefingRequests.$inferSelect;
type Joined = { briefing: BriefingRow; lead: { publicId: string; company: string; name: string; email: string; status: string }; responsePublicId: string | null };

const selection = {
  briefing: briefingRequests,
  lead: { publicId: leads.publicId, company: leads.company, name: leads.name, email: leads.email, status: leads.status },
  responsePublicId: diagnosisResponses.publicId,
};

export function toPublicBriefing(row: Joined) {
  return {
    id: row.briefing.publicId,
    status: row.briefing.status,
    outcome: row.briefing.outcome,
    scheduledAt: row.briefing.scheduledAt,
    heldAt: row.briefing.heldAt,
    externalRef: row.briefing.externalRef,
    notes: row.briefing.notes,
    lead: { id: row.lead.publicId, company: row.lead.company, name: row.lead.name, email: row.lead.email, status: row.lead.status },
    responseId: row.responsePublicId,
    createdAt: row.briefing.createdAt,
    updatedAt: row.briefing.updatedAt,
  };
}

const DEFAULT_PER_PAGE = 20;
const MAX_PER_PAGE = 100;

function baseQuery(db: DbClient) {
  return db.select(selection).from(briefingRequests).innerJoin(leads, eq(briefingRequests.leadId, leads.id)).leftJoin(diagnosisResponses, eq(briefingRequests.responseId, diagnosisResponses.id));
}

export async function listBriefingRequests(db: DbClient, options: { beforeId?: number | null; perPage?: number; status?: BriefingStatus }) {
  const perPage = Math.min(Math.max(options.perPage ?? DEFAULT_PER_PAGE, 1), MAX_PER_PAGE);
  const rows = await baseQuery(db)
    .where(and(options.beforeId ? lt(briefingRequests.id, options.beforeId) : undefined, options.status ? eq(briefingRequests.status, options.status) : undefined))
    .orderBy(desc(briefingRequests.id))
    .limit(perPage + 1);
  const hasMore = rows.length > perPage;
  const page = rows.slice(0, perPage);
  return { items: page.map((row) => toPublicBriefing(row as Joined)), perPage, nextId: hasMore ? page[page.length - 1]!.briefing.id : null };
}

async function findBriefing(db: DbClient, publicId: string): Promise<Joined> {
  const [row] = await baseQuery(db).where(eq(briefingRequests.publicId, publicId)).limit(1);
  if (!row) throw new NotFoundError("15分解説の申込が見つかりません。");
  return row as Joined;
}

export async function getBriefingByPublicId(db: DbClient, publicId: string) {
  return toPublicBriefing(await findBriefing(db, publicId));
}

async function move(db: DbClient, row: Joined, to: BriefingStatus, patch: Partial<typeof briefingRequests.$inferInsert>, session: Session) {
  const from = row.briefing.status as BriefingStatus;
  if (!allowedBriefingTransitions(from).includes(to)) throw new InvalidStateTransitionError("BriefingRequest", from, to);
  await db.batch([
    db
      .update(briefingRequests)
      .set({ ...patch, status: to, updatedAt: new Date().toISOString() })
      .where(eq(briefingRequests.id, row.briefing.id)),
    activityLogInsert(db, { logName: "briefing", description: `BriefingRequest ${from} -> ${to}`, subjectType: "BriefingRequest", subjectId: row.briefing.id, event: `briefing.${to}`, causerId: session.adminUserId, properties: { from, to, ...patch } }),
  ]);
}

export async function scheduleBriefing(db: DbClient, publicId: string, input: ScheduleBriefingInput, session: Session) {
  const row = await findBriefing(db, publicId);
  await move(db, row, "scheduled", { scheduledAt: input.scheduledAt, externalRef: input.externalRef ?? row.briefing.externalRef }, session);
  return getBriefingByPublicId(db, publicId);
}

// Back to `requested` for a reschedule: the old slot is cleared, the external ref kept.
export async function unscheduleBriefing(db: DbClient, publicId: string, session: Session) {
  const row = await findBriefing(db, publicId);
  await move(db, row, "requested", { scheduledAt: null }, session);
  return getBriefingByPublicId(db, publicId);
}

export async function holdBriefing(db: DbClient, publicId: string, input: HoldBriefingInput, session: Session) {
  const row = await findBriefing(db, publicId);
  await move(db, row, "held", { heldAt: input.heldAt ?? new Date().toISOString(), outcome: input.outcome, notes: input.notes ?? row.briefing.notes }, session);

  // The lead's own rules decide whether it can move; an already-converted lead just stays.
  const target = OUTCOME_LEAD_STATUS[input.outcome];
  if (allowedLeadTransitions(row.lead.status as LeadStatus).includes(target)) {
    await transitionLead(db, row.lead.publicId, target, { session });
  }
  return getBriefingByPublicId(db, publicId);
}

export async function markBriefingNoShow(db: DbClient, publicId: string, session: Session) {
  const row = await findBriefing(db, publicId);
  await move(db, row, "no_show", {}, session);
  return getBriefingByPublicId(db, publicId);
}

export async function cancelBriefing(db: DbClient, publicId: string, session: Session) {
  const row = await findBriefing(db, publicId);
  await move(db, row, "cancelled", {}, session);
  return getBriefingByPublicId(db, publicId);
}
