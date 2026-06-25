# SkillFlux 精选 Skill 市场 PRD / Technical Spec

- 状态：草稿 v0.4
- 日期：2026-06-25
- 读者：构建本产品的开发者（你）
- 关联：独立仓库 [skillflux_mcp](https://github.com/vc999999999/skillflux_mcp)；引流站 [Skillflux_Cloudflare](https://github.com/vc999999999/Skillflux_Cloudflare) 仅负责 skillflux.cn 内容分发

---

## 1. Executive Summary

### Problem Statement

AI coding agents 已经支持 skills / rules / MCP，但用户获取高质量 skills 的方式仍然很碎片化：需要到处搜索、手动复制、判断可信度、适配不同 agent 的安装路径、记住版本，并且后续更新困难。

同时，skill 作者想把精选内容变成可持续维护的付费产品，但如果一开始就做完整账号系统、插件平台或远程运行环境，范围会过重。

### Proposed Solution

SkillFlux 是一个**精选 skill 市场**：由 SkillFlux 官方维护一套高质量 skills，用户通过一个 npm 包把 SkillFlux 接入自己的 agent，再通过 MCP 在 agent 内搜索、安装、更新和移除需要的 skills。

产品不是远程执行环境，也不是开放给所有人发布 skill 的平台。它是一个**官方 curated skill marketplace + npm installer + MCP package manager**。

### Success Criteria

- P0：用户运行 `npx -y skillflux install` 后，目标 agent 能看到 `skillflux-mcp` 工具和 `skillflux-manager` skill。
- P0：在 fixture 模式下，用户能通过 agent 安装 `demo-skill`，并在本地生成安装记录。
- P1：用户不需要手动复制 JSON/TOML 即可完成至少一个 agent 的 MCP 注册。
- P2：每个安装的 skill 都有版本、路径、hash、scope 记录，可 list/update/remove。
- P3：用户完成第三方登录和托管支付后，无需人工发 key 即可获得下载权限。
- v1：用户在不同项目中只启用项目需要的 skills，避免全局堆积。

---

## 2. Product Definition

### One-Liner

SkillFlux 是一个通过 npm + MCP 接入 agent 的精选 skill 市场，让用户按需、按项目下载、安装和更新官方维护的 skills。

### What SkillFlux Is

- 一个官方精选 skill 市场。
- 一个 npm 形式交付的 Bootstrap Kit。
- 一个本地 MCP server，供 agent 调用市场搜索、安装、更新、授权等工具。
- 一个 manager skill，用来引导 agent 正确调用 SkillFlux MCP 工具。
- 一个 registry/API，用来分发官方 skill 内容并校验授权。
- 一个本地 lockfile 系统，用来记录每个项目启用了哪些 skills、版本和 hash。

### What SkillFlux Is Not

- 不是远程 agent 运行环境。
- 不是云端 IDE。
- 不是让用户上传和发布自己 skills 的开放平台。
- 不是完整团队知识库。
- 不是完整账号系统或支付系统。
- 不是把所有 skills 一次性塞进用户全局 agent 的合集包。

### Core Product Principle

全局只安装 SkillFlux 管理能力；具体 skills 根据项目需要按需启用。

```
Global bootstrap:
  skillflux CLI
  skillflux-mcp
  skillflux-manager
  ~/.skillflux/config.json
  ~/.skillflux/cache/

Project usage:
  <project>/skillflux.json
  <project>/.skillflux/skills/<skill-id>/SKILL.md
```

---

## 3. Personas

### Independent Developer

会使用 Claude Code、Cursor、Codex 等 agent，希望快速获得可靠 skills，而不是自己到处找 prompt、rules、SKILL.md。

### AI Power User

已经有多个项目和多个 agent，希望每个项目只启用相关 skills，并且能追踪版本和更新。

### SkillFlux Maintainer

负责创作、改写、审核和发布官方 skills，需要一个可授权、可更新、可回滚的分发机制。

---

## 4. User Stories

### Story 1: 一键接入 SkillFlux

As a developer, I want to run one command to connect SkillFlux to my agent so that I do not need to learn each agent's MCP config format.

Acceptance criteria:
- 用户运行 `npx -y skillflux install`。
- CLI 检测或接受 `--agent` 参数。
- CLI 注册 `skillflux-mcp`。
- CLI 安装 `skillflux-manager`。
- CLI 初始化 `~/.skillflux/config.json`。
- CLI 输出下一步提示。

### Story 2: 在 agent 内搜索精选 skill

As a developer, I want to ask my agent to find a skill for a task so that I do not need to browse random repositories.

Acceptance criteria:
- 用户在 agent 中提出需求，例如“给这个项目装一个 PRD skill”。
- `skillflux-manager` 引导 agent 调用 `pack.search`。
- MCP 返回匹配 skills 的 id、name、description、category、version、安装状态。
- 未授权用户只能看到允许公开展示的 metadata，不能下载付费内容。

### Story 3: 按项目安装 skill

As a developer, I want skills to be enabled per project so that my global agent is not cluttered.

Acceptance criteria:
- `skill.install({ id, scope: "project" })` 将 skill 写入当前项目的 SkillFlux 目录。
- 更新 `<project>/skillflux.json`。
- 更新 `<project>/.skillflux/installed.json` 或等价 project lockfile。
- 不默认把所有 paid skills 安装到全局 agent skills 目录。

### Story 4: 持续更新和移除

As a developer, I want SkillFlux to manage versions so that I do not manually maintain copied skill files.

Acceptance criteria:
- `skill.list` 显示当前项目启用的 skills。
- `skill.update` 比对本地 lockfile 和 registry 版本。
- `skill.remove` 只删除 lockfile 记录过的文件。
- 如果本地文件被用户修改，更新前提示冲突。

### Story 5: 登录和支付自动化

As a buyer, I want login and payment to happen through trusted web pages so that I do not send secrets through the agent.

Acceptance criteria:
- `auth.start` 返回浏览器登录 URL。
- 用户在浏览器完成第三方 SSO。
- `auth.status` 轮询并保存 device token。
- `billing.checkout` 返回托管支付 URL。
- 支付 webhook 写入 entitlement。
- 购买后 agent 可以下载授权范围内的 skills。

---

## 5. User Experience

### First-Time Setup

网站主 CTA：

```bash
npx -y skillflux install
```

CLI 完成：

1. 检测 agent，或要求用户传 `--agent cursor|claude-code|codex`。
2. 注册 MCP server。
3. 安装 `skillflux-manager`。
4. 创建 `~/.skillflux/config.json`。
5. 提示用户重启或刷新 agent 会话。

### In-Agent Usage

用户说：

```text
给这个项目安装一个写 PRD 的 SkillFlux skill
```

agent 流程：

1. `skillflux-manager` 触发。
2. 调用 `auth.status`。
3. 未登录则调用 `auth.start`。
4. 未购买则调用 `billing.checkout`。
5. 已授权后调用 `pack.search`。
6. 用户确认后调用 `skill.install({ id, scope: "project" })`。
7. 安装完成后提示本项目已启用该 skill。

### Returning User

用户说：

```text
更新这个项目的 SkillFlux skills
```

agent 流程：

1. 调用 `skill.list`。
2. 调用 `skill.update`。
3. 报告更新了哪些 skills、版本变化、是否有冲突。

---

## 6. Scope Model

### Global Scope

Global scope 只用于 SkillFlux 自身的基础能力。

```
~/.skillflux/
  config.json
  cache/
  logs/                  # optional
```

`~/.skillflux/config.json`：

```json
{
  "deviceId": "local-device-id",
  "deviceToken": "optional-token",
  "agent": "cursor",
  "fixtureMode": false
}
```

Global bootstrap 可安装：

```
~/<agent>/skills/skillflux-manager/SKILL.md
```

### Project Scope

Project scope 用于具体业务 skills。

```
<project>/
  skillflux.json
  .skillflux/
    skills/
      humanizer-zh/
        SKILL.md
      prd-writer/
        SKILL.md
    installed.json
```

`skillflux.json` 是用户可读的项目依赖清单：

```json
{
  "schemaVersion": "2026-06-25",
  "skills": {
    "humanizer-zh": "^1.2.0",
    "prd-writer": "^1.0.0"
  }
}
```

`.skillflux/installed.json` 是机器 lockfile：

```json
{
  "skills": {
    "humanizer-zh": {
      "version": "1.2.0",
      "scope": "project",
      "path": ".skillflux/skills/humanizer-zh",
      "sha256": "...",
      "files": ["SKILL.md"]
    }
  }
}
```

### Why Project Scope Matters

- 不污染用户全局 agent。
- 每个项目只启用需要的 skills。
- 项目可复现：未来可以 `skillflux install` 根据 `skillflux.json` 恢复依赖。
- 更新可控：项目 A 更新 PRD skill 不影响项目 B。

---

## 7. System Architecture

```
[SkillFlux Website]
  - explains product
  - provides install command
  - sends user to checkout when needed

[skillflux npm package]
  - bin: skillflux
  - bin: skillflux-mcp
  - bundled: skillflux-manager
  - bundled: demo-skill for fixture/P0

[Installer CLI]
  - registers MCP
  - installs manager skill
  - creates config
  - runs doctor/uninstall

[skillflux-manager skill]
  - tells agent how to call MCP tools
  - handles workflow decisions
  - does not store secrets or call API directly

[skillflux-mcp]
  - exposes auth/billing/pack/skill tools
  - reads/writes local state
  - calls registry API
  - installs files safely

[SkillFlux Registry API]
  - pack metadata
  - skill file payloads
  - entitlement checks
  - device auth state

[Third-Party Services]
  - SSO provider
  - hosted checkout provider
```

---

## 8. Component Requirements

### 8.1 Website

Responsibilities:
- Explain SkillFlux as a curated skill marketplace.
- Provide the install command.
- Explain supported agents and current beta state.
- Link to manual fallback config for advanced users.
- Explain that skills are installed per project.

Non-responsibilities:
- No password login UI.
- No custom payment form.
- No skill authoring dashboard in MVP.

### 8.2 Installer CLI

Primary command:

```bash
npx -y skillflux install
```

Supported commands:

```bash
skillflux install --agent cursor --scope user
skillflux install --agent codex --scope user
skillflux install --agent claude-code --scope user
skillflux doctor
skillflux uninstall
skillflux mcp start
```

Requirements:
- Register MCP with stable command, preferably:

```json
{
  "command": "skillflux",
  "args": ["mcp", "start"]
}
```

- Do not write unstable temporary npx cache paths into agent config.
- Prefer native agent MCP commands when reliable.
- Fallback to writing JSON/TOML with backup.
- Never accept token/license in shell command.

### 8.3 skillflux-manager Skill

Purpose:
- Teach agent how to use SkillFlux tools.
- Route user requests into MCP tool calls.
- Prevent users from needing to know tool names.

Required behavior:

```markdown
When the user asks to find, install, update, list, or remove SkillFlux skills:

1. Call `auth.status`.
2. If unauthenticated, call `auth.start` and show the login URL.
3. If needs_payment, call `billing.checkout` and show the checkout URL.
4. If active, call the relevant pack/skill tool.
5. Prefer project scope unless the user explicitly asks for global/user scope.
6. After install/update, summarize the project state.
```

Constraints:
- Do not embed API keys.
- Do not implement business logic in the skill.
- Do not ask user to manually edit MCP config unless installer failed.

### 8.4 MCP Server

MCP is the execution layer. It exposes tools and returns structured JSON payloads that the agent can explain to the user.

Required tools:

| Tool | Purpose |
|---|---|
| `auth.start` | Start browser-based SSO/device login |
| `auth.status` | Return auth/payment/entitlement state |
| `billing.checkout` | Return hosted checkout URL |
| `pack.search` | Search official SkillFlux catalog |
| `pack.info` | Return details for one skill |
| `skill.install` | Download and enable one skill |
| `skill.update` | Update one or all project skills |
| `skill.list` | List project/global enabled skills |
| `skill.remove` | Remove one enabled skill |
| `doctor` | Diagnose local bootstrap and project state |

Tool result shape:

```json
{
  "ok": true,
  "status": "active",
  "message": "Human-readable summary",
  "data": {}
}
```

Error shape:

```json
{
  "ok": false,
  "code": "AUTH_REQUIRED",
  "message": "Login required before installing SkillFlux skills.",
  "nextAction": {
    "tool": "auth.start"
  }
}
```

### 8.5 Registry API

Responsibilities:
- Serve `pack.json` metadata.
- Serve skill file payloads.
- Enforce entitlement.
- Support device login polling.
- Support hosted checkout and webhook handling.

Core endpoints:

| Endpoint | Method | Purpose |
|---|---|---|
| `/api/device/start` | POST | Create device login session |
| `/api/device/status` | POST | Poll device auth state |
| `/api/checkout` | POST | Create hosted checkout |
| `/api/pack` | GET | Return catalog metadata |
| `/api/skill/:id` | GET | Return authorized skill files |
| `/api/auth/callback` | GET | SSO callback |
| `/api/webhooks/payment` | POST | Payment entitlement webhook |

### 8.6 Official Skill Repository

The official repository contains curated skills only.

```
skills/
  <skill-id>/
    SKILL.md
    scripts/
    references/
pack.json
```

No user publishing in MVP.

---

## 9. Marketplace / Catalog Requirements

`pack.json` is the source of truth for catalog metadata.

```json
{
  "name": "skillflux/deluxe-pack",
  "packVersion": "1.0.0",
  "updatedAt": "2026-06-25",
  "agents": ["cursor", "claude-code", "codex"],
  "skills": [
    {
      "id": "prd-writer",
      "name": "PRD Writer",
      "description": "Write detailed product requirement documents",
      "category": "product",
      "version": "1.0.0",
      "origin": "original",
      "path": "skills/prd-writer",
      "tier": "deluxe",
      "sha256": "..."
    }
  ]
}
```

Requirements:
- `id` equals folder name and SKILL.md frontmatter `name`.
- `description` is optimized for agent triggering and marketplace search.
- `version` uses semver.
- `sha256` covers all files in the skill payload.
- `tier` controls entitlement access.
- Registry may expose metadata to unauthenticated users, but not paid file payloads.

---

## 10. Install / Update Semantics

### Install

Default install behavior:
- Prefer `scope: "project"`.
- Download payload from registry or fixture bundle.
- Validate every file path.
- Validate payload hash.
- Write into temporary directory.
- Atomically move into project `.skillflux/skills/<id>/`.
- Update `skillflux.json`.
- Update lockfile.

### Update

Update behavior:
- Compare lockfile version with registry version.
- If local files match lockfile hash, update automatically.
- If local files changed, return conflict and ask user to confirm overwrite.
- Update lockfile after successful write.

### Remove

Remove behavior:
- Only delete files tracked in lockfile.
- Remove empty skill directory if safe.
- Remove entry from `skillflux.json`.
- Preserve global auth config.

### Restore

Command (implemented):

```bash
skillflux restore
```

When run inside a project with `skillflux.json`, it installs all declared
project skills. For reproducibility it pins each skill to the version recorded
in the committed lockfile (`.skillflux/installed.json`) when present, falling
back to the latest catalog version otherwise. `skillflux install` also auto-runs
restore when it detects a `skillflux.json` in the current directory.

For reproducible clones, commit `skillflux.json` and `.skillflux/installed.json`
and git-ignore `.skillflux/skills/` (see Open Decision #3).

---

## 11. Auth / Payment / Entitlement

### Auth Model

No first-party password login in MVP.

Supported auth options:
- GitHub OAuth.
- Google OAuth.
- Email magic link.
- Hosted auth provider if faster.

Device flow:

1. MCP calls `auth.start`.
2. API returns `loginUrl`, `deviceSessionId`, `userCode`, `expiresAt`.
3. User opens browser and signs in.
4. API binds provider identity to device session.
5. MCP polls `auth.status`.
6. API returns `deviceToken`.
7. MCP stores token in `~/.skillflux/config.json`.

### Payment Model

**Pricing = subscription** (decided 2026-06-25, resolves Open Decision #6).
No custom payment form. Provider: **Stripe Checkout in `subscription` mode**.

Plans:
- `monthly` → `STRIPE_PRICE_MONTHLY`
- `annual` → `STRIPE_PRICE_ANNUAL`
- No free trial. (`free` tier skills are installable without paying; `lifetime`
  remains only as an internal/admin/fixture grant, not sold.)

Checkout flow:

1. MCP detects `needs_payment`.
2. Manager skill asks the user monthly vs annual, then calls
   `billing.checkout({ plan })`.
3. API creates a Stripe `subscription` checkout for the matching price and
   returns the hosted URL.
4. User subscribes in the browser.
5. Subscription lifecycle webhooks write/refresh entitlement.
6. MCP sees `active`.

Subscription lifecycle (webhook `/api/webhooks/payment/stripe`):
- `checkout.session.completed` — fast-path activation (insert-only, keyed by the
  Stripe subscription id).
- `customer.subscription.created` / `customer.subscription.updated` —
  authoritative: upsert entitlement with plan, status, and `expires_at =
  current_period_end`. Renewals roll `expires_at` forward automatically.
- `customer.subscription.deleted` — mark entitlement `canceled`.

The webhook is idempotent (keyed on subscription id) and verifies the Stripe
signature including timestamp freshness.

### Entitlement Model

Entitlement determines content access.

```sql
entitlements:
  user_id
  product
  plan
  status
  expires_at
```

Content endpoints check:
- device token valid
- user exists
- entitlement active
- skill tier covered by plan

---

## 12. AI System Requirements

### Agent Behavior

The agent should:
- Use `skillflux-manager` when user asks for SkillFlux skills.
- Prefer project scope.
- Explain login/payment links but never claim to complete payment for the user.
- Ask for confirmation before installing if multiple skills match.
- Report installed path and version.
- Use installed skill naturally on later tasks.

### Evaluation Strategy

P0 eval scenarios:

1. "Install SkillFlux" after running CLI.
2. "Find a PRD skill for this project."
3. "Install demo-skill."
4. "List installed SkillFlux skills."
5. "Remove demo-skill."

Pass criteria:
- Agent calls intended MCP tool sequence.
- No manual JSON editing needed.
- Project lockfile updates correctly.
- No global paid skill spam.

---

## 13. Security & Privacy

Requirements:
- Do not pass tokens in shell commands.
- Do not store OAuth client secret in npm package.
- Store device token only in `~/.skillflux/config.json`.
- Set config permissions to `0600` where possible.
- Store only token hash server-side.
- Validate all file paths; reject absolute paths and `..`.
- Verify sha256 before install/update.
- Use lockfile for remove.
- SSO and payment happen in browser, not inside MCP.
- API rate limit auth and skill download endpoints.

---

## 14. Non-Goals

MVP will not include:
- User-submitted marketplace.
- Skill publishing dashboard.
- Team/org workspaces.
- Remote code execution.
- Hosted agent sessions.
- GUI installer.
- Full docs RAG system.
- Complex dependency solver.
- Multiple registries.
- Automatic skill modification by end users.

---

## 15. Phased Rollout

### P0: Bootstrap Vertical Slice

Goal: Prove installation and local project skill enablement.

Deliverables:
- `skillflux` npm package.
- `skillflux install`.
- Stable MCP registration for one selected agent.
- `skillflux-manager` installed globally.
- Fixture `demo-skill`.
- Project-scope install writes `skillflux.json` and `.skillflux/installed.json`.

### P1: MCP Internal Contract

Goal: Make tools product-grade.

Deliverables:
- Structured tool responses.
- Tool error codes.
- Stable `skillflux mcp start`.
- `doctor`.
- Hash verification.
- Atomic writes.
- Project scope default.

### P2: Registry API

Goal: Serve real catalog and authorized skill payloads.

Deliverables:
- `/api/pack`.
- `/api/skill/:id`.
- pack validation script.
- 5-10 real curated skills.
- R2 or server bundle content storage.

### P3: Auth and Payment

Goal: Remove manual key issuing.

Deliverables:
- Device auth.
- Third-party SSO.
- Hosted checkout.
- Payment webhook.
- Entitlement checks.

### P4: Update and Multi-Agent Support

Goal: Make ongoing use reliable.

Deliverables:
- `skill.update`.
- Conflict detection.
- Cursor / Claude Code / Codex adapters.
- Restore from `skillflux.json`.
- Better install docs and diagnostics.

---

## 16. Current Implementation Review & Execution Guide

This section reflects the current repository state as of 2026-06-25. It is the practical build guide for moving SkillFlux from a working beta slice to a production-ready beta.

### 16.1 Current Completeness

Current local package state:
- `skillflux-pack/` already has CLI entrypoints, MCP server entrypoints, pack manifest, bundled skills, manager skill, pack validation, build output, and tests.
- `skillflux install --agent cursor --scope user` can register the MCP server, install the manager skill, write stable runtime files, and initialize local config.
- `skillflux restore --scope project` can read `skillflux.json`, install project skills into `.skillflux/skills/`, and write `.skillflux/installed.json`.
- `npm run typecheck`, `npm test`, `npm run validate:pack`, `npm run build`, and `npm pack --dry-run` pass for the local package.

Current platform/API state:
- Cloudflare Pages Functions include pack, skill payload, device auth, GitHub callback, checkout, Stripe webhook, entitlement, and catalog modules.
- The static build syncs pack data into `functions/_pack/catalog.json`.
- The API shape is mostly in place, but production hardening and real-provider verification are not complete.

Practical completeness estimate (after the 2026-06-25 hardening pass):
- P0 Bootstrap Vertical Slice: ~95% (MCP contract smoke test added).
- P1 MCP Internal Contract: ~90% (structured API errors, project-only scope, tested).
- P2 Registry API: 65-75% (paid payloads kept off the npm channel; R2 storage still pending).
- P3 Auth and Payment: 55-65% (entitlement expiry enforced, idempotent + subscription-capable webhook; real provider end-to-end still pending).
- P4 Update and Multi-Agent Support: 45-55% (reproducible lockfile-pinned restore; multi-agent verification still pending).

> 2026-06-25 hardening pass — completed and covered by tests:
> - Paid (deluxe) skill payloads are no longer shipped in the npm tarball;
>   `files` whitelists free skills only and `scripts/check-publish-safety.mjs`
>   blocks any regression at publish time.
> - Fixture mode is a free-tier sandbox on both client and server; it cannot
>   unlock deluxe content, and production cannot enable it (host-gated).
> - Entitlement expiry is enforced via a pure, unit-tested selector.
> - Billing is subscription-based (Stripe `subscription` mode, monthly + annual,
>   no trial). The webhook drives the full lifecycle (created/updated/deleted),
>   rolls `expires_at` from `current_period_end`, is idempotent (keyed on the
>   subscription id), and verifies signature timestamp freshness.
> - `skill.install` is project-scoped only; the misleading `user` scope was
>   removed from the MCP schema, manager skill, and CLI restore help.
> - MCP API errors survive non-JSON responses and carry code + next action.
> - `skill.restore` reproducibly pins to lockfile versions.

### 16.2 Next Work Order

Do the next work in this order. The order matters because later work depends on security and scope semantics being reliable.

#### Step 0: Keep Paid Content Out of the npm Package — Done (2026-06-25)

Goal: the public installer must never ship paid skill payloads. (This was the
highest-severity gap and was not in the original list.)

Done:
- `skillflux-pack/package.json` `files` whitelists only free skill directories
  (`skills/demo-skill`, `skills/user-story-writer`) plus `dist`, `bootstrap`,
  `pack.json`. Deluxe `SKILL.md` payloads stay out of the tarball but remain in
  `skillflux-pack/skills/` as the server-side registry source.
- `scripts/check-publish-safety.mjs` runs in `prepublishOnly` and fails the
  publish if any non-free skill is reachable by `files` (or if a broad pattern
  like `skills`/`skills/**` reappears).
- `pack.json` still lists deluxe **metadata** (allowed to be public per §9).

Verify: `npm run check:publish` and `npm pack --dry-run` (no deluxe SKILL.md).

#### Step 1: Production Safety Gate — Done (2026-06-25)

Goal: make sure a production deploy cannot accidentally grant paid access.

Done: `SKILLFLUX_FIXTURE_MODE` removed from `wrangler.toml` production vars;
`functions/lib/fixture.ts` `isFixtureEnabled(env, request)` requires both the
flag AND a non-production host, and is used by every fixture branch (auth token
shortcut, `resolveDeviceStatus`, checkout, `/api/checkout/fixture-complete`,
`/api/auth/callback/fixture`). Local fixture goes in git-ignored `.dev.vars`.

Files to review:
- `wrangler.toml`
- `functions/lib/auth.ts`
- `functions/api/auth/callback/fixture.ts`
- `functions/api/checkout/fixture-complete.ts`

Required changes:
- Remove `SKILLFLUX_FIXTURE_MODE = "1"` from production vars.
- Keep fixture mode only for local development or explicit preview environments.
- Gate fixture auth and fixture checkout by both env flag and non-production host or a dev-only secret.
- Add a short deployment note explaining how to enable fixture mode locally.

Acceptance criteria:
- Production config does not expose fixture auth.
- `fixture-dev-token` is never accepted unless the server is explicitly in fixture mode.
- `/api/auth/callback/fixture` and `/api/checkout/fixture-complete` cannot grant entitlement on `skillflux.cn`.
- Local fixture smoke test still works.

Suggested verification:

```bash
npm run typecheck
npm run build
```

#### Step 2: Decide and Fix Install Scope Semantics — Done (2026-06-25)

Goal: make the product promise match the MCP behavior.

Done: curated skills are project-scoped only. `scope` was removed from the
`skill.install` and `skill.restore` MCP input schemas; the lockfile always
records `scope: "project"`; the manager skill and CLI `restore` help no longer
imply user/global skill installs. user/global scope remains only for the
bootstrap (CLI/MCP config/manager skill).

Current mismatch:
- `skill.install` accepts `scope: "user" | "project"`.
- Actual skill files are always installed into project `.skillflux/skills/<id>/`.

Recommended beta decision:
- For paid/curated skills, support only project scope.
- Keep user/global scope only for SkillFlux bootstrap: CLI, MCP config, config file, manager skill.

Required changes:
- Remove `user` from `skill.install` schema, or reject it with a clear `UNSUPPORTED_SCOPE` error.
- Keep `skill.restore` project-only until true global skill install is intentionally designed.
- Update `skillflux-manager/SKILL.md` to say concrete skills are project-scoped by default and user/global scope is not part of beta skill install.
- Update CLI help text if it currently implies `restore --scope user` installs user skills.

Acceptance criteria:
- Agent cannot ask MCP to install paid skills globally by accident.
- Lockfile `scope` always matches where files were written.
- PRD, manager skill, MCP schema, and implementation all say the same thing.

Suggested verification:

```bash
cd skillflux-pack
npm run typecheck
npm test
node dist/bin/skillflux.js restore --scope project
```

#### Step 3: Fix Entitlement Expiry — Done (2026-06-25)

Goal: paid access should stop when a subscription entitlement expires.

Done: `getActiveEntitlement` now fetches active rows and applies a pure,
unit-tested `pickActiveEntitlement(rows, now)` selector that excludes expired
entitlements and prefers lifetime, then newest. `expiresAtForPlan` computes
monthly/annual expiry; the Stripe webhook records plan + `expires_at` so
subscriptions are representable. Covered by `tests/functions-entitlement.test.ts`
(lifetime active, subscription active before expiry, expired downgraded,
lifetime preferred).

Files to review:
- `functions/lib/entitlements-db.ts`
- `functions/lib/entitlement.ts`
- payment webhook module

Required changes:
- Update `getActiveEntitlement` to require `expires_at IS NULL OR expires_at > now`.
- Prefer the newest non-expired active entitlement.
- Add at least one test or local fixture case for expired monthly/annual entitlement.

Acceptance criteria:
- Lifetime entitlement remains active with `expires_at = null`.
- Monthly/annual entitlement is active only before `expires_at`.
- Expired entitlement downgrades user to free tiers.
- `/api/skill/:id` rejects deluxe payloads for expired users.

Suggested verification:

```bash
npm run typecheck
npm run build
```

#### Step 4: Harden MCP Error Handling — Done (2026-06-25)

Goal: make agent-facing failures explainable.

Done: `api-client.ts` reads the response body as text first and tolerates
non-JSON (e.g. a Cloudflare HTML error page) without a raw parse crash. Failures
throw a `SkillFluxError` that maps HTTP status / backend code to a tool error
code (`AUTH_REQUIRED`, `PAYMENT_REQUIRED`, `NOT_FOUND`, …), preserves a short
body excerpt, and carries a `nextAction`. Network failures report the endpoint
without leaking tokens.

Files to review:
- `skillflux-pack/src/mcp/api-client.ts`
- `skillflux-pack/src/mcp/tool-response.ts`
- `skillflux-pack/src/mcp/server.ts`

Required changes:
- Read API response body safely even when it is not JSON.
- Preserve status code, endpoint, and a short body excerpt in errors.
- Keep user-facing message short, but include enough detail for `doctor`.

Acceptance criteria:
- A Cloudflare HTML error page does not crash as a JSON parse error.
- Agent sees a structured error with code and next action.
- `doctor` can report auth/API/config problems without exposing tokens.

Suggested verification:

```bash
cd skillflux-pack
npm run typecheck
npm test
```

#### Step 5: Add One Real MCP Smoke Test — Done (2026-06-25)

Goal: test the actual MCP server contract, not only service functions.

Done: `skillflux-pack/tests/mcp-smoke.test.ts` drives the same server handlers
used by stdio via an in-memory MCP client/server pair, in a temp project dir and
fixture mode: `tools/list`, `auth.status`, `pack.search`, `skill.install`
(demo-skill), `skill.list`, and a negative case asserting deluxe installs are
refused with `PAYMENT_REQUIRED`. It asserts `.skillflux/installed.json` and the
installed `SKILL.md` exist, and never touches the developer's real agent config.

Required scenario:
- Start `skillflux mcp start` in fixture mode.
- Send `tools/list`.
- Call `auth.status`.
- Call `pack.search`.
- Call `skill.install` for `demo-skill`.
- Call `skill.list`.
- Assert `.skillflux/installed.json` and installed files exist.

Acceptance criteria:
- The test talks through MCP JSON-RPC/stdin/stdout or the same server handler used by stdio.
- It runs in temp `HOME` and temp project directory.
- It never touches the developer's real agent config.

### 16.3 Beta Release Gate

SkillFlux is ready for a private beta only when all of these are true:

- [x] Paid skill payloads are never shipped in the npm package (guard enforced).
- [x] Production fixture mode is off and cannot grant paid access (host-gated).
- [x] Project-scope skill install is the only supported concrete skill install path.
- [x] Entitlement expiry is enforced.
- [x] `skill.restore` reproduces from the lockfile; `skill.install`/`list`/`remove`/`update` and the MCP contract are covered by smoke tests.
- [ ] Cursor install path is verified on a clean temp environment (CLI smoke test still pending).
- [ ] The website CTA points to one supported beta command and labels other agents as experimental.
- [ ] Stripe subscription tested end-to-end in sandbox (subscription mode + lifecycle webhook are implemented and unit-tested; live sandbox run with real monthly/annual Price ids still pending).
- [ ] Real SSO provider is tested end-to-end with at least one fresh account.

Remaining before private beta: create the monthly + annual Stripe Prices and run
a live sandbox subscribe/renew/cancel cycle; a CLI-level smoke test of
`skillflux install`/`doctor` in a temp HOME (the MCP-level contract is already
covered); a live SSO run; and the website CTA copy.

### 16.4 What Not To Build Yet

Do not build these before private beta:
- Custom password login.
- User-submitted skill publishing.
- Multi-vendor registry support.
- Team/org billing.
- GUI installer.
- Remote execution environment.
- Complex dependency solver between skills.

The beta should stay narrow: one official curated catalog, one reliable install path, one supported agent, project-scoped skills, browser-based SSO/payment, and strong local state tracking.

---

## 17. Risks

### MCP Config Stability

Risk: installer writes a temporary path from `npx` cache.

Mitigation: register a stable command such as `skillflux mcp start` or install/copy runtime into `~/.skillflux/runtime`.

### Agent Skill Path Differences

Risk: each agent has different skill/rules support.

Mitigation: start with one verified agent; keep adapters isolated; label unverified agents as experimental.

### Context Pollution

Risk: too many global skills reduce agent quality.

Mitigation: global install only manager skill; paid skills default to project scope.

### Paid Content Leakage

Risk: paid skill payload accidentally shipped through a public channel. Two
channels matter, not just the static site:
1. The Astro static assets on skillflux.cn.
2. **The public npm package** — `files` whitelisting the whole `skills/` tree
   would ship deluxe `SKILL.md` payloads to anyone who runs `npm pack skillflux`.

Mitigation:
- Keep paid payloads out of static assets (server-side `functions/_pack/` only).
- npm `files` whitelists individual **free** skill directories only; deluxe
  payloads are never bundled. Enforced by `scripts/check-publish-safety.mjs`
  in `prepublishOnly`, which fails the publish if any non-free skill would be
  included.
- Fixture mode is treated as a free-tier sandbox: it can install free skills
  offline but refuses deluxe payloads (which only the authorized registry
  serves after an entitlement check).

### Local File Overwrite

Risk: update overwrites user-edited skill files.

Mitigation: lockfile hash check and conflict status.

---

## 18. Open Decisions

1. P0 首发 agent：Cursor、Claude Code、Codex 选一个作为唯一承诺目标。
2. Project skill 目录：统一用 `<project>/.skillflux/skills/`，还是同步到各 agent 原生 project skills 目录？
3. `skillflux.json` 是否提交到 git：建议提交；`.skillflux/skills` 是否 gitignore：建议默认 gitignore。
4. Auth provider：GitHub OAuth、Google OAuth、邮箱 magic link，还是托管 auth。
5. Payment provider：~~Stripe、Lemon Squeezy、Polar~~ → **已定：Stripe**（subscription 模式）。
6. Pricing：~~一次买断、年度订阅、还是买断 + 维护订阅~~ → **已定：订阅制，提供 monthly + annual 两档，无试用**。
7. Free demo：未购买用户能否安装 1 个 demo/free skill。（当前 free tier skills 已可免费安装。）

---

## 19. Final Positioning

SkillFlux 的核心不是“把一堆 SKILL.md 打包卖掉”，而是：

> 让用户在自己的 agent 和项目里，像使用包管理器一样使用精选 skills。

最终产品形态：

```text
SkillFlux Website
  -> explains curated marketplace
  -> provides npm install command

skillflux npm package
  -> installs MCP + manager skill

skillflux-manager
  -> guides agent workflow

skillflux-mcp
  -> searches, installs, updates, removes official skills

SkillFlux Registry
  -> serves curated, authorized, versioned skill payloads

Project state
  -> skillflux.json records what this project uses
```

用户价值：

- 不用自己寻找 skill。
- 不用手动维护 skill。
- 不用研究不同 agent 的安装格式。
- 不用把所有 skill 全局塞满。
- 每个项目只启用需要的能力。
- 官方持续更新，用户按需升级。
