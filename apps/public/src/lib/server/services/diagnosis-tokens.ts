// Entry tokens for the outbound mode (DEV-07 §5-5, DEV-09 §2-3). Read-only here except for
// the first-click stamp; issuing and revoking belong to apps/admin.
import { campaigns, diagnosisTokens } from "@app/schema";
import type { DbClient } from "@app/schema/client";
import { NotFoundError } from "@app/server-kit/http";
import { eq } from "drizzle-orm";

export type TokenRow = typeof diagnosisTokens.$inferSelect;

// One message for missing, expired, revoked and used-up: the URL must not reveal which.
export const TOKEN_NOT_FOUND_MESSAGE = "この診断URLは無効か、有効期限が切れています。";

export function isTokenUsable(row: Pick<TokenRow, "status" | "expiresAt" | "useCount" | "maxUses">, now = new Date()): boolean {
  return row.status === "active" && row.expiresAt > now.toISOString() && row.useCount < row.maxUses;
}

export interface ResolvedToken {
  row: TokenRow;
  campaign: { id: number; name: string; introCopy: string | null; ownerAdminUserId: number } | null;
}

export async function findUsableToken(db: DbClient, token: string, now = new Date()): Promise<ResolvedToken> {
  const [found] = await db
    .select({ row: diagnosisTokens, campaign: { id: campaigns.id, name: campaigns.name, introCopy: campaigns.introCopy, ownerAdminUserId: campaigns.ownerAdminUserId } })
    .from(diagnosisTokens)
    .leftJoin(campaigns, eq(diagnosisTokens.campaignId, campaigns.id))
    .where(eq(diagnosisTokens.token, token))
    .limit(1);
  if (!found || !isTokenUsable(found.row, now)) throw new NotFoundError(TOKEN_NOT_FOUND_MESSAGE);
  return { row: found.row, campaign: found.campaign?.id ? found.campaign : null };
}

export interface PublicToken {
  diagnosis: string;
  kind: TokenRow["kind"];
  introCopy: string | null;
  consentRequired: boolean;
  expiresAt: string;
}

export function toPublicToken(resolved: ResolvedToken): PublicToken {
  return {
    diagnosis: resolved.row.diagnosisSlug,
    kind: resolved.row.kind,
    introCopy: resolved.campaign?.introCopy ?? null,
    // Partner customers consent to sharing before answering (Phase 4); outbound needs nothing up front.
    consentRequired: resolved.row.kind === "partner",
    expiresAt: resolved.row.expiresAt,
  };
}

// The entry page / token endpoint: stamps first_clicked_at once, then returns the public shape.
export async function resolveActiveToken(db: DbClient, token: string, now = new Date()): Promise<PublicToken> {
  const resolved = await findUsableToken(db, token, now);
  if (!resolved.row.firstClickedAt) {
    await db.update(diagnosisTokens).set({ firstClickedAt: now.toISOString(), updatedAt: now.toISOString() }).where(eq(diagnosisTokens.id, resolved.row.id));
  }
  return toPublicToken(resolved);
}
