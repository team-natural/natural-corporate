// Campaign + token conventions, per the inquiries reference: hidden integers, one status
// writer, audit entry in the same batch, and the token rules DEV-07 §5-5 / DEV-09 §2-3 pin.
import { env } from "cloudflare:workers";
import { activityLog, adminUsers, campaigns, diagnosisDefinitions, diagnosisResponses, diagnosisTokens, leads } from "@app/schema";
import { createDb } from "@app/schema/client";
import { ulid } from "@app/schema/ulid";
import { InvalidStateTransitionError, NotFoundError, ValidationError } from "@app/server-kit/http";
import { eq } from "drizzle-orm";
import { beforeEach, describe, expect, it } from "vitest";
import type { Session } from "../../src/lib/server/auth/session";
import { createCampaign, getCampaignByPublicId, issueTokens, listCampaigns, listTokens, revokeToken, transitionCampaign, updateCampaign } from "../../src/lib/server/services/campaigns";

const db = createDb(env.DB);
let session: Session;

const input = (name = "Campaign") => ({ name, channel: "form" as const, diagnosisSlug: "business" as const, introCopy: null, sentAt: null, notes: null });

beforeEach(async () => {
  await db.delete(diagnosisResponses);
  await db.delete(leads);
  await db.delete(diagnosisTokens);
  await db.delete(diagnosisDefinitions);
  await db.delete(campaigns);
  await db.delete(activityLog);
  await db.delete(adminUsers);

  const [admin] = await db
    .insert(adminUsers)
    .values({ publicId: ulid(), name: "Editor", email: `${ulid()}@example.com`, passwordHash: "x.y", role: "editor", status: "active", updatedAt: new Date().toISOString() })
    .returning();
  session = { adminUserId: admin!.id, adminUserPublicId: admin!.publicId, role: "editor" };
});

describe("campaigns", () => {
  it("creates as draft, owned by the caller, with an audit entry and no integers in the shape", async () => {
    const campaign = await createCampaign(db, input(), session);
    expect(campaign.status).toBe("draft");
    expect(campaign.owner?.id).toBe(session.adminUserPublicId);
    expect(Object.values(campaign).every((value) => typeof value !== "number")).toBe(true);
    expect((await db.select().from(activityLog)).map((row) => row.event)).toEqual(["campaign.created"]);
  });

  it("lists newest first, filtered by status, by keyset", async () => {
    const a = await createCampaign(db, input("A"), session);
    await createCampaign(db, input("B"), session);
    await transitionCampaign(db, a.id, "active", session);

    const all = await listCampaigns(db, { perPage: 1 });
    expect(all.items.map((item) => item.name)).toEqual(["B"]);
    expect(all.nextId).not.toBeNull();
    const rest = await listCampaigns(db, { perPage: 1, beforeId: all.nextId });
    expect(rest.items.map((item) => item.name)).toEqual(["A"]);
    expect(rest.nextId).toBeNull();
    expect((await listCampaigns(db, { status: "active" })).items.map((item) => item.name)).toEqual(["A"]);
  });

  it("follows draft → active → closed → active and refuses the rest", async () => {
    const campaign = await createCampaign(db, input(), session);
    await expect(transitionCampaign(db, campaign.id, "closed", session)).rejects.toBeInstanceOf(InvalidStateTransitionError);
    await transitionCampaign(db, campaign.id, "active", session);
    await transitionCampaign(db, campaign.id, "closed", session);
    expect((await transitionCampaign(db, campaign.id, "active", session)).status).toBe("active");
    // A rejected move leaves no log of itself.
    const events = (await db.select().from(activityLog)).map((row) => row.event);
    expect(events).toEqual(["campaign.created", "campaign.active", "campaign.closed", "campaign.active"]);
  });

  it("edits drafts only", async () => {
    const campaign = await createCampaign(db, input(), session);
    expect((await updateCampaign(db, campaign.id, { introCopy: "hello" }, session)).introCopy).toBe("hello");
    await transitionCampaign(db, campaign.id, "active", session);
    await expect(updateCampaign(db, campaign.id, { name: "x" }, session)).rejects.toBeInstanceOf(InvalidStateTransitionError);
    await expect(getCampaignByPublicId(db, "missing")).rejects.toBeInstanceOf(NotFoundError);
  });
});

describe("tokens", () => {
  it("issues one active 90-day token per recipient ref, without any personal data", async () => {
    const campaign = await createCampaign(db, input(), session);
    await transitionCampaign(db, campaign.id, "active", session);
    const issued = await issueTokens(db, campaign.id, { count: 2, recipientRefs: ["row-1", "row-2"] }, session);

    expect(issued).toHaveLength(2);
    expect(issued.map((token) => token.recipientRef)).toEqual(["row-1", "row-2"]);
    expect(new Set(issued.map((token) => token.token)).size).toBe(2);
    expect(issued[0]!.entryPath).toBe(`/d/${issued[0]!.token}/`);
    const days = (new Date(issued[0]!.expiresAt).getTime() - Date.now()) / 86_400_000;
    expect(days).toBeGreaterThan(89);
    expect(days).toBeLessThanOrEqual(90);
    expect(Object.keys(issued[0]!)).not.toContain("campaignId");

    await expect(issueTokens(db, campaign.id, { count: 3, recipientRefs: ["only-one"] }, session)).rejects.toBeInstanceOf(ValidationError);
  });

  it("does not issue for a closed campaign", async () => {
    const campaign = await createCampaign(db, input(), session);
    await transitionCampaign(db, campaign.id, "active", session);
    await transitionCampaign(db, campaign.id, "closed", session);
    await expect(issueTokens(db, campaign.id, { count: 1 }, session)).rejects.toBeInstanceOf(InvalidStateTransitionError);
  });

  it("lists tokens with response counts and revokes only active ones", async () => {
    const campaign = await createCampaign(db, input(), session);
    const [token] = await issueTokens(db, campaign.id, { count: 1 }, session);

    const listed = await listTokens(db, campaign.id, {});
    expect(listed.items[0]).toMatchObject({ token: token!.token, status: "active", responses: 0, leads: 0 });

    const revoked = await revokeToken(db, campaign.id, token!.token, session);
    expect(revoked.status).toBe("revoked");
    await expect(revokeToken(db, campaign.id, token!.token, session)).rejects.toBeInstanceOf(InvalidStateTransitionError);
    await expect(revokeToken(db, campaign.id, "nope", session)).rejects.toBeInstanceOf(NotFoundError);

    const [row] = await db.select().from(diagnosisTokens).where(eq(diagnosisTokens.token, token!.token));
    expect(row!.status).toBe("revoked");
  });

  it("scopes revocation to the campaign in the URL", async () => {
    const a = await createCampaign(db, input("A"), session);
    const b = await createCampaign(db, input("B"), session);
    const [token] = await issueTokens(db, a.id, { count: 1 }, session);
    await expect(revokeToken(db, b.id, token!.token, session)).rejects.toBeInstanceOf(NotFoundError);
  });
});
