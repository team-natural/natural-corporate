// The five lead transition routes differ only in the target status (DEV-09 §2-4), so each
// file is one line of intent; the session/role/envelope boilerplate lives here once.
import type { APIContext } from "astro";
import { env } from "cloudflare:workers";
import { createDb } from "@app/schema/client";
import { jsonItem, toErrorResponse } from "@app/server-kit/http";
import { requireRole, requireSession } from "./auth/session";
import { transitionLead, type LeadStatus } from "./services/leads";

export function leadTransitionRoute(to: LeadStatus) {
  return async function POST({ params, cookies }: APIContext): Promise<Response> {
    try {
      const db = createDb(env.DB);
      const session = await requireSession(cookies, db);
      requireRole(session, "editor");
      return jsonItem(await transitionLead(db, params.id!, to, { session }));
    } catch (error) {
      return toErrorResponse(error);
    }
  };
}
