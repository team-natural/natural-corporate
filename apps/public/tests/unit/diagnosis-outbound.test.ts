// The outbound-mode server side: token gate, answer validation and re-scoring, the use
// counter, and the one moment a response is tied to a company. Runs on workerd against the
// real migrations, like auth.test.ts.
import { env } from "cloudflare:workers";
import { activityLog, adminUsers, briefingRequests, campaigns, diagnosisDefinitions, diagnosisResponses, diagnosisTokens, leads } from "@app/schema";
import { createDb } from "@app/schema/client";
import { ulid } from "@app/schema/ulid";
import { newSessionToken } from "@app/server-kit/auth";
import { NotFoundError, ValidationError } from "@app/server-kit/http";
import { eq } from "drizzle-orm";
import { beforeEach, describe, expect, it } from "vitest";
import aiDx from "../../src/diagnoses/ai-dx/data";
import business from "../../src/diagnoses/business/data";
import { DefinitionHashMismatchError, ensureDefinition } from "../../src/lib/server/services/diagnosis-definitions";
import { saveDiagnosisResponse } from "../../src/lib/server/services/diagnosis-responses";
import { findUsableToken, resolveActiveToken } from "../../src/lib/server/services/diagnosis-tokens";
import { createLead } from "../../src/lib/server/services/leads";

const db = createDb(env.DB);
const now = () => new Date().toISOString();
const inDays = (days: number) => new Date(Date.now() + days * 86_400_000).toISOString();

let ownerId: number;
let campaignId: number;

async function issueToken(overrides: Partial<typeof diagnosisTokens.$inferInsert> = {}) {
  const [row] = await db
    .insert(diagnosisTokens)
    .values({ token: newSessionToken(), kind: "outbound", campaignId, recipientRef: "list-row-1", diagnosisSlug: "business", expiresAt: inDays(90), status: "active", updatedAt: now(), ...overrides })
    .returning();
  return row!;
}

// Every business question answered with its first option, except the concern.
function businessAnswers(): Record<string, number> {
  const answers: Record<string, number> = {};
  for (const question of business.questions) answers[question.id] = 0;
  answers.q0 = 6;
  return answers;
}

function aiDxAnswers(): Record<string, number> {
  const answers: Record<string, number> = {};
  for (const question of aiDx.questions) answers[question.id] = 2;
  return answers;
}

const leadInput = (extra: Record<string, unknown> = {}) => ({ purpose: "service" as const, company: "テスト株式会社", name: "山田", email: "yamada@example.com", privacyAgree: true as const, turnstileToken: "ok", ...extra });

beforeEach(async () => {
  await db.delete(briefingRequests);
  await db.delete(diagnosisResponses);
  await db.delete(leads);
  await db.delete(diagnosisTokens);
  await db.delete(campaigns);
  await db.delete(diagnosisDefinitions);
  await db.delete(activityLog);
  await db.delete(adminUsers);

  const [owner] = await db
    .insert(adminUsers)
    .values({ publicId: ulid(), name: "Sales", email: `${ulid()}@example.com`, passwordHash: "x.y", role: "editor", status: "active", updatedAt: now() })
    .returning();
  ownerId = owner!.id;
  const [campaign] = await db.insert(campaigns).values({ publicId: ulid(), name: "2026-10 form outreach", channel: "form", diagnosisSlug: "business", introCopy: "製造業の皆さまへ", ownerAdminUserId: ownerId, status: "active", updatedAt: now() }).returning();
  campaignId = campaign!.id;
});

describe("token gate", () => {
  it("returns the campaign copy and stamps first_clicked_at once", async () => {
    const token = await issueToken();
    const first = await resolveActiveToken(db, token.token);
    expect(first).toMatchObject({ diagnosis: "business", kind: "outbound", introCopy: "製造業の皆さまへ", consentRequired: false });

    const [afterFirst] = await db.select().from(diagnosisTokens).where(eq(diagnosisTokens.id, token.id));
    expect(afterFirst!.firstClickedAt).not.toBeNull();

    await resolveActiveToken(db, token.token);
    const [afterSecond] = await db.select().from(diagnosisTokens).where(eq(diagnosisTokens.id, token.id));
    expect(afterSecond!.firstClickedAt).toBe(afterFirst!.firstClickedAt);
  });

  it.each([
    ["unknown", () => Promise.resolve("no-such-token")],
    ["expired by date", async () => (await issueToken({ expiresAt: inDays(-1) })).token],
    ["revoked", async () => (await issueToken({ status: "revoked" })).token],
    ["used up", async () => (await issueToken({ maxUses: 2, useCount: 2 })).token],
  ])("answers 404 for a %s token", async (_label, make) => {
    await expect(resolveActiveToken(db, await make())).rejects.toBeInstanceOf(NotFoundError);
    await expect(findUsableToken(db, await make())).rejects.toBeInstanceOf(NotFoundError);
  });
});

describe("definition snapshots", () => {
  it("creates one row per (slug, version) and reuses it", async () => {
    const first = await ensureDefinition(db, "business");
    const second = await ensureDefinition(db, "business");
    expect(second.id).toBe(first.id);
    expect(first.version).toBe(business.version);
    expect(await db.select().from(diagnosisDefinitions)).toHaveLength(1);
  });

  it("refuses to save under a version whose scoring changed", async () => {
    await ensureDefinition(db, "ai-dx");
    await db.update(diagnosisDefinitions).set({ definitionHash: "tampered" });
    await expect(ensureDefinition(db, "ai-dx")).rejects.toBeInstanceOf(DefinitionHashMismatchError);
  });
});

describe("saveDiagnosisResponse", () => {
  it("re-scores on the server, stores the run and counts the use", async () => {
    const token = await issueToken();
    const saved = await saveDiagnosisResponse(db, { token: token.token, diagnosis: "business", definitionVersion: business.version, answers: businessAnswers(), clientResult: { resultId: "z" } }, { userAgent: "Mozilla/5.0" });

    expect(saved.id).toHaveLength(26);
    expect(saved.resultUrl).toContain(`/diagnosis/business/result/${saved.resultId}/?v=2`);
    expect(saved.resultUrl).toContain(`r=${saved.id}`);
    expect(saved.resultUrl).not.toContain("a=");

    const [row] = await db.select().from(diagnosisResponses);
    expect(row!.mode).toBe("outbound");
    expect(row!.tokenId).toBe(token.id);
    expect(row!.leadId).toBeNull();
    expect(row!.resultId).toBe(saved.resultId);
    expect(row!.userAgentHash).toHaveLength(16);
    // The client claimed Z; the server disagreed and said so.
    expect(JSON.parse(row!.flagsJson!)).toContain("client_mismatch");

    const [after] = await db.select().from(diagnosisTokens).where(eq(diagnosisTokens.id, token.id));
    expect(after!.useCount).toBe(1);
    expect(after!.status).toBe("active");
  });

  it("expires the token in the same transaction as the last allowed save", async () => {
    const token = await issueToken({ maxUses: 1 });
    await saveDiagnosisResponse(db, { token: token.token, diagnosis: "ai-dx", definitionVersion: aiDx.version, answers: aiDxAnswers() }, { userAgent: null });
    const [after] = await db.select().from(diagnosisTokens).where(eq(diagnosisTokens.id, token.id));
    expect(after!.status).toBe("expired");
    await expect(saveDiagnosisResponse(db, { token: token.token, diagnosis: "ai-dx", definitionVersion: aiDx.version, answers: aiDxAnswers() }, { userAgent: null })).rejects.toBeInstanceOf(NotFoundError);
  });

  it("rejects a stale definition version and malformed answers with 422", async () => {
    const token = await issueToken();
    await expect(saveDiagnosisResponse(db, { token: token.token, diagnosis: "business", definitionVersion: 1, answers: businessAnswers() }, { userAgent: null })).rejects.toBeInstanceOf(ValidationError);
    await expect(saveDiagnosisResponse(db, { token: token.token, diagnosis: "business", definitionVersion: business.version, answers: { ...businessAnswers(), q1: 99 } }, { userAgent: null })).rejects.toBeInstanceOf(ValidationError);
    const missing = businessAnswers();
    delete missing.q9;
    await expect(saveDiagnosisResponse(db, { token: token.token, diagnosis: "business", definitionVersion: business.version, answers: missing }, { userAgent: null })).rejects.toBeInstanceOf(ValidationError);
    await expect(saveDiagnosisResponse(db, { token: token.token, diagnosis: "pro", definitionVersion: 1, answers: {} }, { userAgent: null })).rejects.toBeInstanceOf(ValidationError);
    // None of those consumed a use.
    const [after] = await db.select().from(diagnosisTokens).where(eq(diagnosisTokens.id, token.id));
    expect(after!.useCount).toBe(0);
  });
});

describe("createLead", () => {
  it("links the response, inherits the campaign owner and logs the consent", async () => {
    const token = await issueToken();
    const saved = await saveDiagnosisResponse(db, { token: token.token, diagnosis: "business", definitionVersion: business.version, answers: businessAnswers() }, { userAgent: null });

    const lead = await createLead(db, leadInput({ responseId: saved.id, token: token.token }));
    expect(lead.id).toHaveLength(26);
    expect(lead.campaignName).toBe("2026-10 form outreach");
    expect(lead.diagnosis?.resultUrl).toContain(`r=${saved.id}`);
    expect(lead.briefingRequestId).toBeNull();

    const [leadRow] = await db.select().from(leads);
    expect(leadRow!.campaignId).toBe(campaignId);
    expect(leadRow!.ownerAdminUserId).toBe(ownerId);
    expect(leadRow!.status).toBe("new");
    expect(leadRow!.consentPrivacyAt).not.toBeNull();

    const [response] = await db.select().from(diagnosisResponses);
    expect(response!.leadId).toBe(leadRow!.id);

    const logs = await db.select().from(activityLog);
    expect(logs).toHaveLength(1);
    expect(logs[0]!.event).toBe("lead.created");
    expect(logs[0]!.causerId).toBeNull();
  });

  it("creates a briefing request for the 15-minute route", async () => {
    const token = await issueToken();
    const saved = await saveDiagnosisResponse(db, { token: token.token, diagnosis: "business", definitionVersion: business.version, answers: businessAnswers() }, { userAgent: null });
    const lead = await createLead(db, leadInput({ purpose: "briefing", responseId: saved.id }));
    expect(lead.briefingRequestId).toHaveLength(26);

    const [briefing] = await db.select().from(briefingRequests);
    expect(briefing!.status).toBe("requested");
    const [leadRow] = await db.select().from(leads);
    expect(briefing!.leadId).toBe(leadRow!.id);
  });

  it("never re-points a response that already belongs to a lead", async () => {
    const token = await issueToken();
    const saved = await saveDiagnosisResponse(db, { token: token.token, diagnosis: "business", definitionVersion: business.version, answers: businessAnswers() }, { userAgent: null });
    await createLead(db, leadInput({ responseId: saved.id }));
    await createLead(db, leadInput({ responseId: saved.id, email: "second@example.com" }));

    const rows = await db.select().from(leads);
    expect(rows).toHaveLength(2);
    const [response] = await db.select().from(diagnosisResponses);
    expect(response!.leadId).toBe(rows.find((row) => row.email === "yamada@example.com")!.id);
  });

  it("accepts a lead without a saved response and rejects an unknown one", async () => {
    const lead = await createLead(db, leadInput());
    expect(lead.diagnosis).toBeNull();
    await expect(createLead(db, leadInput({ responseId: "01ZZZZZZZZZZZZZZZZZZZZZZZZ" }))).rejects.toBeInstanceOf(ValidationError);
  });
});
