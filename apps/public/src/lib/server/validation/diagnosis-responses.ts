import { z } from "zod";

// Body of POST /api/v1/diagnosis-responses/ (DEV-04 §6-1b). Answer values are validated
// against the definition inside the service, where the question list lives.
export const saveResponseSchema = z.object({
  token: z.string().trim().min(1).max(128),
  diagnosis: z.string().trim().min(1).max(32),
  definitionVersion: z.number().int().min(1),
  answers: z.record(z.string().max(16), z.number().int().min(0).max(50)),
  clientResult: z
    .object({
      resultId: z.string().trim().min(1).max(32),
      secondaryResultId: z.string().trim().max(32).nullable().optional(),
    })
    .nullable()
    .optional(),
});

export type SaveResponseBody = z.infer<typeof saveResponseSchema>;
