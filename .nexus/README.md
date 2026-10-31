# .nexus

构建参考目录。

正式构建完全由 `.github/workflows/build.yml` 内联的配置完成，不读取这里或仓库里的
`worker/wrangler.toml`。这个目录只用来放给人看的构建说明 / 版本约束，不参与线上产物。

- Node：20（workflow 固定）
- pnpm：8.15.1（workflow 固定）
- wrangler：4.65.0（workflow 固定）
- Worker 入口：`worker/src/index.ts`
- 静态资源：`worker/public/`
- 产物：`index.js` + `public/**` + `manifest.json`
