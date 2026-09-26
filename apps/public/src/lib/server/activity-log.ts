// Audit log writer for the public side. A copy of apps/admin's helper by design: the two apps
// must not import each other (eslint boundaries), and the table is the shared contract.
import { activityLog } from "@app/schema";
import type { DbClient } from "@app/schema/client";

export interface ActivityLogEntry {
  logName?: string;
  description: string;
  subjectType?: string;
  subjectId?: number;
  event?: string;
  // Visitors have no row to point at, so causer_id stays NULL and causer_type says who acted.
  causerType?: string;
  properties?: Record<string, unknown>;
}

// Returned unexecuted so the caller can batch it with the change it describes.
export function activityLogInsert(db: DbClient, entry: ActivityLogEntry) {
  return db.insert(activityLog).values({
    logName: entry.logName ?? null,
    description: entry.description,
    subjectType: entry.subjectType ?? null,
    subjectId: entry.subjectId ?? null,
    event: entry.event ?? null,
    causerType: entry.causerType ?? "Visitor",
    causerId: null,
    properties: entry.properties ? JSON.stringify(entry.properties) : null,
    batchId: null,
  });
}
