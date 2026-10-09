# Instructions for AI assistants

## Purpose and layout

This is a public reference playbook, not a runnable application or the Blume framework source.
- README.md: quickstart, architecture, lessons, and content/hosting guidance.
- examples/blume.config.example.ts: partial, version-dependent configuration for a public site.
- examples/ci-skeleton.yml: incomplete GitLab CI design, not GitHub Actions.

## When helping someone start

1. Read the README quickstart and the current official https://useblume.dev/docs/quickstart and https://useblume.dev/docs/configuration before choosing commands or options. If browsing is unavailable, disclose that limitation.
2. Create the user's site in a separate directory using the official initializer. Do not turn this reference repo into their application unless requested.
3. Establish audience, language, target path, and hosting requirements from context. Use synthetic content until access control is ready.
4. Use the generated config as the baseline. Do not assume the examples, historical patches, custom components, or referenced scripts exist in the new site.
5. For internal docs, use a private repository and hosting-level access control for all files and the origin. External AI integrations require an explicit data-sharing decision.
6. Write a project-specific AGENTS.md in the new site with its actual structure, installed versions, commands, and content rules.
7. Run build, doctor, and validate using the installed CLI, then inspect rendered pages. Report failures and unavailable checks honestly. Obtain user approval before publishing their site.

## When editing this playbook

Keep prose and prompts tool-neutral and examples clearly labelled. Prefer official upstream links. Never add credentials, customer data, internal infrastructure identifiers, workplace email addresses, or private paths. Check Git history as well as working files before public release.

There are no application tests or build commands in this repository. Validate Markdown links and example assumptions when editing; do not claim a site build passed here. Do not run the CI skeleton or deploy cloud infrastructure as a documentation check.