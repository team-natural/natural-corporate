import cloudflare from "@astrojs/cloudflare";
import { unified } from "@astrojs/markdown-remark";
import svelte from "@astrojs/svelte";
import tailwindcss from "@tailwindcss/vite";
import { defineConfig } from "astro/config";
import rehypeExternalLinks from "rehype-external-links";

export default defineConfig({
  output: "server",
  // Canonical/og:url are built with `new URL(path, Astro.site)` in BaseLayout.
  site: "https://naturaling.jp",
  // Subpage URLs are directory-style with a trailing slash (/about/) and public/sitemap.xml
  // follows it. "always" makes dev 404 on slash-less URLs instead of silently redirecting like
  // production hosting would — catches bad internal links early.
  trailingSlash: "always",
  markdown: {
    // Astro 7 defaults to Sätteri, which does not run rehype plugins. Staying on unified keeps
    // the already-published news posts rendering byte-for-byte as they do today.
    processor: unified({
      // Open external links in Markdown (news posts) in a new tab.
      // Does not affect links in .astro templates — add target="_blank" to those individually.
      rehypePlugins: [[rehypeExternalLinks, { target: "_blank", rel: ["noopener", "noreferrer"] }]],
    }),
  },
  adapter: cloudflare({
    // Shared with apps/admin, as in production.
    persistState: { path: "../../.wrangler-state" },
    // Distinct per app, or both apps fight over 9229. Explicit ports don't auto-fall back.
    inspectorPort: Number(process.env.APP_INSPECTOR_PORT_PUBLIC ?? 9229),
  }),
  integrations: [svelte()],
  vite: {
    plugins: [tailwindcss()],
    optimizeDeps: {
      exclude: ["@astrojs/svelte/server.js"],
    },
  },
  server: {
    host: true,
    port: Number(process.env.APP_PORT_DEV_PUBLIC ?? 5173),
  },
});
