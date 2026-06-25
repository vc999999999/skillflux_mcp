# SkillFlux MCP

SkillFlux 官方 curated skill 市场的 **CLI + MCP server + Registry API** 独立仓库。

与 [SkillFlux 引流站](https://github.com/vc999999999/Skillflux_Cloudflare) 分离，本仓库只包含：

- `skillflux-pack/` — npm 安装器与 MCP 工具
- `functions/` — Cloudflare Pages Functions Registry API
- `migrations/` — D1 数据库 schema
- `public/device/` — 浏览器设备授权页

## 快速开始

```bash
# 安装依赖并构建 CLI/MCP
cd skillflux-pack && npm install && npm run build && cd ..

# 同步 catalog 到 functions
npm run sync:pack

# 本地 API（含 device 页）
npm install
npm run pages:dev
```

## 目录

```
skillflux_mcp/
├── skillflux-pack/     # npx skillflux install / skillflux mcp start
├── functions/          # /api/pack, /api/skill/:id, device auth, checkout
├── migrations/         # D1
├── public/device/      # 设备授权静态页
└── docs/specs/         # 设计文档
```

详细设计见 [docs/specs/skillflux-pack-design.md](./docs/specs/skillflux-pack-design.md)。
