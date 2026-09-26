import { sql } from "drizzle-orm";
import { index, integer, sqliteTable, text, uniqueIndex } from "drizzle-orm/sqlite-core";

// Standard tables only. Anything a project may or may not adopt (orders, ai_jobs, …) is added
// here when it adopts it. `members` is the exception: most projects need a public-side login,
// and adding one later costs design work while removing one is a deletion — so it ships, and
// projects that do not need it drop it before their first `pnpm db:generate`.

const createdAt = () =>
  text("created_at")
    .notNull()
    .default(sql`(strftime('%Y-%m-%dT%H:%M:%fZ','now'))`);

export const adminUsers = sqliteTable(
  "admin_users",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    publicId: text("public_id").notNull(),
    name: text("name").notNull(),
    email: text("email").notNull(),
    passwordHash: text("password_hash").notNull(),
    role: text("role", { enum: ["admin", "editor"] }).notNull(),
    status: text("status", { enum: ["active", "inactive"] }).notNull(),
    lastLoginAt: text("last_login_at"),
    createdAt: createdAt(),
    updatedAt: text("updated_at").notNull(),
  },
  (table) => [uniqueIndex("uq_admin_users_public_id").on(table.publicId), uniqueIndex("uq_admin_users_email").on(table.email), index("idx_admin_users_role").on(table.role), index("idx_admin_users_status").on(table.status)],
);

export const adminSessions = sqliteTable(
  "admin_sessions",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    adminUserId: integer("admin_user_id")
      .notNull()
      .references(() => adminUsers.id),
    sessionToken: text("session_token").notNull(),
    expiresAt: text("expires_at").notNull(),
    createdAt: createdAt(),
  },
  (table) => [uniqueIndex("uq_admin_sessions_session_token").on(table.sessionToken), index("idx_admin_sessions_admin_user_id").on(table.adminUserId), index("idx_admin_sessions_expires_at").on(table.expiresAt)],
);

export const passwordResetTokens = sqliteTable(
  "password_reset_tokens",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    adminUserId: integer("admin_user_id")
      .notNull()
      .references(() => adminUsers.id),
    token: text("token").notNull(),
    expiresAt: text("expires_at").notNull(),
    usedAt: text("used_at"),
    createdAt: createdAt(),
  },
  (table) => [uniqueIndex("uq_password_reset_tokens_token").on(table.token), index("idx_password_reset_tokens_admin_user_id").on(table.adminUserId), index("idx_password_reset_tokens_expires_at").on(table.expiresAt)],
);

// Public-side login. Deliberately not sharing admin_users/admin_sessions: an AdminUser token
// must never authenticate on the public site, and the two have different threat models.
export const members = sqliteTable(
  "members",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    publicId: text("public_id").notNull(),
    name: text("name").notNull(),
    email: text("email").notNull(),
    passwordHash: text("password_hash").notNull(),
    status: text("status", { enum: ["active", "inactive"] }).notNull(),
    lastLoginAt: text("last_login_at"),
    createdAt: createdAt(),
    updatedAt: text("updated_at").notNull(),
  },
  (table) => [uniqueIndex("uq_members_public_id").on(table.publicId), uniqueIndex("uq_members_email").on(table.email), index("idx_members_status").on(table.status)],
);

export const memberSessions = sqliteTable(
  "member_sessions",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    memberId: integer("member_id")
      .notNull()
      .references(() => members.id),
    sessionToken: text("session_token").notNull(),
    expiresAt: text("expires_at").notNull(),
    createdAt: createdAt(),
  },
  (table) => [uniqueIndex("uq_member_sessions_session_token").on(table.sessionToken), index("idx_member_sessions_member_id").on(table.memberId), index("idx_member_sessions_expires_at").on(table.expiresAt)],
);

// Row metadata for an object in R2; `key` is the object key. Delete this table and the BUCKET
// binding together — neither is useful without the other.
export const media = sqliteTable(
  "media",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    publicId: text("public_id").notNull(),
    uploaderId: integer("uploader_id").references(() => adminUsers.id),
    key: text("key").notNull(),
    mimeType: text("mime_type").notNull(),
    sizeBytes: integer("size_bytes").notNull(),
    altText: text("alt_text"),
    createdAt: createdAt(),
    updatedAt: text("updated_at").notNull(),
  },
  (table) => [uniqueIndex("uq_media_public_id").on(table.publicId), uniqueIndex("uq_media_key").on(table.key), index("idx_media_uploader_id").on(table.uploaderId)],
);

export const inquiries = sqliteTable(
  "inquiries",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    publicId: text("public_id").notNull(),
    type: text("type"),
    name: text("name").notNull(),
    email: text("email").notNull(),
    message: text("message").notNull(),
    status: text("status", { enum: ["new", "in_progress", "resolved"] }).notNull(),
    handledBy: integer("handled_by").references(() => adminUsers.id),
    createdAt: createdAt(),
    updatedAt: text("updated_at").notNull(),
  },
  (table) => [uniqueIndex("uq_inquiries_public_id").on(table.publicId), index("idx_inquiries_status").on(table.status), index("idx_inquiries_handled_by").on(table.handledBy), index("idx_inquiries_created_at").on(table.createdAt)],
);

// Diagnosis platform, Phase 2b (DEV-07 §3-7 / §5-3〜5-8). Order follows the FK dependency
// chain there. `partner_customer_id` on tokens and responses arrives with Phase 4's tables.

// Snapshot of a diagnosis definition at publish time. Rows are never updated: a new version is
// a new row, and a hash mismatch on an existing (slug, version) means someone forgot to bump it.
export const diagnosisDefinitions = sqliteTable(
  "diagnosis_definitions",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    slug: text("slug").notNull(),
    version: integer("version").notNull(),
    definitionJson: text("definition_json").notNull(),
    definitionHash: text("definition_hash").notNull(),
    publishedAt: text("published_at").notNull(),
    createdAt: createdAt(),
  },
  (table) => [uniqueIndex("uq_diagnosis_definitions_slug_version").on(table.slug, table.version)],
);

export const campaigns = sqliteTable(
  "campaigns",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    publicId: text("public_id").notNull(),
    name: text("name").notNull(),
    channel: text("channel", { enum: ["form", "email", "partner", "other"] }).notNull(),
    diagnosisSlug: text("diagnosis_slug").notNull(),
    introCopy: text("intro_copy"),
    ownerAdminUserId: integer("owner_admin_user_id")
      .notNull()
      .references(() => adminUsers.id),
    status: text("status", { enum: ["draft", "active", "closed"] }).notNull(),
    sentAt: text("sent_at"),
    // Never the recipients themselves — the list lives with the sales owner, not in D1.
    notes: text("notes"),
    createdAt: createdAt(),
    updatedAt: text("updated_at").notNull(),
  },
  (table) => [uniqueIndex("uq_campaigns_public_id").on(table.publicId), index("idx_campaigns_status").on(table.status), index("idx_campaigns_owner_admin_user_id").on(table.ownerAdminUserId), index("idx_campaigns_channel").on(table.channel)],
);

// Entry tokens for the outbound and partner modes. Holds no company, name or email: a token
// identifies a send, and a person only when they enter their contact details (leads).
export const diagnosisTokens = sqliteTable(
  "diagnosis_tokens",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    token: text("token").notNull(),
    kind: text("kind", { enum: ["outbound", "partner"] }).notNull(),
    campaignId: integer("campaign_id").references(() => campaigns.id),
    recipientRef: text("recipient_ref"),
    diagnosisSlug: text("diagnosis_slug").notNull(),
    expiresAt: text("expires_at").notNull(),
    maxUses: integer("max_uses").notNull().default(3),
    useCount: integer("use_count").notNull().default(0),
    firstClickedAt: text("first_clicked_at"),
    status: text("status", { enum: ["active", "expired", "revoked"] }).notNull(),
    createdAt: createdAt(),
    updatedAt: text("updated_at").notNull(),
  },
  (table) => [uniqueIndex("uq_diagnosis_tokens_token").on(table.token), index("idx_diagnosis_tokens_campaign_id").on(table.campaignId), index("idx_diagnosis_tokens_status").on(table.status), index("idx_diagnosis_tokens_expires_at").on(table.expiresAt)],
);

export const leads = sqliteTable(
  "leads",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    publicId: text("public_id").notNull(),
    company: text("company").notNull(),
    name: text("name").notNull(),
    email: text("email").notNull(),
    phone: text("phone"),
    purpose: text("purpose", { enum: ["briefing", "service", "paid", "question"] }).notNull(),
    // Plain reference, no FK: diagnosis_responses.lead_id points back here (DEV-07 §3-7).
    sourceResponseId: integer("source_response_id"),
    campaignId: integer("campaign_id").references(() => campaigns.id),
    ownerAdminUserId: integer("owner_admin_user_id").references(() => adminUsers.id),
    status: text("status", { enum: ["new", "contacted", "qualified", "nurturing", "converted", "lost"] }).notNull(),
    consentPrivacyAt: text("consent_privacy_at").notNull(),
    consentSharePartnerAt: text("consent_share_partner_at"),
    notes: text("notes"),
    createdAt: createdAt(),
    updatedAt: text("updated_at").notNull(),
  },
  (table) => [uniqueIndex("uq_leads_public_id").on(table.publicId), index("idx_leads_email").on(table.email), index("idx_leads_status").on(table.status), index("idx_leads_campaign_id").on(table.campaignId), index("idx_leads_owner_admin_user_id").on(table.ownerAdminUserId), index("idx_leads_created_at").on(table.createdAt)],
);

// One free-diagnosis run. The public (anonymous) mode never writes here, so `mode` has no
// `public` value. `lead_id` is set only when the visitor enters contact details and consents.
export const diagnosisResponses = sqliteTable(
  "diagnosis_responses",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    publicId: text("public_id").notNull(),
    definitionId: integer("definition_id")
      .notNull()
      .references(() => diagnosisDefinitions.id),
    mode: text("mode", { enum: ["outbound", "partner", "paid"] }).notNull(),
    tokenId: integer("token_id").references(() => diagnosisTokens.id),
    leadId: integer("lead_id").references(() => leads.id),
    answersJson: text("answers_json").notNull(),
    scoresJson: text("scores_json").notNull(),
    resultId: text("result_id").notNull(),
    secondaryResultId: text("secondary_result_id"),
    flagsJson: text("flags_json"),
    userAgentHash: text("user_agent_hash"),
    createdAt: createdAt(),
  },
  (table) => [uniqueIndex("uq_diagnosis_responses_public_id").on(table.publicId), index("idx_diagnosis_responses_definition_id").on(table.definitionId), index("idx_diagnosis_responses_token_id").on(table.tokenId), index("idx_diagnosis_responses_lead_id").on(table.leadId), index("idx_diagnosis_responses_mode_created_at").on(table.mode, table.createdAt)],
);

export const briefingRequests = sqliteTable(
  "briefing_requests",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    publicId: text("public_id").notNull(),
    leadId: integer("lead_id")
      .notNull()
      .references(() => leads.id),
    responseId: integer("response_id").references(() => diagnosisResponses.id),
    externalRef: text("external_ref"),
    scheduledAt: text("scheduled_at"),
    heldAt: text("held_at"),
    status: text("status", { enum: ["requested", "scheduled", "held", "no_show", "cancelled"] }).notNull(),
    outcome: text("outcome", { enum: ["service", "paid", "nurture"] }),
    notes: text("notes"),
    createdAt: createdAt(),
    updatedAt: text("updated_at").notNull(),
  },
  (table) => [uniqueIndex("uq_briefing_requests_public_id").on(table.publicId), index("idx_briefing_requests_lead_id").on(table.leadId), index("idx_briefing_requests_response_id").on(table.responseId), index("idx_briefing_requests_status").on(table.status), index("idx_briefing_requests_scheduled_at").on(table.scheduledAt)],
);

// No organization_id / tenant scope column — single-operator premise (DEV-01 §4).
export const activityLog = sqliteTable(
  "activity_log",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    logName: text("log_name"),
    description: text("description").notNull(),
    subjectType: text("subject_type"),
    subjectId: integer("subject_id"),
    event: text("event"),
    causerType: text("causer_type"),
    causerId: integer("causer_id"),
    properties: text("properties"),
    batchId: text("batch_id"),
    createdAt: createdAt(),
  },
  (table) => [index("idx_activity_log_subject").on(table.subjectType, table.subjectId), index("idx_activity_log_causer").on(table.causerType, table.causerId), index("idx_activity_log_log_name").on(table.logName)],
);
