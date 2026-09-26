// Definition snapshots are written by apps/public on first use of a version; here they are
// listed so an operator can see which versions answers refer to.
import { diagnosisDefinitions } from "@app/schema";
import type { DbClient } from "@app/schema/client";
import { desc } from "drizzle-orm";

export async function listDefinitions(db: DbClient) {
  const rows = await db.select({ slug: diagnosisDefinitions.slug, version: diagnosisDefinitions.version, hash: diagnosisDefinitions.definitionHash, publishedAt: diagnosisDefinitions.publishedAt }).from(diagnosisDefinitions).orderBy(desc(diagnosisDefinitions.id));
  return rows.map((row) => ({ slug: row.slug, version: row.version, hash: row.hash, publishedAt: row.publishedAt }));
}
