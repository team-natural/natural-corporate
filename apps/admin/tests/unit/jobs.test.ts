// The daily batch (OPS-02 §4-3): what it touches, what it must leave alone, and that a failing
// job does not take the others down.
import { env } from "cloudflare:workers";
import { activityLog, adminSessions, adminUsers, briefingRequests, campaigns, diagnosisDefinitions, diagnosisResponses, diagnosisTokens, leads } from "@app/schema";
import { createDb } from "@app/schema/client";
import { ulid } from "@app/schema/ulid";
import { beforeEach, describe, expect, it } from "vitest";
import { expireDiagnosisTokens, purgeDiagnosisData, purgeExpiredSessions, RETENTION, runDailyJobs } from "../../src/lib/server/jobs/daily";

const db = createDb(env.DB);
const NOW = new Date("2026-09-26T18:00:00Z");
const daysAgo = (days: number) => new Date(NOW.getTime() - days * 86_400_000).toISOString();
const daysAhead = (days: number) => new Date(NOW.getTime() + days * 86_400_000).toISOString();

let campaignId: number;
let definitionId: number;

async function token(overrides: Partial<typeof diagnosisTokens.$inferInsert> = {}) {
  const [row] = await db
    .insert(diagnosisTokens)
    .values({ token: ulid(), kind: "outbound", campaignId, diagnosisSlug: "business", expiresAt: daysAhead(30), status: "active", updatedAt: NOW.toISOString(), ...overrides })
    .returning();
  return row!;
}

async function response(overrides: Partial<typeof diagnosisResponses.$inferInsert> = {}) {
  const [row] = await db
    .insert(diagnosisResponses)
    .values({ publicId: ulid(), definitionId, mode: "outbound", answersJson: "{}", scoresJson: "{}", resultId: "e", createdAt: NOW.toISOString(), ...overrides })
    .returning();
  return row!;
}

async function lead(overrides: Partial<typeof leads.$inferInsert> = {}) {
  const [row] = await db
    .insert(leads)
    .values({ publicId: ulid(), company: "C", name: "N", email: "n@example.com", purpose: "service", status: "new", consentPrivacyAt: NOW.toISOString(), updatedAt: NOW.toISOString(), ...overrides })
    .returning();
  return row!;
}

beforeEach(async () => {
  await db.delete(briefingRequests);
  await db.delete(diagnosisResponses);
  await db.delete(leads);
  await db.delete(diagnosisTokens);
  await db.delete(diagnosisDefinitions);
  await db.delete(campaigns);
  await db.delete(adminSessions);
  await db.delete(activityLog);
  await db.delete(adminUsers);

  const [admin] = await db
    .insert(adminUsers)
    .values({ publicId: ulid(), name: "A", email: `${ulid()}@example.com`, passwordHash: "x.y", role: "admin", status: "active", updatedAt: NOW.toISOString() })
    .returning();
  const [campaign] = await db.insert(campaigns).values({ publicId: ulid(), name: "c", channel: "form", diagnosisSlug: "business", ownerAdminUserId: admin!.id, status: "active", updatedAt: NOW.toISOString() }).returning();
  campaignId = campaign!.id;
  const [definition] = await db.insert(diagnosisDefinitions).values({ slug: "business", version: 2, definitionJson: "{}", definitionHash: "h", publishedAt: NOW.toISOString() }).returning();
  definitionId = definition!.id;
});

describe("expireDiagnosisTokens", () => {
  it("expires only active tokens past their date", async () => {
    const past = await token({ expiresAt: daysAgo(1) });
    const future = await token();
    const revoked = await token({ expiresAt: daysAgo(1), status: "revoked" });
    expect(await expireDiagnosisTokens(db, NOW)).toBe(1);
    const rows = Object.fromEntries((await db.select().from(diagnosisTokens)).map((row) => [row.id, row.status]));
    expect(rows[past.id]).toBe("expired");
    expect(rows[future.id]).toBe("active");
    expect(rows[revoked.id]).toBe("revoked");
  });
});

describe("purgeExpiredSessions", () => {
  it("drops expired admin sessions and keeps live ones", async () => {
    const [admin] = await db.select().from(adminUsers);
    await db.insert(adminSessions).values([
      { adminUserId: admin!.id, sessionToken: "old", expiresAt: daysAgo(1) },
      { adminUserId: admin!.id, sessionToken: "live", expiresAt: daysAhead(1) },
    ]);
    expect(await purgeExpiredSessions(db, NOW)).toEqual({ admin: 1, member: 0 });
    expect((await db.select().from(adminSessions)).map((row) => row.sessionToken)).toEqual(["live"]);
  });
});

describe("purgeDiagnosisData", () => {
  it("removes dead tokens but keeps their responses, unlinked", async () => {
    const dead = await token({ status: "expired", expiresAt: daysAgo(RETENTION.tokenAfterExpiryDays + 1) });
    const recent = await token({ status: "expired", expiresAt: daysAgo(10) });
    const kept = await response({ tokenId: dead.id });
    const counts = await purgeDiagnosisData(db, NOW);
    expect(counts.tokens).toBe(1);
    expect((await db.select().from(diagnosisTokens)).map((row) => row.id)).toEqual([recent.id]);
    const [row] = await db.select().from(diagnosisResponses);
    expect(row!.id).toBe(kept.id);
    expect(row!.tokenId).toBeNull();
  });

  it("deletes anonymous responses past retention, never linked ones", async () => {
    const owner = await lead();
    await response({ createdAt: daysAgo(RETENTION.anonymousResponseDays + 1) });
    const linked = await response({ createdAt: daysAgo(RETENTION.anonymousResponseDays + 1), leadId: owner.id });
    const fresh = await response({ createdAt: daysAgo(10) });
    const counts = await purgeDiagnosisData(db, NOW);
    expect(counts.responses).toBe(1);
    expect((await db.select().from(diagnosisResponses)).map((row) => row.id).sort()).toEqual([linked.id, fresh.id].sort());
  });

  it("deletes stale leads with their briefings, anonymises their responses, keeps converted ones", async () => {
    const stale = await lead({ updatedAt: daysAgo(RETENTION.leadDays + 1) });
    const converted = await lead({ status: "converted", updatedAt: daysAgo(RETENTION.leadDays + 1) });
    const active = await lead({ updatedAt: daysAgo(10) });
    await db.insert(briefingRequests).values({ publicId: ulid(), leadId: stale.id, status: "requested", updatedAt: NOW.toISOString() });
    const answered = await response({ leadId: stale.id });

    const counts = await purgeDiagnosisData(db, NOW);
    expect(counts.leads).toBe(1);
    expect((await db.select().from(leads)).map((row) => row.id).sort()).toEqual([converted.id, active.id].sort());
    expect(await db.select().from(briefingRequests)).toHaveLength(0);
    const [row] = await db.select().from(diagnosisResponses);
    expect(row!.id).toBe(answered.id);
    expect(row!.leadId).toBeNull();

    const logs = await db.select().from(activityLog);
    expect(logs).toHaveLength(1);
    expect(logs[0]!.event).toBe("data.purged");
    expect(logs[0]!.causerId).toBeNull();
  });

  it("writes no audit entry when nothing was purged", async () => {
    await purgeDiagnosisData(db, NOW);
    expect(await db.select().from(activityLog)).toHaveLength(0);
  });
});

describe("runDailyJobs", () => {
  it("runs every job and reports", async () => {
    await token({ expiresAt: daysAgo(1) });
    const report = await runDailyJobs(db, NOW);
    expect(report.expiredTokens).toBe(1);
    expect(report.purgedSessions).toEqual({ admin: 0, member: 0 });
    expect(report.purgedData).toEqual({ tokens: 0, responses: 0, leads: 0 });
  });
});
