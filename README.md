# A docs site people and AI can both use: a Blume playbook

This is how we built and run a documentation site for a software product with [Blume](https://useblume.dev) (a markdown first docs framework on Astro), hosted as plain static files, written with the help of AI agents, and readable by AI tools. It is written for someone who wants to build the same thing and would like to know what to decide up front and where the traps are.

Nothing here is specific to our product. Addresses, accounts and names are placeholders (`docs.example.com`, `example-docs-bucket`). Version-specific observations below describe the source setup and are not a compatibility guarantee for current releases. Verify the installed Blume version and current official documentation before copying a config or adding a patch.

## Start here: humans and AI assistants

This repository is a reference playbook with tips and examples. It does not contain a runnable Blume site, dependencies, the custom scripts described below, or configured infrastructure. Use it to build a separate documentation project for your organisation. You do not need to clone Blume's framework source to create a site.

### 1. Clone this playbook

Install Git and Node.js 22.19 or newer (check the current upstream requirement first). Run:

```sh
git clone https://github.com/jaggeman/BlumeManuales.git
cd BlumeManuales
```

Read this README and [AGENTS.md](AGENTS.md). Any coding assistant with file access can use them; if yours does not automatically read `AGENTS.md`, explicitly ask it to read the file. No particular AI subscription or integration is required by this playbook.

### 2. Create your own site in a separate folder

From the parent folder of the cloned playbook:

```sh
npx blume@latest init my-internal-docs
cd my-internal-docs
npm run dev
```

The initializer asks questions and installs dependencies. If you choose a different directory, enter that directory instead. Open the local address printed in the terminal. Edit `docs/index.mdx` and the generated `blume.config.ts`; keep the generated config as your baseline.

Stop the dev server before running the initial checks:

```sh
npm run build
npx blume doctor
npx blume validate
```

Commit the generated package lockfile to make later installs reproducible with `npm ci`. Configure your new site's own Git repository and private remote before adding internal material.

Verified against the [official quickstart](https://useblume.dev/docs/quickstart) on 2026-10-09. Read the [CLI reference](https://useblume.dev/docs/cli) for current commands. The [upstream source](https://github.com/haydenbleasel/blume) is useful when contributing to the framework; cloning this playbook and scaffolding a site are separate tasks.

### 3. Give your AI a concrete starting task

Copy this prompt into your coding assistant and replace the paths and requirements:

```text
Read the BlumeManuales README.md and AGENTS.md as reference material.
Create a separate Blume docs site in <new project path> using the current
official https://useblume.dev/docs/quickstart and configuration reference.
Our audience is <audience>, our language is <language>, and hosting is <host>.
This site will contain internal information: keep the repository private,
and require authentication at the hosting layer before any file is served.
Start with synthetic content and a home page, one how-to, and one FAQ.
Record the installed version and actual build/check commands in the new
project's AGENTS.md. Explain which playbook examples apply and which do not.
Run a build, doctor, and link validation; report results and inspect the
rendered pages. If you cannot browse or run commands, say so explicitly.
Do not publish or deploy until I have reviewed the preview and approved it.
```

### 4. Adapt the examples deliberately

- [Configuration example](examples/blume.config.example.ts): selected ideas from a historical setup, not a complete starter. It enables public-facing AI features and assumes a `docs/changelog` folder, optional custom FAQ components, and English translations. Do not copy it unchanged into an internal site. Check every option against your installed version.
- [CI skeleton](examples/ci-skeleton.yml): **GitLab CI syntax**, even though this playbook is hosted on GitHub. It is not a GitHub Actions workflow. Several scripts and npm tasks are intentionally not included; implement them or remove their references before enabling CI. Replace all `<...>` placeholders. For GitHub, translate the design into Actions and use your host's supported OIDC integration.
- Start with a working local build. Add checks, previews, and deployment in small steps rather than copying the entire production design at once.

### Internal hosting comes before internal content

Keep the site repository private. Use a private network or an authenticated gateway that protects **every** route and asset, including Markdown mirrors and search indexes; protect the storage origin too. A browser-only login, `noindex`, or a hidden navigation item does not restrict access. Leave external AI/chat integrations off until your organisation approves what may be sent to them. See section 9 before choosing hosting.

## Experience and version scope

## 1. The shape of it

```
 writers (humans, AI agents)
        |  merge request
        v
  git repo ── docs/*.mdx are the source ──┐
        |                                  |
        |  CI on every merge request       |  CI on main
        v                                  v
  checks + preview build            build, upload, verify
  (private preview host)            (object storage + CDN)
                                           |
                                           v
                                   https://docs.example.com
                                   pages for people
                                   markdown mirrors, llms.txt, search index for tools
```

Four decisions carry most of the weight:

| Decision | Why |
| --- | --- |
| **The `.mdx` files are the source.** No converter, no export, no generated pages. | We started from an export of older manuals and converted it with a script. A hand edit disappeared at the next run. Once the pages became the only source, that whole class of problem went away. |
| **Static output, no server.** | Blume builds plain files. Any object storage plus a CDN serves them, cheaply and with nothing to patch. The price is that the site cannot make decisions per request (see section 10). |
| **One environment.** | Docs are identical everywhere, so a staging copy only adds drift. The merge request preview is the staging. |
| **A merge to main is the deploy.** | Writers do not run anything by hand. The checks run before the merge, and the deploy checks itself afterwards. |

## 2. Hosting a static Blume site

### What worked

- **Private bucket plus CDN.** Keep the bucket private and let only the CDN read it. A public bucket is a second front door that bypasses everything you configure on the CDN.
- **Headers on the CDN, not in the page.** We wanted the whole site out of search engines for a while (the same manuals existed elsewhere). A `noindex` response header set by a CDN response policy is the real thing. A meta tag helps but a header covers every file type. Static hosts that cannot set response headers (GitHub Pages, GitLab Pages) cannot do this, so we used them only for previews.
- **Clean URLs need a rewrite.** Object storage has no index documents. Blume builds `/bank/index.html`, and the CDN needs a small viewer request function that maps `/bank/` and `/bank` to it. Keep the rule narrow: a last path segment with a dot is a file and is left alone.
- **A real 404.** Configure the CDN to serve Blume's `404.html` with status 404. Test it: a misconfigured error page that returns 200 hides every broken link from your monitoring.
- **Content types.** `aws s3 sync` guesses types from file extensions and does not know `.md`. Blume publishes a markdown mirror of every page, so upload `.md` and `.mdx` separately with an explicit `text/markdown` type.

### Deploying from CI without long lived keys

Use the CI system's OIDC token to assume a cloud role that is limited to your repo and your protected branch. No access keys are stored anywhere. The role can write one bucket and invalidate one distribution, nothing else. See `examples/ci-skeleton.yml`.

### Upload in parts

A fresh build gives every file a new modification time, and `sync` uploads a file when size or time differs. Our first version re-uploaded about two thousand files on every deploy. We split the upload into disjoint parts with their own filters: hashed assets compared by size only, the markdown mirrors with their content type, and everything else. Each part uses `--delete`, which is safe because a delete only touches objects that match the same filters. Add a check that every built file falls in exactly one part, so a new file type cannot slip through unfiltered.

### One deploy at a time

Two merges in quick succession can run two deploys at once, and if the older one finishes last the site rolls back. Use the CI system's resource group (a mutex) and set it to process the oldest pipeline first. This is a setting on the resource group, not something the pipeline file can express, so write it in the runbook.

### Verify the live site after every deploy

The build writes the commit hash to `version.txt`. A post deploy job waits until `https://docs.example.com/version.txt` shows that commit (or a newer one that contains it, see below), then checks the real site: the `noindex` header on every response, content types for the markdown mirrors, that a nonexistent page gives 404, and anything else that depends on the CDN and not on your build. Nothing before this job can see those. When two merges land close together, the later deploy overwrites the earlier one before its check sees its own commit, so the check must accept a newer commit that contains the expected one. Ask git (`merge-base --is-ancestor`), do not compare strings.

## 3. CI that catches the things a build does not

A green build only says the site builds. Add checks for what actually broke for us, and **prove each check can fail** with a test that feeds it a deliberately broken input. A check that has only ever said "ok" proves nothing. We found a bug in our first page check on its first day this way (an empty `description: ""` passed).

| Check | What it prevents |
| --- | --- |
| Page standard (title and description present, one H1, no heading jumps, images exist, alt text, ...) | Pages that build but read badly, and AI tools that take their only context from the description |
| Link check that also reads `href` on MDX components | The framework validator reads markdown links only, so a navigation page made of `<Card href>` can ship with every link broken |
| Generated files are up to date (`git diff --exit-code` after regenerating) | Adding a page and forgetting to regenerate the menu or search data |
| Instruction files point at things that exist | Your own `CLAUDE.md` rotting. It cannot catch wrong prose, only dead references, so also grep for a claim when you correct it |
| Tests for each patch to the framework (section 7) | A framework upgrade silently undoing your patch |
| Forbidden content patterns (links to a retired system, unclosed bold, ...) | Whatever bit you last time |

Rule we use for new checks: measure first, fix what it finds, add the rule only when it passes on every existing page. A rule that fails existing pages is a to do list, not a check, and nobody can run it before a merge request.

Previews: build every merge request to a private preview host, so the reviewer sees the page, not a diff. Drafts (`draft: true`) are not built, which is what you want in production and a surprise in a preview. Document how to build them locally.

## 4. Content rules worth writing down

Write these in the repo, where both people and AI agents read them:

- **No customer data.** Show the form, not the values. Never paste from a ticket system, it contains names and ids.
- **Nothing internal, not even hidden.** `draft`, an AI exclusion flag and `noindex` hide a page, they do not protect it. If a page must not be public, it does not belong in a public site (section 9).
- **No prices** if prices differ per customer. Describe the mechanism and point to the account manager.
- **Do not publish security fixes or changes in how customer data is processed in release notes.** A note about a corrected permission check also says the hole existed.
- **Verify facts against the product code or the ticket**, not against the older documentation. Say in the text when something is missing instead of guessing.
- **Describe only what the customer can do.** Features gated behind staff only permissions do not belong.
- **House style that is mechanical gets checked, the rest gets written down.** Menu names in bold with `>` between them, two heading levels, tables with one of two header pairs, and so on.

## 5. Writing with AI agents

This is the part people ask about, so be specific about what made it work.

**An instruction file in the repo root** (`CLAUDE.md` or `AGENTS.md`) that is the single place for the rules: where the source is, the one rule that matters most (pages are source, edit them directly), the workflow, the content rules, the known traps, and a short "open now" list of unfinished things with dates. Ours grew long. What made it useful:

- Start with **what the site is, where things live, and why decisions look the way they do**, in a table. Agents and new colleagues keep asking the same questions.
- **Explain the reasoning**, not only the rule. "We have no converter because hand edits used to vanish" stops someone re-adding one.
- **Date the claims that rot** ("as of 2026-10-04"). A snapshot labelled as one is safe, an undated one is a trap.
- **Correct the instruction in the same change as the bug.** Every time we found a wrong statement we fixed the file too. Reading a file again does not find a wrong sentence, searching for the claim does.

**Templates**: one per page shape (overview, step guide, settings page, report page, FAQ). Agents copy the closest one and follow the comment inside it. Keep a gallery of draft pages, one per template, so the template cannot drift from the theme.

**Skills** (an agent skill is a file that tells the agent how to do one kind of job) for the recurring jobs: add or fix a page, publish, open the editor.

**Workflow we settled on**
1. The agent works in its own git worktree, never in main. Several agents ran in the repo at once and two of them wrote the same fix the same afternoon.
2. It opens a merge request as soon as the change is done.
3. It gives the writer the preview link and asks *"does the preview look right, should I merge?"* Only a yes leads to a merge. This is the step that lets a writer who does not use git publish safely, and it is the step you must not automate away: the pipeline cannot see a wrong screenshot, a customer name inside an image, or a sentence that is simply wrong.
4. After a yes, merge (or enable auto merge if the pipeline is still running).
5. The author merges their own request. Changes to CI, config, theme and scripts are reviewed by someone else.

**People without a git account.** We gave them two routes. A browser editor (an MDX editor wrapped as a small web app) that saves changes which an agent then turns into a merge request, and a shared folder where colleagues drop Word files that an agent converts. Both end in a merge request, so the same checks and review apply. Do not put the repository itself in a synced folder: file sync and git corrupt each other, and concurrent edits are overwritten without anyone noticing.

**What agents get wrong, and the guard for each**

| Failure | Guard |
| --- | --- |
| Invents a step or a field name | Rule to verify against the product code, and to write "missing" in the text instead |
| Copies a real customer into an example | Content rule plus a script that flags personal and organisation numbers, bank account numbers and outside email addresses. Screenshots must be looked at by a person, no script can |
| Edits a generated file by hand | Regeneration plus a CI diff |
| Describes a feature that is switched off in production | Check the feature flag and what the live tool list shows. We once documented an upload form that was disabled in production |
| Lets a long lived branch grow | Rule: small merge requests, merged often |
| Merges before a person has seen it | The "preview, then ask" step above |

## 6. Making the site readable for AI tools

Blume does a lot of this by default. Decide on purpose what you want and check what is switched on.

- **Markdown mirror of every page** (`/page.md`), `llms.txt` and `llms-full.txt`. Agents should fetch the `.md` address directly. Content negotiation (`Accept: text/markdown`) needs a server, so it does not work on a static host.
- **The `description` in the frontmatter is the product.** It is shown as the page intro, it is listed next to the title in `llms.txt`, and it is often the only thing an agent reads before choosing a page. Write what the page answers, not what it is called.
- **Write the orientation text for `llms.txt` by hand** (`agents.llmsTxt.details` in Blume 2). Say what the site covers, and just as important what it does not (internal guides, prices, individual customers' data). Generate any numbers in it from the content, we had a hand written "206 pages" survive until there were 212.
- **Custom MDX components need a markdown serializer.** Without one, your FAQ and side by side blocks appear as raw JSX tags in the mirror, in `llms-full.txt` and in any MCP tool. Blume's own components already have serializers.
- **Fix up generated headings.** Blume files release notes under a generic heading in `llms.txt`. We rename it after the build with a small script, and the script fails if the section holds anything unexpected. Touch only `llms.txt`: the same words appear as real page content in `llms-full.txt`.
- **Escapes leak into mirrors.** If you escape a colon in a word (`Product\:s`) because the framework reads `:s` as a directive, the backslash shows in the mirror. Strip it after the build, except in code.
- **Content signals.** You can say whether search, AI input and AI training are allowed. We allow agents to read the manual (that is the point), and set training to no. These are preferences, not access control.
- **Know what Blume 2 turns on by itself.** With a site address configured it publishes an AI catalog and a generated agent skill for the site. For a public manual that is helpful. For a private site it is not, so switch them off explicitly and check `/.well-known/` after every upgrade.
- **"Open in chat" buttons.** Some assistants accept a prefilled question in the URL, some drop it and open an empty chat. Test each one. For the ones that do not, we added a row that copies the question and opens the chat.
- **An MCP server over the docs**, so assistants can search and read pages. Blume can provide one. If your product also has an MCP server, make the docs searchable from it, and keep the two sources consistent: our product's tool descriptions point customers to the manual.

## 7. Search, and a trap for non English sites

Blume's default search (Orama) tokenises with a letter set that treats å, ä, ö and similar characters as separators. A Swedish word like "lönespecifikation" became two meaningless tokens and returned 241 results, with an unrelated page first. Orama has a Swedish mode. We patch it in for Swedish default locales, and weight titles higher than the framework's default so a long page that merely mentions a word does not outrank the page about it.

Neither is configurable in Blume 1 or 2, so the patch is a small script that runs after install and before build, and it **stops the build** if the expected code is not found in both places the framework keeps it (source and built output). A test fails if either change is missing. Expect to rewrite the pattern at every major upgrade. When you do, measure again: pick a dozen real search terms, count results and look at the top hit before and after.

Check your own language the same way. Any language with accented letters is worth a test search the day you set up.

## 8. Using it with other languages

Translations in Blume are sibling files (`page.en.mdx` next to `page.mdx`) with a fallback to the default language, so you can translate page by page. Remember that retiring a page means deleting its translations too, otherwise they sit orphaned and nothing fails.

## 9. A private docs site is a different project

The static hosting design in this playbook cannot decide access per reader. Access control must be enforced by the hosting layer for every file. `draft`, AI exclusion and `noindex` only hide, so nothing internal belongs in a public site, not even hidden. If you need internal docs, build a second site from the same foundation:

- **A separate repo**, copied from the first: same framework version, theme, components, templates and checks, with no content.
- **Keep it off the public internet**, and decide that before you build anything. Reach it only from your own network. Do not rely on a login inside the site: a login in the browser only hides pages while the files and the search index can still be fetched by address.
- **Let the deploy job prove the site is not public**, instead of checking that it works. Your CI runners are probably outside the network, so they cannot read the site anyway. Check from there that the name does not resolve publicly and that the storage answers "forbidden" to an anonymous request. Check from inside the network, after a deploy, that the site works.
- **AI features off** until you decide what internal content may be sent to AI tools: no open in chat buttons, no `llms.txt`, no catalog, no generated agent skill.
- **A customer data check** in CI for text (personal numbers, bank accounts, outside emails), with tests, and a person looking at every screenshot.
- **Dark launch the pipeline.** Create the deploy jobs only when a single CI variable is set, so main stays green while the infrastructure is still being built.

## 10. Upgrading Blume (1 to 2 in our case)

Blume ships an upgrade command (`npx blume@latest upgrade`) that bumps the version, then lists every config change with file and line. For us it was four config changes and then the things the command cannot know:

- **Your patches break.** Plan for it, and keep the guard tests.
- **URLs can change.** Blume 1 read the year in `2026-09-22-slug.mdx` as a sort prefix and routed the page as `/changelog/09-22-slug`. Blume 2 keeps the whole date. Links people have shared in mail and chat must keep working, so we generate a redirect for every old address from the folder listing, so a new post needs no extra line. Compute them from the working directory: the config is bundled into the framework's build, so `import.meta.url` does not point at your project.
- **Anything that reads the rendered page breaks.** Our date and category filter on the release notes page matched text in the old timeline. The new page is a compact list. We rewrote the filter to read the machine readable `<time datetime>` and keep a test that compares the filter's keys with the built list.
- **Unsupported syntax stops being swallowed.** A `:::details` block is not a Blume directive. In 1.7 its content silently disappeared, and the audit now flags it. Use your own FAQ component.
- **Defaults change.** Read the release notes for what is new and on by default.
- Upgrade in a separate worktree, run the whole chain, **look at the release notes page, the start page and a page with tables** in a browser (light and dark, narrow and wide). A green build says the pages build, not that they look right.

## 11. Pitfalls, in one list

- Do not generate pages from a source you also edit by hand.
- A public bucket behind a CDN is a second front door.
- Static hosts without response headers cannot set `noindex`. Use them for previews only.
- Test the 404 status, not just that a 404 page exists.
- Two quick merges, two overlapping deploys: serialise them.
- A check that has never failed is not a check.
- A framework validator that skips component attributes is not a link checker.
- Generated menus and counts must be regenerated and diffed in CI, never edited.
- Hide is not protect. Keep private content out of public repos and sites.
- Wide tables clip on phones unless you handle overflow, and clipping happens silently. Test one in mobile width.
- Look at the preview. A person must see the page before it goes out.

## 12. What to keep out of a public write up (and your repo)

Before publishing anything derived from a working setup, search for these:

- Cloud account ids, role ARNs, bucket and distribution names, internal hostnames, private IP addresses.
- Tokens, keys, signed cookies, webhook URLs, anything from a CI variable list.
- People's names and email addresses, ticket ids, internal repository paths.
- Customer names, company numbers, amounts from real invoices, screenshots with real data.
- Internal product code names and the names of unreleased features.

Put real values in CI variables, not in the repo. The deploy role's identity should be a CI variable or a placeholder in examples. A public repo of a setup like this should contain a skeleton with placeholders and a list of what you would have to fill in, not a copy of your working files.

## 13. A start list

1. Create the repo with Blume, one theme, one set of templates.
2. Write the instruction file, even a short one, before the first AI generated page.
3. Add the page standard check and the link check, and tests that prove they fail.
4. Set up the private bucket, CDN, noindex header, clean URL rewrite and 404.
5. Add the deploy job with OIDC, parts, queue and the post deploy check.
6. Build previews for merge requests.
7. Decide the AI surface on purpose: mirrors, `llms.txt` text, content signals, what is switched on by default.
8. Test search in your own language.
9. Decide who may merge, and add the "preview, then ask" step.
10. Write down what an upgrade needs, and rehearse one.

Files in this folder:

- `examples/ci-skeleton.yml` a sanitised pipeline: verify, preview, build, upload in parts, check
- `examples/blume.config.example.ts` the config shape with the parts that mattered
