import { ValidationError } from "@app/server-kit/http";
import { z } from "zod";

// One place that turns a Zod failure into the 422 envelope, so routes stay input/output only.
export function parseBody<T extends z.ZodType>(schema: T, payload: unknown): z.infer<T> {
  const parsed = schema.safeParse(payload);
  if (!parsed.success) throw new ValidationError(z.flattenError(parsed.error).fieldErrors as Record<string, string[] | undefined>);
  return parsed.data;
}

export async function readJson(request: Request): Promise<unknown> {
  return request.json().catch(() => null);
}
