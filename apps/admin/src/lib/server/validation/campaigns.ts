// Client-writable campaign columns. `status`, the owner and the timestamps are the server's.
import { campaigns } from "@app/schema";
import { createInsertSchema, createUpdateSchema } from "drizzle-zod";
import { z } from "zod";

const DIAGNOSIS_SLUGS = ["business", "ai-dx"] as const;

const refinements = {
  name: (schema: z.ZodString) => schema.trim().min(1).max(100),
  introCopy: (schema: z.ZodString) => schema.trim().max(500),
  notes: (schema: z.ZodString) => schema.trim().max(2000),
  sentAt: (schema: z.ZodString) => schema.trim().max(40),
};

export const createCampaignSchema = createInsertSchema(campaigns, refinements)
  .pick({ name: true, channel: true, introCopy: true, sentAt: true, notes: true })
  .extend({ diagnosisSlug: z.enum(DIAGNOSIS_SLUGS) });

export const updateCampaignSchema = createUpdateSchema(campaigns, refinements)
  .pick({ name: true, channel: true, introCopy: true, sentAt: true, notes: true })
  .extend({ diagnosisSlug: z.enum(DIAGNOSIS_SLUGS).optional() });

export const issueTokensSchema = z.object({
  count: z.number().int().min(1).max(500),
  recipientRefs: z.array(z.string().trim().min(1).max(100)).max(500).optional(),
});

export type CreateCampaignInput = z.infer<typeof createCampaignSchema>;
export type UpdateCampaignInput = z.infer<typeof updateCampaignSchema>;
export type IssueTokensInput = z.infer<typeof issueTokensSchema>;
