// Daily batch (OPS-02 §4-3, DEV-07 §10). Each job is independent: one failing must not stop the
// others, so runDailyJobs catches per job and reports. No human actor, so causer stays NULL.
import { activityLog, adminSessions, briefingRequests, diagnosisResponses, diagnosisTokens, leads, memberSessions } from "@app/schema";
import type { DbClient } from "@app/schema/client";
import { and, eq, inArray, isNull, lt, ne } from "drizzle-orm";

const DAY = 86_400_000;
export const RETENTION = {
  // Token rows 90 days after they stopped working; the responses they produced stay.
  tokenAfterExpiryDays: 90,
  // Anonymous responses (no lead) — 2 years (GOV-02 TBD-33, assumed).
  anonymousResponseDays: 730,
  // Leads and their briefings — 1 year from last update; converted leads are kept (contract).
  leadDays: 365,
};

const ago = (now: Date, days: number) => new Date(now.getTime() - days * DAY).toISOString();

export async function expireDiagnosisTokens(db: DbClient, now = new Date()): Promise<number> {
  const rows = await db
    .update(diagnosisTokens)
    .set({ status: "expired", updatedAt: now.toISOString() })
    .where(and(eq(diagnosisTokens.status, "active"), lt(diagnosisTokens.expiresAt, now.toISOString())))
    .returning({ id: diagnosisTokens.id });
  return rows.length;
}

export async function purgeExpiredSessions(db: DbClient, now = new Date()): Promise<{ admin: number; member: number }> {
  const [admin, member] = await db.batch([db.delete(adminSessions).where(lt(adminSessions.expiresAt, now.toISOString())).returning({ id: adminSessions.id }), db.delete(memberSessions).where(lt(memberSessions.expiresAt, now.toISOString())).returning({ id: memberSessions.id })]);
  return { admin: admin.length, member: member.length };
}

export async function purgeDiagnosisData(db: DbClient, now = new Date()): Promise<{ tokens: number; responses: number; leads: number }> {
  // 1. Dead tokens: unlink their responses first, then delete (DEV-07 §10).
  const deadTokens = db
    .select({ id: diagnosisTokens.id })
    .from(diagnosisTokens)
    .where(and(ne(diagnosisTokens.status, "active"), lt(diagnosisTokens.expiresAt, ago(now, RETENTION.tokenAfterExpiryDays))));
  const [, deletedTokens] = await db.batch([db.update(diagnosisResponses).set({ tokenId: null }).where(inArray(diagnosisResponses.tokenId, deadTokens)), db.delete(diagnosisTokens).where(inArray(diagnosisTokens.id, deadTokens)).returning({ id: diagnosisTokens.id })]);

  // 2. Anonymous responses past retention: briefings never point at them (no lead), but the
  //    FK is nullable, so clear it anyway before the delete.
  const oldAnonymous = db
    .select({ id: diagnosisResponses.id })
    .from(diagnosisResponses)
    .where(and(isNull(diagnosisResponses.leadId), lt(diagnosisResponses.createdAt, ago(now, RETENTION.anonymousResponseDays))));
  const [, deletedResponses] = await db.batch([db.update(briefingRequests).set({ responseId: null }).where(inArray(briefingRequests.responseId, oldAnonymous)), db.delete(diagnosisResponses).where(inArray(diagnosisResponses.id, oldAnonymous)).returning({ id: diagnosisResponses.id })]);

  // 3. Stale leads: the response is kept anonymised (lead_id back to NULL), briefings go with
  //    the lead.
  const staleLeads = db
    .select({ id: leads.id })
    .from(leads)
    .where(and(ne(leads.status, "converted"), lt(leads.updatedAt, ago(now, RETENTION.leadDays))));
  const [, , deletedLeads] = await db.batch([db.update(diagnosisResponses).set({ leadId: null }).where(inArray(diagnosisResponses.leadId, staleLeads)), db.delete(briefingRequests).where(inArray(briefingRequests.leadId, staleLeads)), db.delete(leads).where(inArray(leads.id, staleLeads)).returning({ id: leads.id })]);

  const counts = { tokens: deletedTokens.length, responses: deletedResponses.length, leads: deletedLeads.length };
  if (counts.tokens + counts.responses + counts.leads > 0) {
    await db.insert(activityLog).values({ logName: "retention", description: "Diagnosis data purged by daily job", event: "data.purged", causerType: "System", causerId: null, properties: JSON.stringify({ source: "system", ...counts }), subjectType: null, subjectId: null, batchId: null });
  }
  return counts;
}

export interface DailyReport {
  expiredTokens: number | Error;
  purgedSessions: { admin: number; member: number } | Error;
  purgedData: { tokens: number; responses: number; leads: number } | Error;
}

export async function runDailyJobs(db: DbClient, now = new Date()): Promise<DailyReport> {
  const run = async <T>(job: () => Promise<T>): Promise<T | Error> => {
    try {
      return await job();
    } catch (error) {
      console.error("daily job failed", error);
      return error instanceof Error ? error : new Error(String(error));
    }
  };
  const report: DailyReport = {
    expiredTokens: await run(() => expireDiagnosisTokens(db, now)),
    purgedSessions: await run(() => purgeExpiredSessions(db, now)),
    purgedData: await run(() => purgeDiagnosisData(db, now)),
  };
  console.log(
    "daily jobs",
    JSON.stringify(report, (_key, value) => (value instanceof Error ? { error: value.message } : value)),
  );
  return report;
}
