# @7dgroup/dsh-skill-7d-viewer

DSH 的**右侧栏查看器**：列出每一轮生成的文件，并可就地预览或编辑——而不是跳系统应用。

[English](./README.md)

## 功能

- **按轮次文件列表** —— 侧边栏列出整个对话中生成的所有文件，按轮次分组。
- **拦截文件点击** —— 对话里的文件引用在侧边栏打开，不再跳系统应用。
- **Markdown 源码/预览** —— `.md` 文件可在「可编辑源码」和「渲染预览」间切换。
- **代码编辑 + 保存** —— 文本/代码文件在可编辑区打开，带保存按钮（宿主半原子写入）。
- **图片预览** —— PNG / JPG / GIF / WebP / SVG / BMP / ICO / AVIF 内联。
- **二进制识别** —— 非图片二进制文件显示「无法预览」。
- **多语言** —— 文案跟随 DSH 语言（zh / en）。

## 安装

```sh
dsh plugin --profile web add @7dgroup/dsh-skill-7d-viewer@latest
```

然后硬刷新浏览器（Cmd/Ctrl+Shift+R）。

## 使用

- 右边缘有一个**开关条**，点击展开/收起侧边栏。
- 侧边栏显示**按轮次分组的生成文件**，点一个即可打开。
- **Markdown**：用「源码 / 预览」按钮切换。
- **代码/文本**：直接编辑，然后点**保存**。
- 点击对话回复里的文件名，也会在侧边栏打开。

## 架构

- **宿主半**（`src/index.ts`）—— 带信任墙的路由：`/viewer/read`（文本 JSON + 二进制探测）、
  `/viewer/media`（图片字节）、`/viewer/write`（保存编辑）。每条路由都过 /api 信任墙并把路径限制在会话 cwd 内。
- **客户端半**（`src/client/index.ts`）—— 包装 `ctx.workspaces.openPath`、订阅会话快照推导生成文件、
  挂载右侧栏。

| 通道 | 清单 | client bundle id |
|---|---|---|
| 官方（`dsh plugin add`） | `cordis.patch.yml` | `@7dgroup/dsh-skill-7d-viewer` |
| 插件市场 registry | `dsh.plugin.json` | `7dgroup/dsh-skill-7d-viewer` |

## 开发

```sh
pnpm install
pnpm typecheck
pnpm test          # vitest 单元测试
pnpm test:smoke    # 对运行中的 DSH（http://127.0.0.1:3080）做挂载冒烟
pnpm test:e2e      # 隔离的 scratch dsh web + Playwright
pnpm build
```

## 安全与限制

- 读写都被限制在会话 cwd 内，且有大小上限（`readLimit` 512 KB、`mediaLimit` 20 MB、`writeLimit` 5 MB 默认）。
- 写入是原子操作（临时文件 + rename）。
- PDF 按二进制返回，不做内联渲染。

## 许可证

MIT
