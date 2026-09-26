CREATE TABLE `activity_log` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`log_name` text,
	`description` text NOT NULL,
	`subject_type` text,
	`subject_id` integer,
	`event` text,
	`causer_type` text,
	`causer_id` integer,
	`properties` text,
	`batch_id` text,
	`created_at` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')) NOT NULL
);
--> statement-breakpoint
CREATE INDEX `idx_activity_log_subject` ON `activity_log` (`subject_type`,`subject_id`);--> statement-breakpoint
CREATE INDEX `idx_activity_log_causer` ON `activity_log` (`causer_type`,`causer_id`);--> statement-breakpoint
CREATE INDEX `idx_activity_log_log_name` ON `activity_log` (`log_name`);--> statement-breakpoint
CREATE TABLE `admin_sessions` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`admin_user_id` integer NOT NULL,
	`session_token` text NOT NULL,
	`expires_at` text NOT NULL,
	`created_at` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')) NOT NULL,
	FOREIGN KEY (`admin_user_id`) REFERENCES `admin_users`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE UNIQUE INDEX `uq_admin_sessions_session_token` ON `admin_sessions` (`session_token`);--> statement-breakpoint
CREATE INDEX `idx_admin_sessions_admin_user_id` ON `admin_sessions` (`admin_user_id`);--> statement-breakpoint
CREATE INDEX `idx_admin_sessions_expires_at` ON `admin_sessions` (`expires_at`);--> statement-breakpoint
CREATE TABLE `admin_users` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`public_id` text NOT NULL,
	`name` text NOT NULL,
	`email` text NOT NULL,
	`password_hash` text NOT NULL,
	`role` text NOT NULL,
	`status` text NOT NULL,
	`last_login_at` text,
	`created_at` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')) NOT NULL,
	`updated_at` text NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `uq_admin_users_public_id` ON `admin_users` (`public_id`);--> statement-breakpoint
CREATE UNIQUE INDEX `uq_admin_users_email` ON `admin_users` (`email`);--> statement-breakpoint
CREATE INDEX `idx_admin_users_role` ON `admin_users` (`role`);--> statement-breakpoint
CREATE INDEX `idx_admin_users_status` ON `admin_users` (`status`);--> statement-breakpoint
CREATE TABLE `briefing_requests` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`public_id` text NOT NULL,
	`lead_id` integer NOT NULL,
	`response_id` integer,
	`external_ref` text,
	`scheduled_at` text,
	`held_at` text,
	`status` text NOT NULL,
	`outcome` text,
	`notes` text,
	`created_at` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')) NOT NULL,
	`updated_at` text NOT NULL,
	FOREIGN KEY (`lead_id`) REFERENCES `leads`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`response_id`) REFERENCES `diagnosis_responses`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE UNIQUE INDEX `uq_briefing_requests_public_id` ON `briefing_requests` (`public_id`);--> statement-breakpoint
CREATE INDEX `idx_briefing_requests_lead_id` ON `briefing_requests` (`lead_id`);--> statement-breakpoint
CREATE INDEX `idx_briefing_requests_response_id` ON `briefing_requests` (`response_id`);--> statement-breakpoint
CREATE INDEX `idx_briefing_requests_status` ON `briefing_requests` (`status`);--> statement-breakpoint
CREATE INDEX `idx_briefing_requests_scheduled_at` ON `briefing_requests` (`scheduled_at`);--> statement-breakpoint
CREATE TABLE `campaigns` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`public_id` text NOT NULL,
	`name` text NOT NULL,
	`channel` text NOT NULL,
	`diagnosis_slug` text NOT NULL,
	`intro_copy` text,
	`owner_admin_user_id` integer NOT NULL,
	`status` text NOT NULL,
	`sent_at` text,
	`notes` text,
	`created_at` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')) NOT NULL,
	`updated_at` text NOT NULL,
	FOREIGN KEY (`owner_admin_user_id`) REFERENCES `admin_users`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE UNIQUE INDEX `uq_campaigns_public_id` ON `campaigns` (`public_id`);--> statement-breakpoint
CREATE INDEX `idx_campaigns_status` ON `campaigns` (`status`);--> statement-breakpoint
CREATE INDEX `idx_campaigns_owner_admin_user_id` ON `campaigns` (`owner_admin_user_id`);--> statement-breakpoint
CREATE INDEX `idx_campaigns_channel` ON `campaigns` (`channel`);--> statement-breakpoint
CREATE TABLE `diagnosis_definitions` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`slug` text NOT NULL,
	`version` integer NOT NULL,
	`definition_json` text NOT NULL,
	`definition_hash` text NOT NULL,
	`published_at` text NOT NULL,
	`created_at` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')) NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `uq_diagnosis_definitions_slug_version` ON `diagnosis_definitions` (`slug`,`version`);--> statement-breakpoint
CREATE TABLE `diagnosis_responses` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`public_id` text NOT NULL,
	`definition_id` integer NOT NULL,
	`mode` text NOT NULL,
	`token_id` integer,
	`lead_id` integer,
	`answers_json` text NOT NULL,
	`scores_json` text NOT NULL,
	`result_id` text NOT NULL,
	`secondary_result_id` text,
	`flags_json` text,
	`user_agent_hash` text,
	`created_at` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')) NOT NULL,
	FOREIGN KEY (`definition_id`) REFERENCES `diagnosis_definitions`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`token_id`) REFERENCES `diagnosis_tokens`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`lead_id`) REFERENCES `leads`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE UNIQUE INDEX `uq_diagnosis_responses_public_id` ON `diagnosis_responses` (`public_id`);--> statement-breakpoint
CREATE INDEX `idx_diagnosis_responses_definition_id` ON `diagnosis_responses` (`definition_id`);--> statement-breakpoint
CREATE INDEX `idx_diagnosis_responses_token_id` ON `diagnosis_responses` (`token_id`);--> statement-breakpoint
CREATE INDEX `idx_diagnosis_responses_lead_id` ON `diagnosis_responses` (`lead_id`);--> statement-breakpoint
CREATE INDEX `idx_diagnosis_responses_mode_created_at` ON `diagnosis_responses` (`mode`,`created_at`);--> statement-breakpoint
CREATE TABLE `diagnosis_tokens` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`token` text NOT NULL,
	`kind` text NOT NULL,
	`campaign_id` integer,
	`recipient_ref` text,
	`diagnosis_slug` text NOT NULL,
	`expires_at` text NOT NULL,
	`max_uses` integer DEFAULT 3 NOT NULL,
	`use_count` integer DEFAULT 0 NOT NULL,
	`first_clicked_at` text,
	`status` text NOT NULL,
	`created_at` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')) NOT NULL,
	`updated_at` text NOT NULL,
	FOREIGN KEY (`campaign_id`) REFERENCES `campaigns`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE UNIQUE INDEX `uq_diagnosis_tokens_token` ON `diagnosis_tokens` (`token`);--> statement-breakpoint
CREATE INDEX `idx_diagnosis_tokens_campaign_id` ON `diagnosis_tokens` (`campaign_id`);--> statement-breakpoint
CREATE INDEX `idx_diagnosis_tokens_status` ON `diagnosis_tokens` (`status`);--> statement-breakpoint
CREATE INDEX `idx_diagnosis_tokens_expires_at` ON `diagnosis_tokens` (`expires_at`);--> statement-breakpoint
CREATE TABLE `inquiries` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`public_id` text NOT NULL,
	`type` text,
	`name` text NOT NULL,
	`email` text NOT NULL,
	`message` text NOT NULL,
	`status` text NOT NULL,
	`handled_by` integer,
	`created_at` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')) NOT NULL,
	`updated_at` text NOT NULL,
	FOREIGN KEY (`handled_by`) REFERENCES `admin_users`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE UNIQUE INDEX `uq_inquiries_public_id` ON `inquiries` (`public_id`);--> statement-breakpoint
CREATE INDEX `idx_inquiries_status` ON `inquiries` (`status`);--> statement-breakpoint
CREATE INDEX `idx_inquiries_handled_by` ON `inquiries` (`handled_by`);--> statement-breakpoint
CREATE INDEX `idx_inquiries_created_at` ON `inquiries` (`created_at`);--> statement-breakpoint
CREATE TABLE `leads` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`public_id` text NOT NULL,
	`company` text NOT NULL,
	`name` text NOT NULL,
	`email` text NOT NULL,
	`phone` text,
	`purpose` text NOT NULL,
	`source_response_id` integer,
	`campaign_id` integer,
	`owner_admin_user_id` integer,
	`status` text NOT NULL,
	`consent_privacy_at` text NOT NULL,
	`consent_share_partner_at` text,
	`notes` text,
	`created_at` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')) NOT NULL,
	`updated_at` text NOT NULL,
	FOREIGN KEY (`campaign_id`) REFERENCES `campaigns`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`owner_admin_user_id`) REFERENCES `admin_users`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE UNIQUE INDEX `uq_leads_public_id` ON `leads` (`public_id`);--> statement-breakpoint
CREATE INDEX `idx_leads_email` ON `leads` (`email`);--> statement-breakpoint
CREATE INDEX `idx_leads_status` ON `leads` (`status`);--> statement-breakpoint
CREATE INDEX `idx_leads_campaign_id` ON `leads` (`campaign_id`);--> statement-breakpoint
CREATE INDEX `idx_leads_owner_admin_user_id` ON `leads` (`owner_admin_user_id`);--> statement-breakpoint
CREATE INDEX `idx_leads_created_at` ON `leads` (`created_at`);--> statement-breakpoint
CREATE TABLE `media` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`public_id` text NOT NULL,
	`uploader_id` integer,
	`key` text NOT NULL,
	`mime_type` text NOT NULL,
	`size_bytes` integer NOT NULL,
	`alt_text` text,
	`created_at` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')) NOT NULL,
	`updated_at` text NOT NULL,
	FOREIGN KEY (`uploader_id`) REFERENCES `admin_users`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE UNIQUE INDEX `uq_media_public_id` ON `media` (`public_id`);--> statement-breakpoint
CREATE UNIQUE INDEX `uq_media_key` ON `media` (`key`);--> statement-breakpoint
CREATE INDEX `idx_media_uploader_id` ON `media` (`uploader_id`);--> statement-breakpoint
CREATE TABLE `member_sessions` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`member_id` integer NOT NULL,
	`session_token` text NOT NULL,
	`expires_at` text NOT NULL,
	`created_at` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')) NOT NULL,
	FOREIGN KEY (`member_id`) REFERENCES `members`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE UNIQUE INDEX `uq_member_sessions_session_token` ON `member_sessions` (`session_token`);--> statement-breakpoint
CREATE INDEX `idx_member_sessions_member_id` ON `member_sessions` (`member_id`);--> statement-breakpoint
CREATE INDEX `idx_member_sessions_expires_at` ON `member_sessions` (`expires_at`);--> statement-breakpoint
CREATE TABLE `members` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`public_id` text NOT NULL,
	`name` text NOT NULL,
	`email` text NOT NULL,
	`password_hash` text NOT NULL,
	`status` text NOT NULL,
	`last_login_at` text,
	`created_at` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')) NOT NULL,
	`updated_at` text NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `uq_members_public_id` ON `members` (`public_id`);--> statement-breakpoint
CREATE UNIQUE INDEX `uq_members_email` ON `members` (`email`);--> statement-breakpoint
CREATE INDEX `idx_members_status` ON `members` (`status`);--> statement-breakpoint
CREATE TABLE `password_reset_tokens` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`admin_user_id` integer NOT NULL,
	`token` text NOT NULL,
	`expires_at` text NOT NULL,
	`used_at` text,
	`created_at` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')) NOT NULL,
	FOREIGN KEY (`admin_user_id`) REFERENCES `admin_users`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE UNIQUE INDEX `uq_password_reset_tokens_token` ON `password_reset_tokens` (`token`);--> statement-breakpoint
CREATE INDEX `idx_password_reset_tokens_admin_user_id` ON `password_reset_tokens` (`admin_user_id`);--> statement-breakpoint
CREATE INDEX `idx_password_reset_tokens_expires_at` ON `password_reset_tokens` (`expires_at`);