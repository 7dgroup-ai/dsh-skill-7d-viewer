# 测试报告 — @7dgroup/dsh-skill-7d-viewer v0.1.0（右侧栏查看器）

## 测试环境

| 项 | 值 |
|---|---|
| Node | v26.7.0 |
| pnpm | 11.7.0 |
| DSH | 本地 checkout（source）+ 真实运行实例 `http://127.0.0.1:3080` |
| 浏览器 | Playwright Chromium（`@playwright/test` 1.58.2） |

## 结果总览


| 测试项 | 结果 |
|---|---|
| 单元测试（vitest） | ✅ **19/19 通过** |
| 类型检查（tsc，strict） | ✅ 通过 |
| 构建（tsc + tsdown） | ✅ 通过 |

## 1. 单元测试（19 项）

- **`tests/openpath.spec.ts`（4 项）**：`wrapOpenPath` 拦截重定向 / 关闭回退 / 无当前会话回退 / 卸载恢复。
- **`tests/host.spec.ts`（5 项）**：`mediaTypeForPath`、`isWithin` 根目录/越界/兄弟前缀。
- **`tests/file-types.spec.ts`（4 项）**：`isImagePath`、`isMarkdownPath` 大小写不敏感与反例。
- **`tests/produced-files.spec.ts`（6 项）**：`producedPaths` 编辑意图/畸形数据、`producedFilesByTurn` 去重按轮次/跳过失败、
  `isAbsolutePath`、`resolveViewerPath`。

## 2. 构建产物

| 文件 | 说明 |
|---|---|
| `lib/index.js` | host 半（read/media/write 路由，12.01 kB） |
| `lib/client.js` | 官方通道 client bundle（29.57 kB） |
| `lib/client-registry.js` | registry 通道 client bundle（29.57 kB） |
| `lib/types/**/*.d.ts` | 类型声明 |

## 测试边界说明

- 侧边栏的「文件列表/打开/编辑」依赖真实会话里有生成文件 + 会话 cwd 就绪；keyless 冒烟环境无这些数据，
  因此列表推导、路径解析、拦截、读写逻辑由单元测试覆盖（19 项），构建/类型检查验证整体可编译、可挂载。
