# AGENTS.md

## Purpose

Repo-specific operating guide for Codex in `/Users/omar/workDevelopment/personalProjects/dropsAppApi`.

Use local repo inspection and edits first. Reach for MCPs when the task needs live external state, hosted platform data, or current documentation that is not already in the workspace.
The tool list below is complete at the namespace or server level so it stays maintainable; pick the specific method inside that tool group based on the task.

## Provider Boundaries

- Cloudflare is for database hosting only in this repo.
  Use Cloudflare for D1 database access, D1 schema/migration work, and D1 account/database inspection.
  Do not use Cloudflare for Workers, KV, R2, Queues, routing, or general compute unless the user explicitly overrides this rule.
- SaaSignal is broader than jobs and is the preferred platform here for more complicated compute structures.
  SaaSignal's documented platform scope includes infra primitives such as KV, locks, sketches, channels, jobs, workflows, and webhooks; higher-level services such as storage, media, AI, search, matching, and personalization; and logistics and delivery modules.
  In this repo, use SaaSignal primarily for realtime channels, tracking, delayed or scheduled execution, queue-style workflows, coordination state, and logistics-oriented flows unless the user asks to expand into more of its platform surface.
- Vercel is the hosting and deployment surface.
  Use Vercel tools for deployments, logs, project configuration, previews, and toolbar threads.

## Default Workflow

- Start with local tools:
  `functions.exec_command`, `functions.write_stdin`, `multi_tool_use.parallel`, `functions.apply_patch`.
- Prefer `rg` for search, `sed` for targeted reads, and repo tests/builds for verification.
- Use `functions.apply_patch` for direct file edits.
- Use a domain MCP only when the task clearly belongs to that system or requires live remote state.
- Use web research only when facts may have changed, the user asks for verification, or direct sources are needed.

## Skills

- `enterprise-api` (`/Users/omar/.codex/skills/enterprise-api/SKILL.md`): Use for backend work in `apps/api`, especially Hono routes, Zod contracts, service-layer changes, auth scopes, OpenAPI work, database-backed resources, and API primitives. This is the default skill for most server-side changes in this repo because the API already follows a thin-route/service-layer structure.
- `frontend-design` (`/Users/omar/.codex/skills/frontend-design/SKILL.md`): Use for substantial UI work in `apps/driver-app` when the task is about interface quality, layout, visual direction, or product polish. Use it when the user wants design work, not for routine wiring or backend tasks.
- `gh-fix-ci` (`/Users/omar/.codex/skills/gh-fix-ci/SKILL.md`): Use when the user asks to debug failing GitHub Actions or CI checks. This skill is specifically for investigating CI failures through GitHub and should be used before proposing a CI fix. Follow its approval rules before implementing changes.
- `imagegen` (`/Users/omar/.codex/skills/imagegen/SKILL.md`): Use only when the user wants image generation or editing through the OpenAI Image API.
- `playwright` (`/Users/omar/.codex/skills/playwright/SKILL.md`): Use when a task needs browser automation from the terminal, repeatable UI flows, screenshots, or DOM-level verification.
- `playwright-interactive` (`/Users/omar/.codex/skills/playwright-interactive/SKILL.md`): Use when a browser session needs to stay alive across multiple iterations for faster UI debugging or investigation.
- `skill-creator` (`/Users/omar/.codex/skills/.system/skill-creator/SKILL.md`): Use when the user wants to create or improve a Codex skill.
- `skill-installer` (`/Users/omar/.codex/skills/.system/skill-installer/SKILL.md`): Use when the user wants to discover or install skills into Codex.

## Local Tools

- `functions.exec_command`: Primary shell tool. Use for reading files, searching, running tests, inspecting git state, building, linting, and one-off repo commands.
- `functions.write_stdin`: Use to continue or poll a running shell session created by `exec_command`, especially for long-running dev servers or interactive terminal programs.
- `functions.apply_patch`: Primary editing tool for creating and modifying files manually.
- `multi_tool_use.parallel`: Use to parallelize independent developer-tool calls such as multiple file reads or shell inspections.
- `functions.list_mcp_resources`, `functions.list_mcp_resource_templates`, `functions.read_mcp_resource`: Use when an MCP exposes structured context directly. Prefer these over external search when they can answer the question.
- `functions.update_plan`: Use for longer multi-step work where a tracked execution plan adds clarity.
- `functions.request_user_input`: Available only in Plan mode. Use only when a real user choice blocks safe progress; otherwise make reasonable assumptions and continue.
- `functions.view_image`: Use to inspect a local image file when screenshots or assets matter.
- `web`: Use for current facts, official sources, direct links, or anything time-sensitive. It also covers search/open navigation plus built-in finance, weather, time, sports, and image lookup helpers. Prefer primary sources and official docs.

## MCPs And When To Use Them

- `better-auth`: Use for knowledge-base search, file retrieval, or chat grounded in uploaded Better Auth documents. This is useful only when those uploaded materials are relevant to the task.
- `cloudflare`: Use for Cloudflare D1 work only in this repo.
  Reasons to use it:
  D1 endpoint lookup through the Cloudflare spec, D1 API reference inspection, or live D1/account operations that support database hosting.
  Reasons not to use it:
  General compute, Workers, KV, R2, Queues, or non-database architecture work.
- `context7`: Use for current library and framework documentation. Resolve the library id first, then query the docs. This is the best choice when implementing against a package API and you need version-aware docs or code examples.
- `firecrawl`: Use for open-ended web research, search, site discovery, structured scraping, or extracting data from documentation sites.
  Preferred flow:
  search first, then map, scrape, or extract, and use the autonomous agent or browser session only when direct search plus scrape is not enough.
- `github`: Use for repository hosting actions and GitHub state.
  Reasons to use it:
  issues, pull requests, review comments, branches, releases, labels, checks, code search, file/branch updates, and Copilot delegation.
- `playwright`: Use for browser automation and UI diagnostics.
  Reasons to use it:
  reproducing frontend bugs, navigating app flows, collecting console or network data, taking screenshots, filling forms, and verifying rendered behavior.
- `saasignal`: Use for complicated compute structures and live SaaSignal project state.
  Reasons to use it:
  realtime channels, presence, delayed jobs, scheduled jobs, queue or pull workflows, KV-backed coordination, token usage, and billing or usage inspection.
  Service-level scope:
  SaaSignal also documents locks, sketches, workflows, webhooks, storage, media, AI primitives, search, matching, personalization, logistics, and delivery modules.
  MCP scope in this session:
  the available SaaSignal tools here cover billing, channel operations, jobs, KV, and token usage or balances. They do not currently expose the full SaaSignal API surface.
  Repo preference:
  In this repo, SaaSignal is the preferred remote orchestration layer for dispatch offers, tracking streams, webhook retry jobs, and similar async flows, and it is the first place to look when a task naturally fits its broader logistics or orchestration platform.
- `shadcn`: Use when building or extending a web React UI that should use shadcn registry components or examples. Avoid it for native/mobile-oriented Expo work unless the scope is explicitly web-only and shadcn is a good fit.
- `stripe`: Use for payments and billing tasks.
  Reasons to use it:
  subscriptions, customers, invoices, payment intents, refunds, disputes, coupons, payment links, and Stripe integration planning.
- `vercel`: Use for the hosting layer used by this repo.
  Reasons to use it:
  deployment lookup, build logs, runtime logs, project settings, team or project discovery, preview access, Vercel docs lookup, and toolbar feedback threads.

## Tool Selection Rules

- For repo code changes:
  use local shell tools plus `apply_patch` first.
- For backend/API implementation:
  use `enterprise-api` first, then `context7` only if library docs are needed.
- For frontend/UI implementation:
  use `frontend-design` for design-heavy work and `playwright` for behavioral verification.
- For deployment or runtime incidents:
  use `vercel`.
- For database work:
  use local code plus Cloudflare D1 guidance and Cloudflare MCP only when live D1 state matters.
- For async orchestration, retries, queues, channels, routing logistics or workflow logic:
  use `saasignal`.
- For GitHub workflow tasks:
  use `github`, and use `gh-fix-ci` if the problem is failing GitHub Actions.
- For library docs:
  use `context7`.
- For current external facts or open web research:
  use `web` or `firecrawl` depending on whether the task is verification/citation or structured discovery/scraping.

## Repo-Specific Reminders

- Respect the current provider split documented in `README.md`:
  Cloudflare D1 for data, Vercel for hosting, SaaSignal for realtime and job orchestration.
- SaaSignal's public API documentation is broader than the local MCP methods exposed in this session.
  Reference: [https://api.saasignal.saastemly.com/llms.txt](https://api.saasignal.saastemly.com/llms.txt)
- Keep API routes thin and move business logic into services.
- Reuse shared contracts in `packages/contracts` when changing request or response shapes.
- Do not introduce Cloudflare compute products as a default solution path for this project.
- Prefer SaaSignal over ad hoc background-job code when the problem is asynchronous, retried, delayed, scheduled, or fan-out oriented.
