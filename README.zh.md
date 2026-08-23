# @7dgroup/dsh-skill-7d-viewer

为关键助手回复打书签并一键跳回 —— 一个聚焦、纯浏览器侧的 DSH 插件。按会话隔离、
中英双语、零原生依赖。

[English](./README.md)

## 功能

- **收藏回复** —— 每条已定稿的助手回复里都有一个书签丝带开关，点击即可固定到本会话书签列表。
- **一键跳回** —— 点击书签，会话滚动到对应消息。
- **备注** —— 可为任意书签附加简短备注。
- **会话隔离** —— 书签按会话存储，刷新页面不丢失（`localStorage`，尽力而为）。
- **多语言** —— 界面文案跟随 DSH 语言（zh / en）实时切换。
- **零原生依赖** —— 无 node-pty、无文件/终端/Git 面；宿主半为空操作，安装零摩擦。

## 安装

```sh
dsh plugin --profile web add @7dgroup/dsh-skill-7d-viewer@latest
```

然后硬刷新浏览器（Cmd/Ctrl+Shift+R）。

## 使用

1. 悬停助手回复，点击书签丝带图标收藏。
2. 点击会话头部的书签列表按钮（带计数的列表图标）打开面板。
3. 在面板里跳转消息、复制摘要、编辑备注或删除。

## 架构

标准的双半结构 DSH 插件：

- **宿主半**（`src/index.ts`）—— 有意为空操作，仅用于让插件挂载进 profile 的 cordis
  树，并让 client 半被正确发现。
- **客户端半**（`src/client/index.ts`）—— 注册中英文字典，并贡献两个插槽：
  - `conversation.chat.assistant-actions` —— 每条消息的书签开关，
  - `conversation.session.header.actions` —— 头部列表/面板。
- **存储**（`src/client/store.ts`）—— 每会话一个可观察控制器（`getSnapshot`/`subscribe`），
  持久化到 `localStorage`；插槽框架将其绑定为 `useBookmarks` 选择器 hook。

一次构建产出两个安装通道：

| 通道 | 清单 | client bundle id |
|---|---|---|
| 官方（`dsh plugin add`） | `cordis.patch.yml` | `@7dgroup/dsh-skill-7d-viewer` |
| 插件市场 registry | `dsh.plugin.json` | `7dgroup/dsh-skill-7d-viewer` |

## 开发

```sh
pnpm install
pnpm typecheck
pnpm test
pnpm build
```

`build` 产出 `lib/index.js`（宿主）、`lib/client.js` 与 `lib/client-registry.js`
（client bundles）、以及 `lib/types/`（类型声明）。

## 安全与限制

- **无宿主攻击面** —— 插件不触碰文件系统、网络或 shell；所有能力都停留在浏览器 UI 层。
- **`localStorage` 持久化** —— 书签保存在浏览器内，不跨设备同步；存储被禁用时（如隐私模式）
  自动降级为内存态。
- **跳回范围** —— 书签只能滚动到仍在当前会话窗口内的消息；已滚出窗口的消息没有锚点。

## 许可证

MIT
