import { z } from "zod";

// ISO 8601 with an offset or Z: what the picker sends and what the column stores.
const isoDateTime = z.iso.datetime({ offset: true });

export const scheduleBriefingSchema = z.object({
  scheduledAt: isoDateTime,
  externalRef: z.string().trim().max(200).optional(),
});

export const holdBriefingSchema = z.object({
  outcome: z.enum(["service", "paid", "nurture"]),
  heldAt: isoDateTime.optional(),
  notes: z.string().trim().max(4000).optional(),
});

export type ScheduleBriefingInput = z.infer<typeof scheduleBriefingSchema>;
export type HoldBriefingInput = z.infer<typeof holdBriefingSchema>;
