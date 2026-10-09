// The parts of a Blume 2 config that mattered for this kind of site. Not a
// complete config: see the Blume documentation for the rest.
import fs from "node:fs";
import { defineConfig } from "blume";
import { orama } from "blume/search";

// The public address comes from the environment so the same commit can build
// for production and for a preview under a sub path. Without `site`, canonical
// links, llms.txt and OG tags point at localhost.
const siteUrl = process.env.DOCS_SITE_URL ?? process.env.CI_PAGES_URL;
const sitePath = siteUrl ? new URL(siteUrl).pathname.replace(/\/+$/, "") : "";

// Redirects for URLs that changed between Blume 1 and 2 (the year used to be
// stripped from a dated filename). Computed from the folder so a new post needs
// no extra line. Read relative to the working directory: this file is bundled
// into the framework's build, so import.meta.url does not point at your project.
const NEWS = "docs/changelog";
const newsRedirects = fs
  .readdirSync(NEWS)
  .filter((name) => /^\d{4}-\d{2}-\d{2}-.+\.mdx$/.test(name))
  .filter((name) => !/^draft:\s*true\s*$/m.test(fs.readFileSync(`${NEWS}/${name}`, "utf8").split(/^---\s*$/m)[1] ?? ""))
  .flatMap((name) => {
    const slug = name.slice(0, -4);
    return ["", "/en"].map((lang) => ({
      from: `${lang}/changelog/${slug.slice(5)}`,
      to: `${lang}/changelog/${slug}`,
    }));
  });

export default defineConfig({
  title: "Example Docs",
  description: "What the site covers, and what it does not.",

  // The search adapter. The Swedish tokenizer and title weight are patched in
  // by a script that runs after install, because neither can be configured.
  search: { provider: orama() },

  // Things that talk to a model.
  ai: {
    // Only some assistants accept a prefilled question in the URL. Test each.
    openInChat: ["chatgpt", "claude"],
  },

  // Things meant for agents and machines (moved here from `ai` in Blume 2).
  agents: {
    // Allow agents to read the manual, keep it out of training data. These are
    // preferences, not access control.
    contentSignals: { search: false, aiTrain: false },

    // Hand written, and says what the site does NOT cover. Generate any
    // numbers in it from the content.
    llmsTxt: {
      enabled: true,
      details: ["## About these docs", "", "..."].join("\n"),
    },

    // Custom MDX components need a markdown serializer, or they appear as raw
    // JSX tags in the .md mirror, in llms-full.txt and in MCP tools.
    markdownComponents: {
      Faq: ({ childBlocks }) => childBlocks().map((b) => b.markdown).join("\n\n"),
      FaqItem: ({ props, children }) =>
        typeof props.question === "string" ? `### ${props.question}\n\n${children}` : null,
    },

    // Blume 2 publishes an AI catalog and a generated agent skill by itself
    // once the site has an address. Fine for a public manual. Switch off for a
    // private site: catalog: false, skillMd: false. Check /.well-known/.
  },

  // Static output on any host: just the address and the base path.
  deployment: {
    ...(siteUrl ? { site: siteUrl } : {}),
    ...(sitePath ? { base: sitePath } : {}),
  },

  // Keep the site out of search engines while another copy exists. The header
  // does the real work (set it on the CDN). Do NOT set noindex per page in
  // frontmatter: it also removes the page from llms.txt.
  seo: { robots: true, sitemap: false },

  redirects: [...newsRedirects],
});
