// What an operator may change on a lead: the owner, the phone they learned on a call, and
// notes. Contact details the visitor typed and the consent stamp are not theirs to edit.
import { leads } from "@app/schema";
import { createUpdateSchema } from "drizzle-zod";
import { z } from "zod";

export const updateLeadSchema = createUpdateSchema(leads, {
  notes: (schema) => schema.trim().max(4000),
  phone: (schema) => schema.trim().max(50),
})
  .pick({ notes: true, phone: true })
  .extend({ ownerId: z.string().trim().min(1).max(32).nullable().optional() });

export type UpdateLeadInput = z.infer<typeof updateLeadSchema>;
