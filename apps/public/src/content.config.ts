import { newsSchema } from "@app/content";
import { glob } from "astro/loaders";
import { defineCollection } from "astro:content";

// Files live in packages/content/, not src/content/ — shared with any other app that needs
// to read (not edit) the same developer-maintained content, the same way D1/R2 are shared.
// The entry id is the filename, and /news/<id>/ is a published URL — renaming a file
// in packages/content/news/ breaks an indexed page.
const news = defineCollection({
  loader: glob({ pattern: "**/*.md", base: "../../packages/content/news" }),
  schema: newsSchema,
});

export const collections = { news };
