---
name: skillflux-manager
description: 当用户想搜索、安装、更新或管理 SkillFlux 精选 skill 市场内容时触发；通过 SkillFlux MCP 工具完成登录、支付检查、按项目启用 skills。
---

# SkillFlux Manager

当用户要求查找或管理 SkillFlux skills 时：

1. 调用 `auth.status` 检查当前设备授权状态。
2. 如果返回 `unauthenticated`，调用 `auth.start`，把登录链接交给用户。
3. 用户完成浏览器登录后，再调用 `auth.status`。
4. 如果返回 `needs_payment`：SkillFlux 是**订阅制**，先问用户要 **monthly 还是 annual**，再用对应 `plan` 调用 `billing.checkout`，把支付链接交给用户。此状态下仍可安装 **free tier** skills；deluxe 需订阅生效后再 `auth.status`。订阅到期或取消后 deluxe 访问会自动失效。
5. 如果返回 `active` 或 `needs_payment`（仅 free skills），根据用户意图调用 `pack.search`、`pack.info`、`skill.install`、`skill.update`、`skill.list`、`skill.remove`、`skill.restore` 或 `doctor`。
6. 精选 skill **始终安装到当前项目**的 `.skillflux/skills/`（project scope）。没有"全局安装 skill"这一说；`skill.install` 不接受 scope 参数。user/global 概念只用于 SkillFlux 自身的 bootstrap（CLI、MCP 配置、manager skill）。
7. 安装或更新完成后，总结本项目已启用的 skills（`skillflux.json` + lockfile），并提示用户刷新 agent 会话。
8. 克隆已有项目或存在 `skillflux.json` 时，优先调用 `skill.restore`（或 CLI `skillflux restore`）恢复声明的 skills；会按 lockfile（`installed.json`）锁定的版本可复现地恢复。

## 核心原则

- 全局只保留 SkillFlux 管理能力（CLI、MCP、manager skill）。
- 具体业务 skills 按项目启用，避免污染全局 agent。
- 多个匹配结果时，先展示 `pack.search` 结果并请用户确认再安装。
- 不要替用户在 agent 内完成登录或支付；只提供浏览器链接。
- 不要保存 token，不要直接拼 API 请求；所有操作通过 MCP 工具完成。

## P0 Fixture 模式

未设置 `SKILLFLUX_API_URL` 时（本地沙盒）：

- `auth.status` 返回 `active`
- **仅能安装 free tier skills**（如 bundled `demo-skill`）验证链路
- deluxe skills 不在 npm 包内、也不会被 fixture 解锁；需设置 `SKILLFLUX_API_URL` 接入正式 registry 并完成购买后才能安装

安装命令：`npx -y skillflux install`
