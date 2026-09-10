import { z } from "zod";

// Schemas for developer-maintained content (git-committed Markdown, no admin UI) — the
// counterpart to packages/schema's D1 tables for client-maintained content. Shared here so
// every app reading these files (apps/public today) validates against the same shape.

// Field names are load-bearing: they match the frontmatter of the already-published posts in
// packages/content/news/, and /news/<filename>/ is an indexed URL.
export const newsSchema = z.object({
  title: z.string(),
  date: z.coerce.date(),
  category: z.string(),
  description: z.string(),
});

export type News = z.infer<typeof newsSchema>;
