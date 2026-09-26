// Lead pipeline (DEV-09 §2-4) and the briefing hand-off (DEV-09 §2-5), including the two side
// effects: first move claims ownership; a held briefing moves the lead.
import { env } from "cloudflare:workers";
import { activityLog, adminUsers, briefingRequests, campaigns, diagnosisDefinitions, diagnosisResponses, diagnosisTokens, leads } from "@app/schema";
import { createDb } from "@app/schema/client";
import { ulid } from "@app/schema/ulid";
import { InvalidStateTransitionError, NotFoundError, ValidationError } from "@app/server-kit/http";
import { eq } from "drizzle-orm";
import { beforeEach, describe, expect, it } from "vitest";
import type { Session } from "../../src/lib/server/auth/session";
import { allowedBriefingTransitions, cancelBriefing, holdBriefing, listBriefingRequests, markBriefingNoShow, scheduleBriefing, unscheduleBriefing } from "../../src/lib/server/services/briefing-requests";
import { allowedLeadTransitions, getLeadByPublicId, listLeads, transitionLead, updateLead } from "../../src/lib/server/services/leads";

const db = createDb(env.DB);
let session: Session;
const now = () => new Date().toISOString();

// apps/public creates these; here they arrive fully formed.
async function arrive(overrides: Partial<typeof leads.$inferInsert> = {}) {
  const [row] = await db
    .insert(leads)
    .values({ publicId: ulid(), company: "テスト株式会社", name: "山田", email: "yamada@example.com", purpose: "briefing", status: "new", consentPrivacyAt: now(), updatedAt: now(), ...overrides })
    .returning();
  return row!;
}

async function requestBriefing(leadId: number) {
  const [row] = await db.insert(briefingRequests).values({ publicId: ulid(), leadId, status: "requested", updatedAt: now() }).returning();
  return row!;
}

beforeEach(async () => {
  await db.delete(briefingRequests);
  await db.delete(diagnosisResponses);
  await db.delete(leads);
  await db.delete(diagnosisTokens);
  await db.delete(diagnosisDefinitions);
  await db.delete(campaigns);
  await db.delete(activityLog);
  await db.delete(adminUsers);

  const [admin] = await db
    .insert(adminUsers)
    .values({ publicId: ulid(), name: "Editor", email: `${ulid()}@example.com`, passwordHash: "x.y", role: "editor", status: "active", updatedAt: now() })
    .returning();
  session = { adminUserId: admin!.id, adminUserPublicId: admin!.publicId, role: "editor" };
});

describe("leads", () => {
  it("hides integers and lists newest first", async () => {
    const first = await arrive({ company: "A" });
    await arrive({ company: "B" });
    const lead = await getLeadByPublicId(db, first.publicId);
    expect(lead.id).toBe(first.publicId);
    expect(lead).not.toHaveProperty("ownerAdminUserId");
    expect(Object.values(lead).every((value) => typeof value !== "number")).toBe(true);
    expect((await listLeads(db, {})).items.map((item) => item.company)).toEqual(["B", "A"]);
    expect((await listLeads(db, { status: "contacted" })).items).toEqual([]);
  });

  it("matches the DEV-09 §2-4 matrix", () => {
    expect(allowedLeadTransitions("new")).toEqual(["contacted", "nurturing", "lost"]);
    expect(allowedLeadTransitions("converted")).toEqual([]);
    expect(allowedLeadTransitions("lost")).toEqual(["contacted", "nurturing"]);
  });

  it("claims ownership on the first move out of `new` and refuses illegal moves without a log", async () => {
    const row = await arrive();
    await expect(transitionLead(db, row.publicId, "converted", { session })).rejects.toBeInstanceOf(InvalidStateTransitionError);
    expect(await db.select().from(activityLog)).toHaveLength(0);

    const moved = await transitionLead(db, row.publicId, "contacted", { session });
    expect(moved.status).toBe("contacted");
    expect(moved.owner?.id).toBe(session.adminUserPublicId);

    // A system move (no session) neither claims nor breaks.
    const [other] = await db
      .insert(adminUsers)
      .values({ publicId: ulid(), name: "Other", email: `${ulid()}@example.com`, passwordHash: "x.y", role: "editor", status: "active", updatedAt: now() })
      .returning();
    const owned = await arrive({ ownerAdminUserId: other!.id });
    const kept = await transitionLead(db, owned.publicId, "nurturing", { session });
    expect(kept.owner?.id).toBe(other!.publicId);
    const system = await transitionLead(db, (await arrive()).publicId, "nurturing", { session: null });
    expect(system.owner).toBeNull();
  });

  it("updates owner, phone and notes, rejecting unknown owners", async () => {
    const row = await arrive();
    const updated = await updateLead(db, row.publicId, { ownerId: session.adminUserPublicId, notes: "called", phone: "03-0000-0000" }, session);
    expect(updated.owner?.name).toBe("Editor");
    expect(updated.notes).toBe("called");
    expect((await updateLead(db, row.publicId, { ownerId: null }, session)).owner).toBeNull();
    await expect(updateLead(db, row.publicId, { ownerId: "nobody" }, session)).rejects.toBeInstanceOf(ValidationError);
    await expect(getLeadByPublicId(db, "missing")).rejects.toBeInstanceOf(NotFoundError);
  });
});

describe("briefing requests", () => {
  it("matches the DEV-09 §2-5 matrix", () => {
    expect(allowedBriefingTransitions("requested")).toEqual(["scheduled", "cancelled"]);
    expect(allowedBriefingTransitions("scheduled")).toEqual(["requested", "held", "no_show", "cancelled"]);
    expect(allowedBriefingTransitions("held")).toEqual([]);
  });

  it("schedules, reschedules and lists with the lead attached", async () => {
    const lead = await arrive();
    const briefing = await requestBriefing(lead.id);
    const scheduled = await scheduleBriefing(db, briefing.publicId, { scheduledAt: "2026-10-01T10:00:00+09:00", externalRef: "cal-1" }, session);
    expect(scheduled.status).toBe("scheduled");
    expect(scheduled.lead.company).toBe("テスト株式会社");
    const back = await unscheduleBriefing(db, briefing.publicId, session);
    expect(back.status).toBe("requested");
    expect(back.scheduledAt).toBeNull();
    expect(back.externalRef).toBe("cal-1");
    expect((await listBriefingRequests(db, { status: "requested" })).items).toHaveLength(1);
  });

  it("holding with an outcome moves the lead through its own transition", async () => {
    const lead = await arrive();
    const briefing = await requestBriefing(lead.id);
    await scheduleBriefing(db, briefing.publicId, { scheduledAt: "2026-10-01T10:00:00+09:00" }, session);
    await expect(holdBriefing(db, briefing.publicId, { outcome: "paid" }, session)).resolves.toMatchObject({ status: "held", outcome: "paid" });

    const [leadRow] = await db.select().from(leads).where(eq(leads.id, lead.id));
    // new → qualified is not a legal lead move, so the lead stays `new`: the briefing's
    // outcome never forces a status the lead matrix forbids.
    expect(leadRow!.status).toBe("new");

    const contacted = await arrive({ status: "contacted" });
    const second = await requestBriefing(contacted.id);
    await scheduleBriefing(db, second.publicId, { scheduledAt: "2026-10-02T10:00:00+09:00" }, session);
    await holdBriefing(db, second.publicId, { outcome: "nurture", notes: "follow up in spring" }, session);
    const [moved] = await db.select().from(leads).where(eq(leads.id, contacted.id));
    expect(moved!.status).toBe("nurturing");

    await expect(holdBriefing(db, second.publicId, { outcome: "service" }, session)).rejects.toBeInstanceOf(InvalidStateTransitionError);
  });

  it("no-show can be rescheduled; cancelled is terminal", async () => {
    const lead = await arrive();
    const briefing = await requestBriefing(lead.id);
    await scheduleBriefing(db, briefing.publicId, { scheduledAt: "2026-10-01T10:00:00+09:00" }, session);
    expect((await markBriefingNoShow(db, briefing.publicId, session)).status).toBe("no_show");
    expect((await scheduleBriefing(db, briefing.publicId, { scheduledAt: "2026-10-08T10:00:00+09:00" }, session)).status).toBe("scheduled");
    expect((await cancelBriefing(db, briefing.publicId, session)).status).toBe("cancelled");
    await expect(scheduleBriefing(db, briefing.publicId, { scheduledAt: "2026-10-09T10:00:00+09:00" }, session)).rejects.toBeInstanceOf(InvalidStateTransitionError);
  });
});
