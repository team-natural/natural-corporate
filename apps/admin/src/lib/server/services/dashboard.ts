// KPI counts for ADM-01 (BIZ-04 §14, KPI-13/14 side). Read-only aggregates; GA4 owns the
// funnel before a save happens.
import { briefingRequests, campaigns, diagnosisResponses, diagnosisTokens, leads } from "@app/schema";
import type { DbClient } from "@app/schema/client";
import { count, desc, eq, isNotNull, sql } from "drizzle-orm";
import { listLeads } from "./leads";

export async function getDashboardStats(db: DbClient) {
  const [campaignRow] = await db.select({ active: count() }).from(campaigns).where(eq(campaigns.status, "active"));
  const [tokenRow] = await db.select({ issued: count(), clicked: sql<number>`sum(case when ${diagnosisTokens.firstClickedAt} is not null then 1 else 0 end)` }).from(diagnosisTokens);
  const [responseRow] = await db.select({ total: count(), linked: sql<number>`sum(case when ${diagnosisResponses.leadId} is not null then 1 else 0 end)` }).from(diagnosisResponses);
  const leadRows = await db.select({ status: leads.status, n: count() }).from(leads).groupBy(leads.status);
  const [briefingRow] = await db.select({ requested: count(), held: sql<number>`sum(case when ${briefingRequests.status} = 'held' then 1 else 0 end)` }).from(briefingRequests);
  const [briefingScheduled] = await db.select({ n: count() }).from(briefingRequests).where(isNotNull(briefingRequests.scheduledAt));

  const leadsByStatus = Object.fromEntries(leadRows.map((row) => [row.status, row.n])) as Record<string, number>;
  const recent = await listLeads(db, { perPage: 5 });
  const [latestResponse] = await db.select({ createdAt: diagnosisResponses.createdAt }).from(diagnosisResponses).orderBy(desc(diagnosisResponses.id)).limit(1);

  return {
    campaigns: { active: campaignRow?.active ?? 0 },
    tokens: { issued: tokenRow?.issued ?? 0, clicked: Number(tokenRow?.clicked ?? 0) },
    responses: { total: responseRow?.total ?? 0, linked: Number(responseRow?.linked ?? 0), latestAt: latestResponse?.createdAt ?? null },
    leads: { total: leadRows.reduce((sum, row) => sum + row.n, 0), byStatus: leadsByStatus },
    briefings: { requested: briefingRow?.requested ?? 0, scheduled: briefingScheduled?.n ?? 0, held: Number(briefingRow?.held ?? 0) },
    recentLeads: recent.items,
  };
}
