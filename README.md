# nexus-game-template

Nexus Playground 的官方游戏模板。通过 publisher 的 `register_game` 建仓时，GitHub 会从这个仓库生成新游戏仓库，并由 publisher 写入真实的 `nexus.game.json`。

## 目录结构

```text
.
├── .github/workflows/build.yml   # 固定 workflow，由平台维护，作者不要修改
├── logic/index.ts                # 游戏逻辑（纯函数，GameLogic 接口）
├── ui/                           # React UI（iframe 内运行）
│   ├── ui.tsx                    # 游戏界面
│   ├── ui.module.css
│   ├── iframe-entry.tsx          # 与平台通信的外壳
│   └── types.d.ts
├── worker/
│   ├── src/index.ts              # 平台 HTTP 契约，自动包装 logic
│   ├── public/game-ui.html       # iframe 承载页
│   ├── public/cover.png          # 游戏封面（占位图，16:9，1280×720）
│   └── wrangler.toml             # 仅本地开发用；线上构建不读它
├── nexus.game.json               # 游戏元数据，注册时由 publisher 写入
├── package.json
├── pnpm-workspace.yaml
├── tsup.config.ts                # 逻辑构建配置
└── vite.config.ui.ts             # UI 构建配置
```

## 本地开发

```bash
pnpm install
pnpm build          # 逻辑 → dist/logic.mjs，UI → worker/public/_ui.js + style.css
pnpm dev            # wrangler dev -c worker/wrangler.toml
pnpm typecheck
```

## 构建与部署

推送到 `main` 会触发 `.github/workflows/build.yml`：

1. `pnpm install --frozen-lockfile` → `pnpm build`
2. 用 workflow 内联的 wrangler 配置打包 Worker
3. 生成 `manifest.json`，连同 `index.js`、`public/**` 一起上传给 publisher
4. publisher 校验 GitHub OIDC token 后部署到 Cloudflare

这个 workflow 是固定的：租户的 git token 只有 `contents: write`，GitHub 会直接拒绝任何 `.github/workflows/**` 的改动。不要修改它；需要平台调整时由平台侧更新模板并同步到已有仓库。

## 封面

`worker/public/cover.png` 是游戏列表里展示的封面，仓库自带一张 1280×720 的占位图，请替换成自己的美术。

- 文件名固定为 `cover.png` / `cover.jpg` / `cover.jpeg` / `cover.webp` / `cover.svg` / `cover.gif`（多个同时存在时按这个顺序取第一个）。
- 比例必须 **16:9**（推荐 1280×720 或 1920×1080），publisher 允许 ±2% 偏差；比例不对会让整次部署失败。
- 大小上限 5MB。
- 不想要封面就删掉这个文件；部署后会从游戏记录里清空。

## 规则

- `logic/` 必须是纯函数：不做 I/O、不读当前时间、不读随机数。
- 隐藏信息只存在于 `GameState`，通过 `toRolePerspective` 决定每个角色能看到什么。
- Worker 不读仓库里的 `worker/wrangler.toml`；`name`、assets、compatibility 都由 publisher 决定。
- `nexus.game.json` 的 `id` / `name` / `repo` 由 publisher 写入，不要手改；本地构建用的是占位值。
